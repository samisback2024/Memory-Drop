# Memory Drop

> **Capture today. Unlock tomorrow.**

Memory Drop is a time-capsule social app. Write a message, attach photos or audio, set a future unlock date, and share it with the world — or keep it just for yourself. When the date arrives, your capsule opens.

**Live:** https://memory-drop-inky.vercel.app

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Backend / Auth | Supabase (PostgreSQL, Auth, Storage) |
| Build tool | Vite 8 |
| Deployment | Vercel |

---

## Features

### Authentication (Phase 1 — complete)
- Email / password sign-up and sign-in
- Google OAuth
- Forgot password → email reset link
- Email verification with resend + cooldown, works correctly even before a session exists
- Complete-profile flow for OAuth users (username + date of birth), since Google sign-in skips the register form
- All routes protected: auth-only, public-only, and a smart root redirect
- Age gate (13+) enforced on both client and database

### Profile (Phase 2 — complete)
- **Profile header** — cover photo, avatar, display name, pronouns, username, public/private badge, profile-completion badge, join date, location, clickable website, bio
- **Cover photo** — upload, replace, remove, crop before upload, stored in its own Supabase Storage bucket
- **Avatar** — upload with drag & drop, crop before upload, client-side compression, initials fallback when no photo is set
- **Edit profile** — display name, username (3–20 chars, unique, 30-day change cooldown), pronouns, bio (150 chars, live preview), location, website (auto-linked), birthday (private — never shown publicly), public/private toggle
- **Public profile** at `/u/username` — privacy-aware: private accounts hide bio/location/website from everyone but the owner while still showing name, avatar, and cover
- **Stats row** — Followers, Following, Capsules, Stories, Memory Streak (placeholders until later phases), Years Active (real, computed from account age)
- **Badges & Achievements** — empty-state panels, ready for a future phase to populate
- Skeleton loading states, error states with retry, full keyboard/screen-reader support

### Friend System (Phase 3 — complete)
- **Follow / request to follow** — instant accepted follow on public profiles, pending request on private ones
- **Manage requests** — accept, decline, or cancel a request you sent, at `/friends/requests`
- **Unfollow / remove follower**
- **Block / unblock** — severs any existing follow relationship in both directions the moment you block someone; a blocked account's profile becomes fully unreachable to you and vice versa
- **Mute / unmute, restrict / unrestrict** — relationship-only for now (no visible effect on content until a later phase adds a feed)
- **Search** at `/search` — by username or display name, blocked accounts (either direction) never appear
- **Suggested friends** — ranked by mutual-connection overlap, falls back to recent accounts when mutuals are scarce
- **Mutual friends** — count + up to 3 avatars, shown on profiles and follow requests
- **Followers / Following pages** — your own at `/followers` and `/following`, anyone's at `/u/username/followers` and `/u/username/following`; private accounts show "This account is private" to everyone except the owner and accepted followers
- **Real social counts** — Followers/Following in the profile stats row are live now, not placeholders
- Follow button states: Follow, Requested, Following (→ Unfollow on hover), Follow Back, Blocked (→ Unblock), Unavailable (they've blocked you)

### Feed — Memory Drops (Phase 4 — complete)
Reshaped around Memory Drop's actual identity — "capture now, unlock later" — rather than a generic social feed. Nothing here copies Instagram/Facebook/Snapchat/TikTok patterns on purpose.

- **Every drop has an unlock date.** Leave it at "now" and it behaves like an ordinary share; push it into the future and it's a real time capsule. **Locked content is never sent to the client** — not blurred, *absent* — so there's no way to peek at your own sealed memory early by inspecting the network response. Even the drop's own author has to wait.
- **Six tabs** at `/feed`, each a genuinely different slice, not just a different sort order:
  - **My Drops** — everything you've dropped, locked or not
  - **Following** — drops from people you follow, locked or unlocked, respecting each drop's own visibility
  - **Public Drops** — the open discovery wall: every public-visibility drop from a public account, locked or unlocked. A locked one here is the anticipation case on purpose — a creator's upcoming drop, countdown and all, not just their already-opened ones
  - **Unlocking Soon** — anything visible to you that's still sealed, soonest unlock first
  - **Today's Unlocks** — anything visible to you opening today
  - **Saved to Unlock** — drops you tapped "Save to Unlock" on while they were still sealed, soonest unlock first

  Switching tabs is instant on a revisit (each tab's drops + scroll position are cached) and infinite-scrolls independently.
- **Memory types** — written, photo (up to 10, adaptive grid), video, or voice (audio) — all lazy-loaded.
- **Mood** — one of 8 curated moods (joyful, grateful, nostalgic, hopeful, reflective, peaceful, bittersweet, excited), shown as an emoji on the card.
- **Visibility** — three tiers per drop (Everyone / Followers / Only me), layered *inside* the account-level privacy that already existed. See "Database tables" below for exactly how the tiers interact.
- **Composer ("Create Drop")** — rotates through three prompts ("What moment do you want to save?" / "Capture this moment for later…" / "Write something your future self will unlock…"), unlock-date picker, mood picker, a three-option visibility picker, curated emoji picker, a localStorage caption draft that survives closing without dropping.
- **Two entirely different action rows depending on lock state — not one row with buttons dimmed out:**
  - **Locked**: four positive, anticipation-flavored reactions — **Save to Unlock**, **I'm Interested**, **Can't Wait**, **Good Vibes** — plus **Reflect**. Deliberately not a like/comment row with nothing to attach to yet; no negative or "engagement-bait" reaction exists. All four are enforced server-side as locked-drop-only — the RLS rejects them once a drop has actually unlocked, so this isn't just which buttons the UI happens to render.
  - **Unlocked**: **Like**, **Reflect**, **Comment**, **Save**, **Share** — the only point any of these five ever appear. Like reuses the `likes` table that's existed since the original Phase 4 (dormant during the time-capsule redesign, now wired back up as a post-unlock-only reaction).
- **Reflect** — a private, unlock-independent note-to-self on any drop (yours or someone else's), available at any lock state, never shown to anyone but its author and never counted as a comment. Reuses the `comments` table with an `is_reflection` flag rather than a new table.
- **Comments** only unlock once the drop does (enforced by RLS, not just hidden in the UI).
- **Share** — copy link (to a real permalink at `/drop/:dropId`), native share sheet where supported, "Share inside Memory Drop" shown as a disabled coming-soon option.
- **Report** (6 reasons) and **Hide** (feed-local, current user only) — both write-only from the client; nobody but the reporter can see their own report.
- **Saved memories** page at `/saved` — the ordinary post-unlock bookmark (`Save`), distinct from the pre-unlock "Save to Unlock" reaction above; a drop can be saved both ways independently.
- Glass cards on a soft gradient wash, a timeline rail connecting cards down the left edge, gradient countdown pills, a locked-drop "sealed capsule" placeholder (not a blurred photo — there's no photo to blur), warm pill-shaped reaction buttons that light up on selection, and a brief reveal transition when a countdown hits zero while the card is on screen.
- **Notification groundwork, not notifications** — every reaction (interest, like, comment, save) is already a durable row with a timestamp and an actor, and a `drop_unlock_views` table quietly logs the first time someone other than the owner sees an unlocked drop. Nothing reads any of this yet; it's there so Phase 9 can build "Sam sent good vibes" / "Sam unlocked your drop" without a schema change.

### Moments (Phase 5 — complete)
Short-lived, not a Stories clone. A Moment is one photo, video, or written thought that sticks around for exactly 12, 24, or 48 hours — chosen once at creation, never extended — and then it's gone from everywhere except your own private archive. No filters, no stickers, no music, no swipe-up links, no merged "your story" bubble.

- **Add Moment** — a dedicated bubble at the front of the tray, always present, separate from anyone's viewing bubble. Photo, video, or text, plus an optional caption, mood (the same 8-mood set as Drops), free-text location, and a mention (search-and-pick, resolved to an actual user).
- **Duration**: 12h / 24h / 48h, decided once and enforced server-side — `expires_at` is computed by a DB trigger from `duration_hours` at insert time, not trusted from the client.
- **Privacy**: **Everyone**, **Followers**, **Close Friends**, **Only Me**. Close Friends is a real privacy tier with a real table (`close_friends`) behind it, but there's no list-management UI yet — until a later phase adds one, a Close-Friends-only moment is visible to nobody but its owner, which the picker's copy says outright rather than pretending otherwise.
- **Moment tray** at the top of Feed — a dedicated "Add Moment" bubble first, then one bubble per author with an active moment (yourself included, if you have one), grouped and ordered so authors with something unviewed sort first. The ring is the entire read/unread signal: gradient while something of theirs is unviewed, plain gray once you've seen everything.
- **Full-screen viewer** at `/moments/:momentId` (or opened inline from the tray) — segmented progress bar per moment in the stack, tap the left/right half to step back/forward, hold to pause. Video drives its own progress off real playback; photo and text play for a fixed 6 seconds.
- **Two-sided engagement, not one**: quick emoji reactions (❤️ 🔥 😍 😮 🙏 😂) and a "Reply to this memory" text field — both write-only from a viewer's side, both explicitly disallowed on your own moment (same rule as Phase 4's pre-unlock interests). Replies are private between the replier and the moment's owner, shaped like a future DM on purpose.
- **Seen by** — owner-only. Tapping "Seen by N" on your own moment opens the viewer list; nobody else can ever see who viewed a moment, only that they themselves did (implicitly, by however the ring behaves for them). **View count**, likewise, is only ever real for the owner — everyone else always gets 0, the same convention Instagram uses for its own story view counts.
- **Expiration is a real boundary, not a filter** — once `expires_at` passes, a moment's direct-table RLS stops returning it to anyone but its owner, and every tab/tray RPC excludes it outright. The owner's **archive** at `/moments` is the one place expired moments keep existing, in a tappable grid, oldest interactions preserved (reactions/replies/views on an expired moment aren't deleted, just no longer growable).
- **Moment ring on profiles** — a small, optional touch: your own profile and anyone else's shows a gradient ring around the avatar when that person currently has an active moment, tap it to open the viewer right from their profile.

### Time Capsules (Phase 6 — complete)
The signature feature, and deliberately not shaped like a post with a date on it. A capsule is a sealed vault: title, memory text, and every attached photo/video/audio/voice note are all withheld until `unlock_date` passes — for *every* viewer, including the capsule's own author. There's no tab, no algorithmic ranking, no engagement bait while it's sealed — just a countdown.

- **A 9-step guided creator**, not a composer form — memory type(s), title, the memory itself, media, mood, visibility, unlock date, a review screen, then a "Memory Locked" confirmation. Each step is one decision; nothing scrolls past you unnoticed.
- **Memory types can combine** — Text, Photo, Video, Audio, and Voice Recording are all independently selectable, and a single capsule can genuinely hold several (e.g. three photos and a recorded voice note alongside a written memory). Voice notes are recorded in-browser via `MediaRecorder`, not just uploaded — a real capability Drops/Moments don't have.
- **Visibility**: **Only Me**, **Followers**, **Public** — decided by the same `can_view_capsule()` pattern as Drops/Moments, but capsules go one step further: the `capsules` table's own row-level security refuses a locked capsule to non-owners *outright*, not just a nulled column. Direct API access to a locked capsule you don't own returns nothing, not a stripped-down row — a stricter guarantee than Drops currently makes (see Security notes).
- **Unlock date presets** — Tomorrow, Next Week, Next Month, 1 Year, Custom Date, Custom Date & Time — plus a hard rule: a capsule's unlock date must be in the future, enforced by a DB trigger, not just form validation.
- **The reveal is a deliberate tap, not automatic.** Once `unlock_date` passes, a capsule shows an "Open Capsule" button instead of silently revealing itself — tapping it plays a short unlock animation while the real content loads underneath, then reveals it. That "I opened this" moment is recorded (`capsule_unlocks`) per person, so it only plays once per viewer.
- **Live countdown down to the second** — years, months, days, hours, minutes, seconds, calendar-aware (not a flat ms division, so "1 year 2 months" actually means that).
- **Post-unlock engagement**: Like, Comment, Reflect, Save, Share — the only point any of those five appear. Reflect is available at any lock state (a private note-to-self, same convention as Drops/Moments); the other four are unlock-gated by RLS.
- **My Archive** at `/capsules` — every capsule you've ever sealed, searchable (title/memory text, your own capsules only) and filterable by lock status, unlock year, mood, media type, and visibility. Rendered as a chronological timeline with year markers, not a feed. The same archive, read-only and without search, appears on your own and anyone else's profile for whatever capsules are visible to you.

### Memories (Phase 7 — complete)
The emotional heart of the app once you've accumulated months and years of content — a journal/scrapbook, not a profile grid. A "memory" is exactly two things, **unioned at read time, not duplicated into a new table**: every Capsule you own (locked or unlocked — a still-sealed one belongs in your own timeline as something in progress) and every Moment you own that's already expired (an active Moment still belongs to the live tray, not here). No new `memories` table exists; `get_memories()`/`get_memory()` UNION `capsules` and `moments` into one normalized shape on every read, the same "compute, don't duplicate" instinct behind every RPC in this app.

- **Eight ways to look back**, all at `/memories`: **Timeline** (search + filters + four interchangeable layouts), **Calendar** (a month grid with a dot on any day that has memories, tap a day to see them), **Years** (an expandable shelf — "2026 · 14 memories" — newest first), **Collections** (a fixed starter set — Travel, Family, Birthday, and nine more — auto-created empty for every user, plus fully custom ones; always manually curated, never content-classified — there's no AI in this phase), **Favorites** (a heart on any memory you can see), **Flashbacks** ("on this day" N years ago, dismissible for the day), **Highlights** (best this month / most viewed / most reacted, computed live, savable as a pinned reel), and **Archive** (Hide/Restore/Delete permanently — hiding is reversible and never touches the underlying row; deleting is not).
- **Four layouts, one dataset** — List (dense rows), Grid (thumbnail tiles), Journal (large, spacious, one entry at a time), Timeline (the connecting-rail visual already used elsewhere in the app, now spanning both content types with year markers). Switching layouts never re-fetches.
- **Grouping and flashbacks use `created_at`** — when a memory actually happened/was captured — not `unlock_date`/`expires_at` (when it became visible). A capsule sealed today that opens in 2030 is still "from today" in your timeline, even though nobody can read it until 2030.
- **Search and two new fields.** `tags` (a text array) was added to both `capsules` and `moments` this phase — genuinely new metadata, not present before — editable from the new Memory Details page. `location_text` was added to `capsules` the same way (Moments already had it). Neither Phase 5's nor Phase 6's original creation flows collect these; they're deliberately edited only after the fact, from Memories, not retrofitted into the older wizards.
- **Memory Details** at `/memories/:memoryType/:memoryId` — for a capsule, this is a full `CapsuleCard` (complete reuse: the unlock ritual, Like/Comment/Reflect/Save/Share, everything Phase 6 already built). For an expired moment, a simpler read-oriented display (media/text, mood, historical reaction counts if you're the owner) — new reactions and replies aren't possible on an expired moment by design (see Phase 5's RLS), so this view doesn't pretend otherwise. Both get the same metadata footer this phase adds: tags, location, collection membership, favorite, and archive controls.
- **Hide is reversible, delete is not.** Hiding sets `hidden_at` and removes a memory from every default view (Timeline, Calendar, Years, Collections, Favorites, Flashbacks, Highlights) without touching the row — "nothing disappears." Deleting permanently calls the same `deleteCapsule`/`deleteMoment` functions Phases 5/6 already built (including their storage cleanup), so that logic lives in exactly one place.

### Settings & Privacy (Phase 8 — complete)
Numbering note: the brief for this phase called itself "Phase 7," but Phase 7 had already shipped as Memories — everything here is filed as **Phase 8** instead (see Roadmap). One page at `/settings`, ten sections drilled into by `/settings/:section` — a list-then-detail shape, not a wall of tabs, matching how every mobile settings app actually works.

- **Account** — change email (Supabase's own confirm-both-addresses flow), change password (re-verifies your *current* password via a real sign-in attempt first, not just trusting the session), username change (reuses Phase 2's existing 30-day-cooldown logic, not a duplicate), log out, and **delete account** — a real, working self-service deletion via a `SECURITY DEFINER` function that deletes the `auth.users` row directly; every table in this schema already cascades from `profiles.id → auth.users.id`, so one DELETE unwinds the entire account.
- **Profile** — links out to Phase 2's existing full editor for display name/bio/avatar/cover rather than duplicating that UI, plus two settings that never had anywhere to live before: default Drop visibility and default Moment visibility, actually wired into `DropComposer`/`CreateMomentModal` (a fresh composer now opens pre-set to your default, not a hardcoded literal).
- **Privacy** — the private-account toggle, and four "manage my list" screens (blocked, muted, restricted, Close Friends) that genuinely didn't exist anywhere before this phase — Phases 3 and 5 let you toggle these relationships from a profile's menu but never gave you a page listing everyone currently on each list. Close Friends finally gets real management, closing a gap Phase 5's own README flagged as a known limitation. "Download my data" is an honest placeholder; "Delete all my data" is real — it deletes every Drop/Moment/Capsule you own (not the account) by calling each phase's own delete function in a loop, so storage cleanup happens exactly the way it always does.
- **Security** — password-last-changed, a self-reported sign-in history (`user_sessions`, one row per login, best-effort device label from the user agent — not a live view into Supabase's internal session store, which the client SDK doesn't expose and this app has no service-role backend to query), a real **"sign out of all devices"** (`supabase.auth.signOut({ scope: 'global' })`, which genuinely revokes every refresh token), and a two-factor authentication UI shell that's visibly "coming soon" rather than pretending to work — deferred exactly as scoped.
- **Notification Preferences** — eight toggles, stored, nothing delivered yet (no push system exists — that's explicitly a later phase). Every choice made now is preserved for whenever it does.
- **Appearance & Accessibility** — real infrastructure, honestly scoped. Font size, high contrast, reduced motion, and larger touch targets are **global CSS overrides** (classes on `<html>`, see `index.css`) that apply everywhere immediately, zero per-component changes needed. Dark mode is real switching infrastructure (`ThemeProvider`, instant apply, `localStorage` + `user_settings` persistence, live system-preference tracking) — but only the core shell (`Navbar`, `AppShell`) and the Settings page itself have `dark:` variants so far. The other ~90 components across Drops/Moments/Capsules/Memories/Profile were built entirely with light-mode literal colors; a full dark-mode visual pass is real, scoped follow-up work, not something this phase pretends to have finished — see Known limitations.
- **Storage** — real numbers, not an estimate: lists every file you own across all five storage buckets via the Storage API's own size metadata and sums them by type. "Clear cached files" clears local drafts from this browser; "Manage uploaded media" links to Capsules/Memories rather than building a second file browser next to the ones that already exist.
- **Help & Support** — a static FAQ accordion, plus one `FeedbackForm` component reused three times (Contact support / Report a bug / Send feedback), all landing in the same one-way `feedback_reports` mailbox — write-only from the client, same discipline as Phase 4's `reports` table.
- **About** — version, and links to the Privacy Policy/Terms of Service routes Phase 1 already built.

### Unified Memory Wiring (Phase 9 — complete)
Not a new feature — a wiring/consistency pass across everything Phases 4–7 already built. Before this phase, `get_memories()` only unioned Capsules and expired Moments (Phase 7's own README explicitly flagged Drops as an open question); Profile had no stats at all; Capsules showed one flat filterable list instead of a lifecycle view.

- **What an audit found**: the six Feed tabs and every unlock-tracking table (`drop_unlock_views`, `capsule_unlocks`, `capsule_views`, `moment_views`) were already correctly and consistently wired — no bugs there. The real gaps were Drops missing from Memories, and Profile having no stats. This phase fixes exactly those, rather than rewriting things that already worked.
- **Drops now join Memories.** `get_memories()`/`get_memory()` UNION three sources instead of two — an unlocked Drop, a Capsule (locked or unlocked, your own), and an expired Moment, all through the same "no peeking early" content-nulling rule already used everywhere. A Drop's `title` is always null (Drops never had one); `tags`/`location_text` stay empty (those two fields only ever existed on Capsules/Moments).
- **`memory_items_view`** — a normalized, lightweight read model over `posts`/`capsules`/`moments`, used by the new stats RPCs so the "what counts as locked/unlocked/expired/archived" logic is written once. Deliberately **not** granted to `authenticated`/`anon` — a Postgres view runs against its underlying tables with the *view owner's* privileges for RLS purposes, so exposing it directly would let any signed-in user read every row in the system, bypassing every visibility rule this app enforces elsewhere. It only exists to be queried from inside `SECURITY DEFINER` functions that apply their own visibility predicate, same discipline as everything else.
- **Real Profile stats** (`get_memory_stats()`) — total Drops, locked/unlocked items (combined across all three content types), expired Moments, saved-to-unlock count, public Drops, followers/following, and live-aggregated views/unlocks/reactions/comments *received* across everything you own. Every number is computed fresh from the same tables Feed/Capsules/Memories already read — never a separately-tracked counter that could drift.
- **Public stats** (`get_public_stats()`) — a deliberately narrow sibling: public memory count plus follower/following counts, nothing else. Never touches locked content or any non-public visibility tier, for anyone but the profile's own owner.
- **Capsules page now has a real lifecycle view** — Locked, Unlocking Soon (within 7 days), Unlocked, and Archived as labeled sections by default, with a "Browse & Search" toggle back to the full filterable timeline for finding something specific.
- **Memories' Timeline tab gained two preview strips** — Recently Unlocked and Locked Until Later — above the full filterable list, so the lifecycle is visible at a glance without digging into filters.
- **Favorites and Collections now support Drops too** (`favorites.drop_id`, `collection_items.drop_id`), the same three-way-XOR-FK pattern already used for Capsules/Moments.

### Search + Explore (Phase 10a — complete)
The first of six Phase 10 ("Social Experience & Product Polish") sub-phases, split by agreement so each lands as one reviewable unit instead of one enormous migration — see Roadmap for 10b–10f.

- **Unified search** (`/search`) — one search bar now finds Users (Phase 3's `search_users`, unchanged), Drops, Capsules, expired Moments, your own Collections, tags, and locations, with type filter chips (All/Users/Drops/Capsules/Moments/Collections) to narrow results. Cross-user content search goes through a new `search_memories()` RPC — the counterpart to `get_memories()` (which is deliberately single-owner-scoped and only ever searches *your own* content): same `can_view_drop`/`can_view_capsule`/`can_view_moment` visibility predicates as everywhere else, same "no peeking early" rule (only ever surfaces unlocked/matured content), returning the identical row shape `get_memories()` does so results render with the exact same `GridView`/`MemoryCard` used across the app.
- **Recent searches** — every search you run is recorded (`search_history`, own-rows-only RLS); shown as clickable chips when the search box is empty, with a one-tap "Clear."
- **Trending searches** — a site-wide aggregate of the last 7 days' search terms (`get_trending_searches()`), counts only, never who searched what.
- **Search suggestions** — as-you-type dropdown combining matching usernames and matching trending terms (`get_search_suggestions()`).
- **Explore page** (`/explore`, new nav link) — eleven tabs: Trending, Newest, Popular Memories, Popular Drops, Today's Unlocks, and six tag-based categories (Travel/Nature/Family/Graduation/Birthday/Achievements). Built entirely on `search_memories()`/`get_explore_feed()` — "only show content users are allowed to view" is inherited directly from the same predicates, not a separate looser rule.

### Profile Polish (Phase 10b — complete)
Before writing anything new, this phase's nine-item brief was checked against what already shipped: **six of the nine already existed** — Memory Statistics dashboard (`ProfileStatsCard`, Phase 9), Achievement section (`BadgesAndAchievements`, Phase 2), Recently unlocked memories ("Recent Memories", Phase 9), and Mutual friends display (`MutualFriends`, Phase 3 — shown on `PublicProfilePage` only, since a mutual-friends count with yourself isn't meaningful). Public Capsules/Public Moments sections needed no new SQL — same client-filter-after-fetch pattern Phase 9's "Locked Drops" preview already used. That left two genuinely new capabilities:

- **Pinned Memories / Pinned Drops** — pin up to 6 of your own unlocked Drops/Capsules/Moments to showcase at the top of your profile. New `pinned_items` table (own-content-only, enforced server-side, not just in the UI) and `get_pinned_memories()` RPC, same visibility-and-block gating as everything else. Toggled from a new "Pin to profile" control in Memory Details (`MemoryViewer`); rendered as two separate sections on Profile — Pinned Memories (Capsules/Moments) and Pinned Drops — per the brief's two distinct bullets, backed by one shared mechanism.
- **Activity timeline** — a live-computed feed of "created a Drop/Capsule/Moment" and "commented on a Drop/Capsule," via a new `get_activity_timeline()` RPC. Deliberately *not* a trigger-populated log table: a log only starts recording the moment it's added (empty history for every existing account), while a live query over existing `created_at`/comment timestamps has full history from day one — the same "derive it fresh" philosophy `memory_items_view`/`get_memory_stats()` already established in Phase 9. Reactions/likes and private threads (reflections, moment replies) are deliberately excluded — see Known limitations.

### Bookmark + Share Experience (Phase 10c — complete)
An audit before writing anything found a real, pre-existing gap: Capsules have had their own `capsule_saves` table since Phase 6 (the Like/Comment/Save trio), but nothing ever built a page to browse them — saving a Capsule toggled a bookmark icon that led nowhere. `/saved` (renamed from Drop-only `SavedDropsPage` to `SavedPage`) now unifies both:

- **One Saved page, two content types** — Drops and Capsules together, via the new `get_saved_memories()` RPC (same Memory-shaped rows as Search/Explore/Pinned). Moments still have no save concept anywhere in this app — they're ephemeral by design, not an oversight.
- **Folders** reuse Phase 7's existing Collections rather than a new parallel concept — the brief's "Folders" and "Collections" bullets are one and the same mechanism here, since Drops/Capsules were already collection-eligible (Phase 9).
- **Notes** — a free-text note (280 chars) per saved item, your own private annotation, stored directly on `saved_posts`/`capsule_saves` (new `note` column + a new UPDATE policy on each — neither table had one before).
- **Sort, filter, search** — newest/oldest saved, filter by content type or folder, and full-text search across title/caption/note, all server-side via `get_saved_memories()`'s params.
- **Share, generalized.** `ShareModal` was Drop-only; it's now shared by Drops and Capsules (`memoryType: 'drop' | 'capsule'`), and gained three new things: a **downloadable preview card** (pure `<canvas>`, no new dependency — gradient background, cover photo if it loads without a CORS taint, mood emoji, caption, "Memory Drop" wordmark), a **QR code** (via a public QR image API — the one external network call this phase adds, documented in Known limitations), and **"Copy shareable text"** (a formatted caption+link, replacing the old disabled "Share inside Memory Drop — Coming soon" stub). Deep linking itself needed no new work — `/drop/:id`, `/capsules/:id`, `/memories/:type/:id`, and `/u/:username` already existed; this phase just made sure every shareable surface builds those same canonical URLs consistently.

### Comments + Reactions (Phase 10d — complete)
An audit before writing anything found `comments` (Drops) has carried a dormant `parent_comment_id` column since Phase 4 — declared "nested replies preparation," never read or written by any RPC or frontend code. `capsule_comments` had no threading column at all, and neither table had an UPDATE policy, so editing was impossible even at the database level. Capsule comments also had noticeably less UI than Drop comments (no delete button, despite the backend already supporting it). This phase closes all of that, and — since both comment tables ended up with the identical shape — **unifies what were two separate, unequal comment UIs into one shared `CommentSection`/`CommentItem` pair**, used by both `DropCard` and `CapsuleCard`.

- **Replies** — one level deep, not infinitely nested. `parent_comment_id` (finally activated on `comments`, newly added to `capsule_comments`) plus a trigger that rejects replying to a reply. Top-level comments render with their replies indented directly beneath, grouped client-side from one flat fetch.
- **Edit comment** — a real UPDATE policy exists now (it didn't before), enforced by a trigger that checks *which* column changed and *who's* allowed to change it (see Security notes) rather than a blanket "owner can update anything" policy.
- **Delete comment** — already worked for Drops end-to-end; now has real UI for Capsules too (it only ever lacked a button, not backend support).
- **Mention users** — typing `@` in any comment/reply box opens a live username-search dropdown (reusing Phase 3's `search_users`); mentions render as clickable profile links. No `comment_mentions` table and no notification hookup — there's nothing for one to feed yet (Notifications stay out of scope for all of Phase 10), so this is parsing + a nice link, not a tracked relationship.
- **Emoji reactions** — a new `comment_reactions` table, one active reaction per user per comment (swap by picking a different emoji, remove by picking the same one again), same model `moment_reactions` already established. Reuses the existing `EmojiPicker` component.
- **Comment timestamps** — already existed for Drops; now rendered for Capsule comments too, plus an "· edited" marker when `edited_at` is set.
- **Pinned comments** — only the Drop/Capsule owner can pin (checked by the same trigger that gates edits), never the comment's own author unless they're also the content owner. Pinned comments sort first.
- **Reactions, more broadly** — Drops'/Capsules' own Like stays a single reaction type (a heart); widening it into full multi-emoji reactions was judged too large/risky a change for this pass (see Known limitations). What *did* ship: an **animated pop + floating heart** on like (pure CSS keyframes, no library), and **"Recent reactions"** — tap a like count to see an avatar list of who recently liked, via a new `get_recent_likers()` RPC (likes' own SELECT policy is own-rows-only, same reasoning as every other cross-user read in this app). "Top reactions" already exists for Moments (`get_moment_reactions`, Phase 5) — nothing new needed there, since Moments already support multiple emoji types.

### Feed Polish + UX + Performance (Phase 10e — complete)
An audit before writing anything found most of the "Feed Polish" brief already shipped in earlier phases and genuinely solid: infinite scroll (`InfiniteLoader`/`useInView`), pull-to-refresh (`usePullToRefresh`, already wired into `FeedPage`), optimistic updates (consistent across `LikeButton`/`SaveButton`/`DropActions` since Phase 4), and real composed skeletons/empty states (`FeedSkeleton`, `EmptyDropState`) — none of that was rebuilt. Keyboard accessibility was also already a mature, consistent pattern (`Modal`'s real focus trap, Escape-to-close everywhere, visible focus rings throughout) — light-touch only here. What was genuinely thin is what this phase actually built:

- **Offline detection + retry** — a new `useOnlineStatus()` hook (`navigator.onLine` + `online`/`offline` events) and a persistent `OfflineBanner` in `AppShell`. Every read hook in this app (`useDrops`, `useMemories`, `useSearch`, ...) already swallows fetch errors into an empty array rather than surfacing them — a pre-existing pattern, not something this phase changed — so a failed request today looks identical to a genuinely empty result. Rather than the much larger, more invasive change of reworking every hook's return contract to distinguish "empty" from "errored," Feed/Explore/Search/Memories/Capsules now check "is the result empty *and* are we offline" and show a real `ErrorState` with Retry for that specific, common case, while true server-error-while-online still reads as "empty" — an honest, scoped fix, not a complete one (see Known limitations).
- **Page transitions** — `AppShell`'s `<main>` is now keyed by `location.pathname` with a `page-enter` fade/slide-up (no `framer-motion`, not installed; a route-change wrapper wasn't attempted, this is a lighter CSS-only touch).
- **Unlock reveal animation** — Drops now play a subtle scale/fade `unlock-reveal` the moment a card's own countdown hits zero and its real content arrives (not on every render of an already-unlocked drop, only the live transition). Capsules already had a dedicated `UnlockAnimation` component (Phase 6) — untouched, already good.
- **Reduced motion is respected automatically** — every new animation here uses standard Tailwind `animate-`/`transition-` classes, which the existing global `.md-reduced-motion` override (Phase 8) already neutralizes app-wide; no new opt-out logic was needed.
- **Performance — memoization**: `MemoryCard`, `DropCard`, `CapsuleCard` (the three components behind every list/grid in the app) are now `React.memo`-wrapped. This works because their parent pages patch one item's object reference in an array at a time (`prev.map(x => x.id === id ? {...x, ...patch} : x)`) rather than replacing the whole array's contents — unchanged siblings keep the same object reference, so memo correctly skips re-rendering them on every interaction with one card.
- **Performance — a dependency-free stand-in for virtualization**: no `react-window`/`react-virtual` is installed, and hand-rolling a windowed scroller for variable-height cards (photos, videos, text, all mixed within one list) was judged too large and error-prone for this polish-focused phase. Instead, `DropCard`/`CapsuleCard` get a new `.cv-auto` CSS utility (`content-visibility: auto` + `contain-intrinsic-size`) — the browser skips layout/paint work for off-screen cards without unmounting them from React, which is most of virtualization's actual win at a fraction of the complexity. Deliberately *not* applied to `MemoryCard`'s small grid/list variants — their aspect-square/compact sizing doesn't match the utility's tuned placeholder height and would misjudge scrollbar length.
- **Performance — image loading**: `Avatar.tsx` — the single most-reused image component in the app (navbar, comments, likers popovers, every card header) — gained `loading="lazy" decoding="async"`, closing the one real gap an audit found (`MemoryCard`/`ImageGrid` already had it consistently).
- **Performance — reduced refetching**: Memories' Favorites/Flashbacks/Archive tabs now cache per-session the same way `FeedPage`'s tabs already did (Phase 4) — revisiting a tab within one page visit no longer refires its RPC.

### Admin Preparation (Phase 10f — complete)
The last of six Phase 10 sub-phases, and explicitly architecture-only per the brief: **"No admin UI yet. Just architecture."** Nothing added here is reachable from the app today — there's no admin screen anywhere, and every existing account has `is_admin = false` by default, so the two new functions below currently have zero real-world callers. That's the intended end state for this phase, not an unfinished one.

An audit found three real gaps: reporting was Drop-only (`reports`, a one-way mailbox — Capsules and Moments had no equivalent); there was no admin/moderator role concept anywhere in the schema; and there was no soft-delete anywhere — every deletion in this app is a hard, cascading DELETE, which is right for a user deleting their own content but wrong for moderation, since it destroys the evidence a review process would need.

- **`profiles.is_admin`** — the role concept itself. Defaults `false` for everyone; nothing sets it to `true` anywhere in this codebase (that's a manual, direct-database step for whoever operates a real deployment).
- **`capsule_reports` / `moment_reports`** — parity with Drops' existing `reports`: same one-way-mailbox shape, no SELECT policy at all, kept as separate per-content-type tables rather than one polymorphic table (matching how `capsule_likes`/`capsule_comments`/`capsule_saves` already mirror their Drop equivalents elsewhere in this app).
- **`moderation_status`** (`'active'` / `'hidden'` / `'removed'`) plus `moderated_at`/`moderated_by`/`moderation_reason` on `posts`/`capsules`/`moments` — the auditable alternative to a silent hard delete. The only way this can change is through `moderate_content()`, a new admin-only `SECURITY DEFINER` RPC — there's deliberately no direct-UPDATE RLS policy for these columns, so "who changed this and why" always has exactly one answer.
- **`get_content_reports()`** — a new admin-only RPC that unions all three report tables into one normalized shape (content type, content, reporter, reason, timestamp). This *is* the "content reports dashboard structure" the brief asks for — a ready-made data source for a future admin screen, without building that screen.
- **Deliberately not done in this pass**: no existing read RPC (`get_drops_feed`, `get_memories`, `search_memories`, ...) was modified to exclude `moderation_status <> 'active'` content. See Known limitations for why.
- **Scale-test seed data** — a separate, clearly-marked `supabase/dev_seed_scale_test.sql` (not a schema migration — never run it against production). Updated in Phase 10g to match the revised spec's exact counts — see below.

### Product Polish & Social Experience — hardening pass (Phase 10g — complete)
A second, much more detailed pass at the same "Phase 10" brief, requested after 10a–10f had already shipped. Rather than a rewrite, this was a reconciliation: an audit found the two briefs overlapping almost entirely, with a handful of concrete mismatches (a pin cap of 3 vs. the shipped 6; an Explore section list that didn't match what was live; a mobile bottom-nav requirement nothing had built yet; the Drops-vs-Capsules RLS gap the README had documented since Phase 6, called out by name as something to actually close). Everything below is that reconciliation, in one migration (`supabase/phase10g_polish_fixes.sql`) plus a frontend pass — see Known limitations for what was deliberately left as honest, scoped progress rather than claimed as finished.

- **Pinned Memories cap 6 → 3** — `enforce_pin_limit()` updated to match the revised spec exactly.
- **Saved page restructured into 4 named tabs** — Waiting to Unlock (drop_interests' pre-unlock save marker, reusing the same `getDropsFeed('saved_to_unlock', ...)` query Feed's own tab already used), Saved Memories (the existing unified saved-Drops+Capsules view, unchanged), Favorites, and Collections — the last two reuse Memories' own mechanisms unchanged, so this page is a second entry point onto the same data, not a competing system.
- **Explore rebuilt around the revised spec's exact section list** — Unlocking Soon, Today's Unlocks, Recently Unlocked, Popular Public Drops, Public Capsules, New Creators, Suggested People — replacing the original Phase 10a tab set (Trending/Newest/6 tag categories, which weren't in the new spec). The two "person" tabs (New Creators, Suggested People) render real accounts, not memories — Suggested People reuses Phase 3's `get_suggested_friends()` unchanged; New Creators is one new small RPC. `ExplorePage` branches its renderer by tab rather than forcing both shapes through one type.
- **Mobile bottom navigation** — genuinely new; nothing like it existed before this pass. A fixed bottom bar (Feed, Capsules, **Create**, Memories, Profile) shown only below the `sm` breakpoint, additive to the existing top `Navbar` (which now hides its own icon row on mobile to avoid a redundant second nav — Search/Explore/Friends move into the always-visible account menu on narrow viewports). **Create** opens a small action sheet (Create Drop / Create Moment / Create Capsule) reusing the existing `DropComposer`/`/moments/create`/`/capsules/create` — no new composer logic.
- **Security hardening — the one the brief called out by name.** `posts`' SELECT RLS only ever checked visibility, never `unlock_date <= now()`, unlike `capsules` — meaning a non-owner who could see the author's posts in general could read a still-locked Drop's *raw row* via a direct `/rest/v1/posts` request, even though every RPC already nulled the content. `posts` now has the exact same table-level guarantee `capsules` has had since Phase 6: a locked Drop you don't own returns **no row at all**, not a row with nulled columns.
- **Storage bucket policies spot-checked, found consistent, left alone** — all four content buckets use the same `bucket_id = 'x'` public-read policy paired with unguessable per-user storage paths, which is Supabase's own standard pattern for object storage layered under app-level access gating (the app already never leaks a media URL before unlock). Not a gap; documented rather than "fixed."
- **A real `ErrorBoundary`** — wraps `AppShell`'s routed content; previously a render-phase crash anywhere had no fallback at all.
- **A shared toast system** (`useToast`/`ToastProvider`) — established as the going-forward pattern for confirmations/errors (comment post/edit/delete/pin failures, share-preview-card download success/failure); existing inline confirmations (e.g. ShareModal's own "Link copied" label) were left as-is rather than ripped out wholesale.
- **Dark mode — scoped, honest progress, not full coverage.** Fixed, in priority order: every shared UI primitive (`Button`, `Input`/`Textarea`, `Modal`, `EmptyState`, `ErrorState`, `Skeleton`, `Avatar`), every new component this pass added, and the highest-traffic surfaces named in the brief (`MemoryCard` fully — the single component behind every grid/list/timeline view in the app — plus the core chrome of `DropCard`, `CapsuleCard`, `FeedPage`/`DropTabs`, `MemoriesPage`, `SavedPage`, `ExplorePage`, `ProfilePage`/`PublicProfilePage`/`SearchPage`). **Not claimed as complete** — see Known limitations for exactly what's still light-mode-only.
- **Accessibility — targeted, not a rebuild.** Modal's focus trap/Escape-to-close/focus rings were already solid app-wide (confirmed, not rebuilt). Added: screen-reader `aria-live` announcements for comment post/reply/delete and capsule-unlock completion; confirmed the new mobile nav's tap targets clear 44px even though its visual "Create" pill is smaller (the surrounding button fills the full nav-bar cell).
- **Performance — targeted.** `PublicProfilePage`'s five independent reads (relationship, moments, public stats, public memories, pins) went from a partly-sequential chain of `await`s to one `Promise.all`. Search/Explore/Memories/Settings are now `React.lazy`-loaded route chunks — the main JS bundle dropped from ~817kB to ~484kB and the build's "chunk larger than 500kB" warning is gone. No virtualization work beyond the `content-visibility: auto` utility already shipped in 10e.
- **Scale-test seed data updated** to the revised spec's exact numbers — 100 fake accounts (10 explicitly private), 1000 Drops, 300 Capsules, 300 Moments, ~1,500 follows, 2 block relationships, ~4,500 comments, ~6,000 likes/reactions, ~600 bookmarks, ~100 collections with ~300 items, and ~500 favorites.

---

## Getting started

```bash
git clone https://github.com/samisback2024/Memory-Drop.git
cd Memory-Drop
npm install
npm run dev        # → http://localhost:5173
```

### Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your **Project URL** and **anon public key** from Project Settings → API
3. Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Run the database migrations **in order** via the Supabase SQL editor:
   - `supabase/phase1_auth.sql` — profiles table, RLS, triggers, username-availability RPC
   - `supabase/phase2_profiles.sql` — bio/privacy/completion columns, `avatars` storage bucket, `get_profile_by_username` RPC
   - `supabase/phase2b_profile_polish.sql` — website/location/pronouns/cover photo columns, username change cooldown, `covers` storage bucket
   - `supabase/phase3_social_graph.sql` — follows/blocks/mutes/restrictions tables, RLS, and the social RPCs (search, suggestions, mutual friends, followers/following, requests)
   - `supabase/phase4_feed.sql` — posts/post_images/likes/comments/saved_posts/hidden_posts/reports tables, RLS, counter triggers, feed RPCs, `post-media` storage bucket
   - `supabase/phase4b_time_capsule_redesign.sql` — time-capsule redesign: `unlock_date`/`visibility`/`mood`/`audio_url` columns on `posts`, `is_reflection` column on `comments`, updated comment RLS (reflections private, real comments unlock-gated), and RPCs `get_drops_feed`/`get_drop`/`get_drop_comments`/`get_saved_drops`/`get_my_reflections` (replacing the old `get_feed`/`get_post`/`get_comments`/`get_saved_posts`)
   - `supabase/phase4c_drop_visibility.sql` — real three-tier drop visibility (Everyone / Followers / Only me): widens the `visibility` check constraint, adds the `can_view_drop()` helper, and fixes a leak where a "private" drop was reachable by anyone who could view the author's posts in general
   - `supabase/phase4d_engagement.sql` — pre-unlock anticipation reactions and post-unlock engagement: `drop_interests` and `drop_unlock_views` tables, interest-count columns on `posts`, re-enables `likes` for post-unlock only, and two new feed tabs (Following, Saved to Unlock) via an updated `get_drops_feed`/`get_drop`/`get_saved_drops`
   - `supabase/phase5_moments.sql` — Memory Moments: `moments`/`moment_media`/`moment_views`/`moment_reactions`/`moment_replies`/`close_friends` tables, RLS, the `can_view_moment()`/`set_moment_expiry()` helpers, the `moments` storage bucket, and RPCs `get_moments_tray`/`get_user_moments`/`get_moment`/`get_moment_seen_list`/`get_moment_reactions`
   - `supabase/phase6_capsules.sql` — Time Capsules: `capsules`/`capsule_media`/`capsule_unlocks`/`capsule_views`/`capsule_reflections`/`capsule_likes`/`capsule_comments`/`capsule_saves` tables, RLS (including a stricter-than-Drops table-level lock on non-owner access to a still-sealed capsule), the `can_view_capsule()`/`validate_capsule_unlock_date()`/`unlock_capsule()` helpers, the `capsules` storage bucket, and RPCs `get_capsule`/`get_user_capsules`/`get_capsule_comments`/`get_capsule_reflections`
   - `supabase/phase7_memories.sql` — Memories: adds `tags`/`hidden_at` to `capsules` and `moments`, `location_text` to `capsules`; new tables `favorites`/`memory_collections`/`collection_items`/`flashbacks_cache`/`memory_highlights`; RPCs `get_memories`/`get_memory`/`get_memory_calendar`/`get_memory_year_counts`/`get_flashbacks`/`dismiss_flashback`/`get_highlight_candidates`/`get_memory_streak`/`get_collections`/`seed_default_collections` — no new `memories` table, everything is computed by UNIONing `capsules` and expired `moments` at read time
   - `supabase/phase8_settings.sql` — Settings & Privacy: new tables `user_settings`/`notification_preferences`/`user_sessions`/`feedback_reports`, a trigger that auto-creates the first two rows the moment a profile exists (plus a one-time backfill for existing accounts), RPCs `get_blocked_users`/`get_muted_users`/`get_restricted_users`/`get_close_friends`/`delete_my_account`
   - `supabase/phase9_unified_memory_wiring.sql` — Unified Memory Wiring: adds the `memory_items_view` (internal-only, never granted to `authenticated`/`anon`), widens `get_memories()`/`get_memory()` to include Drops as a third source, adds `drop_id` to `favorites`/`collection_items`, and adds RPCs `get_memory_stats()`/`get_public_stats()`
   - `supabase/phase10_search_explore.sql` — Search + Explore (Phase 10a): new `search_history` table + `record_search`/`get_recent_searches`/`clear_search_history`/`get_trending_searches` RPCs, cross-user `search_memories()`/`search_collections()` RPCs, and `get_explore_feed()`/`get_search_suggestions()` built on top of `search_memories()`
   - `supabase/phase10b_profile_polish.sql` — Profile Polish (Phase 10b): new `pinned_items` table (max 6, own-content-only, trigger-enforced) + `get_pinned_memories()`, and the live-computed `get_activity_timeline()` RPC
   - `supabase/phase10c_saved_share.sql` — Bookmark Experience (Phase 10c): adds a `note` column + UPDATE policy to `saved_posts`/`capsule_saves`, and the `get_saved_memories()`/`update_saved_note()` RPCs (no schema changes for Share — that part is entirely client-side)
   - `supabase/phase10d_comments_reactions.sql` — Comments + Reactions (Phase 10d): activates `parent_comment_id` on `comments`, adds it plus `edited_at`/`is_pinned` to both comment tables, adds the `enforce_comment_rules()`/`enforce_capsule_comment_rules()` triggers + new UPDATE policies, a new `comment_reactions` table, widened `get_drop_comments()`/`get_capsule_comments()` (DROP + CREATE — return shape changed), and the `get_comment_reactions()`/`get_recent_likers()` RPCs
   - `supabase/phase10f_admin_prep.sql` — Admin Preparation (Phase 10f): adds `profiles.is_admin`, new `capsule_reports`/`moment_reports` tables, `moderation_status`/audit columns on `posts`/`capsules`/`moments`, and the admin-only `moderate_content()`/`get_content_reports()` RPCs — architecture only, no admin UI ships in this phase (Phase 10e has no dedicated SQL file — it was a frontend-only sub-phase)
   - `supabase/phase10g_polish_fixes.sql` — hardening pass (Phase 10g): pin cap 6→3, `get_explore_feed()` rebuilt around the revised tab list, new `get_new_creators()` RPC, and `posts`' SELECT RLS hardened to the same table-level lock guarantee `capsules` already had
   - `supabase/dev_seed_scale_test.sql` — **not a migration, do not run against production** — optional scale-test fixture data (see Phase 10f/10g docs below) for load/consistency testing only

5. Restart the dev server.

### Google OAuth setup

1. Google Cloud Console → create an OAuth client (Web application) with:
   - Authorized JavaScript origins: your app's URL(s) (e.g. `http://localhost:5173`, your Vercel domain)
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
2. Supabase dashboard → Authentication → Providers → Google → enable, paste the Client ID & Secret
3. Authentication → URL Configuration:
   - **Site URL:** your primary app URL
   - **Redirect URLs:** add every origin you use, each with `/**`, e.g. `http://localhost:5173/**` and `https://your-vercel-domain.vercel.app/**`

### Email sending

Supabase's built-in email sender has a very low rate limit (a handful of emails per hour) — fine for local testing, not enough for real signups. Before launch, configure a custom SMTP provider under **Authentication → Settings → SMTP Settings** (Resend, Postmark, and SendGrid all have free tiers that comfortably cover this).

---

## Available scripts

```bash
npm run dev       # local dev server with HMR
npm run build     # type-check + production build → dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint
```

---

## Project structure

```
src/
├── pages/
│   ├── LoginPage.tsx, RegisterPage.tsx, ForgotPasswordPage.tsx,
│   │   ResetPasswordPage.tsx, VerifyEmailPage.tsx, CompleteProfilePage.tsx
│   ├── DashboardPage.tsx
│   ├── ProfilePage.tsx          # own profile, at /profile
│   ├── EditProfilePage.tsx      # at /profile/edit
│   ├── PublicProfilePage.tsx    # anyone's profile, at /u/:username
│   ├── SearchPage.tsx           # unified search (users/drops/capsules/moments/collections), at /search
│   ├── ExplorePage.tsx          # 11-tab discovery feed, at /explore
│   ├── FriendsPage.tsx          # at /friends
│   ├── FriendRequestsPage.tsx   # at /friends/requests
│   ├── FollowersPage.tsx        # at /followers and /u/:username/followers
│   ├── FollowingPage.tsx        # at /following and /u/:username/following
│   ├── FeedPage.tsx             # at /feed — primary landing after login
│   ├── SavedPage.tsx            # saved Drops + Capsules, folders/notes/sort/filter/search, at /saved
│   ├── DropPage.tsx             # single-drop permalink, at /drop/:dropId
│   ├── MomentsPage.tsx          # your own archive (active + expired), at /moments
│   ├── MomentCreatePage.tsx     # linkable composer, at /moments/create
│   ├── MomentViewerPage.tsx     # single-moment permalink, at /moments/:momentId
│   ├── CapsulesPage.tsx         # "My Archive" — search + filters, at /capsules
│   ├── CapsuleCreatePage.tsx    # linkable wizard, at /capsules/create
│   ├── CapsuleViewerPage.tsx    # single-capsule permalink, at /capsules/:capsuleId
│   ├── MemoriesPage.tsx         # 8-tab library (Timeline/Calendar/Years/Collections/
│   │                            #   Favorites/Flashbacks/Highlights/Archive), at /memories
│   ├── MemoryDetailPage.tsx     # single-memory permalink, at /memories/:memoryType/:memoryId
│   ├── SettingsPage.tsx         # 10-section list-then-detail, at /settings and /settings/:section
│   └── TermsPage.tsx, PrivacyPage.tsx
├── components/
│   ├── auth/         # AuthLayout, GoogleButton, RouteGuards
│   ├── layout/       # AppShell (page-transition wrapper, ErrorBoundary + MobileNav mount),
│   │                 #   Navbar (top bar, icon row hidden below `sm`), MobileNav (bottom
│   │                 #   bar + Create action sheet), OfflineBanner, PublicPageHeader
│   ├── profile/      # ProfileHeader (+ skeleton), AvatarUpload,
│   │                 #   CoverPhotoUpload, ImageCropModal, StatsRow,
│   │                 #   BadgesAndAchievements (+ skeleton), ProfileCompletionBar,
│   │                 #   ProfileStatsCard, ActivityTimeline
│   ├── social/       # UserCard, UserList (+ skeleton), FollowButton,
│   │                 #   RelationshipMenu, FriendRequestCard, MutualFriends,
│   │                 #   SocialStats, EmptySocialState, UserSearchBar,
│   │                 #   UserSearchResults, FollowersList, FollowingList,
│   │                 #   SuggestedFriends, NewCreators
│   ├── feed/         # Feed, DropTabs, DropCard, DropComposer, DropActions,
│   │                 #   SaveButton, LikeButton (animated), InterestActions,
│   │                 #   CommentSection, CommentItem, CommentComposer (shared by
│   │                 #   Drops+Capsules), RecentLikersPopover, ReflectionModal,
│   │                 #   MoodPicker, VisibilityPicker, CountdownPill, LockedDropPlaceholder,
│   │                 #   ImageGrid, VideoPlayer, AudioPlayer, ShareModal (Drop+Capsule, QR +
│   │                 #   preview card download), ReportModal,
│   │                 #   EmojiPicker, EmptyDropState, FeedSkeleton, InfiniteLoader
│   ├── moments/      # MomentTray, MomentBubble, CreateMomentModal,
│   │                 #   MomentDurationSelector, MomentPrivacySelector, MomentViewer,
│   │                 #   MomentProgressBar, MomentReactionBar, MomentReplyInput,
│   │                 #   MomentSeenList, MomentArchive, EmptyMomentsState
│   ├── capsules/     # CapsuleWizard, CapsuleCountdown, CapsuleCard,
│   │                 #   CapsuleLockedCard, CapsuleUnlockedCard, UnlockAnimation,
│   │                 #   CapsuleTimeline, CapsuleArchive, CapsuleFilters, CapsuleViewer
│   ├── memories/     # MemoryCard, MemoryTimeline, ListView, GridView, JournalView,
│   │                 #   TimelineView, MemoryCalendar, YearView, CollectionGrid,
│   │                 #   FavoriteButton, PinButton, FlashbackCard, HighlightCard, MemorySearch,
│   │                 #   MemoryFilters, MemoryViewer
│   ├── settings/     # SettingsSection, SettingsCard, ToggleRow, DangerZone, SessionList,
│   │                 #   NotificationSettings, ThemeSelector, StorageUsageCard, FeedbackForm,
│   │                 #   AccountSettings, ProfileSettings, PrivacySettings, SecuritySettings,
│   │                 #   AppearanceSettings, AccessibilitySettings, StorageSettings,
│   │                 #   HelpSettings, AboutSettings
│   ├── saved/        # SavedMemoryRow (notes, folders, unsave)
│   ├── legal/        # LegalLayout
│   └── ui/           # Button, Input, Avatar, Card, Modal, Checkbox,
│                      #   Toggle, Badge, EmptyState, ErrorState, Skeleton,
│                      #   ErrorBoundary, Toast (ToastStack)
├── hooks/
│   ├── useAuth.tsx               # full auth + profile context
│   ├── useSocial.ts              # follow/block/mute/restrict, search, lists, get_new_creators
│   ├── useDrops.ts                # drops, comments, reflections, likes, interests, saves, hide, report
│   ├── useMoments.ts              # moments, views, reactions, replies, archive
│   ├── useCapsules.ts             # capsules, media, unlocks, likes, comments, reflections
│   ├── useMemories.ts             # get_memories/get_memory (Drops+Capsules+Moments), calendar,
│   │                              #   years, flashbacks, highlights, collections, favorites,
│   │                              #   hide/restore/delete, get_memory_stats/get_public_stats
│   ├── useSearch.ts               # search_memories/search_collections/get_explore_feed,
│   │                              #   recent/trending searches, search suggestions
│   ├── useSaved.ts                # get_saved_memories/update_saved_note
│   ├── useComments.ts             # shared comment CRUD/reply/pin/react for Drops+Capsules
│   ├── useSettings.ts             # settings, notification prefs, blocked/muted/restricted/close
│   │                              #   friends lists, sessions, account/password/email, storage usage
│   ├── useTheme.tsx               # ThemeProvider — dark mode, font size, accessibility toggles
│   ├── useUsernameAvailability.ts
│   ├── useImageUpload.ts         # shared drag-drop/crop/upload pipeline
│   ├── useInView.ts              # IntersectionObserver (video lazy-load, infinite scroll)
│   ├── usePullToRefresh.ts       # touch-only pull-to-refresh
│   ├── useOnlineStatus.ts        # navigator.onLine + online/offline events
│   └── useToast.tsx              # ToastProvider — shared success/error confirmations
├── lib/
│   ├── supabase.ts    # Supabase client + isSupabaseConfigured()
│   ├── validators.ts  # every field's validation rules
│   ├── profile.ts     # completion %, years-active
│   └── image.ts        # canvas crop + compression
├── types/
│   ├── index.ts       # Profile (mirrors the real table)
│   ├── auth.ts
│   ├── social.ts       # Relationship, SocialUser, SocialCounts, ...
│   ├── feed.ts          # Drop, DropComment, Reflection, DropTab, MemoryType, Mood, Visibility, InterestType, ReportReason
│   ├── moment.ts        # Moment, MomentTrayItem, MomentSeenEntry, MomentPrivacy, MomentDurationHours
│   ├── capsule.ts       # Capsule, CapsuleMediaItem, CapsuleVisibility, CapsuleMemoryType, CapsuleArchiveFilters
│   ├── memory.ts        # Memory (unified drop+capsule+moment shape), MemoryFilters, MemoryCollection,
│   │                    #   Flashback, HighlightCandidate, MemoryStats, PublicStats, RecentSearch,
│   │                    #   TrendingSearch, SearchSuggestion, CollectionSearchResult, ExploreTab,
│   │                    #   PinnedMemory, ActivityItem, SavedMemory
│   ├── comment.ts        # Comment (shared Drop+Capsule shape), CommentReactionBreakdown, RecentLiker
│   └── settings.ts      # UserSettings, NotificationPreferences, UserSession, ManagedUser, Theme, FontSize
└── utils/
    ├── date.ts
    ├── storage.ts       # upload/delete + storage-path parsing (for cleanup on replace)
    └── sharePreview.ts  # canvas-based downloadable share card + QR image URL builder

supabase/
├── phase1_auth.sql            # profiles table, RLS, triggers, username RPC
├── phase2_profiles.sql        # bio/privacy/completion, avatars bucket, public-profile RPC
├── phase2b_profile_polish.sql # website/location/pronouns/cover photo, username cooldown, covers bucket
├── phase3_social_graph.sql    # follows/blocks/mutes/restrictions, social RPCs
├── phase4_feed.sql            # posts + 6 related tables, counter triggers, feed RPCs, post-media bucket
├── phase4b_time_capsule_redesign.sql  # unlock_date/visibility/mood/audio_url, reflections
├── phase4c_drop_visibility.sql        # three-tier drop visibility, can_view_drop()
├── phase4d_engagement.sql             # drop_interests/drop_unlock_views, likes re-enabled, 2 new tabs
├── phase5_moments.sql         # moments + 5 related tables, can_view_moment(), moments bucket, moment RPCs
├── phase6_capsules.sql        # capsules + 7 related tables, can_view_capsule(), capsules bucket, capsule RPCs
├── phase7_memories.sql        # tags/location/hidden_at on capsules+moments, 5 new tables, get_memories() union RPC
├── phase8_settings.sql        # user_settings, notification_preferences, user_sessions, feedback_reports, delete_my_account()
├── phase9_unified_memory_wiring.sql   # memory_items_view, get_memories()/get_memory() widened to Drops, get_memory_stats(), get_public_stats()
├── phase10_search_explore.sql         # search_history, search_memories()/search_collections(), get_explore_feed(), get_search_suggestions()
├── phase10b_profile_polish.sql        # pinned_items (max 6, own-only), get_pinned_memories(), get_activity_timeline()
├── phase10c_saved_share.sql           # note column + UPDATE policy on saved_posts/capsule_saves, get_saved_memories(), update_saved_note()
├── phase10d_comments_reactions.sql    # parent_comment_id/edited_at/is_pinned + rules triggers on both comment tables, comment_reactions, widened get_drop_comments()/get_capsule_comments(), get_comment_reactions(), get_recent_likers()
├── phase10f_admin_prep.sql            # profiles.is_admin, capsule_reports/moment_reports, moderation_status + audit columns, moderate_content(), get_content_reports()
├── phase10g_polish_fixes.sql          # pin cap 6→3, get_explore_feed() rebuilt, get_new_creators(), posts SELECT RLS hardened
└── dev_seed_scale_test.sql            # NOT a migration — optional scale-test fixture data, never run against production
```

> Note: `phase4b_time_capsule_redesign.sql` predates this phase and refers to the Drops feed's unlock-date redesign — it has nothing to do with the dedicated `capsules` tables in `phase6_capsules.sql`. Unfortunate naming collision, kept as-is rather than renaming an already-applied migration file.

---

## Storage buckets

| Bucket | Public | Size limit | Path convention | Notes |
|---|---|---|---|---|
| `avatars` | Yes (read) | 5 MB | `{user_id}/{file}` | Owner-only write via RLS on `storage.objects` |
| `covers` | Yes (read) | 8 MB | `{user_id}/{file}` | Owner-only write via RLS on `storage.objects` |
| `post-media` | Yes (read) | 50 MB | `{user_id}/{file}` | Photos and videos; owner-only write |
| `moments` | Yes (read) | 50 MB | `{user_id}/{file}` | Photos and videos; owner-only write; nothing auto-deletes an expired moment's file, see Known limitations |
| `capsules` | Yes (read) | 50 MB | `{user_id}/{file}` | Photos, videos, audio, and recorded voice notes; owner-only write |

All five are created and policed by their respective migration files — nothing to configure by hand beyond running the SQL.

---

## Database tables (Phase 3)

| Table | Purpose | Key rules |
|---|---|---|
| `follows` | follower_id → following_id, `status` accepted/pending | No self-follow, no duplicates, status is trigger-derived from the target's privacy, not client-set |
| `user_blocks` | blocker_id → blocked_id | Blocking severs any existing follow both ways; only the blocker can see their own block list |
| `user_mutes` | muter_id → muted_id | No visible effect yet — groundwork for a future feed to filter on |
| `user_restrictions` | restrictor_id → restricted_id | Same — groundwork, no visible effect yet |

## Database tables (Phase 4 + Phase 4b/c/d redesign)

| Table | Purpose | Key rules |
|---|---|---|
| `posts` | One row per drop — caption, `post_type` (photo/video/audio/text), `video_url`/`audio_url`, `unlock_date`, `visibility`, `mood`, and denormalized like/comment/share/save/interest counts | `video_url`/`audio_url` only allowed when `post_type` matches; `unlock_date` defaults to `now()`; `visibility` is `public` \| `followers` \| `private` (see below); counts are trigger-maintained, never written by the client |
| `post_images` | Up to 10 per drop, ordered by `position` | Unique `(post_id, position)`; only the drop's owner can insert/delete |
| `likes` | One row per (post, user) | Unique `(post_id, user_id)`; **post-unlock only** — the INSERT policy rejects a like on a still-locked drop |
| `comments` | Real comments *and* private reflections, distinguished by `is_reflection` | Content capped at 1,000 chars; real comments require the drop to already be unlocked (RLS-enforced, not just hidden client-side); reflections are exempt from that check but only ever visible to their own author; only the author can delete |
| `saved_posts` | One row per (post, user) — the ordinary post-unlock "Save" bookmark | Unique `(post_id, user_id)` |
| `drop_interests` | One row per (drop, user, reaction) — the four pre-unlock reactions: `interested`, `cant_wait`, `good_vibes`, `save_to_unlock` | Unique `(drop_id, user_id, interest_type)`; **pre-unlock only** — the INSERT policy rejects any of these once the drop has actually unlocked; `save_to_unlock` rows are what populate the Saved to Unlock tab |
| `drop_unlock_views` | One row per (drop, viewer) — records the first time someone other than the owner sees an unlocked drop | Unique `(drop_id, user_id)`; nothing reads this yet — pure groundwork for a Phase 9 "X unlocked your drop" notification; only the drop's owner can ever SELECT their own drops' rows |
| `hidden_posts` | One row per (post, user) | Feed-local — only ever filters the hider's own `get_drops_feed` results |
| `reports` | reporter_id, post_id, reason, optional details | Unique `(post_id, reporter_id)` — one report per user per post; no SELECT policy at all, write-only from the client |

**Visibility tiers**, plain language — `public` (Everyone: appears in Public Drops / discovery once unlocked, still gated by the author's own account privacy), `followers` (only your accepted followers, regardless of whether your account itself is public), `private` (Only me — nobody but the owner, at any lock state, enforced everywhere a single drop's visibility matters: the permalink, Saved, comments, likes, and interests).

## Database tables (Phase 5 — Moments)

| Table | Purpose | Key rules |
|---|---|---|
| `moments` | One row per moment — `text_content`, `media_url`/`media_type` (photo/video/text), `mood`, `location_text`, `mentioned_user_id`, `privacy`, `duration_hours`, `expires_at`, `view_count` | `expires_at` is trigger-computed from `duration_hours` at insert, never trusted from the client; `media_url` must already exist at insert time for photo/video (unlike Drops, there's no "insert then attach" step); `view_count` is trigger-maintained and only ever meaningful for the owner |
| `moment_media` | Groundwork for a future multi-attachment moment, same relationship `post_images` has to `posts` | Not written to by the app this phase — a moment has exactly one photo/video/text body, held directly on `moments` |
| `moment_views` | One row per (moment, viewer) — "seen by", and what `view_count` derives from | Unique `(moment_id, viewer_id)`; self-views are rejected by the INSERT policy, so you never inflate your own count by looking at your own moment |
| `moment_reactions` | One row per (moment, user) — a single emoji, changeable | Unique `(moment_id, user_id)`; can't react to your own moment; insert/update both require the moment to still be unexpired |
| `moment_replies` | One row per reply — shaped like a future DM (`moment_id`, `user_id`, `content`, `created_at`) | Private between the replier and the moment's owner, nobody else can read a reply; can't reply to your own moment |
| `close_friends` | owner_id → friend_id, a real relationship table behind the "Close Friends" privacy tier | No management UI ships this phase — the picker's copy says so; a close-friends-only moment is visible to nobody but its owner until a future phase adds list management |

**Privacy tiers**, plain language — `everyone` (gated by the author's own account privacy, same as Drops' `public` tier), `followers` (only accepted followers, regardless of account privacy), `close_friends` (only people on your `close_friends` list — nobody's, yet), `only_me` (nobody but the owner, ever). All four are decided by one function, `can_view_moment(owner, privacy)`, used consistently by `moments`' own table RLS and every RPC — there's no separate path that only checks account-level privacy and forgets the moment's own tier.

## Database tables (Phase 6 — Time Capsules)

| Table | Purpose | Key rules |
|---|---|---|
| `capsules` | One row per capsule — `title`, `memory_text`, `memory_types` (text array, e.g. `{photo,voice}`), `mood`, `visibility`, `unlock_date`, and denormalized like/comment/save/share counts | `unlock_date` must be after `created_at`, enforced by a trigger (`validate_capsule_unlock_date`), not just form validation; `memory_types` is constrained to a fixed set and can never be empty |
| `capsule_media` | One or more per capsule, ordered by `position` — unlike Moments' unused `moment_media`, this one is fully wired up: a capsule genuinely holds combinations (e.g. three photos and a voice note together) | Unique `(capsule_id, position)`; only the capsule's owner can insert/delete |
| `capsule_unlocks` | One row per (capsule, user) — the "I opened this vault" ritual event | Unique `(capsule_id, user_id)`; not a security gate (`unlock_date` alone controls whether content is readable) — purely a UX/stats concern: gates whether the reveal animation replays, and backs the owner's "opened by" stat |
| `capsule_views` | One row per (capsule, non-owner viewer) — notification groundwork, same shape as `drop_unlock_views`/`moment_views` | Unique `(capsule_id, viewer_id)`; nothing reads this yet; only the capsule's owner can ever SELECT their own capsules' rows |
| `capsule_reflections` | A private note-to-self on any capsule, available at any lock state | Only ever visible to its own author, never anyone else's — including the capsule's owner reading a reflection someone else left |
| `capsule_likes` / `capsule_comments` / `capsule_saves` | Not in this phase's originally-named table list — added because Like/Comment/Save are explicitly required post-unlock actions with nowhere else to live. Dedicated tables, not a reuse of Drops' `likes`/`comments`/`saved_posts` | All three: unlock-gated by RLS (`unlock_date <= now()`), same discipline as Drops |

**Visibility tiers**, plain language — `only_me` (nobody but the owner, ever), `followers` (only accepted followers, regardless of account privacy), `public` (gated by the author's own account privacy, same as Drops' `public` tier). Decided by `can_view_capsule(owner, visibility)`, the same pattern as `can_view_drop`/`can_view_moment` — see Security notes for how capsules go one step further than Drops on enforcement.

## Database tables (Phase 7 — Memories)

No new content table — `capsules` and `moments` gained columns instead, and everything else here is either a personal-organization table or a computed-on-read RPC.

| Table | Purpose | Key rules |
|---|---|---|
| `capsules` / `moments` — new columns | `tags text[]` on both (genuinely new metadata, editable only from the new Memory Details page); `location_text` on `capsules` (Moments already had it); `hidden_at timestamptz` on both (Archive's Hide/Restore) | Nothing retrofitted into the Phase 5/6 creation flows — these are Phase 7 additions, edited only after the fact |
| `favorites` | A personal star on any memory you can see — `capsule_id`/`moment_id`, exactly one set | Two nullable FK columns rather than one polymorphic id, so cascading deletes still work with real foreign keys; a partial unique index per column prevents double-favoriting either type |
| `memory_collections` / `collection_items` | Personal folders. A 12-item starter set (Travel, Family, Friends, School, Work, Birthday, Graduation, Vacation, Pets, Love, Music, Sports) is auto-created empty via `seed_default_collections()`, `is_default = true` | Collections only ever hold your own memories — both the collection and the memory being added must belong to the caller; same XOR-FK pattern as `favorites` |
| `flashbacks_cache` | Not a performance cache — the "on this day" query is cheap at this scale — a **dismissal tracker**: once you've dismissed today's flashback for a memory, it stays dismissed for the rest of that day | Unique per (user, memory, day); insert-only, no update/delete needed |
| `memory_highlights` | A **saved/pinned** highlight reel, not an automatic cache — candidate reels (best month / most viewed / most reacted) are computed live by `get_highlight_candidates()`, cheap enough to never need materializing; this table only holds what a user explicitly chose to keep | `capsule_ids uuid[]` / `moment_ids uuid[]` snapshot the reel's members at save time |

**`get_memories()`/`get_memory()` are the whole feature's spine.** They UNION `capsules` (any lock state, your own; unlocked-and-visible, anyone else's) with `moments` (expired only, ever — an active moment belongs to the live tray, not Memories) into one normalized row shape, with the exact same content-nulling discipline as everywhere else in this app. `created_at` — when a memory actually happened — drives all grouping, sorting, and flashback matching; `unlock_date`/`expires_at` only ever controls whether content is currently readable.

**Interpretation note on scope**: the phase brief said "every unlocked Time Capsule and expired Memory Moment" — Drops were deliberately not included in this union. A Drop already has a permanent home (the Feed's My Drops tab + `/saved`) and never disappears from its primary surface the way an expired Moment does or a sealed Capsule's content does; Capsules and Moments both needed somewhere to "graduate" to, Drops didn't. Worth revisiting explicitly before Phase 8 if the intent was actually all three content types.

## Database tables (Phase 8 — Settings & Privacy)

| Table | Purpose | Key rules |
|---|---|---|
| `user_settings` | One row per user — default Drop/Moment visibility, theme, font size, reduced motion, high contrast, larger touch targets, `password_changed_at` | Auto-created the moment a profile exists (`profiles_create_default_settings` trigger), plus a one-time backfill for accounts that predate this migration — the client never upserts this on first load |
| `notification_preferences` | One row per user — the eight toggles listed above | Same auto-create trigger as `user_settings`; store-only, no delivery system reads this yet |
| `user_sessions` | A self-reported login log — `device_label` guessed client-side from the user agent, one row per sign-in | Not a live view into Supabase Auth's session store (unavailable to a pure client SDK without a service-role backend); "sign out of all devices" is a separate, real feature (`auth.signOut({ scope: 'global' })`) that doesn't read this table at all |
| `feedback_reports` | Bug reports, feedback, and support requests | Same one-way-mailbox shape as Phase 4's `reports` — insert-only, no SELECT policy at all, reviewing these is an admin-tool concern out of scope for this phase |

**No new visibility model** — every table here is strictly personal (owner-only RLS), so there's no cross-user visibility question to reconcile the way Drops/Moments/Capsules each needed their own `can_view_*()` function. The two exceptions, `get_blocked_users()`/`get_muted_users()`/`get_restricted_users()`/`get_close_friends()` and `delete_my_account()`, are `SECURITY DEFINER` for narrower reasons: the first four join `profiles` for someone else's info (same reason as every other cross-user RPC in this app), and the last needs privilege an ordinary authenticated role doesn't have — DELETE on `auth.users`.

## Database tables (Phase 9 — Unified Memory Wiring)

No new content table — this phase is schema-light on purpose, since it's a wiring fix, not a feature.

| Object | Purpose | Key rules |
|---|---|---|
| `memory_items_view` | A normalized, lightweight UNION of `posts`/`capsules`/`moments` — `id`, `owner_id`, `source_type`, `title`, `caption`, a single `media_type`/`media_url`, `mood`, `visibility`, `unlock_at`, `expires_at`, `status`, `created_at`, `updated_at` | **Never granted to `authenticated`/`anon`.** A Postgres view runs against its underlying tables with the *view owner's* privileges for RLS purposes (table owners bypass their own RLS), so exposing this view directly would let any signed-in user read every row in the system regardless of visibility. Only `SECURITY DEFINER` functions that apply their own predicate may query it — see `get_memory_stats()` |
| `favorites` / `collection_items` — new `drop_id` column | Drops can now be favorited and added to collections, same as Capsules/Moments already could | Same three-way-XOR-FK pattern (`capsule_id`/`moment_id`/`drop_id`, exactly one set) as the original Phase 7 design, just widened by one column |

**`status`, plain language** — `locked` (unlock date/expiry still ahead), `unlocked` (a Drop or Capsule whose time has come), `expired` (a Moment past expiry — Moments never become "unlocked," they mature into "expired" and move to the owner's archive instead), `archived` (`hidden_at` is set — Capsules/Moments only; Drops have no archive concept yet).

**`get_memories()`/`get_memory()` do *not* literally `SELECT FROM memory_items_view`** — they keep their own richer, independently-maintained UNION (full multi-image `media` jsonb arrays, like/comment counts, favorite/hidden flags) rather than joining back from a flattened view to the source tables for that richer data. The view and the RPCs are kept *logically* consistent by sharing the same status/visibility rules, not by sharing SQL text — a deliberate tradeoff to avoid a riskier rewrite of two already-correct, already-tested functions.

## Database tables (Phase 10a — Search & Explore)

| Table | Purpose | Key rules |
|---|---|---|
| `search_history` | One row per search a user runs (`user_id`, `query`, `created_at`) | Own-rows-only RLS for SELECT/INSERT/DELETE — a user can only ever see or clear their own search history directly. `get_trending_searches()` aggregates across everyone via `SECURITY DEFINER`, but only ever returns a query string + a count, never who searched it |

**`search_memories()` is the cross-user counterpart to `get_memories()`.** `get_memories()` is deliberately single-owner-scoped (`p_user_id`, defaulting to the caller) and only searches your *own* content, even when browsing someone else's Memories isn't the point — it's a personal archive tool. `search_memories()` has no owner scope at all: it UNIONs Drops/Capsules/Moments across *every* user, filtered down by the same `can_view_drop()`/`can_view_capsule()`/`can_view_moment()` predicates `get_public_stats()` already uses, plus `is_blocked_either_way()`. Both `get_explore_feed()` (tab → tag/sort mapping) and the Search page's content results call into this one function, so there's exactly one place that decides "what am I allowed to discover," not two slowly-diverging copies.

**Why Collections search stays separate and own-only**: unlike Drops/Capsules/Moments, `memory_collections` has no visibility model at all in this app — every collection is implicitly private to its owner, nobody has ever been able to see someone else's collections. `search_collections()` reflects that: `where mc.user_id = auth.uid()`, no predicate function needed because there's no cross-user case to handle.

## Database tables (Phase 10b — Profile Polish)

| Table | Purpose | Key rules |
|---|---|---|
| `pinned_items` | Up to 6 pinned Drops/Capsules/Moments per user (`capsule_id`/`moment_id`/`drop_id`, exactly one set — same three-way-XOR pattern as `favorites`/`collection_items`) | INSERT requires *ownership* of the underlying content, not just visibility — pins are a "showcase what's mine" feature, never a repost of someone else's content. A `before insert` trigger rejects a 7th pin with a clear error rather than silently allowing unbounded growth. SELECT is own-rows-only; cross-user reads only ever happen through `get_pinned_memories()` |

**No new table for the activity timeline** — `get_activity_timeline()` is entirely computed live from `posts`/`capsules`/`moments`/`comments`/`capsule_comments`' own `created_at` columns, reusing the exact same `can_view_drop`/`can_view_capsule`/`can_view_moment` + `is_blocked_either_way` predicates as every other cross-user read in this app. This means it has complete history back to each row's original creation date, not just activity that happened after this migration ran — a trigger-populated log table couldn't offer that.

## Database tables (Phase 10c — Bookmark + Share)

| Table change | Purpose | Key rules |
|---|---|---|
| `saved_posts` / `capsule_saves` — new `note` column | A private, 280-character note per saved item | New UPDATE policy on each (`auth.uid() = user_id`, both `using` and `with check`) — neither table had one before, since nothing about a save row was ever editable until Notes existed. `update_saved_note()` is a single RPC that branches on content type server-side rather than the client picking which table/column to hit directly |

**`get_saved_memories()` is the third member of the "returns the same Memory shape" family**, alongside `search_memories()`/`get_explore_feed()`/`get_pinned_memories()` — all four exist to answer a different question (search results, discovery, showcased pins, bookmarks) over the same underlying visibility-gated content, and all four hand back rows the frontend already knows how to render. No new table backs any of them except where genuinely new state needed storing (`search_history`, `pinned_items`, and now the `note` columns here).

**No schema changes for Share** — every URL `ShareModal` builds already existed as a route (`/drop/:id`, `/capsules/:id`). The QR code is a third-party image URL, not app data; the preview card is generated entirely client-side and never touches the database.

## Database tables (Phase 10d — Comments + Reactions)

| Table / change | Purpose | Key rules |
|---|---|---|
| `comments` / `capsule_comments` — new `parent_comment_id` (activated / added), `edited_at`, `is_pinned` | Replies, edit tracking, pinning | A combined `before insert or update` trigger on each table (`enforce_comment_rules()` / `enforce_capsule_comment_rules()`) is the real enforcement — see Security notes. RLS's UPDATE policy just decides *which rows* you can attempt to touch (comment author OR content owner); the trigger decides *which columns* you're actually allowed to change and only if you're the right person for that specific column |
| `comment_reactions` | One active emoji reaction per user per comment across both comment tables | Same XOR-FK pattern as `favorites`/`collection_items`/`pinned_items`, just two columns here instead of three (`drop_comment_id`/`capsule_comment_id`, exactly one set). Swapping reactions is an UPDATE (own-rows-only), removing is a DELETE (own-rows-only) — same "swap via UPDATE, remove via DELETE" model `moment_reactions` already established in Phase 5 |

**`get_drop_comments()`/`get_capsule_comments()` needed DROP + CREATE, not `CREATE OR REPLACE`** — Postgres won't let a function's return columns change in place. Both now return `edited_at`, `parent_comment_id`, `is_pinned`, `reaction_count`, and `my_reaction` alongside the original seven columns, ordered pinned-first then chronological.

**No `comment_mentions` table.** @mentions are parsed and linked client-side only (`CommentItem`'s `renderContent`) and autocompleted via Phase 3's existing `search_users` (`CommentComposer`) — there's no notification system for a tracked mention to feed into (explicitly out of scope for all of Phase 10), so a tracking table would have no consumer yet.

## Database tables (Phase 10f — Admin Preparation)

| Table / change | Purpose | Key rules |
|---|---|---|
| `profiles.is_admin` | The entire role concept | Defaults `false`; nothing in the app sets it — flipping it to `true` for a real account is a manual, direct-database action outside this codebase, by design |
| `capsule_reports` / `moment_reports` | Reporting parity with Drops' existing `reports` | Identical one-way-mailbox shape (insert-only, no SELECT policy even for the reporter) — see the Phase 4 Security notes bullet on `reports` for why |
| `posts` / `capsules` / `moments` — new `moderation_status`/`moderated_at`/`moderated_by`/`moderation_reason` | An auditable alternative to a silent hard DELETE for moderation purposes | Changeable **only** through `moderate_content()` — there is no UPDATE RLS policy on these columns for any role, so a direct table write can't set them even by accident |

**`moderate_content(content_type, content_id, status, reason)`** and **`get_content_reports(limit, offset)`** are both `SECURITY DEFINER` and both begin with `if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception ...` — the exact same admin-gate, written twice rather than factored into a shared helper (matching this app's established preference for each function re-stating its own predicate over a shared abstraction that could silently drift, e.g. `can_view_drop`/`can_view_capsule`/`can_view_moment` remaining three separate functions rather than one parameterized one).

**`dev_seed_scale_test.sql` is explicitly not part of the migration sequence** — it's a load-testing fixture, meant to be run against a disposable local/staging project and then discarded (a one-line cascade DELETE removes everything it creates, since every seeded row hangs off a `scaletest_*` `auth.users` row via the same FK-cascade chain real account deletion already relies on).

## Database tables (Phase 10g — hardening pass)

No new tables — this pass is schema-light on purpose, same posture as Phase 9. `posts`' SELECT RLS policy is dropped and recreated with an added `unlock_date <= now()` clause (see Security notes); `enforce_pin_limit()` and `get_explore_feed()` are both `create or replace` in place (neither changed its column/return shape, so no DROP was needed); `get_new_creators()` is the one genuinely new function, same shape as Phase 3's `get_suggested_friends()`.

## Security notes

- **Row Level Security** on `profiles`: everyone can read/write only their own row directly. Reading *someone else's* profile goes through `get_profile_by_username`, a `SECURITY DEFINER` function that's the one place allowed to decide what a private account exposes — bio, location, and website are nulled out unless the viewer is the owner *or an accepted follower* (Phase 3 extended this from "owner only"); birthday is never returned by it at all, to anyone, ever. The function also hides the profile entirely between two users with a block relationship in either direction.
- **Username uniqueness and format** are enforced by a DB constraint and checked live via a narrow RPC (`is_username_available`), not a broad table read.
- **Username change cooldown** (30 days) is enforced by a database trigger, not just client-side — a client that skips the check still gets rejected by Postgres.
- **Age gate** (13+) is a DB check constraint, not just form validation.
- **Storage policies** key off the first path segment matching `auth.uid()`, so a signed-in user can only write inside their own folder in either bucket.
- **follows/user_blocks/user_mutes/user_restrictions RLS** only ever exposes relationships the caller is a party to (as either side of the pair). Every screen that needs to show *someone else's* profile alongside relationship state — search, suggestions, followers/following lists, mutual friends — goes through a `SECURITY DEFINER` RPC that applies the real privacy rule itself, same pattern as `get_profile_by_username`.
- **Blocked users are invisible** to each other everywhere: search, suggestions, follower/following lists, and the profile page itself. A user is never told they've been blocked, muted, or restricted — same convention as Instagram/Twitter.
- **Follow status can't be tampered with** — a client can only ever insert a bare `(follower_id, following_id)` pair; a trigger decides pending vs. accepted from the target's actual privacy setting, and a second trigger rejects any status transition except pending → accepted.
- **Drop visibility is decided by one function, `can_view_drop(owner, visibility)`**, and everything that touches a specific drop row uses it: the `posts` table's own SELECT RLS, `saved_posts`/`likes`/`drop_interests` INSERT RLS, both `comments` policies, and the `get_drops_feed`/`get_drop`/`get_saved_drops`/`get_drop_comments` RPCs. It returns true for the owner always; for `public` visibility if the viewer can see the author's posts at all (itself still gated by the author's own account privacy); for `followers` visibility only if the viewer is an accepted follower, regardless of whether the account itself is public; and never for `private` visibility unless you're the owner. Before this existed (pre-Phase-4c), a "private" drop was reachable by anyone who could view the author's posts in general — that leak is closed everywhere now, not just in the feed tabs. The RPCs are `SECURITY DEFINER` (same reason as `get_profile_by_username` — they join `profiles` for author info), and the table-level RLS on `posts` remains as defense in depth for any future direct-table access path.
- **Locked content is nulled server-side, for everyone, including the owner — through the normal app path.** Every read path (`get_drops_feed`, `get_drop`, `get_saved_drops`) checks `unlock_date <= now()` and returns `null` for `caption`/`images`/`video_url`/`audio_url` when it isn't; the client only ever calls these RPCs, never a raw table `SELECT`, so this is what every real request actually experiences. Being precise about the boundary, though: `posts`' own table-level RLS only checks *visibility*, not `unlock_date` — it doesn't independently re-enforce the lock the way the RPCs do. A non-owner who can view the author's posts in general, and a technically-inclined owner, could both in principle bypass the RPCs with a direct PostgREST table query and read a locked drop's raw row early. Phase 6 closed exactly this gap for `capsules` (see below); backporting the same tightened policy to `posts`/`moments` is a reasonable hardening pass, not done here to stay scoped to each phase as it shipped.
- **The lock state gates two disjoint sets of actions, both server-side.** `drop_interests` (Save to Unlock / Interested / Can't Wait / Good Vibes) can only be inserted while `unlock_date > now()`; `likes` and real (non-reflection) `comments` can only be inserted once `unlock_date <= now()`. Neither is just a UI convention — both are RLS `WITH CHECK` clauses, so a direct API call at the wrong lock state is rejected the same as a mistargeted one.
- **Reflections are private by construction** — the SELECT policy on `comments` only returns rows where `is_reflection = true` to their own author; nobody else's reflections are ever returned to you, on any drop, including your own.
- **Counter triggers are `SECURITY DEFINER`** — liking, commenting on, saving, or reacting to someone else's drop needs to increment a counter on a row you don't own, which `posts`' own "owners only" UPDATE policy would otherwise block; the comment trigger also skips reflections so they never inflate the visible comment count.
- **`drop_unlock_views` only ever answers to the drop's own owner** — its SELECT policy is `exists(post where post.user_id = auth.uid())`, so this notification groundwork can't be used to build a public "who viewed this" feature even by accident.
- **Hiding a drop is invisible and personal** — `hidden_posts` only ever filters `get_drops_feed` for the person who hid it; there's no way to discover a drop was hidden from someone else's feed.
- **Reports are a one-way mailbox** — no SELECT policy exists on `reports` at all, so nobody (including the reporter) can read reports back through the app; reviewing them is an admin-tool concern for a later phase.
- **A moment's expiry is enforced at the RLS layer, not just filtered out of a read query.** `moments`' own SELECT policy is `user_id = auth.uid() or (expires_at > now() and can_view_moment(...))` — a non-owner can never read an expired moment via any path, direct table access included, while the owner's own row is always visible so the archive works.
- **`moment_views`/`moment_reactions`/`moment_replies` all forbid acting on your own moment** — each INSERT policy requires `m.user_id <> auth.uid()`, so self-views don't inflate your own count, and reacting/replying to yourself isn't possible even by a direct API call.
- **Seen lists and reaction rows are owner-only reads** — `moment_views`/`moment_reactions` SELECT policies only ever return another person's row to the moment's owner; a viewer can see their own reaction (to render their own toggle state) but never anyone else's, and never who else viewed.
- **`moment_replies` are private between the replier and the owner** — shaped like a future DM on purpose (`moment_id`, `user_id`, `content`, `created_at`), never a public comment thread; each side's own SELECT policy only returns their own replies or replies-to-their-own-moments, never both directions for anyone else.
- **A moment's `expires_at` is server-computed, not client-supplied** — `set_moment_expiry()` overwrites whatever the client sends based on `duration_hours` at insert time, the same defense `unlock_date` doesn't need (Drops trust the client's unlock date since it isn't a security boundary the same way) but a fixed 12/24/48h lifespan benefits from anyway.
- **Capsules' table-level RLS is stricter than Drops' or Moments' on the exact same question.** The SELECT policy on `capsules` is `user_id = auth.uid() or (unlock_date <= now() and can_view_capsule(...))` — a non-owner gets *no row at all* for a still-sealed capsule, not a row with nulled columns. A direct PostgREST query against `/rest/v1/capsules` for a locked capsule you don't own returns nothing, full stop; the RPC-layer nulling (`get_capsule`/`get_user_capsules`) is then a second, redundant layer on top for the cases RLS does allow through (your own capsule, before you've decided to peek). This is the one deliberate inconsistency between Capsules and the rest of the app: Drops and Moments only ever gate on visibility at the table level, trusting the RPCs alone for the lock-state check.
- **`unlock_date` must be in the future at creation, enforced by a trigger** (`validate_capsule_unlock_date`), not a plain CHECK constraint — Postgres CHECK constraints can't reference `now()` since it isn't immutable, so this needed `BEFORE INSERT` trigger logic instead.
- **`unlock_capsule()` is a single atomic RPC**, not two separate client-side inserts — it writes `capsule_unlocks` (always) and `capsule_views` (only for non-owners) together, and is safe to call repeatedly (`ON CONFLICT DO NOTHING`) so revisiting an already-opened capsule is a harmless no-op rather than a duplicate-key error the client has to swallow.
- **`capsule_reflections` are private by construction**, same as Drops' `is_reflection` comments — the SELECT policy only ever returns rows to their own author, on any capsule, including your own.
- **Like/Comment/Save on a capsule all require `unlock_date <= now()`** at the RLS `WITH CHECK` layer — a direct API call attempting to like or comment on a still-sealed capsule is rejected the same way an out-of-order Drops interaction would be.
- **`get_memories()`/`get_memory()` are `SECURITY DEFINER` and re-run the exact same predicates** their single-content-type counterparts already enforce — `can_view_capsule`/`can_view_moment`, `is_blocked_either_way`, the unlock/expiry checks — rather than introducing any new, looser notion of "visible." Viewing your own library always includes your own locked capsules (never anyone else's); viewing someone else's never does, and never includes an active (unexpired) moment regardless of whose it is.
- **Favorites and collections can only ever reference a memory you can actually see** — `favorites`' and `collection_items`' INSERT policies re-check `can_view_capsule`/`can_view_moment` (favorites) or plain ownership (collection items — a personal library only ever organizes your own memories, not things shared with you) before the row is allowed to exist.
- **Hiding is a soft, fully reversible flag** (`hidden_at`), not a delete — every default read path excludes hidden memories, but the row, its media, and its engagement history are all untouched. Only `deletePermanently` — which delegates to the same `deleteCapsule`/`deleteMoment` functions Phases 5/6 already built — actually removes anything, storage included.
- **Tags are free-text, not a controlled vocabulary** — no server-side validation beyond length via the existing owner-only UPDATE policies on `capsules`/`moments` (the same blanket "owner can update their own row" policies those tables already had; nothing new was granted for this phase). A malicious client could still only ever edit their *own* memory's tags, same as any other column on those tables.
- **Password change re-authenticates before allowing the change** — `changePassword()` calls `signInWithPassword()` with the current password first and only proceeds to `updateUser({ password })` if that succeeds, rather than trusting the existing session alone. Supabase doesn't require this step on its own; it's an extra layer this app adds.
- **Account deletion cascades entirely through existing foreign keys, deliberately not a bespoke cleanup routine.** `delete_my_account()` is one statement — `delete from auth.users where id = auth.uid()` — and every table in this schema already has `user_id references profiles(id) on delete cascade` (with `profiles.id references auth.users(id) on delete cascade` closing the loop), so the whole account unwinds through referential integrity Postgres already enforces, not through a function that has to remember every table by name. It only works because a `SECURITY DEFINER` function created via the SQL editor runs with the owning `postgres` role's privileges, which includes DELETE on `auth.users` — an ordinary `authenticated` client role cannot do this directly.
- **The four "manage my list" RPCs are unparameterized on purpose** — `get_blocked_users()` etc. take no arguments and always mean "my own list," so there's no `p_user_id` to ever pass someone else's id into by mistake.
- **`feedback_reports` has no SELECT policy at all** — the same one-way-mailbox discipline as Phase 4's `reports`; nobody, including the person who submitted it, can read a feedback row back through the app.
- **Appearance/Accessibility settings are pure client-side + `user_settings` state** — there's no RLS subtlety here since nothing but your own row is ever touched, but worth noting explicitly: the `dark`/`md-reduced-motion`/`md-high-contrast`/`md-large-touch` classes and the `--md-font-scale` CSS variable are applied by trusting `user_settings` values fetched from a table only you can write to, so there's no path for these to be tampered with by anyone but you.
- **`memory_items_view` is the one object in this entire schema deliberately kept unreachable by any client role.** No `GRANT SELECT` exists for it at all, on purpose (see Database tables above) — the risk of a future change accidentally exposing it is real enough that it's worth calling out twice: a view inherits its owner's ability to bypass RLS on the tables it reads, so granting it to `authenticated` would silently undo every visibility rule `can_view_drop`/`can_view_capsule`/`can_view_moment` enforce elsewhere.
- **`get_memory_stats()` and `get_public_stats()` read from completely different, non-overlapping sets of columns**, not the same query with a permission check bolted on. The public version was written from scratch to only ever touch `visibility = 'public'`/`privacy = 'everyone'` rows that are already unlocked/expired and not hidden — there's no code path that could accidentally leak a locked, private, or archived count to a non-owner, because that data is never selected in the first place, not merely filtered out after the fact.
- **Widening `get_memories()`/`get_memory()` to Drops reused the exact same predicate Drops' own Feed RPCs already use** (`can_view_drop`, `is_blocked_either_way`, `unlock_date <= now()`) — no new visibility logic was invented for this phase, only extended to a query that didn't previously run it.
- **`search_history` rows are own-rows-only, even from the aggregate side.** `get_trending_searches()`/`get_search_suggestions()` are `SECURITY DEFINER` specifically so they can count *across* everyone's search terms without ever granting cross-user `SELECT` on the table itself — a client can never query `search_history` directly for anyone but themselves; the only thing that leaves the table for other users is an aggregated `(query, count)` pair, never a `user_id`.
- **`search_memories()`/`get_explore_feed()` introduce no new visibility rule** — same discipline as widening `get_memories()` to Drops in Phase 9: `can_view_drop`/`can_view_capsule`/`can_view_moment` plus `is_blocked_either_way` are reused exactly as `get_public_stats()` already uses them, not reimplemented. Locked/unmatured content is excluded by the same `unlock_date <= now()`/`expires_at <= now()` checks as every other read path in this app, so search and Explore can never be used to peek at something early.
- **You can only ever pin your own content** — `pinned_items`' INSERT policy checks ownership of the target Drop/Capsule/Moment directly, not visibility, so there's no path (client bug or direct API call) to pin someone else's content onto your own profile. The 6-pin cap is a database trigger, not a client-side check a modified request could skip.
- **`get_pinned_memories()`/`get_activity_timeline()` both start with an explicit `is_blocked_either_way(v_target)` early return** — if the viewer and the profile owner have any block relationship in either direction, both functions return zero rows immediately, before evaluating anything else. This mirrors `get_public_stats()`'s own posture, just applied up front rather than per-row, since every row in both functions is about the same one profile.
- **Activity timeline reuses existing content predicates for every event**, and additionally excludes reflections (`is_reflection = true`) and moment replies entirely — both are private-by-construction everywhere else in this app (see the Phase 4/5 bullets above), so surfacing "X reflected on Y" or "X replied to Y" as public activity would have been a new leak, not a feature. Only real (non-reflection) Drop comments and Capsule comments count as "commented" activity.
- **Saved notes are exactly as private as the save itself** — `saved_posts`/`capsule_saves` SELECT policies were already own-rows-only before this phase; the new `note` column and its UPDATE policy inherit that same posture automatically, since Postgres RLS applies per-row regardless of which columns a query touches. There's no path for anyone but the person who saved something to ever read or edit their note.
- **`get_saved_memories()` still re-checks visibility on every row**, even though both `saved_posts` and `capsule_saves` only ever let you save something you could already see and that was already unlocked at save time. This matters because visibility can change *after* the save — if a Capsule owner later flips it from Public to Only Me, the save row still exists (harmless, it's just a bookmark reference) but `get_saved_memories()` correctly stops returning it, the same "re-checked on every read, not just at save time" discipline `favorites`/`collection_items` already established in Phase 9.
- **The share preview card is generated entirely in the browser and never uploaded anywhere** — `generateSharePreview()` draws to an in-memory `<canvas>` and hands the user a local download; the app's servers/database never see or store the image. The QR code is the one new external network call this phase adds (a public QR-image API), which necessarily means that service can see the URLs users generate QR codes for — see Known limitations.
- **Comment edit/pin correctness lives in a trigger, not just RLS — on purpose.** The UPDATE policy on `comments`/`capsule_comments` allows either the comment's author or the content's owner to target a row at all (`using`), but says nothing about which columns — that's `enforce_comment_rules()`/`enforce_capsule_comment_rules()`'s job: only the original author may change `content` (and doing so stamps `edited_at`), only the content owner may flip `is_pinned`, and `post_id`/`capsule_id`/`user_id`/`parent_comment_id`/`created_at` are silently pinned back to their old values no matter who's asking or what they send. This two-layer design (RLS decides *which rows*, a trigger decides *which columns, by whom*) is the same pattern Capsules' own unlock-date validation already uses elsewhere in this app — reused here, not invented.
- **Replies are enforced server-side to be exactly one level deep**, not just hidden in the UI — the same trigger rejects an INSERT whose `parent_comment_id` points at a comment that itself already has a parent, with a clear error rather than a silent constraint violation.
- **`comment_reactions`' SELECT/INSERT policies both re-derive visibility from the parent content**, nested through `comments → posts` or `capsule_comments → capsules`, reusing `can_view_drop`/`can_view_capsule` + `is_blocked_either_way` exactly as everywhere else — there's no independent, potentially-looser visibility rule for reactions.
- **`get_recent_likers()` re-checks the content's own visibility before returning anyone's name** — even though `likes`/`capsule_likes` rows themselves are already gated by the content having been visible at like-time, visibility can change afterward (see the equivalent Phase 10c bullet about saved items), so this RPC checks fresh on every call rather than trusting that the like was valid once.
- **@mention autocomplete never suggests a blocked relationship** — `CommentComposer` calls the same `search_users()` RPC the Search page uses, which already excludes blocked-either-way accounts; there's no separate, unguarded lookup path for mentions.
- **`useOnlineStatus()` is a pure UX affordance, not a security boundary** — `navigator.onLine` is trivially spoofable client-side and nothing in this app ever trusts it for anything beyond "should I show a retry button." Every actual read/write still goes through the same RLS-and-RPC enforcement as always regardless of what the browser claims about its connection.
- **`is_admin` grants nothing by itself — every capability it unlocks re-checks it explicitly.** Setting the column to `true` on a row doesn't change what that user's own client-side RLS access looks like anywhere else in the app; it only changes the outcome of the two new functions that explicitly query it. There is no "if admin, bypass RLS generally" path anywhere.
- **Moderation status changes are impossible to make untraceable** — `moderate_content()` always stamps `moderated_by = auth.uid()` itself (never trusts a client-supplied value), so there's no way to attribute a moderation action to the wrong admin, accidentally or otherwise.
- **Content reports remain a one-way mailbox for reporters, exactly as before** — `get_content_reports()` is admin-only; a user who files a report still can't read it back afterward, the same as Drops' original `reports` behavior since Phase 4. Extending "can I see my own report" would be a deliberate, separate decision, not a side effect of this phase.
- **`posts`' SELECT RLS now matches `capsules`' table-level lock guarantee exactly** — `user_id = auth.uid() or (unlock_date <= now() and moderation_status = 'active' and not is_blocked_either_way(user_id) and can_view_drop(user_id, visibility))`. Every app read path (`get_drops_feed`, `get_drop`, `search_memories`, ...) is `SECURITY DEFINER` and was already unaffected by table-level RLS (those functions bypass RLS by running as the function owner) — this change only closes the *direct-table-access* path (`/rest/v1/posts` via PostgREST), which previously returned a locked Drop's full raw row to anyone who passed the visibility check, regardless of unlock state.
- **This is the one table-level RLS policy in the schema that checks `moderation_status`** — a deliberate, narrow choice, not the start of a wider sweep. It's a natural, low-risk addition since the policy was already being rewritten for the unlock-parity fix and the column defaults to `'active'` for every existing row (zero behavior change until a future admin UI actually sets something to `'hidden'`/`'removed'`); the display-layer RPCs still don't check it — see Known limitations.

---

## Testing Phase 3 (needs two accounts)

- **Follow a public account** — Follow button should go straight to "Following."
- **Follow a private account** — button shows "Requested"; the other account sees it under `/friends/requests` and can Accept or Decline.
- **Cancel a sent request** — from `/friends/requests` → Sent, or by clicking "Requested" again on the profile.
- **Unfollow** — hover "Following" on desktop, should swap to red "Unfollow."
- **Remove a follower** — from your own `/followers`, kebab menu → Remove follower.
- **Block / unblock** — block someone you follow (or who follows you) and confirm the relationship disappears on both sides; confirm their profile now shows "User not found" to you and yours to them; unblock and confirm it's visitable again.
- **Mute/unmute, restrict/unrestrict** — toggle from the kebab menu on a profile or in your followers/following list; no visible effect elsewhere yet (expected — see Known limitations).
- **Search** — by both username and display name; confirm a blocked account (either direction) never appears.
- **Suggested friends** at `/search` with an empty query, or on `/friends`.
- **Mutual friends** — should show on profiles and on incoming follow requests once you and the other account share at least one connection.
- **Private profile visibility** — as a non-follower, confirm bio/location/website are hidden and followers/following show "This account is private"; as an accepted follower, confirm they're visible.
- **RLS with two browser sessions** — try to accept a request that wasn't sent to you, or delete someone else's follow row, directly via the Supabase table editor as a non-service-role user — should be rejected.

## Testing Phase 4 (Memory Drops)

- **Create a drop** — try each memory type (text, photo — 1, 10, and an attempted 11th, video, audio); confirm the composer won't let you attach two media types to the same drop.
- **Unlock date in the future** — drop it, then confirm: the card shows the sealed placeholder with a live countdown; caption/media are genuinely absent from the network response (check DevTools, not just the rendered DOM); comment/share are replaced with the unlock-gated message; this holds true even when you view your own drop as its author.
- **Unlock date in the past (or left as "now")** — confirm the drop renders immediately with full content, comments, and share, same as a normal post would.
- **Countdown hitting zero live** — leave a card with a near-future unlock date open and wait for it to cross zero; confirm it plays the reveal transition and shows real content without a manual refresh.
- **Delete own drop** — from the "..." menu on the card; confirm the storage files (check the `post-media` bucket, including audio) get cleaned up, not just the DB row.
- **Save / unsave** — confirm it shows up at `/saved`, and disappears from there immediately on unsave; confirm a still-locked saved drop still shows sealed there.
- **Reflect** — add a reflection on your own drop and on someone else's; confirm it never appears as a comment or affects the comment count; confirm nobody else (including the drop's author, for someone else's reflection on it) can see it.
- **Comment** — confirm the comment box only appears once a drop is unlocked; try posting a comment directly against a still-locked drop's `post_id` via the Supabase API — should be rejected by RLS.
- **Locked-drop reactions** — on a still-sealed drop, confirm you see exactly Save to Unlock / I'm Interested / Can't Wait / Good Vibes plus Reflect, and *not* Like, Comment, or Share. Tap each reaction, confirm it toggles and its count updates optimistically; try inserting a `drop_interests` row directly via the Supabase API against an already-unlocked drop — should be rejected by RLS.
- **Unlocked-drop engagement** — once a drop opens, confirm the action row swaps to Like / Reflect / Comment / Save / Share and the four pre-unlock reaction buttons are gone. Like/unlike a few times fast, confirm the count never goes negative and settles correctly; try inserting a `likes` row directly against a still-locked drop — should be rejected by RLS.
- **Hide** — confirm the drop disappears from your feed but is still visible to other users.
- **Report** — submit each of the 6 reasons once; try reporting the same drop twice as the same user (should be rejected — unique constraint).
- **Six tabs**:
  - **My Drops** — only your own, locked and unlocked
  - **Following** — drops from people you follow, locked and unlocked, respecting each drop's own visibility (a `followers`-visibility drop from someone you follow should show; a `private` one never should)
  - **Public Drops** — public-visibility drops from public accounts, *including still-locked ones* — confirm a locked public drop from an account you don't follow shows up here with its countdown, and that the same drop from a private account does not
  - **Unlocking Soon** — everything visible to you that's still sealed, soonest first, across My Drops/Following/Public
  - **Today's Unlocks** — anything visible to you opening today
  - **Saved to Unlock** — only drops you tapped "Save to Unlock" on; confirm removing the reaction removes it from this tab

  Switch tabs and back — should not re-fetch or lose scroll position.
- **Visibility** — drop something as Only Me on a public account and confirm nobody else, including an accepted follower, can see it anywhere (feed tabs, permalink, or Saved); drop something as Followers-only on a public account and confirm a non-follower can't see it even though your account itself is public.
- **Infinite scroll** — with more than 10 drops visible to you in a tab, scroll to the bottom and confirm the next page loads before you hit the literal end.
- **Pull to refresh** — on a touch device (or Chrome DevTools device emulation), pull down at the top of the feed.
- **Multiple users / RLS** — as User B, confirm you can't see User A's private or followers-only drops unless the relationship actually qualifies; confirm saving/commenting/reacting/liking on a drop you can't see is rejected by RLS even if you have its UUID.
- **Share** — copy link (only shown once unlocked), open it in an incognito tab while logged out — should redirect to `/login` (see Known limitations), then load correctly once signed in.

## Testing Phase 5 (Moments)

- **Create each type** — text, photo, video; confirm the type picker swaps correctly and a photo/video moment won't submit without a file attached.
- **Each duration** — 12h, 24h, 48h; after creating, confirm the viewer's "Expires in…" reads correctly and (if you're willing to wait, or adjust your Supabase server clock in a test project) that it actually disappears from the tray/tabs at that time, not before or after.
- **Each privacy tier** — Everyone (confirm a non-follower on a public account can see it), Followers (confirm a non-follower cannot, even on a public account), Only Me (confirm literally nobody else can, including an accepted follower), Close Friends (confirm it behaves like Only Me until you manually insert a `close_friends` row for a test pair, then confirm that specific friend can see it).
- **View a moment** — from the tray, confirm the ring goes from gradient to gray once every moment from that author is viewed; confirm `view_count` only ever shows a real number to the moment's own owner, and that your own view of your own moment never increments it.
- **Next/previous** — tap the right half to advance, left half to go back; confirm tapping "previous" on the very first moment closes the viewer rather than doing nothing; confirm tapping "next" on the last one closes it too.
- **React** — tap a quick emoji, confirm it highlights and toggles off on a second tap; confirm you cannot react to your own moment (button should be entirely absent, and a direct API insert should be rejected by RLS).
- **Reply** — send a reply, confirm it can't be sent to your own moment; as the owner, there's currently no in-app reply inbox to read replies back (see Known limitations) — verify via the Supabase table editor that the row landed correctly instead.
- **Seen list** — as the owner, tap "Seen by N" and confirm it lists viewers with timestamps, most recent first; as a non-owner, confirm there's no way to reach anyone else's seen list.
- **Expired moment hidden from tray** — let a 12h moment's `expires_at` pass (or edit it directly in Supabase for testing), confirm it disappears from the tray and from every other user's access entirely.
- **Owner archive** — confirm the same expired moment still appears in your own `/moments` grid, and tapping it still opens the full-screen viewer with real content.
- **Blocked users** — block someone, confirm their moments never appear in your tray and yours never appear in theirs, in both directions.
- **Mobile layout** — tray horizontal scroll, viewer tap zones, and the reply input's on-screen-keyboard behavior on an actual phone or device emulation.

## Testing Phase 6 (Time Capsules)

- **Create a capsule** — walk all 9 steps for at least one text-only capsule and one combination capsule (e.g. Photo + Voice Recording); confirm the wizard won't let you proceed past step 1 with zero types selected, and won't let you submit an entirely empty capsule (no title, no memory text, no media).
- **Upload media of each type** — photo (try the 10-item cap), video, audio file, and an in-browser voice recording (grant microphone access, record, stop, confirm playback preview works before submitting).
- **Lock a capsule** — confirm the "Memory Locked" confirmation screen shows the correct unlock date and a live countdown; confirm the capsule immediately appears (sealed) in your archive.
- **Countdown** — confirm all six units (years/months/days/hours/minutes/seconds) tick correctly and the seconds actually update once a second, not once a minute.
- **Unlock at the correct time** — create a capsule with a near-future custom date/time (a few minutes out), wait for it, confirm "Open Capsule" appears exactly when `unlock_date` passes, not before; tap it, confirm the unlock animation plays once and the real content appears after.
- **Re-open an already-opened capsule** — confirm it shows the revealed content directly, no animation replay, no re-fetch delay.
- **Visibility rules** — Only Me (confirm literally nobody else, including an accepted follower, can see it — check via the Supabase table editor with a second account's session that a direct query returns zero rows, not a nulled one), Followers (confirm a non-follower gets nothing), Public (confirm it's visible to anyone who can see your posts in general, gated by your own account privacy same as a public Drop).
- **Archive** — confirm your own archive shows both locked and unlocked capsules, sorted chronologically by unlock date with year markers; confirm a locked capsule still shows its sealed state there (title/media absent) even though it's your own.
- **Search** — search your own archive by title and by memory text; confirm searching does nothing on someone else's visible-capsules view (search is caller-own-capsules-only, by RPC design).
- **Filters** — Locked/Unlocked toggle, year, mood, media type, visibility — test each independently and combined; confirm "Clear" resets all of them at once.
- **Responsive layout** — the wizard's step content, the countdown grid, and the archive's filter row on a narrow viewport or real device.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.
- **RLS** — as User B, attempt to directly query `/rest/v1/capsules?id=eq.<User A's locked capsule id>` — should return zero rows unless B is the owner; attempt to insert a `capsule_likes`/`capsule_comments`/`capsule_saves` row against a still-locked capsule — should be rejected.

## Testing Phase 7 (Memories)

- **Timeline** — confirm a capsule appears the moment it's created (locked, sealed state) and a moment appears only once it expires (never while still active in the live tray); switch between all four layouts (List/Grid/Journal/Timeline) and confirm the same data renders correctly in each without a re-fetch; confirm Newest/Oldest sort actually reorders.
- **Calendar** — confirm a day with memories shows a dot and a day without doesn't; tap a day, confirm it shows exactly that day's memories; navigate month-to-month and year-to-year.
- **Year grouping** — confirm `get_memory_year_counts` matches what you'd count by hand; expand a year, confirm its memories load and match the count shown.
- **Collections** — visit Collections for the first time on a fresh account, confirm all 12 default collections appear automatically and empty; create a custom collection; add a memory to a collection from its Memory Details page, confirm it appears in that collection's expanded view and in Timeline's collection filter; remove it, confirm it disappears from both; delete a custom collection, confirm its memories are untouched.
- **Favorites** — favorite a memory from a card (grid/list/journal/timeline all have the button) and from its Details page; confirm it shows up on the Favorites tab and via the Timeline's Favorites filter; unfavorite, confirm it disappears from both.
- **Flashbacks** — manually backdate a test capsule/moment's `created_at` in Supabase to exactly one year before today (same month/day); confirm it appears under Flashbacks with "1 year ago"; dismiss it, confirm it's gone for the rest of the day but would reappear tomorrow (check the `flashbacks_cache` row).
- **Highlights** — confirm "Best memories this month" only considers the last 30 days, "Most viewed"/"Most reacted" consider everything; tap "Save this reel," confirm a row lands in `memory_highlights` with the right `capsule_ids`/`moment_ids`.
- **Search** — search your own Timeline by a word that's only in one memory's title, then only in its caption; confirm it matches both; confirm it never matches anyone else's memories even if they're visible to you.
- **Filters** — Year, Month, Mood, Visibility, Media type, Favorite, Collection, Locked/Unlocked — test independently and combined; confirm "Clear" resets everything at once.
- **Archive** — hide a memory from its Details page, confirm it disappears from Timeline/Calendar/Years/Collections/Favorites/Flashbacks/Highlights immediately but appears under the Archive tab; restore it, confirm it's back everywhere; delete one permanently, confirm the row *and* its storage files are gone (check the `capsules`/`moments` bucket), and that it no longer appears in Archive either.
- **Tags and location** — add a few tags to a memory, remove one, confirm both persist after a page reload; add a location to a capsule (moments already had this field from Phase 5).
- **Memory Details for each type** — a capsule opens as a full interactive `CapsuleCard` (unlock ritual if still locked, full Like/Comment/Reflect/Save/Share once unlocked); a moment shows its content plus (owner-only) historical reaction counts, with no way to add new reactions or comments (matches Phase 5's unlock-independent RLS).
- **Responsive layout** — the 8-tab bar's horizontal scroll, the calendar grid, and all four Timeline layouts on a narrow viewport or real device.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.
- **RLS** — as User B, confirm `get_memories`/`get_memory` never return User A's locked capsules or active moments, even by guessing UUIDs; confirm inserting a `favorites`/`collection_items` row against a memory you can't see (or, for collections, don't own) is rejected; confirm updating another user's `tags`/`hidden_at` via a direct table call is rejected.

## Testing Phase 8 (Settings & Privacy)

- **Every setting saves correctly** — change one value per section, reload the page from scratch, confirm it persisted (not just held in memory): default Drop/Moment visibility, theme, font size, every accessibility toggle, every notification preference.
- **Theme changes work** — switch to Dark, confirm the shell (`Navbar`, page background) and the Settings page itself actually change immediately, no reload needed; switch to System, then toggle your OS/browser's dark mode preference, confirm the app follows it live; switch to Light, confirm it overrides System correctly.
- **Accessibility settings apply globally** — turn on Reduced Motion, High Contrast, and Larger Touch Targets one at a time and visit a completely unrelated page (e.g. Feed or Capsules) — confirm the effect is visible there too, not just on the Settings page itself.
- **Privacy settings persist** — toggle Private Account, reload, confirm it held; add and remove a Close Friend, confirm the list updates; block/mute/restrict someone from a profile's menu (Phase 3 UI), then confirm they now appear in Settings' respective "manage" list, and that unblocking/unmuting/unrestricting from Settings removes them from that list.
- **Notification preferences persist** — toggle a few off, reload, confirm they held.
- **Delete account flow** — on a disposable test account: confirm the confirmation phrase gate actually blocks the button until typed correctly; confirm deletion signs you out and the account is genuinely gone (its profile, drops, capsules, moments — try logging back in with the same credentials, should fail).
- **Delete all my data** — confirm every Drop/Moment/Capsule is gone afterward (check Feed/Capsules/Memories) but the account itself still works — you can still log in and create new content.
- **Logout** — confirm it actually ends your session (protected routes redirect to `/login` afterward).
- **Change password** — confirm it rejects an incorrect current password with a clear message before ever attempting the change; confirm a correct current password + valid new password succeeds and updates "Password last changed."
- **Change email** — confirm Supabase's confirmation email flow triggers (check both inboxes if your project has "confirm email change" enabled for both old and new addresses).
- **Sign out of all devices** — sign in from two different browsers (or one normal + one incognito), trigger "Sign out of all devices" from one, confirm the other is also signed out on its next request.
- **Accessibility settings** — see above; also confirm Font Size visibly changes text size app-wide, not just within Settings.
- **Responsive layout** — the 10-section list, each section's forms, and the DangerZone confirmation flow on a narrow viewport or real device.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 9 (Unified Memory Wiring)

Validate with two accounts, User A (owner) and User B (follower/public viewer), per the phase's own multi-user scenario:

- **User A creates**: a locked Capsule, a Moment that will expire, a Public Drop, a Followers-only Drop, and an Only-Me Drop.
- **User B**: follows User A, saves the locked public Drop (Save to Unlock), waits for/forces the unlock (or edits `unlock_date` directly in Supabase for testing), views it after unlock, comments after unlock.
- **Owner view (User A)**: confirm every item they created appears in the right place immediately after creation — the locked Capsule shows sealed in `/capsules` (Locked or Unlocking Soon section depending on how far out); all five items appear somewhere in `/memories` once unlocked/expired (Drops included now); Profile's stats card reflects accurate counts without a page-by-page cross-check needed.
- **Follower view (User B)**: confirm the Followers-only Drop is visible once unlocked, the Only-Me Drop is not visible at all (not even a locked placeholder), and the Public Drop is visible regardless of the follow relationship.
- **Public/logged-out-equivalent view**: confirm only the Public Drop is ever visible, never the Followers-only or Only-Me ones, and never anything still locked.
- **Memories page updates correctly** — after User A's Capsule unlocks, confirm it appears in `/memories` (Recently Unlocked strip and the full Timeline) without a manual refresh being the only way to see it (reload is fine, silently missing is not); confirm the expired Moment lands in the Expired archive, not the live tray.
- **Profile stats update correctly** — after each creation/unlock/view/comment/reaction, confirm the relevant `get_memory_stats()` number changes for User A, and that `get_public_stats()` on User A's public profile (as viewed by User B or a third, unrelated account) only ever shows the Public Drop in its count — never the Followers-only or Only-Me ones, even after User B is confirmed to be following.
- **Capsules page updates correctly** — confirm a capsule moves from "Locked" (or "Unlocking Soon," once within 7 days) to "Unlocked" the moment its `unlock_date` passes, and to "Archived" only after an explicit Hide action, never automatically.
- **Feed tabs remain consistent** — spot-check that My Drops/Following/Public Drops/Unlocking Soon/Today's Unlocks/Saved to Unlock still each show exactly what they showed before this phase (this phase's audit found no bugs here — confirm that's still true after the `get_memories()` widening, which is a separate code path from `get_drops_feed()` and shouldn't have touched Feed's behavior at all).
- **Security** — as User B, attempt to directly query `/rest/v1/memory_items_view` via the Supabase REST API — should be rejected outright (no grant exists, not even a partial/filtered result); confirm `get_public_stats()` for User A never includes the Followers-only or Only-Me Drop in its count regardless of who's asking; confirm a blocked user sees nothing of the blocker's content anywhere (Memories, Profile stats, Capsules).
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10a (Search + Explore)

- **Cross-user search respects visibility** — as User B, search for text that matches User A's Only-Me drop and Followers-only capsule (not following yet): neither should appear. Follow User A, wait for/force acceptance, search again: the Followers-only capsule should now appear (once unlocked), the Only-Me drop still should not, ever.
- **Search never surfaces locked content, even your own** — create a capsule that unlocks next week, search for its exact title as its owner: it should not appear in search results (it will still appear in Memories' own locked-until-later view — that's a different, intentionally separate page).
- **Tag and location search** — search a word that only appears in one of your capsule's tags, then one that only appears in its location field; both should return that capsule. Search a word from a Drop's caption — should also work; search a tag or location term against a Drop specifically — should never match one, since Drops have no tags/location columns.
- **Recent searches** — run a few different searches, reload the page, confirm they appear as chips in the same order (most recent first), deduped if you searched the same term twice. Hit Clear, confirm the list empties and stays empty on reload.
- **Trending searches** — have two test accounts search the same term a few times; confirm it climbs in `get_trending_searches()`'s ordering relative to a term only searched once. Confirm the trending list never reveals *who* searched something, only the term and a count.
- **Suggestions** — type a partial username that matches an existing account (not yourself, not a blocked relationship) and confirm it appears in the suggestion dropdown; type a partial term matching a trending search and confirm that appears too; confirm a blocked user's username never appears as a suggestion.
- **Explore respects visibility identically to Search** — as User B, cycle through all eleven Explore tabs and confirm nothing appears that User B wouldn't also be able to find via Search or Memories directly; confirm a category tab (e.g. Travel) only returns content actually tagged `Travel` (case-insensitive) on a Capsule or Moment — Drops never appear in category tabs since they have no tags.
- **Today's Unlocks is date-accurate** — confirm only content that matured (Drop/Capsule `unlock_date`) or expired (Moment `expires_at`) today, in the database's own clock, appears — not yesterday's or tomorrow's.
- **Security** — as User B, attempt to call `search_memories`/`get_explore_feed` with content that should be invisible (a third account's Only-Me content) and confirm it's never returned regardless of query/tab; confirm a blocked-either-way relationship excludes that user's content from both Search and Explore entirely.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10b (Profile Polish)

- **Pinning respects ownership and the cap** — as User A, pin a Drop, a Capsule, and a Moment from Memory Details; confirm all three appear split correctly across "Pinned Memories" (Capsule/Moment) and "Pinned Drops" on your own profile. Try pinning a 7th item after already having 6 pinned; confirm it's rejected with a clear message, not a silent failure or a generic DB error. Confirm there is no UI path to pin something you don't own, and that a direct `pinned_items` insert attempting to reference someone else's content is rejected by RLS.
- **Pinned content still respects "no peeking early"** — pin a capsule that hasn't unlocked yet (should be allowed, since pinning only checks ownership); confirm it does *not* appear in the Pinned Memories section until it actually unlocks.
- **Pins are visible on your public profile correctly** — as User B, visit User A's profile and confirm pinned items only show if User B could otherwise view that content (an Only-Me pinned drop should never appear to User B; a Followers-only pinned capsule should only appear once User B is an accepted follower).
- **Public Capsules / Public Moments sections** — confirm these show only `visibility: public` (Capsules) / `privacy: everyone` (Moments) content, already unlocked/expired, and stay empty (not shown at all) when there's nothing to show rather than rendering an awkward empty card.
- **Activity timeline reflects real activity** — create a Drop, a Capsule, and a Moment as User A; confirm all three appear in your own Activity section in the correct order (newest first). Comment on someone else's public Drop; confirm "Commented on a Drop" appears on your own timeline. Post a private reflection or a moment reply; confirm neither ever appears in anyone's activity timeline, including your own.
- **Activity timeline respects visibility** — as User B (not following User A), confirm User A's activity around a Followers-only or Only-Me item never appears; follow User A and confirm Followers-only activity now appears, Only-Me activity still never does.
- **Blocked users see nothing** — as a blocked user, confirm both the pinned sections and the Activity section return empty on the blocker's profile, rather than partial/filtered data.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10c (Bookmark + Share)

- **Unified Saved page** — save a Drop and a Capsule; confirm both appear together on `/saved`, correctly labeled, and that the "Capsules" filter chip narrows to just the Capsule while "Drops" narrows to just the Drop.
- **Notes persist and are searchable** — add a note to a saved item, reload the page, confirm the note is still there; search for a word that only appears in the note (not the title/caption) and confirm it's found.
- **Notes are private** — as a different user who can also see the same public Drop/Capsule (e.g. because they also saved it), confirm they never see your note — there's no path in the UI or the RPC that would expose it.
- **Folders reuse Collections correctly** — add a saved item to a Collection from the Saved page, then confirm it also shows up in that Collection from the Memories page's Collections tab, and vice versa — same underlying `collection_items` rows either way.
- **Sort and filter compose correctly** — combine a type filter, a folder filter, and a search term at once; confirm the result set matches all three conditions together (an AND, not an OR).
- **Unsaving removes it from Saved but not from Memories** — remove a saved Capsule from `/saved`; confirm it's gone from Saved but still fully intact and viewable from `/memories` (unsaving is not the same as deleting or hiding).
- **A save row survives a visibility change correctly** — as the owner, save your own Capsule (allowed — owners can save their own), then as a different viewer who saved a friend's Public capsule, have the friend flip it to Only Me; confirm the viewer's saved item disappears from their `/saved` on next load (still exists as a row, `get_saved_memories()` just stops returning it).
- **Share modal works for both content types** — open Share from a Drop and from a Capsule; confirm Copy Link produces the correct `/drop/:id` vs `/capsules/:id` URL in each case, Copy Shareable Text includes that same URL, the QR code image encodes the same URL (scan it to confirm), and Download Preview Card produces a PNG with the right caption/mood/cover for that specific item.
- **Preview card degrades gracefully** — trigger card generation for a memory whose cover image fails to load or taints the canvas (e.g. an unusual external URL); confirm the card still downloads successfully as a text-only card rather than failing silently or throwing.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10d (Comments + Reactions)

- **Replies work and stay one level deep** — reply to a top-level comment on both a Drop and a Capsule; confirm it renders indented directly beneath its parent. Attempt to reply to a reply (e.g. via a direct API call with an existing reply's id as `parent_comment_id`); confirm it's rejected with the "one level deep" error, not silently nested or silently flattened.
- **Edit respects authorship** — edit your own comment, confirm "· edited" appears and the content updates for everyone viewing it. As a different user (not the author, not the content owner), attempt to edit someone else's comment via a direct API call; confirm it's rejected.
- **Delete works for both content types** — delete your own comment on a Drop and on a Capsule; confirm both the row and any of its replies disappear, and the comment count updates correctly.
- **Pin is owner-only, not author-only** — as the Drop/Capsule owner, pin someone else's comment; confirm it moves to the top and shows the "Pinned" label for every viewer. As the comment's own author (not the content owner), attempt to pin your own comment via a direct API call; confirm it's rejected. As the content owner, pin one of your own comments; confirm that succeeds.
- **Mentions autocomplete and link correctly** — type `@` followed by a few letters of a real username in a comment/reply box; confirm the dropdown shows matching users (never a blocked one), and that selecting one inserts `@username`. Post the comment; confirm `@username` renders as a clickable link to that profile.
- **Comment reactions** — react to a comment with an emoji, confirm the count increments and your emoji shows as active; pick a different emoji, confirm it swaps (not adds a second reaction); pick the same emoji again, confirm it's removed and the count decrements.
- **Comment reactions respect visibility** — as a user who can't view the underlying Drop/Capsule (blocked, or Only-Me visibility), confirm any attempt to read or write a reaction on one of its comments is rejected.
- **Like animation and recent likers** — like a Drop or Capsule, confirm the pop + floating-heart animation plays once (not on every re-render); tap the like count, confirm a small list of recent likers' avatars/names appears, sourced correctly (never showing a blocked user, never showing likes on content you can no longer see).
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10e (Feed Polish + UX + Performance)

- **Offline banner + retry** — use your browser devtools to simulate offline (Chrome DevTools → Network → Offline); confirm the amber banner appears within `AppShell` immediately, and disappears immediately on going back online, without a page reload. With an empty result showing (e.g. a Search with no matches, or Explore on a tab with nothing public), go offline; confirm the empty state swaps to "You're offline" with a working Retry button; go back online and click Retry, confirm it actually refetches.
- **Page transitions respect reduced motion** — with Settings → Accessibility → Reduced Motion off, navigate between pages and confirm a brief fade/slide-up plays; turn Reduced Motion on and confirm the transition becomes instant (no animation), same as every other animation in the app.
- **Unlock reveal plays once, at the right moment** — have a Drop with an unlock date a minute or two away open in a browser tab; wait for the countdown to hit zero; confirm the revealed content animates in once. Reload the page after it's already unlocked; confirm no animation plays this time (it's a "just now revealed" moment, not a permanent decoration).
- **Memoization doesn't break optimistic updates** — like/comment/save/pin on one card in a long Feed or Memories list; confirm only that card visibly updates and no sibling cards flicker or re-render (open React DevTools' "Highlight updates" if you want to see this directly).
- **`content-visibility: auto` doesn't clip anything that should be visible** — scroll a long Feed or Capsules list, open a card's "..." menu or comment section near the top and bottom of the viewport; confirm nothing is unexpectedly clipped or missing, and that scrolling past off-screen cards and back doesn't lose their state (likes, open menus should reset on scroll-away the same way they always did — `content-visibility` doesn't change React's own mount/unmount behavior).
- **Memories tab caching** — visit Favorites, switch to another tab, switch back; confirm it doesn't reflash a loading skeleton (served from cache). Favorite a new item, switch tabs and back; note it won't appear until the tab is truly reloaded (a known limitation — see below) — confirm that's the actual, documented behavior, not a crash.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10f (Admin Preparation + Scale Test)

**Admin-prep architecture** — do this against a disposable/staging project, not production, since it involves manually flipping `is_admin`:
- **Non-admins are rejected, not just denied data** — as an ordinary account, call `moderate_content()` and `get_content_reports()` directly (e.g. via `supabase.rpc(...)` in a browser console); confirm both raise an exception rather than silently returning nothing or succeeding.
- **Grant yourself `is_admin` for testing**: `update profiles set is_admin = true where id = '<your-test-account-id>';` — then confirm both RPCs now work: report a Drop, a Capsule, and a Moment from three different accounts, then call `get_content_reports()` as the admin account and confirm all three appear, correctly typed, with the right reporter/reason/details.
- **`moderate_content()` actually changes state and stamps the audit columns** — call it with `status: 'hidden'` on a test Capsule; confirm `moderation_status`/`moderated_at`/`moderated_by`/`moderation_reason` all update on the row (query the table directly). Confirm existing reads (Feed, Memories, Search, Explore) still show it — this phase deliberately didn't wire enforcement into any read path yet (see Known limitations), so seeing it still appear everywhere is expected, not a bug.
- **The audit trail can't be spoofed** — attempt to call `moderate_content()` in a way that would set `moderated_by` to someone else's id (the function signature doesn't even accept one); confirm it's always the calling admin's own id.
- **Revoke `is_admin`** when done testing and confirm both RPCs immediately reject that account again.

**Scale test** — run `supabase/dev_seed_scale_test.sql` against a disposable local/staging project (never production), then work through:
- **No broken navigation** — with 1000 Drops/300 Moments/300 Capsules and 100 fake accounts in the database, click through Feed (all 6 tabs), Explore (all 7 tabs, including the two person-tabs), Memories (all 8 tabs), Capsules (both modes), Search, Saved (all 4 tabs), and a handful of the fake profiles (including the 10 private ones); confirm nothing 404s, infinite-spins, or throws a console error under the larger dataset.
- **No inconsistent stats** — check `get_memory_stats()`'s numbers on a seeded account against manually counting a sample of its rows; confirm Profile's stats card, Explore's Popular tabs, and a Capsule's own like/comment/save counts all agree with what's actually in the tables (no drift between a trigger-maintained counter and the rows it's supposed to be counting).
- **No duplicated memories** — spot-check that no Drop/Capsule/Moment appears twice in Memories' Timeline, Search results, or Explore — the seed script's `on conflict do nothing` clauses prevent duplicate reaction/save/comment rows, but this checks the read side, not just the write side.
- **No RLS leaks** — as a *non-seeded*, ordinary test account, confirm you never see a seeded `only_me`/`private` Drop, Capsule, or Moment anywhere (Search, Explore, a seeded user's profile), and that the two seeded block relationships (rn 1↔2, rn 3↔4) are invisible to each other everywhere. Then, specifically: pick a still-locked seeded Drop and issue a direct `GET {SUPABASE_URL}/rest/v1/posts?id=eq.<id>` with a non-owner's access token — confirm it returns **zero rows**, not a row with nulled columns (this is exactly what Phase 10g's RLS hardening changed; before it, this request would have returned the full raw row).
- **No loading loops** — open Feed/Explore/Memories/Search with the seeded dataset and confirm `loadMore`/infinite-scroll terminates correctly once `hasMore` goes `false`, rather than looping or hammering the network.
- **No console errors** — open the browser console while navigating the pages above; confirm no errors or unhandled promise rejections surface under the larger, more varied dataset (empty arrays, nulls, and edge-case combinations that a small hand-tested dataset might not have exercised).
- **Cleanup** — run `delete from auth.users where email like 'scaletest_%@memorydrop.test';` and confirm every seeded row (profiles, posts, capsules, moments, follows, blocks, comments, likes, saves, collections, favorites — everything) is gone via cascade, with nothing left behind to manually clean up.
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Testing Phase 10g (hardening pass)

- **Pin cap** — pin 3 memories, confirm a 4th is rejected with the "up to 3" message; unpin one, confirm pinning a new one now succeeds.
- **Saved page's 4 tabs** — save a Drop pre-unlock (Save to Unlock) and confirm it appears under Waiting to Unlock; save an already-unlocked Drop/Capsule and confirm it appears under Saved Memories instead; favorite something and confirm it shows under Favorites; confirm Collections matches what Memories' own Collections tab shows for the same account.
- **Explore's 7 tabs** — cycle through all of them, including New Creators and Suggested People; confirm the two person-tabs render account cards (with a working Follow button) rather than memory cards, and that memory-tabs never show locked or unauthorized content.
- **Mobile bottom nav** — at a narrow viewport (or real device), confirm the bottom bar shows Feed/Capsules/Create/Memories/Profile with the active route highlighted; tap Create, confirm the action sheet opens with all three options, Escape/outside-tap closes it; create a Drop from it and confirm it appears on Feed afterward; confirm the top Navbar's icon row is hidden at this width (no duplicate nav) and that Search/Explore/Friends are still reachable from the account menu.
- **No horizontal overflow / no clipped labels** — at 320px width, confirm the bottom nav's five items and the top Navbar never cause the page to scroll sideways, and no label text is cut off.
- **Security — locked Drop direct access** — see the scale-test RLS-leak bullet above; this is the single most important thing to verify in this pass.
- **Dark mode spot-check** — toggle dark mode and browse Feed, Capsules, Memories, Search, Explore, and Profile; confirm the surfaces this pass touched (see the Phase 10g feature list above) have no white-card-on-dark-background or unreadable-text instances. Known gaps are listed below, not hidden.
- **Toasts and error boundary** — trigger a comment post/edit/delete failure (e.g. by revoking network mid-action) and confirm a toast appears with a clear message; force a render error in dev tools and confirm the ErrorBoundary's calm fallback appears instead of a blank page.
- **Bundle size** — run `npm run build` and confirm the main bundle is meaningfully smaller than before this pass and the chunk-size warning is gone (Search/Explore/Memories/Settings now load as separate chunks).
- **TypeScript build** — `npx tsc -b` clean.
- **Production build** — `npm run build` clean.

## Known limitations

- Mute and Restrict have no visible effect anywhere yet — the feed doesn't filter on them. The relationships are stored and toggle correctly; wiring `get_drops_feed` to exclude muted/restricted authors is a natural next step, deliberately not done here since it wasn't part of this phase's explicit scope.
- **Shared drop links require login** — `get_drop` is only granted to `authenticated`, not `anon`, so `/drop/:dropId` redirects to `/login` for logged-out visitors even when the drop itself is public and unlocked. Real link-preview/logged-out sharing would need a separate, more narrowly-scoped anonymous-read path.
- **No notification when a drop unlocks, or when someone reacts.** `drop_interests` and `drop_unlock_views` are both durable event records — the schema is deliberately ready for a "Sam sent good vibes" / "Sam unlocked your drop" notification — but nothing reads them yet. That's Phase 9's job. The countdown/reveal itself only plays if you happen to have the card open in a browser tab at the exact moment.
- **`unlock_date` is compared against the database server's clock**, not the viewer's device clock — correct and tamper-proof, but means a client with a badly skewed clock could see a countdown that doesn't hit zero exactly when their own UI expected.
- **Unlocking Soon and Public Drops can overlap by design** — a public account's still-locked public drop can legitimately appear in both, since they answer different questions ("what's about to open, for me" vs. "what's out there generally"). Not a bug, just worth knowing before it looks like duplicated content while testing.
- **No counts shown for likes or interests at a glance across tabs** — counts render per-card once a drop is on screen, but there's no aggregate "X drops are trending" surface. Not attempted here since it wasn't part of this phase's scope.
- Suggested friends only looks one hop out (people followed by people you follow). No engagement-based ranking — there's no engagement data yet.
- No real-time updates anywhere — a new comment, reflection, reaction, or follower won't appear for another open tab/user until they reload or navigate. Supabase Realtime would be the natural fit for a later pass, and would also let a still-open tab see an unlock happen without the local countdown timer doing the work.
- **Offset-based pagination**, not cursor/keyset — simpler and fine at this scale, but re-paginating after new drops arrive above the current page can occasionally skip or repeat a row. Worth revisiting if the feed needs to scale further.
- **No feed virtualization** — drops accumulate in the DOM as you scroll rather than windowing them out. Not a problem at normal session lengths; a candidate for `react-window`/`react-virtual` if very long scroll sessions become common.
- The account dropdown in `Navbar`, the kebab menu in `RelationshipMenu`, and the "..." menu in `DropCard` all implement the same open/outside-click/Escape pattern independently rather than sharing one primitive — noted as a refactor opportunity across several phases now, not done here to avoid touching working, tested code outside this phase's scope.
- **No in-app reply inbox for the moment owner.** `moment_replies` rows are saved and readable via RLS (owner can SELECT replies to their own moments), but there's no UI screen listing them yet — that's explicitly the groundwork-for-messaging story, which is Phase 7's job, not this one's.
- **Close Friends has no management UI.** The privacy tier and the `close_friends` table both work correctly, but there's no settings page to add or remove someone from your list — until one ships, a Close-Friends-only moment is effectively Only-Me for everyone. The picker's own copy says this rather than hiding it.
- **No auto-advance to the next author's stack.** Closing or running off either end of one person's moments always exits the viewer, rather than chaining into whoever's next in the tray the way Instagram does — a deliberate scope cut, not an oversight, to keep the viewer simple this phase.
- **Expired moments' storage files aren't cleaned up automatically.** There's no scheduled job clearing out `moments` bucket files once their row expires — only an explicit user delete removes the file. Same limitation the rest of the app already has for anything else stored in Supabase Storage; would need pg_cron or an edge function to fix.
- **`get_user_moments`/`get_moments_tray` are called plainly (no caching) from the tray, profile rings, and archive** — fine at this scale, but a very active account being viewed by many people at once would mean many redundant reads. Not optimized here since it wasn't part of this phase's scope.
- **The profile "moment ring" does an extra round trip** — `ProfilePage`/`PublicProfilePage` call `get_user_moments` just to check `length > 0` for the ring, rather than a dedicated lightweight existence check. Reused the existing RPC instead of adding a new one; worth a `has_active_moments(user_id)` boolean RPC if this page turns out to be hit hard.
- No real-time updates here either, same as everywhere else in the app — a new reaction, reply, or view won't appear in an already-open viewer until it's reopened.
- **No multi-capsule / group / shared capsules.** Every capsule has exactly one owner and one unlock date — the "dedicated capsule creation/management" richer version (multiple people contributing to one capsule, capsules that unlock progressively, etc.) is explicitly Phase 6's *next* iteration or a later phase, not this one.
- **No in-app comment/reflection inbox for capsule owners**, same limitation as Moments' replies — `capsule_comments` are visible via the card itself once you open it, but there's no aggregated "here's everything anyone said across all your capsules" view.
- **No storage cleanup job for deleted-then-orphaned files**, same as every other bucket in this app — deleting a capsule cleans up its own media via the client's best-effort delete calls, but there's no server-side guarantee if that call fails partway through (e.g. the row deletes but a media file's delete request times out).
- **The wizard's Review step doesn't support jumping directly back to a specific step** — only sequential Back, one step at a time. A minor UX rough edge, not fixed here to keep the wizard's state model simple.
- **`get_user_capsules` is called once per profile page load with no caching**, same posture as the equivalent Moments calls — fine at this scale, not optimized further here.
- **Capsules' RLS is intentionally stricter than Drops'/Moments' on the same lock-state question** (see Security notes) — this is a deliberate improvement made *for this phase*, not backported to the older tables, so the three content types aren't perfectly consistent with each other on this one point. Worth a dedicated hardening pass across all three in a later phase.
- No real-time updates for capsule engagement either — a new like, comment, or reflection from someone else won't appear on an already-open card until it's reloaded.
- ~~Drops are not part of Memories.~~ **Resolved in Phase 9** — Drops now join Capsules and Moments in `get_memories()`/`get_memory()`; this bullet is kept for history since it was the open question Phase 9 was written to close.
- **"People" search (mentioned in the phase brief) isn't implemented.** Moments have a single `mentioned_user_id`; Capsules have no mention field at all. Rather than bolting a mention picker onto Phase 6's closed wizard, or search that only half-works across the two types, it was left out entirely this phase — a real "search by person" feature would want mentions on both types first.
- **Collections and Favorites only ever apply to memories you can see when you act on them.** If a Followers-visibility capsule you favorited later gets its visibility changed to Only Me by its owner, the favorite row still exists (harmless — the RLS on `favorites`' SELECT is your-own-rows-only), but `get_memories` would stop returning it to you going forward, since the visibility check re-runs on every read, not just at favorite time.
- **No content-based auto-classification into collections** — deliberately, since this phase has no AI. The 12 starter collections are empty shells with sensible names, not smart folders; every memory in every collection got there by an explicit "add to collection" action.
- **"Longest streak" is a plain number** (`get_memory_streak()`), not a reel like the other highlights — a genuinely different kind of computation (consecutive-day counting via a window over distinct dates), so it wasn't forced into the same `HighlightCard` shape. No dedicated UI surfaces it yet beyond what's described here; a small stat tile on the Highlights tab would be a natural, low-effort follow-up.
- **Calendar and Year view fetch a full month/year of rows to compute their client-side day/grouping logic** rather than everything being pre-aggregated server-side beyond the day-count and year-count RPCs. Fine at personal-library scale; would want a leaner approach if someone accumulates thousands of memories.
- **The moment-half of Memory Details has no reply thread** — same underlying limitation Phase 5 already documented (no reply inbox UI exists anywhere yet), just visible again here since Memories is the first place you'd naturally go looking for it.
- No real-time updates in Memories either — a newly favorited-by-someone-else count, a new tag, or a newly hidden memory in another open tab won't reflect until the view is reloaded.
- **Dark mode covers the core shell and Settings only, not the other ~90 components.** `Navbar`, `AppShell`, and everything under `components/settings/` have real `dark:` Tailwind variants; Drops, Moments, Capsules, Memories, Profile, and every other surface built in Phases 1–7 were written with light-mode literal colors (`bg-white`, `text-gray-900`, etc.) and haven't been touched. Switching to Dark today changes the frame around the app, not everything inside it — the infrastructure (`ThemeProvider`, persistence, live system-preference tracking) is complete and correct, but the visual rollout across the rest of the app is real, separate follow-up work, sized roughly in "hours across dozens of files," not something achievable inside this phase's scope.
- **"Active sessions" is a self-reported log, not a live device registry.** There's no way to see a session's IP, precisely identify which of two tabs on the same browser is "this device," or force-terminate one specific *other* device — the client SDK doesn't expose Supabase Auth's internal session store, and this app has no service-role backend to query it with. "Sign out of all devices" is real (it revokes every refresh token globally) but it's all-or-nothing, not per-device.
- **Two-factor authentication is a UI shell, not a working feature** — exactly as scoped ("implementation can be deferred"). Supabase Auth does support real TOTP enrollment via `supabase.auth.mfa`; wiring that up is a natural, contained follow-up.
- **"Download my data" is a placeholder**, also exactly as scoped. A real export would want a background job (likely a Supabase Edge Function) bundling a user's rows and storage files into a downloadable archive — more than a client-only app can do today.
- **Storage usage is computed live on every page visit** — `storage.list()` across five buckets, no caching. Fine at personal-library scale; would want caching or a denormalized running total if an account's file count grows very large.
- **Notification preferences have nothing to actually gate yet** — there's no notification-sending system in this app at all (by design, out of scope for this phase). The toggles are real and persisted so that whenever Phase 9 or later adds delivery, it has user intent to read from day one rather than defaulting everyone to "on."
- **`deleteAllContent()` loops through each item's own delete function** (reusing Phases 4/5/6's storage-aware deletes) rather than a single bulk SQL statement — correct and consistent, but means deleting a very large amount of content runs as many sequential round trips. Fine at personal-library scale; would want batching for a power user with thousands of items.
- **Password re-authentication uses `signInWithPassword`**, which — depending on Supabase project settings — could theoretically trigger the same rate limiting real sign-in attempts do if someone repeatedly enters a wrong current password. Not expected to matter in normal use, worth knowing if testing this flow many times in a row.
- **Search only ever finds unlocked/matured content, including your own.** Drops/Capsules search results (as opposed to "Users") never include something still locked, even when you're its owner searching for your own upcoming capsule by title — that's Memories' own `p_search` (own-content-only) territory, a deliberately separate tool. Not a bug; worth knowing if a search for your own in-progress capsule comes up empty.
- **Drops remain unsearchable by tag or location**, same root cause as every other Drops-vs-Capsules/Moments gap in this app: `posts` has no `tags`/`location_text` columns. Drops are only findable in search via their caption text. Adding those columns to `posts` would resolve this but felt like scope creep beyond "search," same reasoning Phase 9 used for tags/archiving.
- **"Achievements" as an Explore tab is a literal tag filter (`tag = 'Achievements'`), not a query over the badges/achievements system.** Nothing in this app auto-tags content when a badge is earned — the tab only surfaces content a user manually tagged "Achievements" themselves. A real integration between `BadgesAndAchievements` and Explore would be a reasonable, separate follow-up.
- **Collections have no visibility model, so "Search collections" only ever searches your own** — there's no concept of a public/shared collection anywhere in this app to search across users for.
- **No full-text search, no fuzzy matching, no ranking beyond exact substring `ilike`** — `search_memories()`/`search_users()` are both plain `ilike '%term%'` matches. A typo returns nothing; Postgres full-text search (`tsvector`/`tsquery`) or a trigram index (`pg_trgm`) would be the natural upgrade if search quality becomes a complaint, not attempted here to avoid a new extension dependency in this pass.
- **Trending searches has no floor and no spam protection** — a single user searching the same nonsense term 20 times in a row will make it "trending" site-wide for the next 7 days. Fine for a small/trusted user base; a real launch would want per-user rate limiting or a minimum-distinct-searcher threshold before a term counts as trending.
- **Explore's pagination is offset-based with a fixed page size (21) and a client-side "Load more" button**, not infinite scroll — infinite loading is explicitly Phase 10e's job (Feed Polish), not duplicated here ahead of time.
- **Pins have no manual reordering** — `get_pinned_memories()` orders by when something was pinned (most recent first), not a user-chosen position. A `position` column with drag-to-reorder UI would be the natural upgrade if a fixed showcase order turns out to matter; deliberately left out to avoid shipping a column with no UI to set it.
- **Activity timeline excludes reactions/likes entirely.** This was a deliberate product choice as much as a scope cut: most social apps intentionally don't surface "X liked Y" in a public activity feed (Instagram removed it years ago) since it's high-volume, low-narrative-value, and mildly privacy-sensitive (a like on a Followers-only post reveals you follow that person, even if the post itself doesn't leak). Creation and comment events tell a much better "here's what this person has been up to" story on their own.
- **Activity timeline has no pagination UI yet** — `get_activity_timeline()` supports `p_limit`/`p_offset`, but the Profile page only ever calls it with the first 20 rows and no "load more." Fine for a personal-library-scale profile; a "view all activity" page would be a reasonable follow-up.
- **Moments have no save/bookmark concept, on purpose.** They're ephemeral by design — expiring, then landing in the owner's own Memories archive — so "save this for later" doesn't map cleanly onto something that already either exists forever (once expired, for the owner) or has already vanished (for everyone else). If a demand for "bookmark someone else's Moment before it expires" ever emerges, it would need real new schema, not a fit into the existing Drop/Capsule save pattern.
- **"Share inside Memory Drop" is "Copy shareable text," not a repost/embed feature.** The original stub said "Coming soon" for a reason — building a real in-app share (reposting into your own feed, or sending to a specific person) would mean either a lightweight repost system (new feature, out of this phase's "wiring/polish" scope) or messaging (explicitly excluded from all of Phase 10). "Copy shareable text" gives you a paste-ready caption+link for your own next Drop's caption, a comment, anywhere — genuinely useful, deliberately not more than that.
- **QR codes call a third-party image API** (`api.qrserver.com`) rather than generating the code fully offline — no QR-encoding library was added to keep the dependency list unchanged. This means generating a QR code sends the shared URL to that external service and requires the user to be online; it's a public link either way (never a private/locked one, since Share only ever appears on already-unlocked content), but worth knowing before assuming everything in this app is self-contained.
- **The share preview card is a fixed, simple layout** — gradient background, one cover image, mood emoji, caption, wordmark — not a themeable/customizable template. A cover photo that fails to load (CORS, network) silently degrades to a text-only card rather than blocking the download, which is the right failure mode but means the card's appearance can vary based on network conditions in a way that's not obvious to the user.
- **Replies are one level deep, permanently, not a temporary cut.** Reddit-style infinite nesting was considered and deliberately rejected — it needs recursive queries, recursive rendering, and unbounded indentation for a benefit this app's comment volume doesn't need. If deeper threads ever become a real request, this would be a genuine redesign (recursive CTE in the RPC, a tree-rendering component), not an incremental tweak to what's here.
- **Drops'/Capsules' Like stays a single reaction type (a heart), not multi-emoji.** `moment_reactions` already proves the multi-emoji pattern works in this app, but retrofitting it onto `likes`/`capsule_likes` would mean changing what `like_count` means everywhere it's already read (Feed, Profile stats, Explore's "popular" sort, `get_memory_stats()`) — a bigger, riskier change than this polish-focused sub-phase should take on. "Top reactions" therefore only really applies to Moments today.
- **`@mention` detection is "the token after the last `@` in the whole input," not true cursor-aware parsing.** Fine for a single-line comment box where people type mentions and keep going, but editing a mention in the middle of a longer message (cursor not at the end) won't retrigger the right suggestions. A richer text-input component would fix this; not attempted here to avoid a much bigger input-handling rewrite.
- **No `comment_mentions` tracking table, and mentioning someone doesn't notify them.** This is intentional, not an oversight — there's no notification system anywhere in this app yet (explicitly excluded from all of Phase 10), so a table recording who-mentioned-whom would have no consumer. Revisit when Notifications actually ships.
- **The emoji reaction picker doesn't highlight your current reaction.** `EmojiPicker` is a shared component with its own self-contained trigger button; reusing it here (rather than forking it) means the grid it opens has no way to show "this is the one you already picked" — functionally reacting/swapping/removing all still work correctly, it's just not visually indicated inside the picker itself.
- **Reply notifications, mention notifications, and pin notifications don't exist**, same reasoning as mentions above — there's simply nowhere for any of them to go yet.
- **Offline detection only catches the "genuinely offline" case, not "server returned an error while you're online."** This was a deliberate, scoped tradeoff — the real fix is having every read hook distinguish and surface `{data, error}` instead of collapsing failures into an empty array, which is how this app has worked since Phase 4 and touches far more files than a polish phase should rewrite at once. A 500 error, a timeout, or a misconfigured RLS policy while genuinely online will still render as "nothing here" today, same as before this phase.
- **Memories' tab caching means a favorite/hide/archive action taken elsewhere won't retroactively appear in an already-visited tab within the same page visit** — e.g., favorite something from a Search result, then check the already-cached Favorites tab: it won't show up until you navigate away and back (which resets the `loadedTabs` cache) or reload the page. A cross-tab invalidation system (or just always refetching on favorite/unfavorite) would fix this; not attempted here to keep the caching change small and low-risk.
- **No true list virtualization** — `content-visibility: auto` (see above) recovers most of the *rendering-cost* benefit without unmounting off-screen items, but every fetched item is still a real DOM node and still counts toward memory/DOM-size; a list that grows into the thousands within one session would still eventually get heavy. A real windowing library (`@tanstack/react-virtual` is the natural choice) is the correct next step if that ever becomes a real problem — deliberately not added as a new dependency in this pass.
- **No page-transition library, no shared-element/hero transitions** — `framer-motion` isn't installed, and the CSS-only `page-enter` fade/slide is a page-shell-level effect, not per-element choreography (e.g. a card growing into its detail view). A richer transition system would be a real, separate scope decision (new dependency, more design work) rather than an incremental addition here.
- **No admin UI exists anywhere, on purpose** — exactly as scoped. `moderate_content()`/`get_content_reports()` are real, correctly-secured, and completely unreachable without either direct SQL access or a future admin screen that doesn't exist yet.
- **`moderation_status` isn't enforced by any existing read path yet.** `get_drops_feed`, `get_memories`, `search_memories`, `get_explore_feed`, and every other content RPC in this app still return `'hidden'`/`'removed'` content exactly as if it were `'active'`. This was a deliberate risk decision, not an oversight: wiring `and moderation_status = 'active'` into every one of those functions would mean touching 15+ already-correct, already-tested RPCs across nine migration files in a single pass with no real-world admin to exercise the change (since no account has `is_admin = true` today) — a bad risk/reward trade for a feature explicitly scoped as "architecture, no UI yet." When an actual admin UI is built, wiring this in should happen alongside it, informed by how that UI actually needs moderated content to behave (fully invisible vs. visible-with-a-banner vs. owner-still-sees-it, etc. — a real design decision, not just a WHERE clause).
- **No moderation UI also means no way to *reverse* a `moderate_content()` call except calling it again** — there's no history/log table beyond the single current `moderated_at`/`moderated_by`/`moderation_reason` snapshot on the row itself, so a second moderation action overwrites the first one's record rather than appending to a trail. Fine for "architecture," not sufficient for a real moderation team's audit needs — a proper `moderation_log` table recording every action (not just the latest) would be the natural next step.
- **The scale-test seed script's `auth.users` insert is best-effort, not guaranteed** — `auth.users` is Supabase-managed and not defined in this repo's own migrations, so its exact required columns can vary by project/Postgres version. The script's own header says to dry-run the "Fake accounts" section alone first; if it fails, the fix is adjusting that one INSERT's column list to match your specific instance, not the rest of the script.
- **Seed data is text-only for Drops/Moments/Capsules** — no photo/video/audio content, since that would require actually uploading files to Storage per row (slow, and unnecessary for a data-consistency/scale test rather than a visual/media-rendering one). If you specifically need to load-test image-heavy rendering, this script isn't that tool.
- **Dark mode is meaningfully further along after Phase 10g but still not complete app-wide.** Fixed: every shared primitive, every new component this pass added, and the core chrome of `MemoryCard` (fully), `DropCard`, `CapsuleCard`, `FeedPage`/`DropTabs`, `MemoriesPage`, `SavedPage`, `ExplorePage`, `ProfilePage`/`PublicProfilePage`/`SearchPage`. **Not yet touched**: Moments components (`MomentTray`, `MomentViewer`, `CreateMomentModal`, ...), Friends/Followers/Following pages, most of Settings' individual sub-forms, `DropActions`/`InterestActions`/`LockedDropPlaceholder`/`CommentItem`'s own literal colors (only the container chrome around them was fixed), `CapsuleLockedCard`/`CapsuleUnlockedCard`/`UnlockAnimation`, and secondary/tertiary text colors within files that only got their outermost card background and heading fixed. A genuinely exhaustive pass across all ~155 component/page files would be its own multi-day effort — this pass prioritized the highest-traffic surfaces for the best coverage-per-edit, not full coverage.
- **Accessibility got targeted additions, not a certified audit.** `aria-live` announcements exist for comment post/reply/delete and capsule unlock, but not yet for favorite/save/pin toggles (those already expose state via `aria-pressed`, which is a real but weaker signal than an explicit announcement) or for Drop/Moment unlock reveals. No automated contrast-ratio tool or real screen reader was run against this pass — the testing checklist above spells out what a human should verify instead.
- **Mobile bottom nav's Create action sheet has no animation-out** — it appears with `animate-slide-up` but disappears instantly on outside-tap/Escape/selection rather than reverse-animating closed. A minor polish gap, not a functional one.
- **Storage bucket policies were spot-checked and left alone, not hardened further** — see the Phase 10g Security notes bullet. If a future need arises to make media URLs themselves unguessable-and-time-limited (e.g. Supabase signed URLs) rather than "public bucket + hope the path isn't discovered," that's a real, separate architecture change, not something this pass attempted.
- **`get_new_creators()` has no real "new" signal beyond `created_at` ordering** — no filter for accounts that never completed onboarding, no minimum-content threshold. Good enough for a discovery tab at this app's current scale; would want tightening if spam/abandoned-signup accounts become a real problem.
- **Phase 9's "service layer" is the existing hooks, widened, not five newly-named files.** The brief asked for `memoryService`/`capsuleService`/`dropService`/`momentService`/`statsService`; rather than creating parallel files that would duplicate or shadow the already-correct, already-tested `useMemories`/`useCapsules`/`useDrops`/`useMoments` hooks, those hooks were widened in place and `getMemoryStats`/`getPublicStats` were added to `useMemories` as the stats-service equivalent. Flagging this explicitly in case literally-named service files were the intent — reorganizing later is a rename/re-export, not a rewrite.
- **Drops still don't support tags, location, or archiving (hide/restore).** Widening `get_memories()` to include Drops surfaces them everywhere Capsules/Moments appear, but `posts` has no `hidden_at`, `tags`, or `location_text` columns — `MemoryViewer` hides those controls for Drops rather than erroring, and `updateTags`/`hideMemory`/`restoreMemory` return an explicit "not available for Drops yet" error if called on one. Adding real support would mean adding those columns to `posts`, which felt like scope creep beyond "wiring."
- **"Locked Until Later" on the Memories page sorts client-side, not via a new SQL sort mode.** `get_memories()`'s `p_sort` only orders by `created_at` (newest/oldest); soonest-to-unlock ordering needed a different column (`matured_at`/`unlock_at`) entirely. Rather than adding a new sort parameter (a signature change to an already-widened, already-tested function), the page fetches a wider locked set and re-sorts the 20 rows client-side, keeping the top 5. Fine at personal-library scale; would want a real `sort: 'unlocking_soon'` mode server-side if the locked set grows large.
- **Flashbacks and Highlights were not widened to include Drops.** Phase 9's explicit scope was the Memories/Profile/Capsules/Feed wiring described in the brief — `get_flashbacks()` and the three Highlight RPCs (`best_month`/`most_viewed`/`most_reacted`) still only look at Capsules and Moments, same as Phase 7 shipped them. A reasonable next step, deliberately not bundled into this integration-focused phase.
- **`total_views` and `total_unlocks` intentionally overlap for Drops and Moments.** `get_memory_stats()` computes both from the same `drop_unlock_views`/`moment_views` rows for those two content types, since "someone saw this" and "someone unlocked/opened this" are the same event for a Drop or a Moment. Only Capsules genuinely distinguish the two (separate `capsule_views` and `capsule_unlocks` tables) — the two stat numbers will read closer together than their names might suggest for accounts that are mostly Drops/Moments.
- **`memory_items_view` is a normalized model for stats, not the thing `get_memories()`/`get_memory()` actually query.** Those two functions keep their own independently-maintained 3-way UNION (richer: full multi-image `media` jsonb, like/comment counts, favorite flags) rather than joining back from the flattened view — kept *logically* consistent with the view's status/visibility rules, not textually shared, to avoid rewriting two already-correct, already-tested functions into a riskier join-back pattern. Worth consolidating later if the two ever drift.

---

## Deployment

The project is deployed on **Vercel** and auto-builds from the `main` branch on GitHub. `vercel.json` rewrites every path to `index.html` — required for a client-side-routed SPA, otherwise any URL other than `/` 404s at the host level.

Environment variables required in Vercel (Project Settings → Environment Variables, applied to Production/Preview/Development, then redeploy):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth (sign-up, sign-in, Google OAuth, password reset, email verify) | ✅ Complete |
| 2 | Profiles (edit, avatar + cover upload, public `/u/username` page) | ✅ Complete |
| 3 | Friend system (follow/unfollow, requests, block/mute/restrict, search, suggestions) | ✅ Complete |
| 4 | Feed — Memory Drops (time-capsule redesign: unlock dates, mood, 3-tier visibility, reflections, pre/post-unlock reactions, 6 tabs) | ✅ Complete |
| 5 | Moments (12h/24h/48h ephemeral photo/video/text, 4-tier privacy, reactions, replies, seen list, owner archive) | ✅ Complete |
| 6 | Time Capsules (9-step guided creator, combinable memory types incl. in-browser voice recording, 3-tier visibility, ritual unlock + animation, Like/Comment/Reflect/Save/Share, searchable/filterable archive) | ✅ Complete |
| 7 | Memories (unified library over unlocked Capsules + expired Moments — Timeline/Calendar/Years/Collections/Favorites/Flashbacks/Highlights/Archive, 4 layouts) | ✅ Complete |
| 8 | Settings & Privacy (10 sections, real dark mode infrastructure, global accessibility overrides, self-service account deletion, blocked/muted/restricted/Close-Friends management) | ✅ Complete |
| 9 | Unified Memory Wiring (Drops joined into Memories, `memory_items_view`, real Profile/public stats, Capsules lifecycle sections, Memories preview strips, Favorites/Collections widened to Drops) | ✅ Complete |
| 10a | Search + Explore (cross-user `search_memories()`, recent/trending searches, suggestions, 11-tab Explore page) | ✅ Complete |
| 10b | Profile polish (pinned Memories/Drops, public Capsules/Moments sections, live activity timeline) | ✅ Complete |
| 10c | Bookmark experience (unified saved Drops+Capsules, folders via Collections, notes, sort/filter/search) + Share experience (generalized ShareModal, QR, downloadable preview cards) | ✅ Complete |
| 10d | Comments (unified Drop+Capsule UI, one-level replies, edit/delete, @mentions, emoji reactions, pinned) + Reactions polish (animated likes, recent likers) | ✅ Complete |
| 10e | Feed polish (offline detection + retry) + UX (page transitions, unlock reveal animation) + Performance (memoization, content-visibility, lazy Avatar, tab caching) | ✅ Complete |
| 10f | Admin-prep architecture (`is_admin`, Capsule/Moment reports, auditable `moderation_status`, admin-gated RPCs — no UI) + scale-test seed data | ✅ Complete |
| 10g | Hardening pass on a revised, stricter Phase 10 spec: pin cap 6→3, Explore rebuilt to the new section list, mobile bottom nav + Create menu, `posts` RLS lock parity, ErrorBoundary + toast system, scoped dark-mode/accessibility/performance passes, seed data updated to 1000/300/300/100 | ✅ Complete |
| 11 | Messages (DMs, conversation list) | Planned |
| 12 | Notifications | Planned |
