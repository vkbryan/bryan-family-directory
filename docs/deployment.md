# Running the live site

The website runs on **Vercel** (free Hobby plan, personal use) at
**https://bryan-family.com**. Every change merged into `main` on GitHub goes
live automatically within a couple of minutes.

## Vercel settings

Project → **Settings** → **Environment Variables** (Production):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rnumsgxknettjvjyyxdj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (Supabase → Project Settings → API Keys); public by design |
| `SITE_URL` | `https://bryan-family.com` (used in invitation links) |

Never add the Supabase secret (service role) key or the database password to
Vercel. The website doesn't need them.

**Deployment Protection:** keep "Vercel Authentication" on for preview
deployments, so test versions from other branches need a Vercel sign-in.

## Domain

Vercel → Project → **Settings** → **Domains**: `bryan-family.com` (main) and
`www.bryan-family.com` (redirects to it). The DNS records Vercel shows are
added in Squarespace → Domains → bryan-family.com → **DNS**. Leave the email
records alone: `resend._domainkey`, `send`, `rsend` and `_dmarc` are what let
sign-in codes reach relatives.

## Supabase

Authentication → **URL Configuration** → Site URL: `https://bryan-family.com`.

## What protects the live site

- Family data needs a signed-in, active member; the database enforces this.
- Search engines are told not to index anything (robots.txt and an
  `X-Robots-Tag` header on every page).
- Safety headers on every page: no embedding in other sites, HTTPS only, no
  camera/microphone/location, minimal referrer information.
