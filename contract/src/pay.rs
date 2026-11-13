//! Paying a supplier. One signature from a member key: the contract checks the key's policy,
//! reserves the amount against its day, and moves the USDC in the same transaction.

use near_sdk::json_types::{U64, U128};
use near_sdk::serde_json::json;
use near_sdk::{
    env, log, near, require, AccountId, Gas, NearToken, Promise, PromiseError, PublicKey,
};

use crate::{fmt_usdc, Contract, ContractExt, Entry, Role, Status, NANOS_PER_DAY};

/// What a NEP-145 token asks for to register an account. Refunded if already registered.
const STORAGE_DEPOSIT: NearToken = NearToken::from_yoctonear(1_250_000_000_000_000_000_000);
/// `ft_transfer` demands exactly one yoctoNEAR. The member's transaction carries none; the
/// company account attaches it here.
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const STORAGE_GAS: Gas = Gas::from_tgas(5);
const TRANSFER_GAS: Gas = Gas::from_tgas(10);
const PAID_CALLBACK_GAS: Gas = Gas::from_tgas(10);

#[near]
impl Contract {
    /// Pay `amount` (USDC's smallest unit) to `to`, with a memo that is paid at most once.
    /// Called with a member key. Every refusal says why.
    pub fn pay(&mut self, to: AccountId, amount: U128, memo: String) -> Promise {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "pay must be called with a key on the company account"
        );
        let key = env::signer_account_pk();
        let mut member = self
            .members
            .get(&key)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown key: the company never issued it"));
        require!(member.role == Role::Member, "owner keys cannot pay");
        let policy = member
            .policy
            .clone()
            .unwrap_or_else(|| env::panic_str("this key has no policy"));

        let now = env::block_timestamp();
        if let Some(expires_at) = policy.expires_at {
            require!(
                now < expires_at.0,
                format!("this key expired at unix second {}", expires_at.0 / 1_000_000_000)
            );
        }
        require!(
            policy.suppliers.contains(&to),
            format!("{to} is not an allowed supplier for this key")
        );
        require!(amount.0 > 0, "the amount must be above zero");
        require!(
            amount.0 <= policy.per_payment.0,
            format!(
                "over the per-payment limit: {} is more than {}",
                fmt_usdc(amount.0),
                fmt_usdc(policy.per_payment.0)
            )
        );
        let today = now / NANOS_PER_DAY;
        let spent = if member.spent_day == today { member.spent_today.0 } else { 0 };
        require!(
            spent + amount.0 <= policy.per_day.0,
            format!(
                "over the daily limit: {} already spent today, {} more would pass {}",
                fmt_usdc(spent),
                fmt_usdc(amount.0),
                fmt_usdc(policy.per_day.0)
            )
        );
        require!(!memo.trim().is_empty(), "a payment needs a memo");
        require!(!self.memos.contains(&memo), format!("memo {memo} was already paid"));

        // Reserve before anything leaves, so a second call in the same block sees it.
        member.spent_day = today;
        member.spent_today = U128(spent + amount.0);
        self.members.insert(key.clone(), member.clone());
        self.memos.insert(memo.clone());
        let id = self.ledger.len() as u64;
        self.ledger.push(Entry {
            id,
            key: key.clone(),
            member: member.name,
            to: to.clone(),
            amount,
            memo: memo.clone(),
            status: Status::Pending,
            at: U64(now),
        });

        let register = Promise::new(self.usdc.clone()).function_call(
            "storage_deposit",
            json!({ "account_id": to, "registration_only": true })
                .to_string()
                .into_bytes(),
            STORAGE_DEPOSIT,
            STORAGE_GAS,
        );
        let transfer = Promise::new(self.usdc.clone()).function_call(
            "ft_transfer",
            json!({ "receiver_id": to, "amount": amount, "memo": memo })
                .to_string()
                .into_bytes(),
            ONE_YOCTO,
            TRANSFER_GAS,
        );
        register.then(transfer).then(
            Self::ext(env::current_account_id())
                .with_static_gas(PAID_CALLBACK_GAS)
                .on_paid(id, key, amount),
        )
    }

    /// Runs after the transfer. Success is recorded; failure refunds the reservation and
    /// frees the memo, so the key can try again.
    #[private]
    pub fn on_paid(
        &mut self,
        id: u64,
        key: PublicKey,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> Status {
        let mut entry = self
            .ledger
            .get(id as u32)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown ledger entry"));
        let status = if result.is_ok() { Status::Paid } else { Status::Failed };
        if status == Status::Failed {
            if let Some(mut member) = self.members.get(&key).cloned() {
                member.spent_today = U128(member.spent_today.0.saturating_sub(amount.0));
                self.members.insert(key.clone(), member);
            }
            self.memos.remove(&entry.memo);
        }
        entry.status = status.clone();
        self.ledger.replace(id as u32, entry.clone());
        log!(
            "EVENT_JSON:{}",
            json!({
                "standard": "settle_keys",
                "version": "1.0.0",
                "event": if status == Status::Paid { "pay" } else { "pay_failed" },
                "data": [{
                    "id": id, "key": key, "member": entry.member, "to": entry.to,
                    "amount": amount, "memo": entry.memo
                }]
            })
        );
        status
    }
}
