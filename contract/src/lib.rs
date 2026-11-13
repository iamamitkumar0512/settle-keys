//! Settle Keys: a business account on NEAR where every person gets a key with a limit.
//!
//! The contract is deployed on the company account. It holds the company's USDC and
//! manages the access keys of its members. Every member signs for the company account,
//! so a member is identified by the key that signed, not by an account.

mod keys;
mod pay;
mod types;

use near_sdk::json_types::{U64, U128};
use near_sdk::store::{IterableMap, LookupSet, Vector};
use near_sdk::{env, near, AccountId, BorshStorageKey, PanicOnDefault, PublicKey};

pub use types::*;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Members,
    Memos,
    Ledger,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// The NEP-141 token the company pays with.
    usdc: AccountId,
    /// Every key the company has issued, by the key itself.
    members: IterableMap<PublicKey, Member>,
    /// Memos already paid or in flight. A memo is paid once, company-wide.
    memos: LookupSet<String>,
    /// Every payment, in order.
    ledger: Vector<Entry>,
}

#[near]
impl Contract {
    /// Deploy with the token the company pays in. The key that signs the deployment becomes
    /// the root owner: it can add and remove members and cannot be removed from here.
    #[init]
    pub fn new(usdc: AccountId) -> Self {
        let mut members = IterableMap::new(StorageKey::Members);
        members.insert(
            env::signer_account_pk(),
            Member {
                name: "Deploy key".to_string(),
                role: Role::Owner,
                root: true,
                policy: None,
                spent_day: 0,
                spent_today: U128(0),
                added_at: U64(env::block_timestamp()),
            },
        );
        Self {
            usdc,
            members,
            memos: LookupSet::new(StorageKey::Memos),
            ledger: Vector::new(StorageKey::Ledger),
        }
    }

    /// The token this company pays with.
    pub fn get_usdc(&self) -> AccountId {
        self.usdc.clone()
    }

    /// Every key the company has issued.
    pub fn get_members(&self) -> Vec<MemberView> {
        let today = Self::today();
        self.members
            .iter()
            .map(|(key, m)| Self::view_of(key, m, today))
            .collect()
    }

    /// One key, or nothing if the company never issued it.
    pub fn get_member(&self, key: PublicKey) -> Option<MemberView> {
        let today = Self::today();
        self.members.get(&key).map(|m| Self::view_of(&key, m, today))
    }

    /// What a key has paid today, zero if the company never issued it.
    pub fn spent_today(&self, key: PublicKey) -> U128 {
        let today = Self::today();
        match self.members.get(&key) {
            Some(m) if m.spent_day == today => m.spent_today,
            _ => U128(0),
        }
    }

    /// Ledger lines from `from`, at most `limit`, oldest first.
    pub fn get_ledger(&self, from: Option<u64>, limit: Option<u64>) -> Vec<Entry> {
        let from = from.unwrap_or(0) as u32;
        let limit = limit.unwrap_or(50) as u32;
        self.ledger.iter().skip(from as usize).take(limit as usize).cloned().collect()
    }

    /// How many ledger lines exist.
    pub fn ledger_len(&self) -> u64 {
        self.ledger.len() as u64
    }

    fn today() -> u64 {
        env::block_timestamp() / NANOS_PER_DAY
    }

    fn view_of(key: &PublicKey, m: &Member, today: u64) -> MemberView {
        MemberView {
            key: key.clone(),
            name: m.name.clone(),
            role: m.role.clone(),
            root: m.root,
            policy: m.policy.clone(),
            spent_today: if m.spent_day == today { m.spent_today } else { U128(0) },
            added_at: m.added_at,
        }
    }
}
