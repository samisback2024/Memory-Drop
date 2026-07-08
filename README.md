# Memory Drop

> **Capture today. Unlock tomorrow.**

Memory Drop is a time-capsule social app. Write a message, attach photos or audio, set a future unlock date, and share it with the world — or keep it just for yourself. When the date arrives, your capsule opens.

---

## What it looks like

### Auth screen
A full-screen purple-to-blue gradient with the Memory Drop logo. Supports email/password sign-in, sign-up, and Google OAuth. A **Try Demo Mode** button lets you explore the entire app instantly without an account.

### Feed (`/feed`)
- A personalized greeting banner ("Good morning, Alex 👋") with a count of your unlocked memories
- A horizontal **Stories Row** — circular avatars for recent stories from people you follow (expire in 12–48 hours)
- A **search bar** to filter by title, author, or tag
- Four tabs: **Discover · Trending · Recent · Friends**
- Scrollable capsule cards showing author avatar, title, lock/unlock status, tags, media previews, and time remaining

### Create (`/create`)
- Title field (100 char limit)
- Message/note textarea (2 000 chars) with an **AI Suggest** button that injects writing prompts
- Media upload for photos, videos, and audio
- Future-only date picker for the unlock date
- Visibility picker: Public / Friends / Only Me / Specific People
- Tag input (up to 10 tags, auto-slugified) and optional location field

### Memories (`/memories`)
- Your personal timeline of unlocked capsules grouped by year
- Unlocked/locked counters at the top
- Locked upcoming capsules listed separately with a countdown

### Messages (`/messages`)
- Two-panel layout on desktop: conversation list on the left, chat on the right
- Collapsible to a single panel on mobile with a back button
- Conversation search, unread count badges, last-message preview

### Profile (`/profile`)
- Cover gradient with editable avatar (picks from 10 DiceBear-generated options)
- Follower / following counts, active streak, and achievement badges
- Your capsules list with quick access to create more
- Sign-out button

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript 6 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Backend / Auth | Supabase (PostgreSQL, Auth, Storage) |
| Build | Vite 8 |

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Click **Try Demo Mode** on the auth page to explore without a Supabase account. Everything (create, message, follow) works against local state in demo mode.

### With Supabase

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then restart the dev server.

```bash
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

---

## Project structure

```
src/
  pages/          # AuthPage, FeedPage, CreatePage, MemoriesPage, MessagesPage, ProfilePage
  components/
    layout/       # Navbar (desktop), BottomTabBar (mobile), Layout
    feed/         # CapsuleCard, StoriesRow
    create/       # MediaUpload
    messages/     # ConversationList, ChatWindow
    profile/      # ProfileHeader, AvatarGenerator
    friends/      # FriendSearch
    ui/           # Button, Card, Input, Modal, Avatar, Badge
  hooks/          # useAuth, useCapsules, useMessages, useFriends, useStories
  lib/            # supabase client, demo-data
  types/          # TypeScript interfaces
  utils/          # date helpers, storage helpers
```
