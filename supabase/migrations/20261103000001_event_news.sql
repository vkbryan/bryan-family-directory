-- =============================================================================
-- Event news: a contact list for future family events, by choice only.
--
-- Each member says yes or no once ("Send me news about family events") and
-- can change their mind on their profile. A yes can use their sign-in email
-- or a different one. Only admins see the list.
--
-- Changes:
-- 1. private.event_news: one row per account that has answered. Not readable
--    by the app directly.
-- 2. my_event_news / set_event_news: a member reads and changes their own.
-- 3. admin_contact_list: everyone who said yes, for admins only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The answers
-- -----------------------------------------------------------------------------

create table private.event_news (
  account_id  uuid primary key references public.accounts (id) on delete cascade,
  wants_news  boolean not null,
  -- Null means "use my sign-in email".
  email       text check (char_length(email) <= 320),
  answered_at timestamptz not null default now()
);

alter table private.event_news enable row level security;


-- -----------------------------------------------------------------------------
-- 2. A member's own answer
-- -----------------------------------------------------------------------------

-- No row yet means they haven't been asked.
create function public.my_event_news()
returns table (wants_news boolean, email text, sign_in_email text)
language sql stable
security definer
set search_path = ''
as $$
  select n.wants_news, n.email, u.email
  from auth.users u
  left join private.event_news n on n.account_id = u.id
  where u.id = auth.uid() and private.is_active_member();
$$;

create function public.set_event_news(p_wants_news boolean, p_email text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := nullif(lower(btrim(p_email)), '');
begin
  perform public.require_active_member();
  if p_wants_news is null then
    raise exception 'answer_required';
  end if;
  if clean_email is not null and clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'email_invalid';
  end if;
  -- The same as the sign-in email is stored as "use my sign-in email", so it
  -- follows them if they change it later.
  if clean_email = (select lower(email) from auth.users where id = auth.uid()) then
    clean_email := null;
  end if;

  insert into private.event_news (account_id, wants_news, email)
  values (auth.uid(), p_wants_news, case when p_wants_news then clean_email end)
  on conflict (account_id) do update
    set wants_news = excluded.wants_news, email = excluded.email, answered_at = now();

  perform public.write_audit('event_news.answered', null, auth.uid(),
    jsonb_build_object('wants_news', p_wants_news));
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. The contact list
-- -----------------------------------------------------------------------------

create function public.admin_contact_list()
returns table (
  full_name   text,
  email       text,
  branch      text,
  city        text,
  state       text,
  answered_at timestamptz
)
language sql stable
security definer
set search_path = ''
as $$
  select p.full_name, coalesce(n.email, u.email), b.name, p.city, p.state, n.answered_at
  from private.event_news n
  join public.accounts a on a.id = n.account_id
  join auth.users u on u.id = n.account_id
  left join public.profiles p on p.account_id = n.account_id and p.archived_at is null
  left join public.profile_branches pb on pb.profile_id = p.id and pb.is_primary
  left join public.family_branches b on b.id = pb.branch_id
  where n.wants_news
    and a.status = 'active'
    and private.is_admin()
  order by p.full_name nulls last, 2;
$$;

revoke execute on function public.my_event_news(), public.set_event_news(boolean, text),
  public.admin_contact_list() from public, anon;
grant execute on function public.my_event_news(), public.set_event_news(boolean, text),
  public.admin_contact_list() to authenticated;
