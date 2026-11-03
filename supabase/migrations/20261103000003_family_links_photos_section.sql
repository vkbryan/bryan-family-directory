-- A "Photos" section on the Family page, for shared albums.

alter table public.family_links drop constraint family_links_section_check;
alter table public.family_links add constraint family_links_section_check
  check (section in ('stay_in_touch', 'photos', 'history', 'get_involved', 'past_events'));
