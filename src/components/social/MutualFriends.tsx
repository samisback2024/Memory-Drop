import React, { useEffect, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { Avatar } from '../ui/Avatar';
import type { SocialUser } from '../../types/social';

interface MutualFriendsProps {
  targetId: string;
}

// Fetches its own data (count + up to 3 previews) rather than taking props,
// so any list or profile can drop in <MutualFriends targetId={...} /> without
// the parent having to know about get_mutual_friends at all.
export const MutualFriends: React.FC<MutualFriendsProps> = ({ targetId }) => {
  const { getMutualFriendsCount, getMutualFriends } = useSocial();
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<SocialUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMutualFriendsCount(targetId), getMutualFriends(targetId, 3)]).then(([c, users]) => {
      if (cancelled) return;
      setCount(c);
      setPreview(users);
    });
    return () => { cancelled = true; };
  }, [targetId, getMutualFriendsCount, getMutualFriends]);

  if (count === 0) return null;

  const names = preview.map(u => u.display_name || u.username).join(', ');

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex -space-x-1.5">
        {preview.map(u => (
          <Avatar
            key={u.id}
            src={u.profile_photo_url}
            name={u.display_name || u.username}
            size="xs"
            className="border-2 border-white"
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">
        {count} mutual friend{count === 1 ? '' : 's'}{names ? ` · ${names}` : ''}
      </p>
    </div>
  );
};
