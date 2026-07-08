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
│   └── TermsPage.tsx, PrivacyPage.tsx
├── components/
│   ├── auth/         # AuthLayout, GoogleButton, RouteGuards
│   ├── layout/        # AppShell, Navbar
│   ├── profile/       # ProfileHeader (+ skeleton), AvatarUpload,
│   │                   #   CoverPhotoUpload, ImageCropModal, StatsRow,
│   │                   #   BadgesAndAchievements (+ skeleton), ProfileCompletionBar
│   ├── legal/         # LegalLayout
│   └── ui/            # Button, Input, Avatar, Card, Modal, Checkbox,
│                       #   Toggle, Badge, EmptyState, ErrorState, Skeleton
├── hooks/
│   ├── useAuth.tsx               # full auth + profile context
│   ├── useUsernameAvailability.ts
│   └── useImageUpload.ts         # shared drag-drop/crop/upload pipeline
├── lib/
│   ├── supabase.ts    # Supabase client + isSupabaseConfigured()
│   ├── validators.ts  # every field's validation rules
│   ├── profile.ts     # completion %, years-active
│   └── image.ts        # canvas crop + compression
├── types/
│   ├── index.ts       # Profile (mirrors the real table)
│   └── auth.ts
└── utils/
    ├── date.ts
    └── storage.ts      # upload/delete + storage-path parsing (for cleanup on replace)

supabase/
├── phase1_auth.sql            # profiles table, RLS, triggers, username RPC
├── phase2_profiles.sql        # bio/privacy/completion, avatars bucket, public-profile RPC
└── phase2b_profile_polish.sql # website/location/pronouns/cover photo, username cooldown, covers bucket
```

---

## Storage buckets

| Bucket | Public | Size limit | Path convention | Notes |
|---|---|---|---|---|
| `avatars` | Yes (read) | 5 MB | `{user_id}/{file}` | Owner-only write via RLS on `storage.objects` |
| `covers` | Yes (read) | 8 MB | `{user_id}/{file}` | Owner-only write via RLS on `storage.objects` |

Both are created and policed by their respective migration files — nothing to configure by hand beyond running the SQL.

---

## Security notes

- **Row Level Security** on `profiles`: everyone can read/write only their own row directly. Reading *someone else's* profile goes through `get_profile_by_username`, a `SECURITY DEFINER` function that's the one place allowed to decide what a private account exposes — bio, location, and website are nulled out for private accounts when the viewer isn't the owner; birthday is never returned by it at all, to anyone, ever.
- **Username uniqueness and format** are enforced by a DB constraint and checked live via a narrow RPC (`is_username_available`), not a broad table read.
- **Username change cooldown** (30 days) is enforced by a database trigger, not just client-side — a client that skips the check still gets rejected by Postgres.
- **Age gate** (13+) is a DB check constraint, not just form validation.
- **Storage policies** key off the first path segment matching `auth.uid()`, so a signed-in user can only write inside their own folder in either bucket.

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
| 3 | Friend system (follow/unfollow, requests, followers/following lists) | Planned |
| 4 | Feed + Capsules (create, unlock, discover, trending) | Planned |
| 5 | Stories | Planned |
| 6 | Messages (DMs, conversation list) | Planned |
| 7 | Notifications | Planned |
