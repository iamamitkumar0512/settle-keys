//! The records the contract keeps: members, their policies, and the ledger.

use near_sdk::json_types::{U64, U128};
use near_sdk::{near, AccountId, PublicKey};

/// One USDC, in the token's smallest unit (6 decimals).
pub const ONE_USDC: u128 = 1_000_000;

/// Nanoseconds in a day; the daily limit resets when this boundary passes.
pub const NANOS_PER_DAY: u64 = 86_400_000_000_000;

/// What a key is allowed to do. The chain enforces the method list; the contract enforces the rest.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Role {
    /// Can add and remove members. Cannot pay.
    Owner,
    /// Can pay, within its policy.
    Member,
}

/// The limits on a member key. All amounts are in USDC's smallest unit.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Policy {
    /// Accounts this key may pay. Never empty.
    pub suppliers: Vec<AccountId>,
    /// The most one payment may be.
    pub per_payment: U128,
    /// The most this key may pay in one day.
    pub per_day: U128,
    /// After this timestamp (nanoseconds) the key pays nothing.
    pub expires_at: Option<U64>,
}

/// A key the company has issued.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Member {
    pub name: String,
    pub role: Role,
    /// True only for the key that deployed the contract. It cannot be removed from here.
    pub root: bool,
    /// Owners have no policy.
    pub policy: Option<Policy>,
    /// The day index the spend below belongs to.
    pub spent_day: u64,
    /// What this key has paid, or reserved, on that day.
    pub spent_today: U128,
    pub added_at: U64,
}

/// A member together with the key that identifies it, as views return it.
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MemberView {
    pub key: PublicKey,
    pub name: String,
    pub role: Role,
    pub root: bool,
    pub policy: Option<Policy>,
    /// Spend on the current day, zero if the stored day has passed.
    pub spent_today: U128,
    pub added_at: U64,
}

/// Where a payment is in its life.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    /// Reserved against the key's day; the transfer is in flight.
    Pending,
    /// The USDC moved.
    Paid,
    /// The transfer failed; the reservation was refunded.
    Failed,
}

/// One line of the company's ledger.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Entry {
    pub id: u64,
    pub key: PublicKey,
    pub member: String,
    pub to: AccountId,
    pub amount: U128,
    pub memo: String,
    pub status: Status,
    pub at: U64,
}

/// Formats a USDC amount for a message: `4.00 USDC`, `1.25 USDC`, `0.000001 USDC`.
pub fn fmt_usdc(amount: u128) -> String {
    let whole = amount / ONE_USDC;
    let frac = amount % ONE_USDC;
    let mut digits = format!("{frac:06}");
    while digits.len() > 2 && digits.ends_with('0') {
        digits.pop();
    }
    format!("{whole}.{digits} USDC")
}

#[cfg(test)]
mod tests {
    use super::fmt_usdc;

    #[test]
    fn formats_usdc_amounts() {
        assert_eq!(fmt_usdc(4_000_000), "4.00 USDC");
        assert_eq!(fmt_usdc(1_250_000), "1.25 USDC");
        assert_eq!(fmt_usdc(1), "0.000001 USDC");
        assert_eq!(fmt_usdc(0), "0.00 USDC");
    }
}
