# Backlog

What's next, what's waiting, and what's done. Updated as work happens.
No personal details here: relatives are described generally.

## Next up

1. **WhatsApp group link** (built Nov 2)
   - Done: Admin → Group link makes one link for the family chat: up to 50 people, 14 days, cancel anytime. New people join straight away (decided: no approval step). Shown once, with Copy and Share on WhatsApp.
   - Watch Admin → Members after sharing; if the link spreads beyond the family, cancel it and deactivate anyone who shouldn't be there.
   - Later, if needed: approval step or a pre-approved email list (stored privately, loaded from `private-data/`, never pasted in chat).
2. **Hotmail / Outlook sign-in emails** (a pilot relative never received her code)
   - Findings (Oct 27): the email records are correct (DKIM signed by Resend, DMARC passes). Likely causes: the domain was only 3 days old when she tried (Microsoft is hardest on new domains), the domain has no mailbox (no MX record), so replies can't be received, and the email is a bare code with little text.
   - Checked Resend → Emails: both codes "Delivered" within the same minute, nothing after, so Microsoft accepted them and filtered them out of sight (Resend isn't blocking the address). Resend's Insights pass every check except one suggestion: "Use a subdomain".
   - Before sending emailed invitations in bulk, send sign-in codes from a subdomain (e.g. `login.bryan-family.com`) so bulk mail can't drag down the codes' reputation.
   - Done (Nov 2): hello@ forwards to the admin's Gmail through Squarespace (added MX records; root SPF now includes Mailgun). Resend records unchanged.
   - Next: test with an Outlook.com address made for testing (inbox, Junk or missing?); if missing, file Microsoft's sender-support form.
   - Done: Hotmail/Outlook hint on the code screen; friendlier sign-in email text (in `docs/supabase-setup.md`, pasted into Supabase's templates).
   - Optional: admin-assisted sign-in code for relatives who can't receive email (needs the Supabase secret key kept only on the admin's Mac).
3. **Reorganize and consolidate the home page** (it feels too busy)
   - Today, top to bottom: greeting and count, "Your profile" card, search and filters, birthdays, browse by branch, shared interests, where we live, everyone, then the invite/admin/sign-out buttons.
   - Decide which sections matter most and put them first; combine overlapping ones (the branch, interest and place chips repeat what the filters already do).
   - Options to weigh: show the family grid sooner, fold the browse chips into the filters or behind a "Browse" toggle, make "Your profile" smaller, keep birthdays short.
   - Sketch two or three layouts to choose from before changing anything.
   - Done: "Shared interests" removed from the home page (still under Advanced search and on profiles); "More filters" renamed "Advanced search".
   - Done: menu bar under the banner (Home, My profile, + Invite, Admin, Sign out) replaces the bottom buttons and "← Back" links; breadcrumbs on the edit and add-a-child pages.
   - Done: "Everyone" page in the menu, with search, Advanced search and every tile; the home page shows the 12 newest profiles and a simple search box that opens Everyone; site footer.
   - Menu (Nov 3): Home, Family (everyone), Me, Info (family links), + Invite, then Admin and Sign out. Addresses: /family (everyone), /info (links).
4. **Getting invitations opened** (5 sent, none joined yet; at least one wasn't even read in WhatsApp)
   - Done: link preview picture and warmer text; invitation page says "takes about a minute, just your name" and how many relatives are already in; friendlier ready-made text message.
   - Tip for sending: put the reason and the link in one message, rather than waiting for "sure".
   - Expiry stays at 14 days for now (decided).
   - Done: invitation page trimmed, and the email box is on the invitation page itself (no hop to the sign-in page).
5. **Helping people through sign-in** (a relative replied to the code email instead of typing the code)
   - Done: code screen says to keep the page open and type the code there; the site remembers a waiting code for an hour, so coming back opens straight at the code box.
   - Maybe: reword the sign-in email to lead with "type this code on the page" and add a link back to the site.
6. **Contact list for family events** (built Nov 3)
   - Done: members are asked once on the home page ("Send me news about family events?"), can change it on their own Edit profile page, and choose their sign-in email or another. Admin → Contact list shows everyone who said yes, with a spreadsheet (CSV) download. Deactivated members drop off.
   - Later: relatives who haven't joined aren't on it; children's profiles never are.
7. **Family hub** (replacing the public 2025 reunion Linktree)
   - Done (Nov 3): members-only Info page (Stay in touch, Our history, Get involved, Past events); Admin → Family links to add, edit, reorder, hide and delete. "My profile" in the menu is now "Me".
   - Next: add the real links (WhatsApp chat, photo album, family tree, brainstorm doc), then retire or privatize the Linktree.
   - Later: an Events page (next reunion with its key links on the home page), a family tree drawn from recorded parent links.
8. **Finish the pilot:** collect feedback (what was confusing, did you find someone, what would bring you back), fix what tripped people up, then roll out the WhatsApp link.

## Waiting / clean-up

- Retire the old Softr site and disconnect it from Airtable; keep the Airtable base as a read-only archive for a while. (Airtable warned the free API limit was near; that's Softr, not this site.)
- Backup: Supabase sometimes adds its own tables before the CLI's practice copy has them; the practice restore now skips those with a warning (fixed Nov 3). Updating the CLI pin would make the warnings go away.
- Update the backup workflow's GitHub building blocks (now in vkbryan/family-directory-backups) (Node 20 deprecation warning; `ubuntu-latest` moving to Ubuntu 26).
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
