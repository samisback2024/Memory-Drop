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
- Google OAuth (one-tap)
- Forgot password → email reset link
- Email verification with resend + cooldown
- Complete-profile flow for OAuth users (username + date of birth)
- Demo mode — full app tour with no account required
- All routes protected: auth-only, public-only, and smart root redirect
- Age gate (13+) enforced on both client and database

### Profile (Phase 2 — in progress)
- View and edit display name, username, avatar
- Avatar upload to Supabase Storage
- Profile completion progress bar
- Stats row (capsules · followers · following · streak)
- Badges & achievements panel
- Public profile page at `/@username`
- Privacy toggle (public / private)

---

## Getting started

```bash
git clone https://github.com/samisback2024/Memory-Drop.git
cd Memory-Drop
npm install
npm run dev        # → http://localhost:5173
```

Hit **Try Demo Mode** on the login screen to explore without any account.

### Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your **Project URL** and **anon public key** from Project Settings → API
3. Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Run the database migrations in order via the Supabase SQL editor:
   - `supabase/phase1_auth.sql` — profiles table, RLS, triggers
   - `supabase/phase2_profiles.sql` — avatar storage bucket, extended profile columns

5. Restart the dev server.

### Google OAuth setup

1. Supabase dashboard → Authentication → Providers → Google → enable, add Client ID & Secret
2. Authentication → URL Configuration:
   - **Site URL:** `https://your-vercel-domain.vercel.app`
   - **Redirect URLs:** `https://your-vercel-domain.vercel.app/**` and `http://localhost:5173/**`

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
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── VerifyEmailPage.tsx
│   ├── CompleteProfilePage.tsx
│   ├── DashboardPage.tsx
│   ├── ProfilePage.tsx
│   ├── EditProfilePage.tsx
│   ├── PublicProfilePage.tsx
│   ├── TermsPage.tsx
│   └── PrivacyPage.tsx
├── components/
│   ├── auth/         # AuthLayout, GoogleButton, RouteGuards
│   ├── layout/       # AppShell, Navbar
│   ├── profile/      # ProfileHeader, AvatarUpload, StatsRow,
│   │                 #   BadgesAndAchievements, ProfileCompletionBar
│   ├── legal/        # LegalLayout
│   └── ui/           # Button, Input, Avatar, Card, Modal,
│                     #   Checkbox, Toggle, EmptyState
├── hooks/
│   └── useAuth.tsx   # full auth context (sign-in, sign-up, OAuth,
│                     #   password reset, email verify, demo mode)
├── lib/
│   ├── supabase.ts   # Supabase client + isSupabaseConfigured()
│   ├── validators.ts # email, password, username, date-of-birth rules
│   └── profile.ts    # profile helpers
├── types/
│   ├── index.ts      # Profile view-model
│   └── auth.ts       # ProfileRow, RegisterFormValues, AuthResult
└── utils/
    ├── date.ts
    └── storage.ts

supabase/
├── phase1_auth.sql   # profiles table, RLS, triggers, username RPC
└── phase2_profiles.sql
```

---

## Deployment

The project is deployed on **Vercel** and auto-builds from the `main` branch on GitHub.

To deploy manually:

```bash
vercel --prod
```

Environment variables required in Vercel:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth (sign-up, sign-in, Google OAuth, password reset, email verify) | ✅ Complete |
| 2 | Profiles (edit, avatar upload, public `/@username` page) | 🔄 In progress |
| 3 | Feed + Capsules (create, unlock, discover, trending) | Planned |
| 4 | Memories (personal timeline, countdown) | Planned |
| 5 | Messages (DMs, conversation list) | Planned |
| 6 | Social (follow, friends, stories) | Planned |
  lib/            # supabase client, demo-data
  types/          # TypeScript interfaces
  utils/          # date helpers, storage helpers
```
