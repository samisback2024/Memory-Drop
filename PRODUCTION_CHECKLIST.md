# Production Readiness Checklist (Phase 13)

Status legend: ✅ Done · 🟡 Partial (real, scoped progress — not a full pass) · ⏭️ Deferred (deliberately out of scope, documented reason) · 👤 Needs a human (can't be done from this environment)

This checklist mirrors the 15 sections of the Phase 13 brief exactly. For narrative detail on *why* something is partial/deferred, see `KNOWN_LIMITATIONS.md` and the README's own Known Limitations sections (one per phase). For exact file evidence, see the Phase 13 README section.

## 1. Performance

| Item | Status | Evidence |
|---|---|---|
| React rendering | 🟡 | `DropCard`/`MemoryCard` were already `React.memo`'d (earlier phases); `MessageBubble`/`ConversationListItem` added this phase. No app-wide re-render audit — `useMemo`/`React.memo` usage is sparse outside these list-item components (10 `useMemo` calls, 8 `React.memo` wraps across 220 files). Needs real profiler data (React DevTools Profiler) to prioritize further, not guesswork. |
| Supabase queries | ✅ | Every cross-user read already goes through a `SECURITY DEFINER` RPC (established since Phase 2); no N+1 patterns introduced this phase. `Promise.all` used wherever independent reads exist (established Phase 10g). |
| Image loading | ✅ | `loading="lazy"` + `decoding="async"` on all content `<img>` tags (established); `compressImageFile()` re-encodes every upload; `useInView`-gated lazy mount for Video/AudioPlayer. |
| Video loading | 🟡 | Lazy-mounted, `preload="metadata"` only. No compression/transcoding — raw upload, capped at 50MB client-side. Real compression needs ffmpeg.wasm or a server-side transcode step (new dependency/infra) — deferred. |
| Lazy loading | ✅ | Every secondary route (`Search`, `Explore`, `Memories`, `Settings`, `Notifications`, `Messages`, `MessageRequests`, `ConversationPage`) is `React.lazy`-loaded. |
| Code splitting | ✅ | `vite.config.ts` now has a real `manualChunks` split (`vendor-react`, `vendor-supabase`, `vendor-icons`) on top of route-level splitting — new this phase. |
| Bundle size | ✅ | Main chunk dropped from ~508kB to ~316kB after the `manualChunks` split; the >500kB build warning is gone entirely (was present since Phase 11). |
| Infinite lists | ✅ | Feed/Explore/Memories/Notifications/Messages all use cursor or offset pagination with `hasMore` guards; chat's message list is windowed (~150 in-memory cap) rather than unbounded. |
| Memory usage | 🟡 | Chat's message list windowing (Phase 12) is the one place with an explicit cap; other infinite lists (Feed, Explore) accumulate in the DOM without limit — documented, unchanged limitation from Phase 10e. |
| Mobile performance | 👤 | Code-level responsive/perf work is done (below); real on-device performance (low-end Android, older iPhones) needs physical devices — see `TEST_PLAN.md`. |

## 2. Error Handling

| Item | Status | Evidence |
|---|---|---|
| Offline mode | ✅ | `useOnlineStatus` + `OfflineBanner` (existing, Phase 10e), unchanged. |
| Network timeout | 🟡 | `classifyError()` (new, `src/lib/logger.ts`) recognizes timeout/network-shaped error messages and maps them to a clear user-facing string. No explicit request-level timeout/abort-controller wiring on Supabase calls. |
| Upload failures | ✅ | Every upload path already returns/surfaces a real error (established); Phase 13 adds a client-side size/type check to Chat's last uncapped attach path (generic files). |
| Expired sessions | ✅ | New this phase — `useAuth` detects an unintentional `SIGNED_OUT` (vs. a deliberate sign-out) and a `SessionExpiryToast` surfaces a clear "session expired, please sign in again" message app-wide. |
| Database errors | ✅ | `classifyError()` recognizes RLS-denial and generic DB error shapes; existing per-hook error messages (established) still pass through untouched. |
| Permission denied | ✅ | Same `classifyError()` — generalizes the ad hoc `/row-level security/i` checks a few hooks already had into one reusable classifier. |
| 404 pages | ✅ | New this phase — `NotFoundPage.tsx`, wired as the real catch-all route (previously silently redirected to Feed/Login). |
| 500 pages | ✅ | `ErrorBoundary` (existing) now also wraps the top-level route tree in `App.tsx`, not just `AppShell` — the three permalink routes outside `AppShell` (`/drop/:id`, `/moments/:id`, `/messages/:id`) had zero crash coverage before this phase. |
| Retry actions | ✅ | `ErrorState`'s `onRetry` pattern (existing) used consistently; pull-to-refresh and `hasMore`-gated "Load more" buttons throughout. |
| Toast messages | ✅ | `useToast` (existing, Phase 10g) — session-expiry and several new flows in this phase route through it. |
| Error boundaries | ✅ | Two layers now: `AppShell`'s (page-scoped) and the new top-level one (whole-app fallback). |

## 3. Security

| Item | Status | Evidence |
|---|---|---|
| Private accounts | ✅ Confirmed | `get_profile_by_username` still the sole cross-user profile read path; verified no Phase 12 RPC bypasses it. |
| Followers-only | ✅ Confirmed | `can_view_drop`/`can_view_capsule`/`can_view_moment` remain the only three places visibility is decided; Phase 12 messaging introduces zero new content-visibility logic. |
| Only Me | ✅ Confirmed | Same three functions; `posts`' table-level RLS (hardened Phase 10g) still matches `capsules`' zero-row (not nulled-row) guarantee. |
| Blocked users | ✅ Fixed | **Real gap found and fixed this phase**: `get_messages()`, `get_conversation_media()`, and `message_reactions`' INSERT policy didn't check `is_blocked_either_way()` — a blocked user could keep reading a conversation's full history and reacting to messages indefinitely. `typing_status` had the same gap `presence_status` already correctly avoided. All four fixed in `supabase/phase13_production_hardening.sql`. |
| Storage permissions | ✅ Confirmed | All 6 buckets (`avatars`/`covers`/`post-media`/`moments`/`capsules`/`chat-media`) use the identical `(storage.foldername(name))[1] = auth.uid()::text` write/delete policy — no bucket lets one user touch another's file. |
| Upload permissions | ✅ Fixed | `chat-media` was the only bucket missing a server-side `allowed_mime_types` allowlist — added this phase, plus a matching client-side check on Chat's generic-file attach path (previously uncapped). |
| Download permissions | ✅ Confirmed (documented tradeoff) | All buckets are public-read + unguessable path + app-level gating (a URL is only ever handed out by an RPC to someone authorized) — a deliberate, repeated architectural choice, not an oversight. See "Signed URLs" below. |
| Signed URLs | ⏭️ Deliberately not used | This app uses public-bucket-plus-unguessable-path instead, the same pattern used consistently since Phase 2. Switching to signed URLs is a real architecture change (loses CDN/browser caching, needs URL-refresh logic for long-lived pages) that wasn't asked for as a build item here — flagged for a future dedicated pass if truly-private, time-limited media URLs become a hard requirement. |
| Prevent unauthorized reads | ✅ | Covered by the four items above plus the "Blocked users" fix. |

## 4. Storage

| Item | Status |
|---|---|
| `avatars`, `covers`, `post-media`, `moments`, `capsules` buckets | ✅ Reviewed, no changes needed — all already had `allowed_mime_types` + `file_size_limit` set at the database level (not just client-side). |
| `chat-media` (Phase 12's bucket — the brief's "attachments") | ✅ Fixed — added `allowed_mime_types`. |
| Compression | 🟡 Images only (`compressImageFile()` — downscale + re-encode on every upload). Video/audio are uploaded raw. |
| Image resizing | ✅ Same `compressImageFile()` pipeline, capped dimensions. |
| Video previews | ⏭️ No thumbnail/poster generation — native `<video preload="metadata">` shows the first frame, no server-side thumbnail extraction. |
| File validation | ✅ Now real on both client and server for every upload path, including Chat's generic-file attach (this phase's fix). |
| Duplicate uploads | ⏭️ Not deduplicated — two uploads of the same file produce two storage objects. No dedup infrastructure (would need content hashing) exists or was added. |

## 5. Responsive Design

| Item | Status |
|---|---|
| Desktop / Tablet / Portrait / Landscape | ✅ Tailwind `sm`/`md`/`lg` breakpoints used consistently; verified via code review, not device testing. |
| Android / iPhone | 👤 Needs real devices — see `TEST_PLAN.md`. Safe-area insets (`env(safe-area-inset-bottom)`) already used in `MobileNav` (Phase 10g). |
| Large screens | ✅ `max-w-2xl` content constraint app-wide prevents unbounded line-length/card-width on large monitors. |
| Foldable devices | 👤 No specific handling; standard responsive breakpoints should degrade reasonably but untested on real foldable hardware. |
| Overflow / Spacing / Navigation / Safe areas | ✅ Spot-checked this phase, no new issues found. Existing 320px-width checks from Phase 10g still apply. |
| Keyboard overlap | 🟡 Chat's composer and forms use standard flow layout (no `position: fixed` fighting the OS keyboard); not verified on a real mobile keyboard — see `TEST_PLAN.md`. |

## 6. Accessibility

| Item | Status |
|---|---|
| Screen readers | 🟡 `alt` text fixed on the 5 highest-traffic content-image components this phase (`ImageGrid`, `MemoryCard`, `CapsuleUnlockedCard`, `MomentViewer`, `MessageBubble`) — real, meaningful descriptions instead of empty strings. Not every image in the app. |
| Keyboard | ✅ Confirmed solid app-wide (established, re-verified not rebuilt) — `Modal`'s focus trap, Escape-to-close, and `focus-visible` rings. |
| Focus order | ✅ Same as above. |
| Reduced motion | ✅ Existing `user_settings.reduced_motion` + CSS override, unchanged, confirmed still wired. |
| Color contrast | 👤 No automated contrast-ratio tool run; needs a real audit (e.g. axe DevTools) — not done from this environment. |
| Alt text | 🟡 See "Screen readers" above — real progress, not exhaustive. |
| Large text | ✅ Existing `font_size` setting + `--md-font-scale` CSS variable, unchanged, confirmed still wired. |

## 7. Dark Mode

| Item | Status |
|---|---|
| Every page / modal / component / form | 🟡 Substantial, targeted progress this phase — the three previously-0%-covered directories (`social/`, `moments/`, `profile/`, 35 files) are now fully covered, plus the specific files the Phase 10g README explicitly flagged as gaps (`DropActions`, `InterestActions`, `LockedDropPlaceholder`, `CommentItem`, plus `CapsuleCard`'s action-row aria fixes). **Not** a claim of 100% app-wide coverage — see `KNOWN_LIMITATIONS.md` for the honest remainder. |
| No visual inconsistencies | 🟡 True for every surface touched this phase and every prior dark-mode pass; not independently verified pixel-by-pixel across the whole app. |

## 8. Analytics

| Item | Status |
|---|---|
| Signups, Drops, Capsules, Unlocks (Capsule), Moments, Followers, Searches, Shares | ✅ Instrumented via `track()` calls at the real success points in `useAuth`/`useDrops`/`useCapsules`/`useMoments`/`useSocial`/`useSearch`/`ShareModal`/`useMessages`. |
| Drop unlocks specifically | ⏭️ Not instrumented — Drops unlock passively (time-based, no single client action point to hook), unlike Capsules' explicit `unlock_capsule()` call. Documented gap. |
| Retention | 🟡 Raw events exist (`created_at`, `user_id`, `session_id` on every row) to compute retention via SQL later; no pre-built retention dashboard/query. |
| Crash events | ✅ `logger.error()` → `track('client_error', ...)`, wired through `ErrorBoundary`. |
| Privacy-conscious | ✅ Self-hosted (`analytics_events` table in this app's own Supabase project, never a third-party vendor), a real Settings → Privacy → Analytics opt-out toggle (default on, genuinely gates `track()`), and the Privacy Policy was updated to disclose it. |

## 9. Logging

| Item | Status |
|---|---|
| Client | ✅ New `src/lib/logger.ts` — leveled (`debug`/`info`/`warn`/`error`), always consoles in dev, `error` level also persists to `analytics_events`. |
| Server | ⏭️ N/A by architecture — there's no custom backend server in this app (Supabase is the full backend; Vercel serves static assets). "Server" logging is Supabase's own dashboard logs plus this app's `raise exception` messages in SQL functions (already surfaced to the client on every RPC failure, established since Phase 1). Not a gap — a correct scoping decision for this architecture. |
| Errors / Warnings / Performance | 🟡 Errors and warnings are real; no performance-timing instrumentation (e.g. Web Vitals reporting) was added. |

## 10. App Icons

| Item | Status |
|---|---|
| Favicon | ✅ Already existed (16/32 PNG + `favicon.svg`); `favicon.svg` is now actually linked in `index.html` (was present but unreferenced). |
| Apple icon | ✅ Already existed (`apple-touch-icon.png`, 180×180). |
| Splash screen | ⏭️ No dedicated splash image generated — `theme-color`/`background_color` in the manifest provide a solid-color fallback; a real splash image needs actual design/image-generation tooling not available here. |
| Notification icon | ⏭️ N/A — no OS push notifications exist (Phase 11's Activity Center is in-app only); a notification icon has nothing to attach to yet. |
| Shortcut icon | ✅ New this phase — `site.webmanifest` `shortcuts` array (New Drop, Messages), backed by real functionality (`FeedPage` now reads `?compose=drop`). |
| Adaptive Android icon | ⏭️ Needs a layered foreground/background image pair, which needs real design tooling not available here — see `APP_STORE_ASSETS.md`. |
| Use current branding | ✅ All existing/new assets reuse the established purple-to-blue gradient + "M" mark. |

## 11. App Store Assets

See `APP_STORE_ASSETS.md` for the full drafted content (name, subtitle, descriptions, keywords, privacy-labels checklist, screenshot/feature-graphic specs). Screenshots and the feature graphic themselves need real device captures/design work — placeholders and exact specs are documented, not faked.

## 12. Website Preparation

| Item | Status |
|---|---|
| Privacy Policy / Terms links | ✅ Already existed on Login/Register (confirmed, not newly added); both legal pages now cross-link to the new Support page and each other's dark-mode-fixed shared layout. |
| Support | ✅ New public `/support` page (previously only reachable via in-app Settings, unreachable logged out). |
| Contact | ✅ `support@memorydrop.app` (already referenced in Terms) surfaced on the new Support page too. |
| Download buttons (placeholders) | ✅ New — disabled "Coming to the App Store" / "Coming to Google Play" buttons on the Support page. |
| Dedicated marketing landing page | ⏭️ Out of scope — `/` is the app's own login/redirect entry point, not a separate marketing homepage; building one is a separate, feature-sized scope decision, not attempted here (see `KNOWN_LIMITATIONS.md`). |

## 13. Testing

See `TEST_PLAN.md` — the 100/1000/5000-user QA plan (built on the existing `dev_seed_scale_test.sql` scale-test infrastructure from Phase 10f), plus slow-internet/offline/reconnect/upload/download/multi-device/dark-mode/accessibility sections. No automated test framework exists or was added this phase (see `KNOWN_LIMITATIONS.md` for why).

## 14. Bug Bash

| Item | Status |
|---|---|
| Broken links | ✅ Spot-checked; the 404 page (item 2) is the real backstop for any that remain. |
| Console warnings | ✅ Zero `console.log` calls found in `src/` before this phase; unchanged. |
| TypeScript warnings | ✅ `npx tsc -b` clean throughout this phase's work. |
| Lint warnings | ✅ `npx oxlint` clean except the same 6 pre-existing, already-accepted `only-export-components` warnings from prior phases. |
| Unused files | ✅ Two confirmed-dead components deleted (`UserSearchBar.tsx`, `Card.tsx` — zero imports anywhere, re-verified before deletion). |
| Dead code | ✅ Same as above. |
| Duplicate components | 🟡 None newly found; the previously-documented "RelationshipMenu/Navbar-dropdown/DropCard-kebab-menu share the same open/outside-click/Escape pattern independently" note (Phase 3/4) still stands, unchanged. |
| Inconsistent terminology | ✅ Re-confirmed clean (Drop/Moment/Capsule/Unlock/Reflect, no "Post"/"Story" leakage) — previously audited Phase 10, not re-litigated. |
| Memory leaks | 🟡 Spot-checked `useEffect` cleanup functions in files touched this phase; no dedicated leak-detection tooling run. |
| Loading loops | ✅ **Real bug found and fixed**: `CapsuleArchive.tsx`'s "Load more" had a stale-closure bug — `load()`'s memoized callback closed over `capsules.length` from whenever it was last recreated, so every "Load more" click re-fetched page 1 instead of advancing. Fixed with a ref. Two similar patterns (`MemoryTimeline.tsx`, `FeedPage.tsx`) were spot-checked and confirmed already correct. |

## 15. Documentation

| Item | Status |
|---|---|
| README updated | ✅ New Phase 13 feature section, migration entry, Database tables section, Security notes additions, Known Limitations additions, Roadmap row. |
| `PRODUCTION_CHECKLIST.md` | ✅ This file. |
| `LAUNCH_CHECKLIST.md` | ✅ New. |
| `KNOWN_LIMITATIONS.md` | ✅ New. |
| `TEST_PLAN.md` | ✅ New. |

---

## Phase 14 Addendum — Database & Frontend Hardening

A second, narrower audit pass following Phase 13 — same "read the real code, fix real bugs, don't add features" posture, this time focused on database performance/integrity and a frontend code-quality/consistency sweep. Severity tiers below (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low) reflect production impact, not effort. Every item shipped as its own commit with a what/why/impact message — see `git log`.

| Severity | Finding | Fix | Commit |
|---|---|---|---|
| 🟠 High | 45+ foreign-key columns across `messages`, `capsule_*`, `moment_*`, `comments`, `reports`, `favorites`/`collection_items`/`pinned_items`, `notification*` had no index. Postgres only auto-indexes the *referenced* side of a FK (the PK), never the referencing column — every JOIN and cascade-delete check on these was a sequential scan, worsening linearly as tables grow. | Added `create index if not exists` for every identified FK column, grouped by table, in `supabase/phase14_database_hardening.sql`. | `e4239cb` |
| 🟠 High | `create_notification()` had no `REVOKE` — any authenticated client could call it directly via PostgREST and forge arbitrary notifications (fake "someone liked your post" spam, or worse, impersonate system announcements) bypassing every app-level trigger that's supposed to be the only caller. | `revoke all on function ... from public, anon, authenticated` — the function still works for the triggers that call it (they run as the invoking context that already has rights via `SECURITY DEFINER`/table owner), just not reachable directly from the client. | `e4239cb` |
| 🟡 Medium | Several count columns (`like_count`, `comment_count`, etc.) and `notification_events.event_type` had no `CHECK` constraint — a bug in a trigger or a manual `UPDATE` could silently drive a count negative or write a typo'd event type that no code path would ever query for. | Added `not valid` + `validate constraint` CHECK constraints (avoids a long table lock on existing rows) for count non-negativity and the full 24-value `event_type` enum. | `e4239cb` |
| 🟡 Medium | `generate_weekly_recap()` looped per-user, running one `select count(*)` per iteration — an O(n) query pattern that gets slower every week as the user base grows, on a function meant to run unattended via `pg_cron`. | Rewrote as a single `group by owner_id having count(*) > 0` query feeding the notification loop — one query instead of N. | `e4239cb` |
| 🟡 Medium | Six RLS policies on `posts`/`capsules`/`moments`/`messages`/`conversation_members`/`notifications` called bare `auth.uid()` in their `USING`/`WITH CHECK` clause, which Postgres's planner re-evaluates per scanned row rather than once per statement. | Wrapped as `(select auth.uid())` — Supabase's documented RLS perf pattern, letting the planner cache it as a once-per-statement InitPlan. Deliberately scoped to these 6 (not all `auth.uid()` occurrences app-wide): this app's reads mostly go through `SECURITY DEFINER` RPCs where table RLS is a defense-in-depth backstop, not the hot path, and wrapping `auth.uid()` *inside* a `SECURITY DEFINER` function body is a no-op — those functions are never inlined by the planner. | `60f2321` |
| 🟠 High | `getDropsFeed`/`getUserCapsules`/`getMomentsTray`/`getConversations`/`searchMemories` had no request timeout — a hung network request (flaky connection, slow cold-start) would leave the caller's loading state spinning forever with no recovery path. | Wired `supabase.rpc(...).abortSignal(signal)` with a 15s `withAbortTimeout()` (new `src/lib/timeout.ts`, real `AbortController`, not a `Promise.race` that abandons but doesn't cancel the in-flight request) into all five, plus `logger.warn()` on failure before returning `[]`. | `17c7b61` |
| 🟡 Medium | `MessagesPage`'s empty-conversations state showed the generic "no messages yet" empty state even when the real cause was being offline — no way to tell "you have no conversations" from "we can't reach the server" at a glance. | Added an `useOnlineStatus`-gated branch showing `ErrorState` with a retry action when offline, matching `Feed.tsx`'s established pattern. | `17c7b61` |
| 🟢 Low (2 🟡 a11y fixes inside) | Nine components independently hand-rolled the same open/outside-click/Escape dropdown-dismissal listener — a maintenance-surface and consistency problem on its own, and it had already drifted: `RecentLikersPopover` and `CapsuleCard` were missing Escape handling entirely (mousedown-only), a real keyboard-accessibility gap. | Extracted `useDismissableMenu` (`src/hooks/useDismissableMenu.ts`); refactored all nine call sites onto it, closing both Escape gaps for free. Also fixed zero-dark-mode-coverage on `EmojiPicker`/`RecentLikersPopover` since both were being rewritten anyway. | `e260716` |
| 🟠 High | 8 of 15 page-level `<h1>` titles (`CapsulesPage`, `DashboardPage`, `MemoriesPage`, `MomentsPage`, `SettingsPage`, `FriendRequestsPage`, `FriendsPage`, `EditProfilePage`) used `text-gray-900` with no `dark:` variant. `AppShell` sets the app background to `bg-gray-950` in dark mode, so these titles rendered as near-invisible dark-gray-on-near-black — a real visible defect for every dark-mode user on 8 pages, not cosmetic. | Added `dark:text-gray-100`. Also standardized all 15 page titles from a mixed `text-xl`/`text-lg` split onto `text-lg` (the majority pattern), since primary nav destinations were inconsistently sized right next to each other. | `339858b` |
| 🟢 Low | `MessageBubble`'s image/video/file attachment buttons had no hover state, inconsistent with every other clickable non-chrome element in the app (`hover:opacity-*`/`transition-opacity`, established in `SocialStats`/`Toast`/`NotFoundPage`). `ShareModal`'s QR code wrapper used `rounded-lg` while every sibling button in the same sheet uses `rounded-xl`. | Added matching hover/transition treatment to all three attachment types; fixed the QR wrapper's radius. | `3576128` |

### Remaining / deferred (honest, not fixed this pass)

- **Skeleton-component adoption is inconsistent** — 34 files hand-roll their own `animate-pulse` loading skeleton instead of using the shared `Skeleton` primitive (7 files). Real, but a larger mechanical refactor with low per-file risk-adjusted value relative to the fixes above; not attempted this pass.
- **The broader `auth.uid()` RLS-wrapping optimization was deliberately not applied app-wide** — see the reasoning in the table above and in `supabase/phase14b_rls_performance.sql`'s header comment. Revisit only if profiling ever shows table-level RLS (not RPC calls) as an actual hot path.
- **No systematic re-render/profiler audit was run this pass** — same limitation Phase 13 documented; still needs real React DevTools Profiler data to prioritize further, not code-reading alone.
