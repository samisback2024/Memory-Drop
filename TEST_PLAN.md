# Test Plan

Memory Drop has no automated test suite (see `KNOWN_LIMITATIONS.md` for why) — every phase of this project has instead shipped a precise manual checklist, and the scale sections below extend the same `dev_seed_scale_test.sql` fixture infrastructure this app has used since Phase 10f. **Run everything in this document against a disposable local/staging Supabase project — never production.**

## 1. Scale testing (100 / 1000 / 5000 users)

`supabase/dev_seed_scale_test.sql` seeds, as shipped: **100 users, 1000 Drops, 300 Capsules, 300 Moments**, plus ~1,500 follows, 2 block relationships, ~4,500 comments, ~6,000 likes/reactions, ~600 bookmarks, ~100 collections, ~500 favorites, and the Phase 11 notification/message-adjacent tables it already covers.

**Tier 1 — 100 users (default).** Run the script exactly as shipped.

**Tier 2 — 1000 users.** Before running, multiply these three `generate_series` bounds (and the two `% 100` modulus references that key off user count) by 10:
- Line ~63: `generate_series(1, 100)` → `generate_series(1, 1000)` (users)
- Lines ~113/133/153: `(i % 100) + 1` → `(i % 1000) + 1` (keeps content spread evenly across the larger user pool)
- Lines ~121/140/164: `generate_series(1, 1000)`/`generate_series(1, 300)` → scale Drops/Capsules/Moments proportionally (e.g. `generate_series(1, 10000)` for Drops) if you want proportional content volume too, not just more users.

**Tier 3 — 5000 users.** Same approach, ×50 from baseline. At this tier, expect the seed script itself to take noticeably longer to run (it's not optimized for bulk-insert speed, just correctness) — that's expected, not a bug.

For every tier, verify:
- [ ] **No broken navigation** — click through Feed (all 6 tabs), Explore (all 7 tabs), Memories (all 8 tabs), Capsules, Search, Saved (4 tabs), Messages, Notifications; confirm nothing 404s, infinite-spins, or throws a console error.
- [ ] **No inconsistent stats** — `get_memory_stats()` vs. manual row counts on a sample account; Profile stats card vs. actual table contents.
- [ ] **No duplicated content** — spot-check Memories' Timeline, Search results, and Explore for repeats.
- [ ] **RLS holds under volume** — as a non-seeded test account, confirm you never see a seeded `only_me`/private Drop/Capsule/Moment anywhere, and that the two seeded block relationships stay invisible to each other. Direct `GET {SUPABASE_URL}/rest/v1/posts?id=eq.<locked-id>` as a non-owner still returns zero rows (Phase 10g fix, re-verify it still holds at scale).
- [ ] **`Load more`/pagination terminates** — no loading loops on any list, including the `CapsuleArchive` pagination bug fixed this phase (click "Load more" repeatedly, confirm each click surfaces genuinely new capsules, not the same page again).
- [ ] **Cleanup works** — `delete from auth.users where email like 'scaletest_%@memorydrop.test';` removes every seeded row via cascade at whichever tier you ran, with nothing left behind.

## 2. Network conditions

- [ ] **Slow internet** — throttle to "Slow 3G" in devtools; confirm skeleton/loading states show (not a blank screen), no request appears hung forever, and the app remains usable (if slow) rather than broken.
- [ ] **Offline** — go fully offline (devtools "Offline" or airplane mode); confirm `OfflineBanner` appears, in-flight actions fail cleanly (a toast, not a silent hang or a crash), and nothing corrupts local state.
- [ ] **Reconnect** — restore connectivity; confirm the offline banner clears automatically, Realtime subscriptions (Messages, Notifications) resume delivering without a manual refresh, and any action that failed while offline can be retried successfully.
- [ ] **Network timeout mid-request** — throttle heavily and trigger a slow write (e.g. a large image upload); confirm a stuck request eventually surfaces an error via `classifyError()`'s network-shaped message rather than spinning forever.

## 3. Uploads / downloads

- [ ] Upload one file of each supported type through every attach path: Drop photo/video/audio, Capsule photo/video/audio/voice, Moment photo/video, Avatar/Cover (crop flow), Chat image/video/voice-note/GIF/file.
- [ ] Attempt an oversized file and an unsupported file type on each path above — confirm a real client-side error message, and (for Chat's generic-file path specifically, fixed this phase) confirm it's now actually rejected client-side rather than only failing silently against the bucket's blanket limit.
- [ ] Download: use `MediaViewer`'s download button (Chat) on an image and a video; confirm the file actually saves and opens correctly outside the browser.
- [ ] Confirm every upload path's compression/resize actually reduces file size for a large source image (compare before/after in devtools' Network tab).

## 4. Multiple devices / responsive

- [ ] Desktop (1920×1080 and 1366×768), tablet (768×1024 portrait + landscape), a real or simulated Android phone, a real or simulated iPhone (including one with a notch/Dynamic Island for safe-area testing), and one large monitor (2560×1440+) to confirm the `max-w-2xl` content constraint holds.
- [ ] At 320px width specifically: confirm no horizontal scroll anywhere, `MobileNav`'s 5 items don't clip, and Chat's composer attach menu doesn't overflow off-screen.
- [ ] Keyboard-overlap: open Chat's composer or any text-input-heavy form (Create Moment, Edit Profile) on a real mobile device; confirm the on-screen keyboard doesn't cover the active input.
- [ ] Foldable device (or Chrome DevTools' foldable emulation) — confirm the layout doesn't break across the fold/hinge at either posture.
- [ ] Two devices simultaneously signed in as the same account (or two different accounts messaging each other) — confirm Realtime (Messages, typing, presence, Notifications) delivers correctly to both.

## 5. Dark mode

- [ ] Toggle dark mode (Settings → Appearance) and browse every top-level page: Feed, Capsules, Moments, Memories, Search, Explore, Notifications, Messages, Friends, Profile, Settings (all sections).
- [ ] Specifically re-verify the surfaces fixed this phase: any Social list (search results, followers/following, suggested friends, new creators), the Moments composer and tray, the Profile header and stats, `DropActions`/`InterestActions`/`LockedDropPlaceholder`/`CommentItem` (Feed), and `CapsuleCard`'s action row.
- [ ] Confirm no white-card-on-dark-background or unreadable-text instances on any surface touched this phase. Known remaining gaps are listed in `KNOWN_LIMITATIONS.md` — those are expected, not new bugs.

## 6. Accessibility

- [ ] **Screen reader** (VoiceOver on macOS/iOS, or NVDA/JAWS on Windows) — navigate Feed, a Drop's comment section, Chat, and Settings; confirm meaningful announcements, not silence, on the images fixed this phase (Drop photos, Memory cards, unlocked Capsule photos, Moments, Chat image attachments).
- [ ] **Keyboard-only navigation** — unplug the mouse; complete a full flow (sign in → create a Drop → comment → sign out) using only Tab/Shift+Tab/Enter/Escape/arrow keys. Confirm focus is always visible and never gets trapped.
- [ ] **Reduced motion** — enable the OS-level "reduce motion" preference (or the in-app setting); confirm animations are meaningfully reduced, not just cosmetically different.
- [ ] **Color contrast** — run an automated tool (axe DevTools browser extension or similar) against Feed, Settings, and Chat; log any failures found (none were pre-checked from this environment — see `KNOWN_LIMITATIONS.md`).
- [ ] **Large text** — set the in-app font-size setting to its largest option; confirm no text is clipped or overlapping.

## 7. Security spot-checks (re-verify this phase's fixes)

- [ ] Block another account mid-conversation in Chat; as the blocked account, confirm a direct `supabase.rpc('get_messages', {...})` call for that conversation now returns nothing (was previously still readable).
- [ ] Same scenario for `get_conversation_media` and attempting to react to the blocking user's message (should be rejected).
- [ ] Confirm typing status no longer surfaces across a block relationship.
- [ ] Attempt to upload a disallowed file type (e.g. `.exe`) as a Chat "file" attachment — confirm it's rejected both client-side (immediate error) and would be rejected server-side (the bucket's new `allowed_mime_types`).
