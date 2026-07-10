# Launch Checklist

Ordered, human-operator action items to actually take Memory Drop from "code is ready" to "real beta users can sign up." Nothing here can be done from this environment — it all needs real credentials, a real Supabase dashboard, or a real app-store account. Cross-referenced against `PRODUCTION_CHECKLIST.md` (what's done in code) and `KNOWN_LIMITATIONS.md` (what's honestly not).

## 1. Database

- [ ] Run every `supabase/*.sql` migration **in the exact order listed in the README's "Getting started" section**, ending with `supabase/phase13_production_hardening.sql`.
- [ ] Confirm `supabase/phase13_production_hardening.sql` applied cleanly — spot-check: `select is_blocked_either_way('<test-user-id>')` should exist as a function, and `select allowed_mime_types from storage.buckets where id = 'chat-media';` should return a non-null array.
- [ ] Do **not** run `supabase/dev_seed_scale_test.sql` against production — it's scale-test fixture data only (see `TEST_PLAN.md`).

## 2. Environment & secrets

- [ ] Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel (Production + Preview).
- [ ] Configure a real SMTP provider (Resend/Postmark/SendGrid) under Supabase → Authentication → Settings → SMTP — the built-in sender's rate limit is far too low for real signups (documented since Phase 1).
- [ ] Set up Google OAuth credentials for production (separate from any local-dev OAuth client) — Authorized origins/redirect URIs need the real production domain, not `localhost`.
- [ ] Decide on and configure a custom domain in Vercel, then:
  - [ ] Update `index.html`'s `og:image`/`twitter:image`/`og:url` to absolute URLs on the real domain (currently relative — see Phase 13 README note).
  - [ ] Update Google OAuth's redirect URI to match.

## 3. Optional but recommended before public beta

- [ ] Enable `pg_cron` in the Supabase dashboard (Database → Extensions) and schedule `generate_unlock_reminders()` and `generate_weekly_recap()` (Phase 11) — both are real, tested functions that currently have nothing calling them.
- [ ] Have a real lawyer review `TermsPage.tsx`/`PrivacyPage.tsx` — both are explicitly marked as placeholder copy in their own file headers.
- [ ] Register `support@memorydrop.app` (or whichever domain is chosen) as a real, monitored inbox — it's referenced on the Terms, Privacy, and new Support pages today but its deliverability hasn't been verified from this environment.
- [ ] Decide whether to flip any account to `is_admin = true` (Phase 10f) for moderation purposes — there's still no admin UI, only the underlying `moderate_content()`/`get_content_reports()` RPCs, callable via direct SQL.

## 4. Manual QA pass

- [ ] Run through `TEST_PLAN.md` in full on a staging/disposable Supabase project — at minimum the "100 users" tier and the offline/reconnect/dark-mode/accessibility sections.
- [ ] Test the real password-reset and email-verification flows end to end with the real SMTP provider configured (step 2) — these were only ever testable in principle before a provider is wired up.
- [ ] Confirm the blocked-user fixes in `phase13_production_hardening.sql` actually work: block someone mid-conversation, confirm they can no longer fetch message history via a direct `/rest/v1/rpc/get_messages` call with their own token.

## 5. App icons & store assets (needs a designer)

- [ ] Generate a real Android adaptive icon (separate foreground/background layers) — see `APP_STORE_ASSETS.md` for exact spec.
- [ ] Generate a splash screen image (or confirm the solid-`background_color` manifest fallback is acceptable for launch).
- [ ] Capture real screenshots per the layout plan in `APP_STORE_ASSETS.md` (5-8 per platform).
- [ ] Design the feature graphic (Google Play requires 1024×500).

## 6. App store submission (when ready to leave beta/web-only)

- [ ] Decide on a packaging approach for iOS/Android (this is a web app today — needs a wrapper like Capacitor/Bubblewrap, or a decision to stay web-only for launch).
- [ ] Fill in the privacy-labels questionnaire (Apple App Store) using the checklist in `APP_STORE_ASSETS.md` as the source of truth for what data is actually collected.
- [ ] Replace the "Coming to the App Store" / "Coming to Google Play" placeholder buttons on `/support` with real store links once listings exist.

## 7. Post-launch monitoring

- [ ] Set up a way to actually *read* the `analytics_events` table (a Supabase dashboard SQL query, or a lightweight internal tool) — right now it's write-only from the client by design, and nothing queries it yet.
- [ ] Watch Supabase's own dashboard logs for RLS-denial spikes or slow-query warnings in the first few days of real traffic.
- [ ] Confirm real users' `client_error` events (in `analytics_events`) aren't dominated by one recurring crash before declaring the beta stable.

---

Nothing in this list blocks the codebase from being deployed today — Vercel will build and serve the app correctly as-is (`vercel.json`'s SPA rewrite is already correct). This checklist is about the *product* being genuinely ready for real users, not the *code* being deployable.
