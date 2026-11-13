use super::*;
use crate::Role;

#[test]
fn the_deploy_key_is_the_root_owner() {
    act_as(key(0), NOON);
    let contract = Contract::new(usdc());
    let members = contract.get_members();
    assert_eq!(members.len(), 1);
    assert_eq!(members[0].key, key(0));
    assert_eq!(members[0].role, Role::Owner);
    assert!(members[0].root);
    assert_eq!(contract.get_usdc(), usdc());
}

#[test]
fn an_owner_issues_a_member_key_with_its_policy() {
    let contract = company_with_anita();
    let anita = contract.get_member(key(1)).expect("Anita exists");
    assert_eq!(anita.name, "Anita");
    assert_eq!(anita.role, Role::Member);
    assert!(!anita.root);
    assert_eq!(anita.policy.unwrap().suppliers, vec![supplier()]);
    assert_eq!(contract.spent_today(key(1)), U128(0));
}

#[test]
#[should_panic(expected = "only an owner key can add or remove members")]
fn a_member_key_cannot_add_members() {
    let mut contract = company_with_anita();
    act_as(key(1), NOON);
    let _ = contract.add_member(key(2), "Mallory".to_string(), anita_policy());
}

#[test]
#[should_panic(expected = "unknown key: the company never issued it")]
fn an_unknown_key_cannot_add_members() {
    let mut contract = company_with_anita();
    act_as(key(9), NOON);
    let _ = contract.add_member(key(2), "Mallory".to_string(), anita_policy());
}

#[test]
#[should_panic(expected = "call this with a key on the company account")]
fn another_account_cannot_add_members() {
    let mut contract = company_with_anita();
    let mut ctx = VMContextBuilder::new();
    ctx.current_account_id(company())
        .predecessor_account_id(stranger())
        .signer_account_id(stranger())
        .signer_account_pk(key(0))
        .block_timestamp(NOON);
    testing_env!(ctx.build());
    let _ = contract.add_member(key(2), "Mallory".to_string(), anita_policy());
}

#[test]
#[should_panic(expected = "a member key needs at least one supplier")]
fn a_member_key_needs_a_supplier() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let policy = Policy {
        suppliers: vec![],
        ..anita_policy()
    };
    let _ = contract.add_member(key(2), "Ravi".to_string(), policy);
}

#[test]
#[should_panic(expected = "the daily limit cannot be below the per-payment limit")]
fn the_daily_limit_cannot_be_below_the_per_payment_limit() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let policy = Policy {
        per_day: usdc_amount(5),
        ..anita_policy()
    };
    let _ = contract.add_member(key(2), "Ravi".to_string(), policy);
}

#[test]
#[should_panic(expected = "this key was already issued")]
fn a_key_is_issued_once() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let _ = contract.add_member(key(1), "Anita again".to_string(), anita_policy());
}

#[test]
fn removing_a_member_forgets_the_key() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let _ = contract.remove_member(key(1));
    assert!(contract.get_member(key(1)).is_none());
    assert_eq!(contract.get_members().len(), 1);
}

#[test]
#[should_panic(expected = "the deploy key cannot be removed from here")]
fn the_deploy_key_cannot_be_removed() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let _ = contract.remove_member(key(0));
}

#[test]
fn a_refused_add_key_drops_the_record() {
    let mut contract = company_with_anita();
    act_as(key(0), NOON);
    let kept = contract.on_key_added(key(1), Err(near_sdk::PromiseError::Failed));
    assert!(!kept);
    assert!(contract.get_member(key(1)).is_none());
}
