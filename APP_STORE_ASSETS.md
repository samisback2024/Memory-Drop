# App Store Assets

Real, ready-to-use drafted copy and exact specs for whoever prepares Memory Drop's app store listings. Screenshots, the feature graphic, the adaptive Android icon, and the splash screen all need actual design/image-generation tooling this environment doesn't have access to — those sections document the precise spec to hand off, not a placeholder pretending to be final art. See `LAUNCH_CHECKLIST.md` for when this actually gets used.

## App name

**Memory Drop**

## Subtitle (App Store, 30 chars max) / Short description (Google Play, 80 chars max)

- App Store subtitle: **Time-capsule memories** (23 chars)
- Google Play short description: **Capture today. Unlock tomorrow. A social time capsule for real moments.** (75 chars)

## Long description

> Memory Drop is a social app built around a simple idea: not everything needs to be seen right away.
>
> **Drop a memory, unlock it later.** Share a photo, video, voice note, or a few words — set when it unlocks, from a few hours to years from now — and let the people who care about you look forward to it instead of scrolling past it.
>
> **Seal a Time Capsule.** Combine photos, video, and voice recordings into a single sealed memory for a specific future date — a birthday, an anniversary, a "open when you need this" note to your future self or someone else.
>
> **Share a Moment.** Ephemeral, expiring photos and videos for what's happening right now — then it lands quietly in your own private archive forever, even after everyone else has stopped seeing it.
>
> **Build a real archive.** Every Drop, Capsule, and Moment you create becomes part of your personal Memories library — searchable, organized into collections, with real Flashbacks and Highlights, not an algorithm deciding what you get to look back on.
>
> **Message the people who matter.** Real-time messaging with read receipts, typing indicators, and the same privacy-first design as everything else in the app — message requests keep your inbox to people you actually know unless you choose otherwise.
>
> **Private by default, yours by design.** Private accounts, granular Followers/Only-Me visibility on every memory, full block/mute/restrict controls, and a real, working dark mode. No ads. No algorithm deciding what you see. No premium tier gating basic features — Memory Drop is free.
>
> Memory Drop is currently in beta. We'd love your feedback — reach us anytime at support@memorydrop.app.

## Keywords

`memory, time capsule, social, private, journal, photos, moments, capsule, future, unlock, memories, diary, scrapbook, close friends, messaging`

(App Store keyword field is comma-separated, 100 chars max — trim to the highest-value dozen if needed: `memory, time capsule, social, private, journal, moments, capsule, unlock, memories, diary`.)

## Privacy labels checklist (Apple "App Privacy" / Google Play "Data safety")

Source of truth: what this app's own database schema actually collects, not a guess. Cross-check against `PrivacyPage.tsx` before submitting.

| Data type | Collected? | Linked to identity? | Used for tracking? | Notes |
|---|---|---|---|---|
| Email address | Yes | Yes | No | Auth only (Supabase Auth) |
| Username / display name | Yes | Yes | No | Shown to other users |
| Date of birth | Yes | Yes | No | Age-gate verification (13+) only, never shown publicly |
| Photos / videos / audio you upload | Yes | Yes | No | User-generated content, stored in Supabase Storage |
| Precise location | Only if user shares it | Yes | No | Chat's "Location" message type is opt-in per message; Moments/Capsules' free-text "location" field is user-typed, not device GPS |
| Usage data (product analytics) | Yes | Optionally (see below) | No | New this phase — self-hosted `analytics_events`; user-opt-outable in Settings; never shared with or sold to a third party, so "used for tracking" (cross-app/cross-site) is correctly **No** |
| Crash data | Yes | Optionally | No | Same `analytics_events` table, `client_error` events |
| Contacts | No | — | — | This app never requests device contacts |
| Advertising identifier | No | — | — | No ads exist in this app |
| Third-party analytics SDK | No | — | — | Explicitly not used — see README/KNOWN_LIMITATIONS for why |

## Screenshot layout plan

Standard sizes needed: iPhone 6.7" (1290×2796), iPhone 6.5" (1284×2778), iPad 12.9" (2048×2732), Android phone (1080×1920 minimum). 5-8 screenshots per platform, in this order:

1. **Feed** — a mix of locked (countdown) and unlocked Drops, showing the core "wait for it" hook. Caption: *"Some memories are worth the wait."*
2. **Time Capsule unlock moment** — the unlock animation/reveal on a Capsule. Caption: *"Seal it. Forget it. Rediscover it."*
3. **Memories library** — the Timeline or Grid view with a mix of content types. Caption: *"Your whole story, actually organized."*
4. **Moments tray + viewer** — the story-ring tray and a full-screen Moment. Caption: *"Share what's happening now — it's yours to keep later."*
5. **Chat / Messages** — a conversation with read receipts and a reaction visible. Caption: *"Message the people who matter, privately."*
6. **Privacy/Settings** — the Privacy settings screen (private account toggle, messaging privacy tiers). Caption: *"Private by default. Always your call."*
7. **Dark mode** — any of the above, rendered in dark mode, ideally side-by-side with light mode. Caption: *"Looks as good at night."*
8. (Optional) **Profile** — a filled-out profile with pinned memories and stats. Caption: *"A profile that's actually about your memories."*

## Feature graphic (Google Play, 1024×500, required)

Concept: the purple-to-blue brand gradient as background, the Memory Drop wordmark + icon centered-left, a stylized sealed "capsule" icon with a soft glow on the right two-thirds, tagline beneath the wordmark: **"Capture today. Unlock tomorrow."** No screenshots or UI chrome in the feature graphic itself (per Play Store guidance — it's a brand banner, not a screenshot collage).

## App icon status

Already exist and are launch-ready: favicon (16×16, 32×32, SVG), `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png` (both marked `"purpose": "any maskable"` in the manifest). **Still needed for native app store submission specifically:**
- **Adaptive Android icon**: a separate foreground layer (the "M" mark, transparent background, safe zone per [Android's adaptive icon spec](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)) and a background layer (the gradient), so Android can mask/animate them independently. The current `icon-512.png` is a single flattened image and isn't directly usable as an adaptive icon's two layers.
- **iOS App Store icon**: 1024×1024, no transparency, no rounded corners (Apple applies the mask) — can likely be derived directly from the existing `icon-512.png` source art once upscaled/re-exported at the right size, but needs the original vector/design source, not a raster upscale, for a crisp result.
