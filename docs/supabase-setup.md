# Supabase dashboard settings

These settings live in the Supabase dashboard, not in code. If the project is
ever recreated, set them again. Project: `rnumsgxknettjvjyyxdj`.

Never paste the Resend API key or the database password anywhere except the
Supabase field that asks for it.

## 1. Email sender (Resend)

**Resend:** sign up at resend.com (free), then **API Keys → Create API key**,
permission **Sending access**. Copy the key; it is shown once.

**Supabase:** Authentication → Emails → **SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Sender email | `onboarding@resend.dev` (until a family domain is verified) |
| Sender name | `Bryan Family Directory` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key |

Until a domain is verified in Resend, emails only reach the address that owns
the Resend account.

## 2. Email templates: show the 6-digit code

Authentication → Emails → **Templates**. Edit both **Confirm signup** and
**Magic link** (new members get the first, returning members the second).

Subject:

```
Your Bryan Family Directory code
```

Body:

```html
<h2>Your sign-in code</h2>
<p>Enter this code to sign in to the Bryan Family Directory:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>The code works for one hour. If you didn't ask for it, you can ignore this email.</p>
```

## 3. Invite-only sign-up check

Authentication → **Auth Hooks** → **Add hook** → **Before User Created**:

| Field | Value |
|---|---|
| Hook type | Postgres |
| Schema | `private` |
| Function | `before_user_created` |

Enable it. This refuses any new account that doesn't carry a valid invitation.

**Only "Before User Created".** Do not attach this function to any other hook
(especially **Send Email**, which would stop all sign-in emails). Since
migration `20261024000002`, it refuses loudly if attached to Send Email.

**Deleting any hook in the dashboard can remove the sign-in service.s access to
the `private` schema.** If sign-ups then fail with "Error running hook", re-apply
the grants in `supabase/migrations/20261024000003_restore_hook_access.sql`.

## 4. Email sign-in

Authentication → **Sign In / Providers** → **Email**:

- Email provider: **enabled**
- Allow new users to sign up: **on** (the hook above decides who may)
- Email OTP length: **6**; expiration: **3600** seconds

## 5. Site address

Authentication → **URL Configuration** → Site URL: `http://localhost:3000`
while testing. Change it to the real address at launch.
