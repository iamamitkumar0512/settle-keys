//! Settle Keys: a business account on NEAR where every person gets a key with a limit.
//!
//! The contract is deployed on the company account. It holds the company's USDC and
//! manages the access keys of its members.

use near_sdk::{near, AccountId, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// The NEP-141 token the company pays with.
    usdc: AccountId,
}

#[near]
impl Contract {
    /// Deploy with the token the company pays in.
    #[init]
    pub fn new(usdc: AccountId) -> Self {
        Self { usdc }
    }

    /// The token this company pays with.
    pub fn get_usdc(&self) -> AccountId {
        self.usdc.clone()
    }
}
