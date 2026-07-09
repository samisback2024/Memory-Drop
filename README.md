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
│   ├── SearchPage.tsx           # at /search
│   ├── FriendsPage.tsx          # at /friends
│   ├── FriendRequestsPage.tsx   # at /friends/requests
│   ├── FollowersPage.tsx        # at /followers and /u/:username/followers
│   ├── FollowingPage.tsx        # at /following and /u/:username/following
│   ├── FeedPage.tsx             # at /feed — primary landing after login
│   ├── SavedDropsPage.tsx       # at /saved
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
│   ├── layout/       # AppShell, Navbar, PublicPageHeader
│   ├── profile/      # ProfileHeader (+ skeleton), AvatarUpload,
│   │                 #   CoverPhotoUpload, ImageCropModal, StatsRow,
│   │                 #   BadgesAndAchievements (+ skeleton), ProfileCompletionBar
│   ├── social/       # UserCard, UserList (+ skeleton), FollowButton,
│   │                 #   RelationshipMenu, FriendRequestCard, MutualFriends,
│   │                 #   SocialStats, EmptySocialState, UserSearchBar,
│   │                 #   UserSearchResults, FollowersList, FollowingList,
│   │                 #   SuggestedFriends
│   ├── feed/         # Feed, DropTabs, DropCard, DropComposer, DropActions,
│   │                 #   SaveButton, LikeButton, InterestActions, CommentSection,
│   │                 #   CommentItem, ReflectionModal, MoodPicker, VisibilityPicker,
│   │                 #   CountdownPill, LockedDropPlaceholder,
│   │                 #   ImageGrid, VideoPlayer, AudioPlayer, ShareModal, ReportModal,
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
│   │                 #   FavoriteButton, FlashbackCard, HighlightCard, MemorySearch,
│   │                 #   MemoryFilters, MemoryViewer
│   ├── settings/     # SettingsSection, SettingsCard, ToggleRow, DangerZone, SessionList,
│   │                 #   NotificationSettings, ThemeSelector, StorageUsageCard, FeedbackForm,
│   │                 #   AccountSettings, ProfileSettings, PrivacySettings, SecuritySettings,
│   │                 #   AppearanceSettings, AccessibilitySettings, StorageSettings,
│   │                 #   HelpSettings, AboutSettings
│   ├── legal/        # LegalLayout
│   └── ui/           # Button, Input, Avatar, Card, Modal, Checkbox,
│                      #   Toggle, Badge, EmptyState, ErrorState, Skeleton
├── hooks/
│   ├── useAuth.tsx               # full auth + profile context
│   ├── useSocial.ts              # follow/block/mute/restrict, search, lists
│   ├── useDrops.ts                # drops, comments, reflections, likes, interests, saves, hide, report
│   ├── useMoments.ts              # moments, views, reactions, replies, archive
│   ├── useCapsules.ts             # capsules, media, unlocks, likes, comments, reflections
│   ├── useMemories.ts             # get_memories/get_memory, calendar, years, flashbacks,
│   │                              #   highlights, collections, favorites, hide/restore/delete
│   ├── useSettings.ts             # settings, notification prefs, blocked/muted/restricted/close
│   │                              #   friends lists, sessions, account/password/email, storage usage
│   ├── useTheme.tsx               # ThemeProvider — dark mode, font size, accessibility toggles
│   ├── useUsernameAvailability.ts
│   ├── useImageUpload.ts         # shared drag-drop/crop/upload pipeline
│   ├── useInView.ts              # IntersectionObserver (video lazy-load, infinite scroll)
│   └── usePullToRefresh.ts       # touch-only pull-to-refresh
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
│   ├── memory.ts        # Memory (unified capsule+moment shape), MemoryFilters, MemoryCollection, Flashback, HighlightCandidate
│   └── settings.ts      # UserSettings, NotificationPreferences, UserSession, ManagedUser, Theme, FontSize
└── utils/
    ├── date.ts
    └── storage.ts      # upload/delete + storage-path parsing (for cleanup on replace)

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
└── phase8_settings.sql        # user_settings, notification_preferences, user_sessions, feedback_reports, delete_my_account()
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
- **Drops are not part of Memories.** The phase brief named Capsules and Moments specifically; an unlocked Drop still only lives in the Feed (My Drops tab) and `/saved`, not in `/memories`. See the interpretation note under "Database tables (Phase 7)" — worth explicitly confirming before Phase 8 if that was meant to include Drops too, since adding them later means widening `get_memories()`'s UNION, not a redesign.
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
| 9 | Messages (DMs, conversation list) | Planned |
| 10 | Notifications | Planned |
