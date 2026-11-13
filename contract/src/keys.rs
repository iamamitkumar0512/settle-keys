//! Issuing and removing keys. The company account adds and deletes its own access keys
//! from inside the contract, so the owner's daily key never needs full access.

use near_sdk::json_types::{U64, U128};
use near_sdk::{env, near, require, Allowance, Gas, NearToken, Promise, PromiseError, PublicKey};

use crate::{Contract, ContractExt, Member, Policy, Role};

/// NEAR a new key may spend on gas before it has to be re-issued.
const KEY_ALLOWANCE: NearToken = NearToken::from_millinear(500);
/// Gas for the callback that records whether the key was added.
const KEY_CALLBACK_GAS: Gas = Gas::from_tgas(5);
/// What an owner key may call. It cannot pay.
const OWNER_METHODS: &str = "add_owner,add_member,remove_member";
/// What a member key may call. Nothing else.
const MEMBER_METHODS: &str = "pay";

#[near]
impl Contract {
    /// Issue an owner key. It can add and remove members. It cannot pay.
    pub fn add_owner(&mut self, key: PublicKey, name: String) -> Promise {
        self.require_owner();
        self.insert_member(key.clone(), name, Role::Owner, None);
        self.add_key(key, OWNER_METHODS)
    }

    /// Issue a member key with a policy. The chain lets it call only `pay`; the contract lets
    /// it pay only within the policy.
    pub fn add_member(&mut self, key: PublicKey, name: String, policy: Policy) -> Promise {
        self.require_owner();
        require!(!policy.suppliers.is_empty(), "a member key needs at least one supplier");
        require!(policy.per_payment.0 > 0, "the per-payment limit must be above zero");
        require!(
            policy.per_day.0 >= policy.per_payment.0,
            "the daily limit cannot be below the per-payment limit"
        );
        self.insert_member(key.clone(), name, Role::Member, Some(policy));
        self.add_key(key, MEMBER_METHODS)
    }

    /// Remove a key. The company account deletes it, and its holder can never pay again.
    pub fn remove_member(&mut self, key: PublicKey) -> Promise {
        self.require_owner();
        let member = self
            .members
            .get(&key)
            .unwrap_or_else(|| env::panic_str("unknown key: the company never issued it"));
        require!(!member.root, "the deploy key cannot be removed from here");
        self.members.remove(&key);
        Promise::new(env::current_account_id()).delete_key(key)
    }

    /// Runs after the chain tried to add the key. If it refused, the record goes too.
    #[private]
    pub fn on_key_added(
        &mut self,
        key: PublicKey,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        if result.is_err() {
            self.members.remove(&key);
            return false;
        }
        true
    }

    /// The caller must be a key on this account, and that key must be an owner.
    pub(crate) fn require_owner(&self) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "call this with a key on the company account"
        );
        match self.members.get(&env::signer_account_pk()) {
            Some(m) if m.role == Role::Owner => {}
            Some(_) => env::panic_str("only an owner key can add or remove members"),
            None => env::panic_str("unknown key: the company never issued it"),
        }
    }

    fn insert_member(&mut self, key: PublicKey, name: String, role: Role, policy: Option<Policy>) {
        require!(self.members.get(&key).is_none(), "this key was already issued");
        require!(!name.trim().is_empty(), "a member needs a name");
        self.members.insert(
            key,
            Member {
                name,
                role,
                root: false,
                policy,
                spent_day: 0,
                spent_today: U128(0),
                added_at: U64(env::block_timestamp()),
            },
        );
    }

    fn add_key(&self, key: PublicKey, methods: &str) -> Promise {
        let allowance = Allowance::limited(KEY_ALLOWANCE).expect("the allowance is above zero");
        Promise::new(env::current_account_id())
            .add_access_key_allowance(key.clone(), allowance, env::current_account_id(), methods)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(KEY_CALLBACK_GAS)
                    .on_key_added(key),
            )
    }
}
