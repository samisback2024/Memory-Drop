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

### Feed (Phase 4 — complete)
- **Four tabs** at `/feed` — Following (chronological, your network), Discover (public accounts only), Trending (most-liked among what you can see), Recent (newest among what you can see). Switching tabs is instant on a revisit (each tab's posts + scroll position are cached) and infinite-scrolls independently.
- **Post types** — text-only, up to 10 photos (adaptive grid, lazy-loaded), or a single video (lazy-loaded — the `<video>` source isn't set until it scrolls near the viewport). Photos and video are schema-independent columns, ready for true mixed-media posts in a later phase without a migration.
- **Composer** — caption (2,200 chars, counter, curated emoji picker), photo/video upload with preview and per-item remove, a localStorage caption draft that survives closing without posting, client-side compression on every image before upload.
- **Likes, comments, saves** — optimistic UI (flips instantly, reverts on failure), duplicate-proof via DB unique constraints, denormalized counters maintained by triggers so Trending's "most likes" sort never needs a join aggregate.
- **Share** — copy link (to a real permalink at `/post/:postId`), native share sheet where supported, "Share inside Memory Drop" shown as a disabled coming-soon option; share count is a plain counter, not a per-user record.
- **Report** (6 reasons) and **Hide** (feed-local, current user only) — both write-only from the client; nobody but the reporter can see their own report.
- **Saved posts** page at `/saved`.
- Skeleton loaders, empty states per tab, pull-to-refresh (touch), and an infinite-scroll sentinel that fires ~400px before the actual bottom.

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
│   ├── SavedPostsPage.tsx       # at /saved
│   ├── PostPage.tsx             # single-post permalink, at /post/:postId
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
│   ├── feed/         # Feed, FeedTabs, PostCard, PostComposer, PostActions,
│   │                 #   LikeButton, SaveButton, CommentSection, CommentItem,
│   │                 #   ImageGrid, VideoPlayer, ShareModal, ReportModal,
│   │                 #   EmojiPicker, EmptyFeed, FeedSkeleton, InfiniteLoader
│   ├── legal/        # LegalLayout
│   └── ui/           # Button, Input, Avatar, Card, Modal, Checkbox,
│                      #   Toggle, Badge, EmptyState, ErrorState, Skeleton
├── hooks/
│   ├── useAuth.tsx               # full auth + profile context
│   ├── useSocial.ts              # follow/block/mute/restrict, search, lists
│   ├── useFeed.ts                # posts, likes, comments, saves, hide, report
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
│   └── feed.ts          # FeedPost, PostComment, FeedTab, ReportReason
└── utils/
    ├── date.ts
    └── storage.ts      # upload/delete + storage-path parsing (for cleanup on replace)

supabase/
├── phase1_auth.sql            # profiles table, RLS, triggers, username RPC
├── phase2_profiles.sql        # bio/privacy/completion, avatars bucket, public-profile RPC
├── phase2b_profile_polish.sql # website/location/pronouns/cover photo, username cooldown, covers bucket
├── phase3_social_graph.sql    # follows/blocks/mutes/restrictions, social RPCs
└── phase4_feed.sql            # posts + 6 related tables, counter triggers, feed RPCs, post-media bucket
```

---

## Storage buckets

| Bucket | Public | Size limit | Path convention | Notes |
|---|---|---|---|---|
| `avatars` | Yes (read) | 5 MB | `{user_id}/{file}` | Owner-only write via RLS on `storage.objects` |
| `covers` | Yes (read) | 8 MB | `{user_id}/{file}` | Owner-only write via RLS on `storage.objects` |
| `post-media` | Yes (read) | 50 MB | `{user_id}/{file}` | Photos and videos; owner-only write |

All three are created and policed by their respective migration files — nothing to configure by hand beyond running the SQL.

---

## Database tables (Phase 3)

| Table | Purpose | Key rules |
|---|---|---|
| `follows` | follower_id → following_id, `status` accepted/pending | No self-follow, no duplicates, status is trigger-derived from the target's privacy, not client-set |
| `user_blocks` | blocker_id → blocked_id | Blocking severs any existing follow both ways; only the blocker can see their own block list |
| `user_mutes` | muter_id → muted_id | No visible effect yet — groundwork for a future feed to filter on |
| `user_restrictions` | restrictor_id → restricted_id | Same — groundwork, no visible effect yet |

## Database tables (Phase 4)

| Table | Purpose | Key rules |
|---|---|---|
| `posts` | One row per post — caption, `post_type`, `video_url`, and denormalized like/comment/share/save counts | `video_url` only allowed when `post_type = 'video'`; counts are trigger-maintained, never written by the client |
| `post_images` | Up to 10 per post, ordered by `position` | Unique `(post_id, position)`; only the post's owner can insert/delete |
| `likes` | One row per (post, user) | Unique `(post_id, user_id)` — the DB, not the client, is what actually prevents a double-like |
| `comments` | Flat for now; `parent_comment_id` exists but is always null from Phase 4's UI | Content capped at 1,000 chars; only the author can delete |
| `saved_posts` | One row per (post, user) | Unique `(post_id, user_id)` |
| `hidden_posts` | One row per (post, user) | Feed-local — only ever filters the hider's own `get_feed` results |
| `reports` | reporter_id, post_id, reason, optional details | Unique `(post_id, reporter_id)` — one report per user per post; no SELECT policy at all, write-only from the client |

## Security notes

- **Row Level Security** on `profiles`: everyone can read/write only their own row directly. Reading *someone else's* profile goes through `get_profile_by_username`, a `SECURITY DEFINER` function that's the one place allowed to decide what a private account exposes — bio, location, and website are nulled out unless the viewer is the owner *or an accepted follower* (Phase 3 extended this from "owner only"); birthday is never returned by it at all, to anyone, ever. The function also hides the profile entirely between two users with a block relationship in either direction.
- **Username uniqueness and format** are enforced by a DB constraint and checked live via a narrow RPC (`is_username_available`), not a broad table read.
- **Username change cooldown** (30 days) is enforced by a database trigger, not just client-side — a client that skips the check still gets rejected by Postgres.
- **Age gate** (13+) is a DB check constraint, not just form validation.
- **Storage policies** key off the first path segment matching `auth.uid()`, so a signed-in user can only write inside their own folder in either bucket.
- **follows/user_blocks/user_mutes/user_restrictions RLS** only ever exposes relationships the caller is a party to (as either side of the pair). Every screen that needs to show *someone else's* profile alongside relationship state — search, suggestions, followers/following lists, mutual friends — goes through a `SECURITY DEFINER` RPC that applies the real privacy rule itself, same pattern as `get_profile_by_username`.
- **Blocked users are invisible** to each other everywhere: search, suggestions, follower/following lists, and the profile page itself. A user is never told they've been blocked, muted, or restricted — same convention as Instagram/Twitter.
- **Follow status can't be tampered with** — a client can only ever insert a bare `(follower_id, following_id)` pair; a trigger decides pending vs. accepted from the target's actual privacy setting, and a second trigger rejects any status transition except pending → accepted.
- **Post visibility follows the same rule as profiles**: your own posts, anyone public, or a private account you're an accepted follower of. `get_feed`/`get_post`/`get_saved_posts`/`get_comments` are `SECURITY DEFINER` (same reason as `get_profile_by_username` — they join `profiles` for author info) and each re-implements that exact predicate via two shared helper functions (`can_view_author_posts`, `is_blocked_either_way`), since being `SECURITY DEFINER` means they bypass `posts`' own RLS too, not just `profiles`'. The table-level RLS on `posts` remains as defense in depth for any future direct-table access path.
- **Counter triggers are `SECURITY DEFINER`** — liking, commenting on, or saving someone else's post needs to increment a counter on a row you don't own, which `posts`' own "owners only" UPDATE policy would otherwise block.
- **Hiding a post is invisible and personal** — `hidden_posts` only ever filters `get_feed` for the person who hid it; there's no way to discover a post was hidden from someone else's feed.
- **Reports are a one-way mailbox** — no SELECT policy exists on `reports` at all, so nobody (including the reporter) can read reports back through the app; reviewing them is an admin-tool concern for a later phase.

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

## Testing Phase 4

- **Create a post** — text-only, photos (try 1, try 10, try attempting an 11th), and video; confirm the composer won't let you add both media types to the same post.
- **Delete own post** — from the "..." menu on the card; confirm the storage files (check the `post-media` bucket) get cleaned up, not just the DB row.
- **Like / unlike** — click fast a few times in a row, confirm the count never goes negative and settles on the correct value after the requests land.
- **Comment / delete comment** — add one, confirm the count updates live; confirm you can't delete someone else's comment (no delete button shows, and a direct API call would be rejected by RLS).
- **Save / unsave** — confirm it shows up at `/saved`, and disappears from there immediately on unsave.
- **Hide** — confirm the post disappears from your feed but is still visible to other users.
- **Report** — submit each of the 6 reasons once; try reporting the same post twice as the same user (should be rejected — unique constraint).
- **Tabs** — Following shows only people you follow (+ you); Discover excludes private accounts; Trending sorts by likes; Recent is newest-first. Switch tabs and back — should not re-fetch or lose scroll position.
- **Infinite scroll** — with more than 10 posts visible to you, scroll to the bottom and confirm the next page loads before you hit the literal end.
- **Pull to refresh** — on a touch device (or Chrome DevTools device emulation), pull down at the top of the feed.
- **Multiple users / RLS** — as User B, confirm you can't see User A's private-account posts unless following; confirm liking/commenting/saving on a post you can't see is rejected by RLS even if you have the post's UUID.
- **Share** — copy link, open it in an incognito tab while logged out — should redirect to `/login` (see Known limitations), then load correctly once signed in.

## Known limitations

- Mute and Restrict have no visible effect anywhere yet — Phase 4's feed doesn't filter on them. The relationships are stored and toggle correctly; wiring `get_feed` to exclude muted/restricted authors is a natural next step, deliberately not done here since it wasn't part of this phase's explicit scope.
- **Shared post links require login** — `get_post` is only granted to `authenticated`, not `anon`, so `/post/:postId` redirects to `/login` for logged-out visitors even when the post itself is public. Real link-preview/logged-out sharing would need a separate, more narrowly-scoped anonymous-read path.
- Suggested friends only looks one hop out (people followed by people you follow). No engagement-based ranking — there's no engagement data yet.
- No real-time updates anywhere — a new like, comment, or follower won't appear for another open tab/user until they reload or navigate. Supabase Realtime would be the natural fit for a later pass across both the feed and the friend system.
- **Offset-based pagination**, not cursor/keyset — simpler and fine at this scale, but re-paginating after new posts arrive above the current page can occasionally skip or repeat a row. Worth revisiting if the feed needs to scale further.
- **No feed virtualization** — posts accumulate in the DOM as you scroll rather than windowing them out. Not a problem at normal session lengths; a candidate for `react-window`/`react-virtual` if very long scroll sessions become common.
- The account dropdown in `Navbar`, the kebab menu in `RelationshipMenu`, and the "..." menu in `PostCard` all implement the same open/outside-click/Escape pattern independently rather than sharing one primitive — noted as a refactor opportunity across three phases now, not done here to avoid touching working, tested code outside this phase's scope.

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
| 4 | Feed (posts, likes, comments, saves, shares, reports, 4 tabs) | ✅ Complete |
| 5 | Time Capsules (the app's actual namesake feature — create, unlock, countdown) | Planned |
| 6 | Stories | Planned |
| 7 | Messages (DMs, conversation list) | Planned |
| 8 | Notifications | Planned |
