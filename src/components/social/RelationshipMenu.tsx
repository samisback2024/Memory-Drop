import React, { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal, UserMinus, VolumeX, Volume2, ShieldOff, Shield, Ban, ShieldCheck } from 'lucide-react';
import { useSocial } from '../../hooks/useSocial';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';

interface RelationshipMenuProps {
  targetId: string;
  isMuted: boolean;
  isRestricted: boolean;
  isBlocked: boolean;
  showRemoveFollower?: boolean;
  onRemoveFollower?: () => void;
  onChange?: (next: { isMuted?: boolean; isRestricted?: boolean; isBlocked?: boolean }) => void;
}

// A self-contained kebab menu — Navbar's account dropdown uses the same
// open/outside-click/Escape pattern but isn't extracted into a shared
// primitive yet; noted as a follow-up rather than risking a refactor of
// already-working, already-tested nav code in the same change as this.
export const RelationshipMenu: React.FC<RelationshipMenuProps> = ({
  targetId, isMuted, isRestricted, isBlocked, showRemoveFollower = false, onRemoveFollower, onChange,
}) => {
  const { muteUser, unmuteUser, restrictUser, unrestrictUser, blockUser, unblockUser } = useSocial();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const [restricted, setRestricted] = useState(isRestricted);
  const [blocked, setBlocked] = useState(isBlocked);
  const closeMenu = useCallback(() => setOpen(false), []);
  const ref = useDismissableMenu<HTMLDivElement>(open, closeMenu);

  useEffect(() => { setMuted(isMuted); }, [isMuted]);
  useEffect(() => { setRestricted(isRestricted); }, [isRestricted]);
  useEffect(() => { setBlocked(isBlocked); }, [isBlocked]);

  const toggleMute = async () => {
    setOpen(false);
    const { error } = muted ? await unmuteUser(targetId) : await muteUser(targetId);
    if (!error) { setMuted(!muted); onChange?.({ isMuted: !muted }); }
  };

  const toggleRestrict = async () => {
    setOpen(false);
    const { error } = restricted ? await unrestrictUser(targetId) : await restrictUser(targetId);
    if (!error) { setRestricted(!restricted); onChange?.({ isRestricted: !restricted }); }
  };

  const toggleBlock = async () => {
    setOpen(false);
    const { error } = blocked ? await unblockUser(targetId) : await blockUser(targetId);
    if (!error) { setBlocked(!blocked); onChange?.({ isBlocked: !blocked }); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 w-52 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-fade-in">
          {showRemoveFollower && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onRemoveFollower?.(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <UserMinus size={15} aria-hidden="true" /> Remove follower
            </button>
          )}
          <button role="menuitem" onClick={toggleMute} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {muted ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button role="menuitem" onClick={toggleRestrict} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {restricted ? <ShieldCheck size={15} aria-hidden="true" /> : <ShieldOff size={15} aria-hidden="true" />}
            {restricted ? 'Unrestrict' : 'Restrict'}
          </button>
          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
          <button role="menuitem" onClick={toggleBlock} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            {blocked ? <Shield size={15} aria-hidden="true" /> : <Ban size={15} aria-hidden="true" />}
            {blocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      )}
    </div>
  );
};
