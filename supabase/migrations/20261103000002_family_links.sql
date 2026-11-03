-- =============================================================================
-- Family links: the family's shared places (WhatsApp chat, photos, family
-- tree, planning docs), on a members-only page instead of a public Linktree.
--
-- Admins add, edit, reorder, hide and delete links. Signed-in members see the
-- links that aren't hidden. Nobody else sees anything.
-- =============================================================================

create table public.family_links (
  id         uuid primary key default gen_random_uuid(),
  section    text not null check (section in ('stay_in_touch', 'history', 'get_involved', 'past_events')),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  url        text not null check (char_length(url) <= 1000 and url ~ '^(https://|mailto:)'),
  note       text check (char_length(note) <= 200),
  icon       text not null default 'link'
             check (icon in ('link', 'chat', 'email', 'tree', 'photos', 'calendar', 'video', 'document', 'form', 'money', 'beach')),
  sort_order integer not null default 0,
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.accounts (id) on delete set null default auth.uid()
);

alter table public.family_links enable row level security;

create policy family_links_read on public.family_links for select to authenticated
  using ((not hidden and (select private.is_active_member())) or (select private.is_admin()));
create policy family_links_insert on public.family_links for insert to authenticated
  with check ((select private.is_admin()));
create policy family_links_update on public.family_links for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy family_links_delete on public.family_links for delete to authenticated
  using ((select private.is_admin()));

grant select, delete on public.family_links to authenticated;
grant insert (section, title, url, note, icon, sort_order, hidden) on public.family_links to authenticated;
grant update (section, title, url, note, icon, sort_order, hidden) on public.family_links to authenticated;
