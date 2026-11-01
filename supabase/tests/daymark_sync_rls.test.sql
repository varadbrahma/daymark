begin;

select plan(5);

insert into public.daymark_sync_records (user_id, key, value)
values
  ('00000000-0000-0000-0000-000000000001', 'ownership-test', '"account one"'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'ownership-test', '"account two"'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::integer from public.daymark_sync_records where key = 'ownership-test'),
  1,
  'an account can only select its own records'
);

select is(
  (select value #>> '{}' from public.daymark_sync_records where key = 'ownership-test'),
  'account one',
  'the visible record belongs to the authenticated account'
);

select lives_ok(
  $$insert into public.daymark_sync_records (key, value) values ('own-insert-test', '"owned"'::jsonb)$$,
  'an account can insert a record owned by its authenticated identity'
);

select throws_ok(
  $$insert into public.daymark_sync_records (user_id, key, value)
    values ('00000000-0000-0000-0000-000000000002', 'forged-owner-test', '"not owned"'::jsonb)$$,
  '42501',
  null,
  'an account cannot insert a record for another account'
);

select throws_ok(
  $$update public.daymark_sync_records
    set user_id = '00000000-0000-0000-0000-000000000002'
    where key = 'ownership-test'$$,
  '42501',
  null,
  'an account cannot transfer its record to another account'
);

select * from finish();
rollback;
