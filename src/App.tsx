import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { usePresence } from './hooks/usePresence';
import { AppShell } from './components/layout/AppShell';
import { AuthProtectedRoute, PublicOnlyRoute, RootRedirect } from './components/auth/RouteGuards';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { CompleteProfilePage } from './pages/CompleteProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { FriendsPage } from './pages/FriendsPage';
import { FriendRequestsPage } from './pages/FriendRequestsPage';
import { FollowersPage } from './pages/FollowersPage';
import { FollowingPage } from './pages/FollowingPage';
import { FeedPage } from './pages/FeedPage';
import { SavedPage } from './pages/SavedPage';
import { DropPage } from './pages/DropPage';
import { MomentsPage } from './pages/MomentsPage';
import { MomentCreatePage } from './pages/MomentCreatePage';
import { MomentViewerPage } from './pages/MomentViewerPage';
import { CapsulesPage } from './pages/CapsulesPage';
import { CapsuleCreatePage } from './pages/CapsuleCreatePage';
import { CapsuleViewerPage } from './pages/CapsuleViewerPage';
import { MemoryDetailPage } from './pages/MemoryDetailPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

// Route-level code splitting for the heavier, less-frequently-first-
// loaded pages (chips away at the >500kB bundle warning) — Feed/
// Capsules/Profile stay eager since they're the most common landing
// destinations right after login and shouldn't show a loading flash.
const SearchPage = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then(m => ({ default: m.ExplorePage })));
const MemoriesPage = lazy(() => import('./pages/MemoriesPage').then(m => ({ default: m.MemoriesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
const MessageRequestsPage = lazy(() => import('./pages/MessageRequestsPage').then(m => ({ default: m.MessageRequestsPage })));
// The heaviest single addition in this phase (bubbles, composer, media
// viewer, voice recorder, forward/reactions/link-preview UI all pull in
// together) — lazy, same reasoning as the Phase 10g bundle-size pass,
// even though it sits outside AppShell like DropPage/MomentViewerPage.
const ConversationPage = lazy(() => import('./pages/ConversationPage').then(m => ({ default: m.ConversationPage })));

const RouteLoadingFallback = () => (
  <div className="flex flex-col gap-3 py-6" aria-busy="true" aria-label="Loading page">
    {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
  </div>
);

// Mounted once, inside AuthProvider (Presence needs the signed-in user's
// id) but outside any one route — Presence should track "online" for
// the whole session regardless of which page is open, including
// /messages/:conversationId, which renders outside AppShell entirely
// (own chrome, like /drop/:dropId) and would otherwise unmount presence
// tracking the moment a chat screen opened.
const PresenceMount = () => { usePresence(); return null; };

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <ToastProvider>
          <PresenceMount />
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route index element={<RootRedirect />} />

            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/complete-profile" element={<AuthProtectedRoute><CompleteProfilePage /></AuthProtectedRoute>} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* Public — reachable logged out, own chrome (PublicPageHeader) */}
            <Route path="/u/:username" element={<PublicProfilePage />} />
            <Route path="/u/:username/followers" element={<FollowersPage />} />
            <Route path="/u/:username/following" element={<FollowingPage />} />

            {/* Same two pages, resolved to the signed-in user's own username */}
            <Route path="/followers" element={<AuthProtectedRoute><FollowersPage /></AuthProtectedRoute>} />
            <Route path="/following" element={<AuthProtectedRoute><FollowingPage /></AuthProtectedRoute>} />

            {/* Own chrome (PublicPageHeader) but requires login — get_drop is
                only granted to `authenticated`, not `anon` */}
            <Route path="/drop/:dropId" element={<AuthProtectedRoute><DropPage /></AuthProtectedRoute>} />

            {/* Full-screen overlay, no navbar chrome either way — same
                reasoning as /drop/:dropId, get_moment is authenticated-only */}
            <Route path="/moments/:momentId" element={<AuthProtectedRoute><MomentViewerPage /></AuthProtectedRoute>} />

            {/* The chat screen — same "own full-bleed chrome, outside
                AppShell" treatment, so it can behave like a real mobile
                chat screen (its own header, no double nav bar). */}
            <Route path="/messages/:conversationId" element={<AuthProtectedRoute><ConversationPage /></AuthProtectedRoute>} />

            <Route element={<AuthProtectedRoute><AppShell /></AuthProtectedRoute>}>
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="/moments" element={<MomentsPage />} />
              <Route path="/moments/create" element={<MomentCreatePage />} />
              <Route path="/capsules" element={<CapsulesPage />} />
              <Route path="/capsules/create" element={<CapsuleCreatePage />} />
              <Route path="/capsules/:capsuleId" element={<CapsuleViewerPage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/memories/:memoryType/:memoryId" element={<MemoryDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/:section" element={<SettingsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/edit" element={<EditProfilePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/requests" element={<MessageRequestsPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/friends/requests" element={<FriendRequestsPage />} />
            </Route>

            <Route path="*" element={<RootRedirect />} />
          </Routes>
          </Suspense>
        </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
