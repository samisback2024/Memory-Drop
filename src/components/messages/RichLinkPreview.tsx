import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, User as UserIcon, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDrops } from '../../hooks/useDrops';
import { useCapsules } from '../../hooks/useCapsules';
import { Avatar } from '../ui/Avatar';
import type { InternalLink } from '../../types/message';

interface RichLinkPreviewProps {
  link: InternalLink;
}

interface PreviewData {
  href: string;
  title: string;
  subtitle: string;
  photoUrl: string | null;
  locked: boolean;
}

// Client-side only — no new backend for "message links." Reuses the
// exact same RPCs the destination pages already call (get_drop/
// get_capsule/get_profile_by_username), so a preview can never show
// something the viewer isn't already allowed to see: if the RPC returns
// null (private, blocked, not yours to view), no preview card renders —
// the raw link text stays as plain, unlinked text instead of a broken
// or misleadingly-styled card.
export const RichLinkPreview: React.FC<RichLinkPreviewProps> = ({ link }) => {
  const { getDrop } = useDrops();
  const { getCapsule } = useCapsules();
  const [preview, setPreview] = useState<PreviewData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (link.kind === 'drop') {
        const drop = await getDrop(link.id);
        if (cancelled) return;
        if (!drop) { setPreview(null); return; }
        setPreview({
          href: `/drop/${drop.id}`,
          title: drop.display_name || drop.username,
          subtitle: drop.is_unlocked ? (drop.caption || 'A memory drop') : 'Locked until it unlocks',
          photoUrl: drop.profile_photo_url,
          locked: !drop.is_unlocked,
        });
      } else if (link.kind === 'capsule') {
        const capsule = await getCapsule(link.id);
        if (cancelled) return;
        if (!capsule) { setPreview(null); return; }
        setPreview({
          href: `/capsules/${capsule.id}`,
          title: capsule.title || 'A time capsule',
          subtitle: capsule.is_unlocked ? (capsule.display_name || capsule.username) : 'Sealed until it unlocks',
          photoUrl: capsule.profile_photo_url,
          locked: !capsule.is_unlocked,
        });
      } else {
        const { data } = await supabase.rpc('get_profile_by_username', { p_username: link.id });
        const row = Array.isArray(data) ? data[0] : data;
        if (cancelled) return;
        if (!row) { setPreview(null); return; }
        setPreview({
          href: `/u/${row.username}`,
          title: row.display_name || row.username,
          subtitle: `@${row.username}`,
          photoUrl: row.profile_photo_url,
          locked: false,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [link, getDrop, getCapsule]);

  if (preview === null) return null;
  if (preview === undefined) {
    return <div className="h-14 w-56 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden="true" />;
  }

  const Icon = link.kind === 'profile' ? UserIcon : Clock;

  return (
    <Link
      to={preview.href}
      className="flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors max-w-[240px]"
    >
      {link.kind === 'profile' ? (
        <Avatar src={preview.photoUrl} name={preview.title} size="md" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
          {preview.locked ? <Lock size={16} className="text-white" aria-hidden="true" /> : <Icon size={16} className="text-white" aria-hidden="true" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{preview.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{preview.subtitle}</p>
      </div>
    </Link>
  );
};
