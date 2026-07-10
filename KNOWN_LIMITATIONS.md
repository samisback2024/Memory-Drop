# Known Limitations

A curated list of what a beta user, reviewer, or new contributor is most likely to actually hit. Every phase's README section (`README.md`, search for "## Known limitations") has the exhaustive, phase-by-phase record — this file surfaces the ones that matter most at launch, in one place.

## Testing

- **No automated test suite exists.** Zero unit/integration/E2E test framework is installed (confirmed via `package.json` — 5 runtime dependencies, no Jest/Vitest/Playwright). Every phase of this project has instead shipped a real, precise manual testing checklist (see each "Testing PhaseN" README section, and `TEST_PLAN.md` for this phase's). Adding a real automated suite is a deliberate, separate decision — this project has a strong, repeated "no new dependency without a clear reason" precedent, and a test framework is exactly the kind of foundational choice that shouldn't be added silently.
- **QA at scale (1000/5000 simulated users) relies on `dev_seed_scale_test.sql`**, a fixture script, not real production traffic. It's a reasonable proxy for data-volume/consistency bugs, not for real network conditions, real device diversity, or genuinely concurrent write load.

## Dark mode & Accessibility

- **Dark mode is real and substantial, but not app-wide.** As of Phase 13: `settings/`, `messages/`, `ui/`, `notifications/` are fully covered; `social/`, `moments/`, `profile/` were brought from 0% to fully covered this phase; `feed/` and `capsules/` have their highest-traffic/most-visible files fixed but not every file. `memories/` remains mostly unfixed beyond `MemoryCard` itself. Switching to dark mode changes the vast majority of what a user actually sees day to day, but not literally everything.
- **No automated contrast-ratio audit has been run.** Keyboard navigation, focus order, and reduced-motion support are all real and confirmed solid; color contrast specifically needs a tool like axe DevTools run by a human against a real browser session.
- **Screen-reader alt text is fixed on the highest-traffic content images**, not every image in the app. Icon-only buttons are covered where spot-checked (`CapsuleCard`'s action row this phase); a full sweep of every icon-only button across ~180 components hasn't been done.

## Performance

- **No true list virtualization anywhere** — Feed, Explore, and Memories all accumulate DOM nodes as you scroll rather than windowing them. Chat's message list (Phase 12) is the one exception, capped at ~150 in-memory messages. A real virtualization library (`@tanstack/react-virtual`) is the natural upgrade if long scroll sessions become a real complaint — not added, to keep the zero-new-dependency posture.
- **Video is never compressed or transcoded.** Uploads go to Storage as-is (capped at 50MB client + server-side). Real compression needs ffmpeg.wasm (a sizeable new dependency) or a server-side transcode pipeline (new infrastructure) — out of scope everywhere it's come up.
- **No Web Vitals / real-user performance monitoring.** The new analytics pipeline tracks product events, not page-load/interaction timing.

## Security architecture (deliberate tradeoffs, not oversights)

- **Media URLs are public-read-plus-unguessable-path, not signed/expiring URLs.** Every Storage bucket in this app uses the same pattern: public bucket, unpredictable per-user path, and the URL is only ever handed to an authorized client by an app-level RPC. This trades true access revocation (a signed URL naturally expires; a guessed public URL doesn't) for simplicity and free CDN/browser caching. If a leaked-URL scenario ever becomes a real threat model, moving to signed URLs is a genuine architecture change, not a quick fix.
- **`moderation_status` (Phase 10f) still isn't enforced by any content-read path.** An admin can flag content as hidden/removed, but Feed/Explore/Search/Memories all still show it exactly as if it were active — this was a deliberate "architecture, no enforcement wiring yet" scope cut when the admin groundwork shipped, revisited only once a real admin UI exists to inform how enforcement should actually behave.

## Analytics & Logging

- **Analytics events aren't queryable through the app** — `analytics_events` is genuinely write-only from the client (by RLS design, for privacy), which also means there's no built-in dashboard; reading it back requires direct SQL access to the Supabase project. See `LAUNCH_CHECKLIST.md`.
- **"Server" logging doesn't exist as a separate concept** in this app's architecture — there is no custom backend server (Supabase is the entire backend). Structured client logging exists (`src/lib/logger.ts`); "server" logs are Supabase's own dashboard logs plus this app's own `raise exception` error messages, which have always surfaced directly to the client.
- **Drop unlocks aren't tracked as an analytics event**, unlike Capsule unlocks — Drops unlock passively over time with no single client action to hook a `track()` call to, the same reason Phase 11's notification system couldn't hook a trigger to it either.

## Website / App Store

- **There's no separate marketing landing page.** `/` is this app's own login/redirect entry point. A real pre-signup marketing homepage (hero copy, feature highlights, social proof) is a genuinely separate, feature-sized piece of scope that wasn't built here — the new `/support` page and the existing Terms/Privacy pages are the only fully public-and-unauthenticated surfaces today.
- **No app store presence yet.** This is a web app; shipping to the Apple App Store / Google Play needs a packaging decision (Capacitor, Bubblewrap, or similar) that hasn't been made. `APP_STORE_ASSETS.md` has real drafted listing copy ready for whenever that happens; the "Coming soon" buttons on `/support` are honest placeholders, not a claim of an imminent launch date.
- **Adaptive Android icon, splash screen image, and real screenshots don't exist yet** — all three need actual image-generation/design tooling this environment doesn't have access to. Exact specs are documented in `APP_STORE_ASSETS.md` for whoever picks this up.

## Messaging (Phase 12, hardened this phase)

- **A blocked user's already-sent messages/media aren't retroactively hidden or deleted** — blocking (as of this phase's fix) stops them from reading further history, sending new messages, seeing typing, or reacting, but doesn't purge what already happened before the block.
- **No group chat** — this remains a strictly 1:1 messaging system; see the Phase 12 README section for the full reasoning.

## General

- **`moderate_content()`/`get_content_reports()` have no admin UI.** Real, correctly-secured RPCs with no screen to call them from — same posture since Phase 10f, unchanged.
- **Two-factor authentication and "download my data" remain UI shells**, exactly as scoped since Phase 8 — real backing implementation is a deliberate, separate follow-up in both cases.
