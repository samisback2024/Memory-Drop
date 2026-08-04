# App Store & Google Play Submission Plan

The complete, current, actionable path from "Memory Drop is a web app today" to "live in both app stores." This is a living document — update it whenever the packaging/submission state actually changes, the same way `README.md` gets a new phase section per engineering phase. Everything here was checked against the real codebase on 2026-07-17 (59 migrations, `phase1` through `phase28`), not assumed.

Related docs, so this one doesn't repeat them: `LAUNCH_CHECKLIST.md` (web-launch prerequisites), `APP_STORE_ASSETS.md` (drafted store copy, privacy-label tables, screenshot/icon specs), `KNOWN_LIMITATIONS.md` (honest gaps), `PRODUCTION_CHECKLIST.md` (what's done in code).

---

## Where things actually stand today

- **Memory Drop is a React 19 + Vite single-page web app.** `package.json` has zero native/mobile dependencies — no Capacitor, Cordova, React Native, or Expo installed. Nothing has been wrapped yet.
- **It's already PWA-shaped**, which matters for what comes next: `public/site.webmanifest`, `apple-touch-icon.png`, `icon-192.png`/`icon-512.png` (marked `"purpose": "any maskable"`) all exist and work today. A user can already "Add to Home Screen" on iOS/Android and get an app-like icon and standalone window — this is real, live, zero-cost distribution that doesn't need either store.
- **No packaging decision has been executed.** `LAUNCH_CHECKLIST.md` and `KNOWN_LIMITATIONS.md` have both flagged this as an open decision for a while; this document is that decision, made concrete.
- **Store-readiness gaps that exist regardless of packaging approach**, carried over from `LAUNCH_CHECKLIST.md`/`KNOWN_LIMITATIONS.md` (don't re-solve these here, just tracking that they block submission either way):
  - `TermsPage.tsx`/`PrivacyPage.tsx` are explicitly placeholder copy — both stores' reviewers check that these links are live and real, not just present.
  - No adaptive Android icon (needs separate foreground/background layers), no splash screen art, no real device screenshots — specs already drafted in `APP_STORE_ASSETS.md`, execution needs a designer or design tool.
  - `APP_STORE_ASSETS.md`'s long description and Part 2 of `README2.md` both still describe the old "message requests from strangers" messaging model — messaging now strictly requires mutual Orbit (see `supabase/phase28_mutual_orbit_messaging.sql`); both need a copy pass before submission (tracked below).
  - No real production domain configured yet in Vercel (also blocks the Google OAuth branding fix from the last round of work — same underlying prerequisite).
  - `moderate_content()`/`get_content_reports()` (Phase 10f) have no admin UI — this stops being a "nice to have later" once you're a UGC app under App Store/Play review (see Phase 2/3 below, this becomes a real submission requirement, not a backlog item).

---

## The packaging decision: Capacitor, for both platforms

Three real options existed; here's why one wins clearly for this specific app:

| Option | Verdict |
|---|---|
| **Capacitor** | ✅ **Recommended.** Wraps the existing, finished Vite/React app in a thin native shell for iOS *and* Android from one codebase. Zero rewrite of anything already built. Native API access (camera, push notifications, etc.) available later via plugins if ever needed, but not required to ship. This is the standard modern path for "mature React web app → app stores" — Ionic (Capacitor's maintainer) built it for exactly this migration. |
| **Bubblewrap / TWA (Trusted Web Activity)** | ❌ Android-only — Apple has no equivalent, so this can't be the whole answer if both stores are the goal. Lighter-weight than Capacitor for Android alone, but splitting iOS onto a totally different toolchain later is more total work than just using Capacitor for both from the start. |
| **React Native rewrite** | ❌ Throws away the entire existing, working, 28-phases-deep web codebase and rebuilds the UI layer from scratch in a different rendering system. Months of duplicate work for an app that's already feature-complete. Not appropriate here. |

**Decision: Capacitor for both iOS and Android.**

---

## Phase 0 — Finish the web-launch prerequisites first

`README2.md`'s existing recommendation still holds and this plan doesn't second-guess it: **launch web-first / PWA-installable before wrapping for the stores.** Reasoning, concretely:
- App store review cycles (Phase 2/3 below) add real friction to iteration speed. It's cheaper to find and fix bugs against real users on the web first.
- A native wrapper is easiest to build correctly once the underlying web app is stable, not while it's still actively changing day to day.
- Nothing about wrapping later is harder than wrapping now — Capacitor works the same regardless of how many users you already have.

Concrete blockers to clear first (full detail in `LAUNCH_CHECKLIST.md`, summarized here as the app-store-relevant subset):
- [ ] Run every pending Supabase migration through `phase28_mutual_orbit_messaging.sql`.
- [ ] Real SMTP provider configured (Supabase's default sender rate-limits far too low for real signups — this breaks account creation for real users, which breaks App Review testing too).
- [ ] Real production domain live in Vercel.
- [ ] Google OAuth production credentials + consent screen branding (App name = "Memory Drop", logo, privacy/terms links) — same prerequisite as the OAuth branding work already scoped.
- [ ] Legal review pass on Terms/Privacy — real copy, not the placeholder text currently in `TermsPage.tsx`/`PrivacyPage.tsx`.
- [ ] `pg_cron` enabled for `generate_unlock_reminders()`/`generate_weekly_recap()` — not a hard submission blocker, but genuinely improves what reviewers and early users experience.
- [ ] Refresh `APP_STORE_ASSETS.md`'s long description and `README2.md` Part 2's messaging description — both still describe the pre-Phase-28 "message requests from strangers" model; messaging is now mutual-Orbit-only.

---

## Phase 1 — Capacitor integration (code-level, do this once Phase 0 is clear)

1. **Install**: `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. **Initialize**: `npx cap init` — prompts for app name (`Memory Drop`) and app ID. **The app ID is a reverse-domain string (e.g. `app.memorydrop.mobile`) that gets baked into both store listings and cannot be changed later without creating an entirely new listing** — decide it once, deliberately, before running this command.
3. **Configure `capacitor.config.ts`**: `webDir: 'dist'` (matches this project's existing Vite build output exactly, no change needed there).
4. **Build and add platforms**: `npm run build`, then `npx cap add ios` and `npx cap add android` — generates the native Xcode/Android Studio project shells.
5. **Sync after every web change**: `npx cap sync` copies the latest `dist/` build into both native projects. This becomes a normal step in the release process from here on (add it to whatever deploy script exists).
6. **Icons**: generate the full icon set from one 1024×1024 source image via `npx @capacitor/assets generate` (installs `@capacitor/assets` as a dev dependency) — this produces both the iOS icon set and the Android adaptive icon's layers automatically, which directly closes the "no adaptive Android icon" gap `APP_STORE_ASSETS.md` flagged, once real source art exists.
7. **Splash screen**: `@capacitor/splash-screen` plugin, configured with the app's existing brand purple as the background color — closes the "no splash image" gap with the documented manifest-color fallback as a safe default if custom art isn't ready yet.
8. **Status bar / safe areas**: `@capacitor/status-bar` plugin so the native status bar matches the app's light/dark theme instead of defaulting to the OS default.
9. **Local testing**:
   - Android: `npx cap run android` — needs Android Studio installed, works on Windows/Mac/Linux.
   - iOS: `npx cap run ios` — **needs Xcode, which is Mac-only.** If there's no Mac available, this is a real blocker, not a preference — options are buying/borrowing a Mac, or a cloud Mac CI service (MacStadium, Codemagic, GitHub Actions' macOS runners) to build and sign without owning one. Flagging this now since it's the single most common surprise blocker for teams doing this for the first time.
10. **(Later, optional, not required for initial submission)** Push notifications for unlock reminders — `README2.md`'s growth playbook already identifies unlock reminders as a real retention lever currently only reachable via in-app `pg_cron` + the Activity Center. Wiring real OS push would need `@capacitor/push-notifications` + Apple Push Notification service / Firebase Cloud Messaging setup — a separate, later scope, don't block initial store submission on it.

---

## Phase 2 — iOS App Store submission

- **Apple Developer Program**: $99/year. Enrolling as an organization (recommended for a real product, not a personal account) needs a D-U-N-S number, which can take 1-2 weeks to obtain if the business doesn't already have one — start this early, it's the most common timeline surprise.
- **App Store Connect**: create the app listing; Bundle ID must match the app ID chosen in Phase 1 step 2 exactly.
- **UGC/social-app-specific requirements** (Memory Drop has user profiles, photo/video sharing, and direct messaging — Apple's Guideline 1.2 applies): reviewers require a working in-app report/block mechanism (block/mute/restrict already exist and work) **and** a way for the developer to act on reports within 24 hours. The `moderate_content()`/`get_content_reports()` RPCs already exist in the database (Phase 10f) but have **no admin UI** — this needs to become real before submission, not stay a backlog item, or Guideline 1.2 rejection is likely.
- **Age rating questionnaire**: UGC + messaging apps commonly land at 17+ under Apple's system unless additional safeguards exist. Answer honestly based on what the app actually does (photo/video sharing, direct messaging, no algorithmic feed, no ads).
- **Privacy Nutrition Label**: use the already-drafted data-collection table in `APP_STORE_ASSETS.md` directly — it's real, checked against the actual schema, not a guess.
- **Screenshots**: iPhone 6.7"/6.5" required; iPad if the app will be listed as iPad-compatible (Tailwind's responsive breakpoints likely make this viable without extra work, worth a real device/simulator check before deciding). Layout plan and captions already drafted in `APP_STORE_ASSETS.md`.
- **TestFlight**: strongly recommended before public submission. Internal testers (up to 100, your own team) get access immediately; external testers need a lightweight Beta App Review first (faster/lighter than full App Review).
- **Demo account for reviewers**: Apple's reviewers need real, working login credentials to test messaging/social features — prepare a seeded demo account and include the credentials in the App Review notes field, or review is likely to stall on "can't test core functionality."
- **Submit for review**: typical turnaround 24-48 hours; first-time submissions and UGC/social apps often get extra scrutiny — budget for at least one rejection/resubmission cycle in the timeline, don't plan around a single-pass approval.
- **Most likely first-rejection reasons for this app specifically**: placeholder/broken legal page links (must be real by submission time), missing or incomplete UGC moderation response flow, no demo account provided, metadata mismatch (e.g. screenshots showing a build older than what's submitted).

---

## Phase 3 — Google Play submission

- **Google Play Console**: $25 one-time registration fee.
- **UGC requirements**: Play's User Generated Content policy has the same shape as Apple's — in-app reporting/blocking (built) plus a real moderation response capability (same admin-UI gap as Phase 2, needs closing before submission here too, not twice-separately).
- **Data Safety section**: same source-of-truth table from `APP_STORE_ASSETS.md`, filled into Play Console's own form (different UI from Apple's, same underlying facts).
- **Adaptive icon**: required (not optional, unlike some older Android requirements) — produced automatically in Phase 1 step 6 once real source art exists.
- **Feature graphic**: 1024×500, required — spec and concept already drafted in `APP_STORE_ASSETS.md`.
- **Closed testing track first**: recent Google Play policy requires new developer accounts to run a closed test with at least 12 testers for 14 continuous days before Google allows a production release — **this is a real ~2-week minimum timeline floor**, not a suggestion, for any account that hasn't shipped a Play app before. Plan the submission calendar around this, not around review speed alone.
- **Review turnaround**: usually faster than Apple (hours to ~3 days for updates), but a brand-new developer account's *first* app can take longer — don't assume Play is uniformly faster than App Store for a first submission.

---

## Phase 4 — Post-launch maintenance (both stores)

- **Every code change needs a new store submission** — standard Capacitor has no built-in over-the-air update mechanism. (Services like Capgo or Ionic Appflow add OTA updates for the *web-layer* portion of a Capacitor app, for a fee — worth evaluating later if release velocity becomes a real pain point, but not assumed or required here.)
- **Version/build number discipline**: bump both the web app's own version and the native project's build number on every release — App Store Connect/Play Console both reject a re-submission with an unchanged build number.
- **Keep Capacitor core + plugins updated** — each major iOS/Android OS release sometimes requires an updated Capacitor version to keep working correctly; treat this like any other dependency that needs periodic maintenance, not a one-time setup cost.
- **Crash/error monitoring already exists and extends naturally**: `analytics_events`'s `client_error` tracking (`src/lib/logger.ts`) keeps working inside a Capacitor-wrapped app unchanged, since it's still the same web code running in a native WebView.

---

## Cost & timeline summary

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/year | Budget 1-2 weeks extra if enrolling as an organization (D-U-N-S number lookup) |
| Google Play Console | $25 one-time | |
| Mac access for iOS builds | $0 (if you own one) or ~$20-100/mo | Cloud Mac CI (Codemagic, MacStadium) if no Mac is available — a real requirement, not optional |
| Legal review (Terms/Privacy) | Variable | Even a lightweight lawyer pass is worth budgeting for — both stores' reviewers do check these links |
| Design work (adaptive icon, splash, screenshots) | Variable | Needs a designer or a design tool this environment doesn't have access to — specs are ready, execution isn't |
| Google Play closed-testing window | ~2 weeks minimum | Policy-mandated for new developer accounts, not a cost but a hard timeline floor |

**Realistic total timeline from "start Phase 1" to "live in both stores," for a reasonably resourced team**: 4-8 weeks, assuming Phase 0's prerequisites are already clear and design/legal aren't blocked on external parties. Longer if any of Mac access, legal review, or design work becomes a bottleneck.

---

## Definition of done — final submission checklist

**Before touching Capacitor at all (Phase 0):**
- [ ] All pending Supabase migrations run
- [ ] Real SMTP provider live
- [ ] Real production domain live
- [ ] Google OAuth branding fixed (consent screen shows "Memory Drop", not the raw Supabase URL)
- [ ] Terms/Privacy have real, lawyer-reviewed copy, live at real URLs
- [ ] `APP_STORE_ASSETS.md` and `README2.md`'s messaging description updated to match Phase 28's mutual-Orbit-only model

**Capacitor setup (Phase 1):**
- [ ] App ID decided and locked in
- [ ] iOS and Android native projects generated and building locally
- [ ] Real icon set generated from source art (not the placeholder favicon/manifest icons)
- [ ] Splash screen configured
- [ ] Tested on a real device or simulator/emulator for both platforms

**Store-specific (Phases 2 & 3):**
- [ ] Admin UI exists for `moderate_content()`/`get_content_reports()` — genuinely necessary now, not deferred
- [ ] Demo account prepared for Apple reviewers
- [ ] Screenshots captured on real devices/simulators per `APP_STORE_ASSETS.md`'s layout plan
- [ ] Feature graphic designed (Google Play)
- [ ] Privacy Nutrition Label (Apple) / Data Safety section (Google) filled in from `APP_STORE_ASSETS.md`'s table
- [ ] Age rating questionnaire completed honestly for both stores
- [ ] Google Play closed-testing track running (12+ testers, 14+ days) before requesting production access

**Post-submission:**
- [ ] Version/build number bump process documented for the next release
- [ ] `/support` page's "Coming to the App Store"/"Coming to Google Play" placeholder buttons replaced with real store links once both listings are live
