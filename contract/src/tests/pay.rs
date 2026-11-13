use super::*;
use crate::Status;
use near_sdk::PromiseError;

fn pay(contract: &mut Contract, to: AccountId, whole: u128, memo: &str) {
    let _ = contract.pay(to, usdc_amount(whole), memo.to_string());
}

#[test]
fn a_member_pays_a_supplier_within_its_limits() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
    assert_eq!(contract.spent_today(key(1)), usdc_amount(4));
    let ledger = contract.get_ledger(None, None);
    assert_eq!(ledger.len(), 1);
    assert_eq!(ledger[0].to, supplier());
    assert_eq!(ledger[0].amount, usdc_amount(4));
    assert_eq!(ledger[0].status, Status::Pending);
    assert_eq!(ledger[0].member, "Anita");
}

#[test]
fn a_successful_transfer_is_recorded_as_paid() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
    act_as(key(0), NOON);
    let status = contract.on_paid(0, key(1), usdc_amount(4), Ok(()));
    assert_eq!(status, Status::Paid);
    assert_eq!(contract.get_ledger(None, None)[0].status, Status::Paid);
    assert_eq!(contract.spent_today(key(1)), usdc_amount(4));
}

#[test]
fn a_failed_transfer_refunds_the_day_and_frees_the_memo() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
    act_as(key(0), NOON);
    let status = contract.on_paid(0, key(1), usdc_amount(4), Err(PromiseError::Failed));
    assert_eq!(status, Status::Failed);
    assert_eq!(contract.spent_today(key(1)), U128(0));
    assert_eq!(contract.get_ledger(None, None)[0].status, Status::Failed);
    // The same memo can be paid again.
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
    assert_eq!(contract.ledger_len(), 2);
}

#[test]
#[should_panic(expected = "owner keys cannot pay")]
fn an_owner_key_cannot_pay() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
}

#[test]
#[should_panic(expected = "unknown key: the company never issued it")]
fn an_unknown_key_cannot_pay() {
    let mut contract = company_with_anita();
    act_as(key(9), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
}

#[test]
#[should_panic(expected = "pay must be called with a key on the company account")]
fn another_account_cannot_pay() {
    let mut contract = company_with_anita();
    let mut ctx = VMContextBuilder::new();
    ctx.current_account_id(company())
        .predecessor_account_id(stranger())
        .signer_account_id(stranger())
        .signer_account_pk(key(1))
        .block_timestamp(NOON);
    testing_env!(ctx.build());
    pay(&mut contract, supplier(), 4, "order-1");
}

#[test]
#[should_panic(expected = "stranger.testnet is not an allowed supplier for this key")]
fn a_payment_to_anyone_but_a_supplier_is_refused() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, stranger(), 4, "order-1");
}

#[test]
#[should_panic(expected = "over the per-payment limit: 500.00 USDC is more than 20.00 USDC")]
fn a_payment_over_the_per_payment_limit_is_refused() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 500, "order-1");
}

#[test]
#[should_panic(expected = "over the daily limit: 15.00 USDC already spent today")]
fn two_payments_in_one_block_cannot_pass_the_daily_limit() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 15, "order-1");
    // No callback has run; the reservation alone must stop this one.
    pay(&mut contract, supplier(), 10, "order-2");
}

#[test]
fn the_daily_limit_resets_the_next_day() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 20, "order-1");
    act_as(key(1), NOON + NANOS_PER_DAY);
    assert_eq!(contract.spent_today(key(1)), U128(0));
    pay(&mut contract, supplier(), 20, "order-2");
    assert_eq!(contract.spent_today(key(1)), usdc_amount(20));
}

#[test]
#[should_panic(expected = "this key expired at unix second")]
fn an_expired_key_is_refused() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let _ = contract.add_member(key(2), "Night agent".to_string(), expiring(NOON + 1));
    act_as(key(2), NOON + 2);
    pay(&mut contract, supplier(), 1, "milk-1");
}

#[test]
fn a_key_pays_until_it_expires() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let _ = contract.add_member(key(2), "Night agent".to_string(), expiring(NOON + 10));
    act_as(key(2), NOON + 5);
    pay(&mut contract, supplier(), 1, "milk-1");
    assert_eq!(contract.spent_today(key(2)), usdc_amount(1));
}

#[test]
#[should_panic(expected = "memo order-1 was already paid")]
fn a_memo_is_paid_once() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
    pay(&mut contract, supplier(), 4, "order-1");
}

#[test]
#[should_panic(expected = "unknown key: the company never issued it")]
fn a_removed_member_cannot_pay() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let _ = contract.remove_member(key(1));
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 4, "order-1");
}

#[test]
#[should_panic(expected = "the amount must be above zero")]
fn a_zero_payment_is_refused() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    pay(&mut contract, supplier(), 0, "order-1");
}
