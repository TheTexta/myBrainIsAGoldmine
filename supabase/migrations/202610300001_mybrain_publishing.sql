begin;

create schema mybrain_private;
revoke all on schema mybrain_private from public, anon, authenticated;

-- Match JavaScript/Zod string lengths, including non-BMP characters.
create function mybrain_private.js_length(value text) returns integer
language sql immutable set search_path = '' as $$
    select length(value) + length(regexp_replace(value, U&'[\0001-\FFFF]', '', 'g'));
$$;

create function mybrain_private.valid_text(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare style_name text;
begin
    if jsonb_typeof(value) is distinct from 'object' or value->>'type' is distinct from 'text'
        or jsonb_typeof(value->'text') is distinct from 'string'
        or mybrain_private.js_length(value->>'text') > 100000
        or jsonb_typeof(value->'styles') is distinct from 'object' then return false; end if;
    foreach style_name in array array['bold','italic','underline','strike','code'] loop
        if value->'styles' ? style_name and jsonb_typeof(value->'styles'->style_name) <> 'boolean' then return false; end if;
    end loop;
    foreach style_name in array array['textColor','backgroundColor'] loop
        if value->'styles' ? style_name and (jsonb_typeof(value->'styles'->style_name) <> 'string'
            or mybrain_private.js_length(value->'styles'->>style_name) > 32) then return false; end if;
    end loop;
    return true;
end;
$$;

create function mybrain_private.valid_document(document jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare stack jsonb[]; current_item jsonb; block jsonb; inline_item jsonb; linked_text jsonb;
    prop record; depth integer; block_count integer := 0;
begin
    if document is null or jsonb_typeof(document) <> 'array' or jsonb_array_length(document) = 0
        or octet_length(document::text) > 1048576 then return false; end if;
    stack := array[jsonb_build_object('nodes', document, 'depth', 0)];
    while cardinality(stack) > 0 loop
        current_item := stack[cardinality(stack)];
        stack := stack[1:cardinality(stack)-1];
        depth := (current_item->>'depth')::integer;
        if depth > 12 or jsonb_array_length(current_item->'nodes') > 5000 then return false; end if;
        for block in select value from jsonb_array_elements(current_item->'nodes') loop
            block_count := block_count + 1;
            if block_count > 5000 or jsonb_typeof(block) <> 'object'
                or block->>'type' is null or block->>'type' not in
                ('paragraph','heading','bulletListItem','numberedListItem','checkListItem','quote','image','embed','divider') then return false; end if;
            if block ? 'id' and (jsonb_typeof(block->'id') <> 'string' or mybrain_private.js_length(block->>'id') > 100) then return false; end if;
            if block ? 'props' then
                if jsonb_typeof(block->'props') <> 'object' then return false; end if;
                for prop in select key, value from jsonb_each(block->'props') loop
                    if mybrain_private.js_length(prop.key) > 64 or jsonb_typeof(prop.value) not in ('string','number','boolean') then return false; end if;
                    if jsonb_typeof(prop.value) = 'string' and mybrain_private.js_length(prop.value #>> '{}') > 4096 then return false; end if;
                    if jsonb_typeof(prop.value) = 'number' and abs((prop.value #>> '{}')::numeric) > 1.7976931348623157e308 then return false; end if;
                end loop;
            end if;
            if block ? 'content' then
                if jsonb_typeof(block->'content') <> 'array' or jsonb_array_length(block->'content') > 5000 then return false; end if;
                for inline_item in select value from jsonb_array_elements(block->'content') loop
                    if inline_item->>'type' = 'text' then
                        if not mybrain_private.valid_text(inline_item) then return false; end if;
                    elsif inline_item->>'type' = 'link' then
                        if jsonb_typeof(inline_item->'href') is distinct from 'string' or mybrain_private.js_length(inline_item->>'href') > 2048
                            or jsonb_typeof(inline_item->'content') is distinct from 'array' then return false; end if;
                        if jsonb_array_length(inline_item->'content') > 1000 then return false; end if;
                        for linked_text in select value from jsonb_array_elements(inline_item->'content') loop
                            if not mybrain_private.valid_text(linked_text) then return false; end if;
                        end loop;
                    else return false;
                    end if;
                end loop;
            end if;
            if block ? 'children' then
                if jsonb_typeof(block->'children') <> 'array' then return false; end if;
                stack := array_append(stack, jsonb_build_object('nodes', block->'children', 'depth', depth + 1));
            end if;
        end loop;
    end loop;
    return true;
end;
$$;
revoke all on function mybrain_private.js_length(text), mybrain_private.valid_text(jsonb),
    mybrain_private.valid_document(jsonb) from public, anon, authenticated;

-- Site-local objects only. Do not redefine shared is_admin() or other sites' roles.
create table public.mybrain_editors (
    user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.mybrain_drafts (
    id uuid primary key,
    legacy_key text unique,
    group_index integer,
    position bigint not null,
    title text not null check (length(btrim(title)) between 1 and 200),
    document jsonb check (document is null or (jsonb_typeof(document) = 'array' and octet_length(document::text) <= 1048576)),
    revision bigint not null default 0 check (revision >= 0),
    updated_at timestamptz not null default now()
);
create table public.mybrain_publications (
    id uuid primary key references public.mybrain_drafts(id),
    legacy_key text unique,
    group_index integer,
    position bigint not null,
    state text not null check (state in ('legacy', 'published', 'hidden')),
    title text,
    document jsonb,
    published_at timestamptz,
    check ((state = 'published' and title is not null and document is not null and jsonb_typeof(document) = 'array')
        or (state in ('legacy', 'hidden') and title is null and document is null))
);
create index mybrain_publications_position on public.mybrain_publications(position, id);
create table public.mybrain_media (
    id uuid primary key,
    upload_key text not null unique,
    object_key text not null unique,
    content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
    size_bytes bigint not null check (size_bytes between 1 and 20971520),
    sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
    state text not null default 'pending' check (state in ('pending', 'ready')),
    created_at timestamptz not null default now(),
    check (state <> 'ready' or sha256 is not null)
);
create table public.mybrain_publication_media (
    post_id uuid not null references public.mybrain_publications(id) on delete cascade,
    media_id uuid not null references public.mybrain_media(id),
    primary key (post_id, media_id)
);
create index mybrain_publication_media_lookup on public.mybrain_publication_media(media_id);

alter table public.mybrain_editors enable row level security;
alter table public.mybrain_drafts enable row level security;
alter table public.mybrain_publications enable row level security;
alter table public.mybrain_media enable row level security;
alter table public.mybrain_publication_media enable row level security;

revoke all on public.mybrain_editors, public.mybrain_drafts, public.mybrain_publications,
    public.mybrain_media, public.mybrain_publication_media from public, anon, authenticated;
grant select on public.mybrain_editors, public.mybrain_drafts, public.mybrain_media to authenticated;
grant select on public.mybrain_publications to anon, authenticated;
grant all on public.mybrain_editors, public.mybrain_drafts, public.mybrain_publications,
    public.mybrain_media, public.mybrain_publication_media to service_role;

create policy mybrain_own_membership on public.mybrain_editors for select to authenticated
    using (user_id = (select auth.uid()));
create policy mybrain_draft_read on public.mybrain_drafts for select to authenticated
    using (exists (select 1 from public.mybrain_editors where user_id = (select auth.uid())));
create policy mybrain_media_read on public.mybrain_media for select to authenticated
    using (exists (select 1 from public.mybrain_editors where user_id = (select auth.uid())));
create policy mybrain_public_read on public.mybrain_publications for select to anon, authenticated using (true);

create function public.mybrain_save_draft(p_id uuid, p_expected_revision bigint, p_title text, p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.mybrain_drafts;
begin
    if auth.uid() is null or not exists (select 1 from public.mybrain_editors where user_id = auth.uid()) then
        raise insufficient_privilege using message = 'Editorial access required';
    end if;
    if p_id is null or p_expected_revision is null or p_expected_revision < 0
        or p_title is null or length(btrim(p_title)) not between 1 and 200
        or not mybrain_private.valid_document(p_document) then
        raise check_violation using message = 'Invalid draft';
    end if;
    -- Serialize creation of the same client-generated UUID as well as updates.
    perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
    select * into v from public.mybrain_drafts where id = p_id for update;
    if not found then
        if p_expected_revision <> 0 then raise serialization_failure using message = 'Draft changed; reload before saving'; end if;
        insert into public.mybrain_drafts(id, position, title, document, revision)
            values (p_id, -(extract(epoch from clock_timestamp()) * 1000)::bigint, btrim(p_title), p_document, 1)
            returning * into v;
    else
        if v.revision <> p_expected_revision then raise serialization_failure using message = 'Draft changed; reload before saving'; end if;
        update public.mybrain_drafts set title = btrim(p_title), document = p_document,
            revision = revision + 1, updated_at = now() where id = p_id returning * into v;
    end if;
    return to_jsonb(v);
end;
$$;

create function public.mybrain_publish(p_id uuid, p_expected_revision bigint, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.mybrain_drafts; media_url text; media_ids uuid[] := '{}'; media_id uuid;
begin
    if auth.uid() is null or not exists (select 1 from public.mybrain_editors where user_id = auth.uid()) then
        raise insufficient_privilege using message = 'Editorial access required';
    end if;
    if p_id is null or p_expected_revision is null or p_expected_revision < 0 then
        raise check_violation using message = 'Invalid revision';
    end if;
    select * into strict v from public.mybrain_drafts where id = p_id for update;
    if v.revision <> p_expected_revision then raise serialization_failure using message = 'Draft changed; reload before publishing'; end if;
    if p_action not in ('publish', 'hide') or p_action is null then raise check_violation using message = 'Invalid action'; end if;
    if p_action = 'publish' then
        if not mybrain_private.valid_document(v.document) then raise check_violation using message = 'Import and save a valid document before publishing'; end if;
        for media_url in select distinct value #>> '{}' from jsonb_path_query(v.document, '$.**.url') as reference(value) loop
            if media_url like '/media/%' then
                if media_url !~ '^/media/[a-f0-9-]{36}$' then raise check_violation using message = 'Invalid media reference'; end if;
                media_id := substring(media_url from 8)::uuid;
                if not exists (select 1 from public.mybrain_media m where m.id = media_id and m.state = 'ready') then
                    raise check_violation using message = 'Finish uploading images before publishing';
                end if;
                media_ids := array_append(media_ids, media_id);
            end if;
        end loop;
    end if;
    update public.mybrain_drafts set revision = revision + 1, updated_at = now() where id = p_id;
    insert into public.mybrain_publications(id, legacy_key, group_index, position, state, title, document, published_at)
        values (v.id, v.legacy_key, v.group_index, v.position,
            case when p_action = 'publish' then 'published' else 'hidden' end,
            case when p_action = 'publish' then v.title end,
            case when p_action = 'publish' then v.document end, now())
        on conflict (id) do update set state = excluded.state, title = excluded.title,
            document = excluded.document, published_at = excluded.published_at;
    delete from public.mybrain_publication_media where post_id = p_id;
    insert into public.mybrain_publication_media(post_id, media_id)
        select p_id, unnest(media_ids) on conflict do nothing;
    return jsonb_build_object('revision', v.revision + 1, 'state', case when p_action = 'publish' then 'published' else 'hidden' end);
end;
$$;

create function public.mybrain_reserve_media(p_id uuid, p_size bigint, p_type text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.mybrain_media; extension text;
begin
    if auth.uid() is null or not exists (select 1 from public.mybrain_editors where user_id = auth.uid()) then
        raise insufficient_privilege using message = 'Editorial access required';
    end if;
    extension := case p_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/gif' then 'gif' when 'image/webp' then 'webp' end;
    if extension is null then raise check_violation using message = 'Unsupported image type'; end if;
    insert into public.mybrain_media(id, upload_key, object_key, content_type, size_bytes)
        values (p_id, 'incoming/' || p_id::text, 'originals/' || p_id::text || '.' || extension, p_type, p_size)
        returning * into v;
    return to_jsonb(v);
end;
$$;

-- This RPC reveals only originals referenced by currently published entries.
create function public.mybrain_public_media(p_id uuid)
returns table(object_key text, content_type text, size_bytes bigint, sha256 text)
language sql stable security definer set search_path = '' as $$
    select m.object_key, m.content_type, m.size_bytes, m.sha256
    from public.mybrain_media m where m.id = p_id and m.state = 'ready'
        and exists (select 1 from public.mybrain_publication_media pm
            join public.mybrain_publications p on p.id = pm.post_id
            where pm.media_id = m.id and p.state = 'published');
$$;

revoke all on function public.mybrain_save_draft(uuid,bigint,text,jsonb),
    public.mybrain_publish(uuid,bigint,text), public.mybrain_reserve_media(uuid,bigint,text),
    public.mybrain_public_media(uuid) from public, anon, authenticated;
grant execute on function public.mybrain_save_draft(uuid,bigint,text,jsonb),
    public.mybrain_publish(uuid,bigint,text), public.mybrain_reserve_media(uuid,bigint,text) to authenticated;
grant execute on function public.mybrain_public_media(uuid) to anon, authenticated;

-- Known original entries only; no identities or editorial memberships are seeded.
insert into public.mybrain_drafts(id, legacy_key, group_index, position, title) values
('b1710000-0000-4000-8000-000000000001','goldmine',0,1,'Protected: my brain is a goldmine.'),
('b1710000-0000-4000-8000-000000000002','jeffrey-lewis',1,2,'PSA: Jeffrey Lewis.'),
('b1710000-0000-4000-8000-000000000003','notes-app',2,3,'Back by popular request : My notes app ❤'),
('b1710000-0000-4000-8000-000000000004','reading',3,4,'She started reading again ?! How long will this last…'),
('b1710000-0000-4000-8000-000000000005','sixteenth-note',4,5,'sixteenth note'),
('b1710000-0000-4000-8000-000000000006','alphabet',5,6,'Mallory in an Alphabet'),
('b1710000-0000-4000-8000-000000000007','aftertaste-of-june',6,7,'aftertaste of june'),
('b1710000-0000-4000-8000-000000000008','manic-pixie',6,8,'I am not your manic pixie freak By Mallory Paige Webber'),
('b1710000-0000-4000-8000-000000000009','archives',6,9,'In da [ica] archives of my notes app'),
('b1710000-0000-4000-8000-000000000010','morally-mallory',6,10,'Morally Mallory,'),
('b1710000-0000-4000-8000-000000000011','conclusive',6,11,'Conclusive');
insert into public.mybrain_publications(id, legacy_key, group_index, position, state)
    select id, legacy_key, group_index, position, 'legacy' from public.mybrain_drafts;

commit;
