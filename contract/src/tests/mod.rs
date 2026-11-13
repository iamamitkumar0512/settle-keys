//! Unit tests. Every refusal the contract can give has a test that reads its message.

mod keys;
mod pay;

use near_sdk::json_types::{U64, U128};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{AccountId, CurveType, PublicKey, testing_env};

use crate::{Contract, NANOS_PER_DAY, ONE_USDC, Policy};

/// A moment on day 20 000 since the epoch, comfortably inside a day.
pub const NOON: u64 = 20_000 * NANOS_PER_DAY + NANOS_PER_DAY / 2;

pub fn company() -> AccountId {
    "chaipoint.testnet".parse().unwrap()
}
pub fn usdc() -> AccountId {
    "usdc.testnet".parse().unwrap()
}
pub fn supplier() -> AccountId {
    "milk-supplier.testnet".parse().unwrap()
}
pub fn stranger() -> AccountId {
    "stranger.testnet".parse().unwrap()
}

/// A distinct ed25519 key for each small number.
pub fn key(n: u8) -> PublicKey {
    PublicKey::from_parts(CurveType::ED25519, vec![n; 32]).unwrap()
}

/// Act as `signer`, a key on the company account, at time `at`.
pub fn act_as(signer: PublicKey, at: u64) {
    let mut ctx = VMContextBuilder::new();
    ctx.current_account_id(company())
        .predecessor_account_id(company())
        .signer_account_id(company())
        .signer_account_pk(signer)
        .block_timestamp(at);
    testing_env!(ctx.build());
}

pub fn usdc_amount(whole: u128) -> U128 {
    U128(whole * ONE_USDC)
}

/// Anita's policy: the milk supplier only, 20 USDC a payment, 20 a day.
pub fn anita_policy() -> Policy {
    Policy {
        suppliers: vec![supplier()],
        per_payment: usdc_amount(20),
        per_day: usdc_amount(20),
        expires_at: None,
    }
}

/// A company deployed by key 0, with Anita holding key 1.
pub fn company_with_anita() -> Contract {
    act_as(key(0), NOON);
    let mut contract = Contract::new(usdc());
    let _ = contract.add_member(key(1), "Anita".to_string(), anita_policy());
    contract
}

pub fn expiring(at: u64) -> Policy {
    Policy {
        expires_at: Some(U64(at)),
        ..anita_policy()
    }
}
