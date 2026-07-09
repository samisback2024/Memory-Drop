import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
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
import { SearchPage } from './pages/SearchPage';
import { FriendsPage } from './pages/FriendsPage';
import { FriendRequestsPage } from './pages/FriendRequestsPage';
import { FollowersPage } from './pages/FollowersPage';
import { FollowingPage } from './pages/FollowingPage';
import { FeedPage } from './pages/FeedPage';
import { SavedDropsPage } from './pages/SavedDropsPage';
import { DropPage } from './pages/DropPage';
import { MomentsPage } from './pages/MomentsPage';
import { MomentCreatePage } from './pages/MomentCreatePage';
import { MomentViewerPage } from './pages/MomentViewerPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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

          <Route element={<AuthProtectedRoute><AppShell /></AuthProtectedRoute>}>
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/saved" element={<SavedDropsPage />} />
            <Route path="/moments" element={<MomentsPage />} />
            <Route path="/moments/create" element={<MomentCreatePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/friends/requests" element={<FriendRequestsPage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
