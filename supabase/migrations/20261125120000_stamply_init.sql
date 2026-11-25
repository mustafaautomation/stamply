-- Stamply schema, RLS, and punch/redeem functions.
-- Apply in the Supabase SQL editor or with `supabase db push`.
-- Authorization lives in memberships and super_admins, never in user_metadata.

create extension if not exists pgcrypto;

create schema if not exists private;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  industry text not null check (industry in ('cafe', 'salon', 'gym', 'other')),
  logo_url text,
  primary_color text not null default '#24312B',
  accent_color text not null default '#C23B22',
  stamp_goal integer not null default 8 check (stamp_goal between 2 and 24),
  reward_text text not null,
  plan text not null default 'starter' check (plan in ('starter', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  read_only boolean not null default false,
  city text not null default '',
  tagline text not null default '',
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  code text not null unique,
  stamps integer not null default 0 check (stamps >= 0),
  rewards_redeemed integer not null default 0 check (rewards_redeemed >= 0),
  reward_unlocked boolean not null default false,
  last_punch_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.punches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  staff_id uuid not null references auth.users (id),
  override boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  actor_id uuid,
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_tenant_id_idx on public.memberships (tenant_id);
create index customers_tenant_id_idx on public.customers (tenant_id);
create index customers_tenant_email_idx on public.customers (tenant_id, lower(email));
create index cards_tenant_id_idx on public.cards (tenant_id);
create index cards_code_lower_idx on public.cards (lower(code));
create index punches_tenant_created_idx on public.punches (tenant_id, created_at desc);
create index punches_card_id_idx on public.punches (card_id);
create index activity_tenant_created_idx on public.activity (tenant_id, created_at desc);

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.super_admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function private.tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id
  from public.memberships
  where user_id = (select auth.uid());
$$;

revoke all on function private.is_super_admin() from public;
revoke all on function private.tenant_ids() from public;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.tenant_ids() to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.super_admins enable row level security;
alter table public.customers enable row level security;
alter table public.cards enable row level security;
alter table public.punches enable row level security;
alter table public.activity enable row level security;

create policy tenants_select on public.tenants
  for select to authenticated
  using ((select private.is_super_admin()) or id in (select private.tenant_ids()));

create policy tenants_update on public.tenants
  for update to authenticated
  using (
    read_only = false
    and id in (
      select m.tenant_id from public.memberships m
      where m.user_id = (select auth.uid()) and m.role = 'owner'
    )
  )
  with check (
    read_only = false
    and id in (
      select m.tenant_id from public.memberships m
      where m.user_id = (select auth.uid()) and m.role = 'owner'
    )
  );

create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy super_admins_select on public.super_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy customers_select on public.customers
  for select to authenticated
  using ((select private.is_super_admin()) or tenant_id in (select private.tenant_ids()));

create policy cards_select on public.cards
  for select to authenticated
  using ((select private.is_super_admin()) or tenant_id in (select private.tenant_ids()));

create policy punches_select on public.punches
  for select to authenticated
  using ((select private.is_super_admin()) or tenant_id in (select private.tenant_ids()));

create policy activity_select on public.activity
  for select to authenticated
  using (
    (select private.is_super_admin())
    or tenant_id in (select private.tenant_ids())
  );

-- No direct insert/update policies for cards, punches, customers, or activity.
-- Stamp changes go through security definer functions that check auth.uid().

revoke all on table public.tenants from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.super_admins from anon, authenticated;
revoke all on table public.customers from anon, authenticated;
revoke all on table public.cards from anon, authenticated;
revoke all on table public.punches from anon, authenticated;
revoke all on table public.activity from anon, authenticated;

grant select on public.tenants, public.profiles, public.memberships, public.super_admins,
  public.customers, public.cards, public.punches, public.activity to authenticated;
grant update on public.tenants, public.profiles to authenticated;

create or replace function private.card_payload(
  p_code text,
  p_stamps integer,
  p_goal integer,
  p_reward text,
  p_unlocked boolean,
  p_redeemed integer,
  p_business text,
  p_industry text,
  p_logo text,
  p_primary text,
  p_accent text,
  p_city text,
  p_tagline text,
  p_customer text,
  p_read_only boolean,
  p_demo boolean
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'code', p_code,
    'stamps', p_stamps,
    'stampGoal', p_goal,
    'rewardText', p_reward,
    'rewardUnlocked', p_unlocked,
    'rewardsRedeemed', p_redeemed,
    'businessName', p_business,
    'industry', p_industry,
    'logoUrl', p_logo,
    'primaryColor', p_primary,
    'accentColor', p_accent,
    'city', p_city,
    'tagline', p_tagline,
    'customerName', p_customer,
    'customerFirstName', split_part(p_customer, ' ', 1),
    'readOnly', p_demo or p_read_only,
    'showcase', p_read_only
  );
$$;

revoke all on function private.card_payload(text, integer, integer, text, boolean, integer, text, text, text, text, text, text, text, text, boolean, boolean) from public;

-- Public card lookup. The unguessable code is the capability.
-- Returns first name and program branding only. No email or phone.
create or replace function public.get_public_card(p_code text, p_demo boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.id is null then jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'No card uses that code.')
    )
    else jsonb_build_object(
      'ok', true,
      'data', private.card_payload(
        c.code, c.stamps, t.stamp_goal, t.reward_text, c.reward_unlocked, c.rewards_redeemed,
        t.name, t.industry, t.logo_url, t.primary_color, t.accent_color, t.city, t.tagline,
        cu.name, t.read_only, coalesce(p_demo, false)
      )
    )
  end
  from (select p_code as code) input
  left join public.cards c on lower(c.code) = lower(input.code)
  left join public.tenants t on t.id = c.tenant_id
  left join public.customers cu on cu.id = c.customer_id;
$$;

revoke all on function public.get_public_card(text, boolean) from public;
grant execute on function public.get_public_card(text, boolean) to anon, authenticated;

create or replace function public.create_merchant_tenant(
  p_name text,
  p_industry text,
  p_goal integer,
  p_reward text,
  p_primary text,
  p_accent text,
  p_city text,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'UNAUTHORIZED', 'message', 'Sign in before creating a program.'));
  end if;
  if exists (select 1 from public.memberships where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'CONFLICT', 'message', 'This login already has a program.'));
  end if;
  insert into public.profiles (user_id, full_name)
  values (v_uid, coalesce(nullif(btrim(p_full_name), ''), 'Owner'))
  on conflict (user_id) do update set full_name = excluded.full_name;
  insert into public.tenants (name, slug, industry, stamp_goal, reward_text, primary_color, accent_color, city)
  values (
    btrim(p_name),
    lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')),
    case when p_industry in ('cafe', 'salon', 'gym', 'other') then p_industry else 'cafe' end,
    least(24, greatest(2, coalesce(p_goal, 8))),
    btrim(p_reward),
    coalesce(nullif(p_primary, ''), '#24312B'),
    coalesce(nullif(p_accent, ''), '#C23B22'),
    coalesce(p_city, '')
  )
  returning id into v_tenant;
  insert into public.memberships (user_id, tenant_id, role) values (v_uid, v_tenant, 'owner');
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('tenantId', v_tenant));
end;
$$;

revoke all on function public.create_merchant_tenant(text, text, integer, text, text, text, text, text) from public;
grant execute on function public.create_merchant_tenant(text, text, integer, text, text, text, text, text) to authenticated;

create or replace function public.punch_card(p_code text, p_confirm boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_card public.cards;
  v_tenant public.tenants;
  v_customer public.customers;
  v_elapsed double precision := null;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'UNAUTHORIZED', 'message', 'Staff sign-in is required to punch a card.'));
  end if;
  select * into v_card from public.cards where lower(code) = lower(p_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'That card is not on this account.'));
  end if;
  if not exists (
    select 1 from public.memberships
    where user_id = v_uid and tenant_id = v_card.tenant_id and role in ('owner', 'staff')
  ) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'That card is not on this account.'));
  end if;
  select * into v_tenant from public.tenants where id = v_card.tenant_id;
  select * into v_customer from public.customers where id = v_card.customer_id;
  if v_tenant.read_only then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'READ_ONLY', 'message', 'This showcase is read-only. Create your own program to stamp cards.'));
  end if;
  if v_card.reward_unlocked or v_card.stamps >= v_tenant.stamp_goal then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'FULL', 'message', 'This card is full. Redeem the reward before the next stamp.'));
  end if;
  if v_card.last_punch_at is not null then
    v_elapsed := extract(epoch from (now() - v_card.last_punch_at));
    if v_elapsed >= 0 and v_elapsed < 90 and not coalesce(p_confirm, false) then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'COOLDOWN',
        'message', 'This card was punched recently. Confirm to stamp again.',
        'retryAfterSeconds', ceil(90 - v_elapsed)::int
      ));
    end if;
  end if;
  update public.cards
  set stamps = stamps + 1,
      last_punch_at = now(),
      reward_unlocked = (stamps + 1) >= v_tenant.stamp_goal
  where id = v_card.id
  returning * into v_card;
  insert into public.punches (tenant_id, card_id, staff_id, override)
  values (v_card.tenant_id, v_card.id, v_uid, v_elapsed is not null and v_elapsed < 90);
  insert into public.activity (tenant_id, actor_id, action, summary)
  values (v_card.tenant_id, v_uid, 'card.punched', 'Stamped ' || v_customer.name || '.');
  if v_card.reward_unlocked then
    insert into public.activity (tenant_id, actor_id, action, summary)
    values (v_card.tenant_id, v_uid, 'reward.unlocked', v_customer.name || ' unlocked ' || v_tenant.reward_text || '.');
  end if;
  return jsonb_build_object('ok', true, 'data', private.card_payload(
    v_card.code, v_card.stamps, v_tenant.stamp_goal, v_tenant.reward_text, v_card.reward_unlocked,
    v_card.rewards_redeemed, v_tenant.name, v_tenant.industry, v_tenant.logo_url, v_tenant.primary_color,
    v_tenant.accent_color, v_tenant.city, v_tenant.tagline, v_customer.name, v_tenant.read_only, false
  ) || jsonb_build_object('email', v_customer.email, 'phone', v_customer.phone, 'lastPunchAt', v_card.last_punch_at));
end;
$$;

revoke all on function public.punch_card(text, boolean) from public;
grant execute on function public.punch_card(text, boolean) to authenticated;

create or replace function public.redeem_card(p_code text, p_demo boolean default false, p_audience text default 'public')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_card public.cards;
  v_tenant public.tenants;
  v_customer public.customers;
begin
  select * into v_card from public.cards where lower(code) = lower(p_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'No card uses that code.'));
  end if;
  select * into v_tenant from public.tenants where id = v_card.tenant_id;
  select * into v_customer from public.customers where id = v_card.customer_id;
  if p_audience = 'staff' then
    if v_uid is null then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'UNAUTHORIZED', 'message', 'Staff sign-in is required to redeem.'));
    end if;
    if not exists (
      select 1 from public.memberships
      where user_id = v_uid and tenant_id = v_card.tenant_id and role in ('owner', 'staff')
    ) then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'That card is not on this account.'));
    end if;
  end if;
  if coalesce(p_demo, false) or v_tenant.read_only then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'READ_ONLY', 'message', 'This showcase card is read-only. Stamps stay put.'));
  end if;
  if not v_card.reward_unlocked then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'VALIDATION', 'message', 'The reward is not unlocked yet.'));
  end if;
  update public.cards
  set stamps = 0, reward_unlocked = false, rewards_redeemed = rewards_redeemed + 1, last_punch_at = now()
  where id = v_card.id
  returning * into v_card;
  insert into public.activity (tenant_id, actor_id, action, summary)
  values (v_card.tenant_id, v_uid, 'reward.redeemed', 'Redeemed ' || v_tenant.reward_text || ' for ' || v_customer.name || '.');
  return jsonb_build_object('ok', true, 'data', private.card_payload(
    v_card.code, v_card.stamps, v_tenant.stamp_goal, v_tenant.reward_text, v_card.reward_unlocked,
    v_card.rewards_redeemed, v_tenant.name, v_tenant.industry, v_tenant.logo_url, v_tenant.primary_color,
    v_tenant.accent_color, v_tenant.city, v_tenant.tagline, v_customer.name, v_tenant.read_only, false
  ));
end;
$$;

revoke all on function public.redeem_card(text, boolean, text) from public;
grant execute on function public.redeem_card(text, boolean, text) to anon, authenticated;

create or replace function public.lookup_card(p_contact text, p_name text, p_origin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_card public.cards;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'UNAUTHORIZED', 'message', 'Staff sign-in is required to pull up a card.'));
  end if;
  select tenant_id into v_tenant from public.memberships
  where user_id = v_uid and role in ('owner', 'staff')
  limit 1;
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'UNAUTHORIZED', 'message', 'Staff sign-in is required to pull up a card.'));
  end if;
  select c.* into v_card
  from public.cards c
  join public.customers cu on cu.id = c.customer_id
  where c.tenant_id = v_tenant
    and (
      lower(c.code) = lower(btrim(p_contact))
      or (position('@' in p_contact) > 0 and lower(cu.email) = lower(btrim(p_contact)))
      or (
        length(regexp_replace(p_contact, '\D', '', 'g')) >= 7
        and regexp_replace(cu.phone, '\D', '', 'g') = regexp_replace(p_contact, '\D', '', 'g')
      )
    )
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'data', (
      select private.card_payload(
        c.code, c.stamps, t.stamp_goal, t.reward_text, c.reward_unlocked, c.rewards_redeemed,
        t.name, t.industry, t.logo_url, t.primary_color, t.accent_color, t.city, t.tagline,
        cu.name, t.read_only, false
      ) || jsonb_build_object('email', cu.email, 'phone', cu.phone, 'lastPunchAt', c.last_punch_at)
      from public.cards c
      join public.tenants t on t.id = c.tenant_id
      join public.customers cu on cu.id = c.customer_id
      where c.id = v_card.id
    ));
  end if;
  if coalesce(btrim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'NOT_FOUND',
      'message', 'No card yet. Add the customer''s name to start one.',
      'canCreate', true
    ));
  end if;
  if exists (select 1 from public.tenants where id = v_tenant and read_only) then
    return jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'READ_ONLY', 'message', 'This showcase is read-only. Create your own program to stamp cards.'));
  end if;
  insert into public.customers (tenant_id, name, email, phone)
  values (
    v_tenant,
    btrim(p_name),
    case when position('@' in p_contact) > 0 then lower(btrim(p_contact)) else '' end,
    case when position('@' in p_contact) > 0 then '' else btrim(p_contact) end
  )
  returning id into v_card.customer_id;
  insert into public.cards (tenant_id, customer_id, code)
  values (v_tenant, v_card.customer_id, upper(substr(md5(gen_random_uuid()::text), 1, 8)))
  returning * into v_card;
  insert into public.activity (tenant_id, actor_id, action, summary)
  values (v_tenant, v_uid, 'card.created', 'Started a card for ' || btrim(p_name) || '.');
  return jsonb_build_object('ok', true, 'data', (
    select private.card_payload(
      c.code, c.stamps, t.stamp_goal, t.reward_text, c.reward_unlocked, c.rewards_redeemed,
      t.name, t.industry, t.logo_url, t.primary_color, t.accent_color, t.city, t.tagline,
      cu.name, t.read_only, false
    ) || jsonb_build_object('email', cu.email, 'phone', cu.phone, 'lastPunchAt', c.last_punch_at)
    from public.cards c
    join public.tenants t on t.id = c.tenant_id
    join public.customers cu on cu.id = c.customer_id
    where c.id = v_card.id
  ));
end;
$$;

revoke all on function public.lookup_card(text, text, text) from public;
grant execute on function public.lookup_card(text, text, text) to authenticated;
