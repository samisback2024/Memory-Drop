import React, { useEffect, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useSocial } from '../../hooks/useSocial';
import { Button } from '../ui/Button';

interface FollowButtonProps {
  targetId: string;
  isPrivate: boolean;
  isFollowing: boolean;
  isPending: boolean;
  isFollowedBy: boolean;
  iBlocked?: boolean;
  blockedMe?: boolean;
  onChange?: (next: { isFollowing?: boolean; isPending?: boolean; iBlocked?: boolean }) => void;
  size?: 'sm' | 'md';
}

// A controlled component: the parent (profile page, or a social list)
// fetched the relationship once via get_relationship or one of the list
// RPCs, and passes it in as flat booleans. This button only manages
// request-in-flight + hover state locally, and applies an optimistic
// update on success — it never fetches on its own, so a list of 20 of
// these doesn't mean 20 relationship queries.
export const FollowButton: React.FC<FollowButtonProps> = ({
  targetId, isPrivate, isFollowing, isPending, isFollowedBy, iBlocked = false, blockedMe = false,
  onChange, size = 'md',
}) => {
  const { followUser, unfollowUser, cancelRequest, unblockUser } = useSocial();
  const [following, setFollowing] = useState(isFollowing);
  const [pending, setPending] = useState(isPending);
  const [blocked, setBlocked] = useState(iBlocked);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => { setFollowing(isFollowing); }, [isFollowing]);
  useEffect(() => { setPending(isPending); }, [isPending]);
  useEffect(() => { setBlocked(iBlocked); }, [iBlocked]);

  if (blockedMe) {
    return <Button variant="secondary" size={size} disabled>Unavailable</Button>;
  }

  const handleClick = async () => {
    setLoading(true);
    if (blocked) {
      const { error } = await unblockUser(targetId);
      if (!error) { setBlocked(false); onChange?.({ iBlocked: false }); }
    } else if (following) {
      const { error } = await unfollowUser(targetId);
      if (!error) { setFollowing(false); onChange?.({ isFollowing: false }); }
    } else if (pending) {
      const { error } = await cancelRequest(targetId);
      if (!error) { setPending(false); onChange?.({ isPending: false }); }
    } else {
      const { error, status } = await followUser(targetId);
      if (!error) {
        setFollowing(status === 'accepted');
        setPending(status === 'pending');
        onChange?.({ isFollowing: status === 'accepted', isPending: status === 'pending' });
      }
    }
    setLoading(false);
  };

  if (blocked) {
    return (
      <Button variant="outline" size={size} onClick={handleClick} loading={loading} className="text-red-600 border-red-200 hover:bg-red-50">
        Unblock
      </Button>
    );
  }

  if (following) {
    return (
      <Button
        variant={hovering ? 'outline' : 'secondary'}
        size={size}
        onClick={handleClick}
        loading={loading}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={hovering ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : hovering ? 'Unfollow' : 'Following'}
      </Button>
    );
  }

  if (pending) {
    return (
      <Button variant="outline" size={size} onClick={handleClick} loading={loading}>
        Requested
      </Button>
    );
  }

  return (
    <Button variant="primary" size={size} onClick={handleClick} loading={loading}>
      {isPrivate && <Lock size={12} aria-hidden="true" />}
      {isFollowedBy ? 'Follow Back' : 'Follow'}
    </Button>
  );
};
