import React, { useEffect, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useSocial } from '../../hooks/useSocial';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';

interface OrbitButtonProps {
  targetId: string;
  isPrivate: boolean;
  isInOrbit: boolean;
  isPending: boolean;
  isOrbitingYou: boolean;
  iBlocked?: boolean;
  blockedMe?: boolean;
  onChange?: (next: { isInOrbit?: boolean; isPending?: boolean; iBlocked?: boolean }) => void;
  size?: 'sm' | 'md';
}

// A controlled component: the parent (profile page, or a social list)
// fetched the relationship once via get_relationship or one of the list
// RPCs, and passes it in as flat booleans. This button only manages
// request-in-flight + hover state locally, and applies an optimistic
// update on success — it never fetches on its own, so a list of 20 of
// these doesn't mean 20 relationship queries.
export const OrbitButton: React.FC<OrbitButtonProps> = ({
  targetId, isPrivate, isInOrbit, isPending, isOrbitingYou, iBlocked = false, blockedMe = false,
  onChange, size = 'md',
}) => {
  const { orbitUser, leaveOrbit, cancelRequest, unblockUser } = useSocial();
  const { showToast } = useToast();
  const [inOrbit, setInOrbit] = useState(isInOrbit);
  const [pending, setPending] = useState(isPending);
  const [blocked, setBlocked] = useState(iBlocked);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => { setInOrbit(isInOrbit); }, [isInOrbit]);
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
      else showToast(error, 'error');
    } else if (inOrbit) {
      const { error } = await leaveOrbit(targetId);
      if (!error) { setInOrbit(false); onChange?.({ isInOrbit: false }); }
      else showToast(error, 'error');
    } else if (pending) {
      const { error } = await cancelRequest(targetId);
      if (!error) { setPending(false); onChange?.({ isPending: false }); showToast('Orbit request cancelled.'); }
      else showToast(error, 'error');
    } else {
      const { error, status } = await orbitUser(targetId);
      if (!error) {
        setInOrbit(status === 'accepted');
        setPending(status === 'pending');
        onChange?.({ isInOrbit: status === 'accepted', isPending: status === 'pending' });
        if (status === 'pending') showToast('Orbit request sent — they need to accept it before you see their posts.');
      } else {
        showToast(error, 'error');
      }
    }
    setLoading(false);
  };

  if (blocked) {
    return (
      <Button variant="outline" size={size} onClick={handleClick} loading={loading} className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30">
        Unblock
      </Button>
    );
  }

  if (inOrbit) {
    return (
      <Button
        variant={hovering ? 'outline' : 'secondary'}
        size={size}
        onClick={handleClick}
        loading={loading}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={hovering ? 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30' : ''}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : hovering ? 'Leave Orbit' : 'In Orbit ✓'}
      </Button>
    );
  }

  if (pending) {
    return (
      <Button variant="outline" size={size} onClick={handleClick} loading={loading}>
        Orbit Requested
      </Button>
    );
  }

  return (
    <Button variant="primary" size={size} onClick={handleClick} loading={loading}>
      {isPrivate && <Lock size={12} aria-hidden="true" />}
      {isPrivate ? 'Request Orbit' : isOrbitingYou ? 'Orbit Back' : 'Orbit'}
    </Button>
  );
};
