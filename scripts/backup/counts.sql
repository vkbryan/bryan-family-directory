-- profiles, accounts, sign-in users, photos, audit entries: one comma-separated line.
select concat_ws(',',
  (select count(*) from public.profiles),
  (select count(*) from public.accounts),
  (select count(*) from auth.users),
  (select count(*) from storage.objects where bucket_id = 'profile-photos'),
  (select count(*) from public.audit_log)
);
