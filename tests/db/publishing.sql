\set ON_ERROR_STOP on
create function pg_temp.assert_true(condition boolean, message text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'FAIL: %', message; end if; end; $$;
create function pg_temp.expect_error(query text, expected_state text) returns void language plpgsql as $$
begin
    begin execute query; exception when others then
        if sqlstate = expected_state then return; end if;
        raise exception 'Expected %, got %: %', expected_state, sqlstate, sqlerrm;
    end;
    raise exception 'Expected failure: %', query;
end; $$;

insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.mybrain_editors values ('11111111-1111-4111-8111-111111111111');
select pg_temp.assert_true((select count(*) = 11 from public.mybrain_drafts), 'eleven original drafts');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.mybrain_publish(uuid,bigint,text)', 'execute'), 'anon cannot call publishing RPC');

set role anon;
select pg_temp.assert_true((select count(*) = 11 from public.mybrain_publications), 'public original projection');
select pg_temp.expect_error('select * from public.mybrain_drafts', '42501');
select pg_temp.expect_error('select * from public.mybrain_media', '42501');
select pg_temp.expect_error('select * from public.mybrain_editors', '42501');
reset role;

-- A shared identity with no membership (including an admin of another site)
-- is neither an editor nor a reader of this site's private content.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select pg_temp.assert_true((select count(*) = 0 from public.mybrain_drafts), 'nonmember cannot read drafts');
select pg_temp.expect_error($q$insert into public.mybrain_editors values ('22222222-2222-4222-8222-222222222222')$q$, '42501');
select pg_temp.expect_error($q$select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'Unauthorized','[]')$q$, '42501');
select pg_temp.expect_error($q$select public.mybrain_publish('b1710000-0000-4000-8000-000000000001',0,'hide')$q$, '42501');

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.assert_true((select count(*) = 11 from public.mybrain_drafts), 'member sees drafts');
select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'New entry','[{"type":"paragraph","content":[{"type":"text","text":"saved only","styles":{}}]}]');
select pg_temp.expect_error($q$select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'Stale','[{"type":"paragraph"}]')$q$, '40001');
select pg_temp.expect_error($q$select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'No revision','[]')$q$, '23514');
select pg_temp.expect_error($q$update public.mybrain_publications set state='hidden'$q$, '42501');
select pg_temp.expect_error($q$select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'Empty','[]')$q$, '23514');
select pg_temp.expect_error($q$select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'Unsupported','[{"type":"html"}]')$q$, '23514');
select pg_temp.expect_error($q$select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'Bad inline','[{"type":"paragraph","content":[{"type":"text","text":"missing styles"}]}]')$q$, '23514');
reset role;
set role anon;
select pg_temp.assert_true((select count(*) = 0 from public.mybrain_publications where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'saving does not publish');
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'publish');
select pg_temp.expect_error($q$select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'hide')$q$, '40001');
select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,'Unpublished edit','[{"type":"paragraph","content":[{"type":"text","text":"private changed words","styles":{}}]}]');
reset role;
set role anon;
select pg_temp.assert_true((select title='New entry' and document::text not like '%private changed words%' from public.mybrain_publications where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'editing live entry does not leak draft');
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.mybrain_reserve_media('cccccccc-cccc-4ccc-8ccc-cccccccccccc',100,'image/png');
select pg_temp.expect_error($q$update public.mybrain_media set state='ready', sha256=repeat('a',64)$q$, '42501');
select public.mybrain_save_draft('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3,'With image','[{"type":"image","props":{"url":"/media/cccccccc-cccc-4ccc-8ccc-cccccccccccc"}}]');
select pg_temp.expect_error($q$select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',4,'publish')$q$, '23514');
reset role;
-- Only the server's service-role completion step may attest verified bytes.
set role service_role;
update public.mybrain_media set state='ready', sha256=repeat('a',64) where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',4,'publish');
reset role;
set role anon;
select pg_temp.assert_true((select count(*)=1 from public.mybrain_public_media('cccccccc-cccc-4ccc-8ccc-cccccccccccc')), 'published reference exposes verified original');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,'hide');
select pg_temp.expect_error($q$select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,'publish')$q$, '40001');
reset role;
set role anon;
select pg_temp.assert_true((select document is null and title is null and state='hidden' from public.mybrain_publications where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'unpublish clears public content');
select pg_temp.assert_true((select count(*)=0 from public.mybrain_public_media('cccccccc-cccc-4ccc-8ccc-cccccccccccc')), 'unpublish removes media visibility');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.mybrain_media where state='ready'), 'unpublish retains original');

do $$
declare document jsonb := '[{"type":"paragraph"}]';
begin
    for depth in 1..14 loop document := jsonb_build_array(jsonb_build_object('type','paragraph','children',document)); end loop;
    perform pg_temp.assert_true(not mybrain_private.valid_document(document), 'deep documents rejected at database boundary');
    perform pg_temp.assert_true(mybrain_private.js_length('❤😀') = 3, 'Unicode validation matches JavaScript');
end; $$;
-- A malformed row introduced by privileged maintenance must still not publish.
update public.mybrain_drafts set document='[]' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($q$select public.mybrain_publish('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',6,'publish')$q$, '23514');
reset role;

delete from public.mybrain_editors;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($q$select public.mybrain_publish('b1710000-0000-4000-8000-000000000001',0,'hide')$q$, '42501');
reset role;
