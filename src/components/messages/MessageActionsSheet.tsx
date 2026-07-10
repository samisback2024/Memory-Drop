import React from 'react';
import { Reply, Forward, Copy, Pin, PinOff, Star, Edit3, Undo2, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { Message } from '../../types/message';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageActionsSheetProps {
  message: Message | null;
  isMine: boolean;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void;
  onTogglePin: () => void;
  onToggleStar: () => void;
  onEdit: () => void;
  onUnsend: () => void;
  onDeleteForMe: () => void;
}

// One bottom sheet covers reply/forward/copy/react/pin/star/edit/
// unsend/delete-for-me — "Unsend" and "Delete for everyone" are
// deliberately the same button (see phase12_messaging.sql's comment on
// why that's one capability, not two), so there's no separate,
// confusing second action for the same underlying thing.
export const MessageActionsSheet: React.FC<MessageActionsSheetProps> = ({
  message, isMine, onClose, onReply, onForward, onCopy, onReact, onTogglePin, onToggleStar, onEdit, onUnsend, onDeleteForMe,
}) => {
  if (!message) return null;
  const canEdit = isMine && message.type === 'text' && !message.is_unsent;
  const canCopy = message.type === 'text' && !message.is_unsent && !!message.content;

  const row = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={() => { onClick(); onClose(); }}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <Modal isOpen onClose={onClose} hideClose size="sm">
      <div className="flex flex-col gap-3 -m-4">
        <div className="flex items-center justify-center gap-2 px-4 pt-1">
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onReact(emoji); onClose(); }}
              className="text-2xl leading-none p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 pt-1 pb-2">
          {!message.is_unsent && row(<Reply size={17} aria-hidden="true" />, 'Reply', onReply)}
          {!message.is_unsent && row(<Forward size={17} aria-hidden="true" />, 'Forward', onForward)}
          {canCopy && row(<Copy size={17} aria-hidden="true" />, 'Copy', onCopy)}
          {row(message.is_pinned ? <PinOff size={17} aria-hidden="true" /> : <Pin size={17} aria-hidden="true" />, message.is_pinned ? 'Unpin' : 'Pin', onTogglePin)}
          {row(<Star size={17} aria-hidden="true" className={message.is_starred_by_me ? 'fill-current text-yellow-500' : ''} />, message.is_starred_by_me ? 'Unstar' : 'Star', onToggleStar)}
          {canEdit && row(<Edit3 size={17} aria-hidden="true" />, 'Edit', onEdit)}
          {isMine && !message.is_unsent && row(<Undo2 size={17} aria-hidden="true" />, 'Unsend', onUnsend, true)}
          {row(<Trash2 size={17} aria-hidden="true" />, 'Delete for me', onDeleteForMe, true)}
        </div>
      </div>
    </Modal>
  );
};
