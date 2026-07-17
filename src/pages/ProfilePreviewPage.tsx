import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Globe2, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ProfileHeader } from '../components/profile/ProfileHeader';

type PreviewAs = 'public' | 'private';

// A read-only simulation of "what does my profile look like to someone
// who doesn't orbit me" — not a second real profile. Reuses ProfileHeader
// (the exact component a stranger's view renders) with isOwnProfile
// forced false and is_private/bioHidden driven by the toggle below
// instead of your real setting, so you can preview both states without
// actually changing your account's privacy. isOwnProfile=false makes its
// StatsRow call get_public_stats(your own id) instead of get_memory_stats
// — the same visible_stats-gated numbers a stranger actually sees, not a
// guess.
export const ProfilePreviewPage: React.FC = () => {
  const { profile } = useAuth();
  const [previewAs, setPreviewAs] = useState<PreviewAs>(profile?.is_private ? 'private' : 'public');

  // On a fresh page load, useAuth's profile fetch is still async when this
  // component first mounts — the useState initializer above runs before it
  // resolves and captures a null profile, defaulting to 'public', then
  // never re-syncs once the real profile arrives, since a hook's initial
  // value only runs once. Left unfixed, the toggle can silently default to
  // "Public" regardless of the user's actual privacy setting. Runs exactly
  // once, the first time `profile` actually has data — not on every
  // profile change, so it doesn't clobber the user's in-progress toggle
  // selection if the profile object updates for an unrelated reason later.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setPreviewAs(profile.is_private ? 'private' : 'public');
  }, [profile]);

  if (!profile) return null;

  const simulatedProfile = { ...profile, is_private: previewAs === 'private' };
  const bioHidden = previewAs === 'private';

  return (
    <div className="flex flex-col gap-4">
      <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 w-fit">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to Settings
      </Link>

      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 rounded-2xl p-4 flex items-start gap-3">
        <Eye size={18} className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">This is a preview, not your real profile</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Shows exactly what someone who isn't in your Orbit sees — your account's actual privacy setting isn't changed by anything here.
          </p>
        </div>
      </div>

      <div className="flex bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-1 gap-1 w-fit">
        <button
          type="button"
          onClick={() => setPreviewAs('public')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            previewAs === 'public' ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Globe2 size={14} aria-hidden="true" /> As Public
        </button>
        <button
          type="button"
          onClick={() => setPreviewAs('private')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            previewAs === 'private' ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Lock size={14} aria-hidden="true" /> As Private
        </button>
      </div>

      <ProfileHeader profile={simulatedProfile} isOwnProfile={false} bioHidden={bioHidden} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">What the relationship button says to a stranger:</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${
            previewAs === 'private' ? 'bg-black text-white dark:bg-white dark:text-gray-900' : 'bg-gradient-to-r from-purple-600 to-blue-500 text-white'
          }`}
        >
          {previewAs === 'private' && <Lock size={12} aria-hidden="true" />}
          {previewAs === 'private' ? 'Request Orbit' : 'Orbit'}
        </span>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 px-1">
        The extra stat tiles above only show what you've opted into under Settings → Privacy → "Profile stats visibility" — that choice applies the same way here.
      </p>
    </div>
  );
};
