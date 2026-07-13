-- Phase 14l — first-time onboarding tour.
--
-- Just one new column — the actual tour is a client-side slide carousel
-- (src/pages/OnboardingPage.tsx). onboarding_completed_at is set once,
-- either by finishing every slide or by tapping Skip, and gates routing
-- the same way profile_completed already does for /complete-profile:
-- see src/components/auth/RouteGuards.tsx.

alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

-- Backfill: only genuinely new signups (created after this migration runs)
-- should see the tour. Without this, every existing profile would also
-- read as needsOnboarding on their next login, since the column starts
-- out null for everyone.
update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null;
