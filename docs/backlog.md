# Backlog

What's next, what's waiting, and what's done. Updated as work happens.
No personal details here: relatives are described generally.

## Next up

1. **WhatsApp group link with quick approval** (decided)
   - One link for the family group chat, with an expiry and a cap on sign-ups; can be cancelled anytime.
   - New people sign in with an email code and fill in name, nickname, branch and city.
   - An admin approves each with one tap on the Admin home; until then they see nothing.
   - **Pre-approved email list:** relatives whose email is on the list skip approval. The list is stored privately (admins only). Load it from a file in `private-data/`, never pasted in chat.
2. **Hotmail / Outlook sign-in emails** (a pilot relative never received her code)
   - Findings (Oct 27): the email records are correct (DKIM signed by Resend, DMARC passes). Likely causes: the domain was only 3 days old when she tried (Microsoft is hardest on new domains), the domain has no mailbox (no MX record), so replies can't be received, and the email is a bare code with little text.
   - Checked Resend → Emails: both codes "Delivered" within the same minute, nothing after, so Microsoft accepted them and filtered them out of sight (Resend isn't blocking the address). Resend's Insights pass every check except one suggestion: "Use a subdomain".
   - Before sending emailed invitations in bulk, send sign-in codes from a subdomain (e.g. `login.bryan-family.com`) so bulk mail can't drag down the codes' reputation.
   - Set up hello@ forwarding to the admin's Gmail (adds MX records, which also helps deliverability).
   - Hint on the code screen: "Using Hotmail or Outlook? Check Junk, add bryan-family.com to Safe senders, or use another email."
   - Friendlier sign-in email text (a bare code can look like spam to Microsoft).
   - Optional: admin-assisted sign-in code for relatives who can't receive email (needs the Supabase secret key kept only on the admin's Mac).
3. **Reorganize and consolidate the home page** (it feels too busy)
   - Today, top to bottom: greeting and count, "Your profile" card, search and filters, birthdays, browse by branch, shared interests, where we live, everyone, then the invite/admin/sign-out buttons.
   - Decide which sections matter most and put them first; combine overlapping ones (the branch, interest and place chips repeat what the filters already do).
   - Options to weigh: show the family grid sooner, fold the browse chips into the filters or behind a "Browse" toggle, make "Your profile" smaller, keep birthdays short.
   - Sketch two or three layouts to choose from before changing anything.
4. **Finish the pilot:** collect feedback (what was confusing, did you find someone, what would bring you back), fix what tripped people up, then roll out the WhatsApp link.

## Waiting / clean-up

- Forward replies sent to hello@bryan-family.com to the admin's Gmail.
- Retire the old Softr site and disconnect it from Airtable; keep the Airtable base as a read-only archive for a while. (Airtable warned the free API limit was near; that's Softr, not this site.)
- Update the backup workflow's GitHub building blocks (Node 20 deprecation warning; `ubuntu-latest` moving to Ubuntu 26).
- Swap in a full-size reunion photo if the original turns up (current one is 640px wide).
- Importer: reuse the website's state and interest tidying (`src/lib/places.ts`, `src/lib/interests.ts`) for any future CSV imports.
- Add a second admin (and maybe a "branch captain" per branch) so approvals don't all wait on one person.

## Ideas for later

- Interactive family tree (parent and partner links are already recorded).
- Emailed invitations to the pre-approved list for relatives not in WhatsApp (100 emails/day free; send in batches).
- "Recently updated" or "new members" on the home page.
- Birthday reminders (opt-in).
- Shorter branch labels on tiles, e.g. "Joe B." instead of "Joseph Bryan (Joe B.)".
- More countries in the State list's "Outside the US" group.
- Admin page to change the invitation photo without help.
- Partners/spouses shown on profiles (the database already supports it).

## Before the full launch (Milestone 8)

- Accessibility check (keyboard, screen reader, text size) on a phone and a computer.
- Security review: rerun the stranger tests and Supabase's security checker; review admin list.
- Plain-English maintenance notes: adding admins, replacing the invitation photo, what to do if backups fail.
- A restore drill from a real nightly backup into a scratch Supabase project.

## Done

### Pilot feedback (October 2026)

- "Your profile" card with an Edit button at the top of the home page.
- Directory tiles show name, location and branch.
- Each branch has its own color on tiles, chips and profiles.
- State is a dropdown; "GA"/"NY" tidied to Georgia/New York.
- Children show whose child they are ("Vanessa Bryan's child"); admins record parents on the child's edit page.
- Interests typed as a comma-separated list are added separately; one combined entry was split.
- "Invite a relative" added to the admin menu.
- Fixed: a child's page told admins "your request is waiting" for someone else's request.

### Before the pilot

- Jamaican flag design with the motto; reunion photo on valid invitation pages; pilot checklist on the Admin home.
- Site online at https://bryan-family.com (Vercel), with safety headers and no search-engine indexing.
- Milestones 1–6: database and permissions, invite-only email-code sign-in, Airtable import (8 profiles, 8 photos, 14 branches), searchable directory, profile editing with photos and children, admin tools, nightly encrypted backups with a practice restore.
