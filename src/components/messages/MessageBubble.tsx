import React, { useState } from 'react';
import { Check, CheckCheck, Pin, Star, FileText, Download } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { RichLinkPreview } from './RichLinkPreview';
import { LocationCard } from './LocationCard';
import { MediaViewer, type MediaViewerItem } from './MediaViewer';
import { findInternalLink, type LocationMetadata, type Message, type StickerMetadata } from '../../types/message';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  otherName: string;
  otherPhotoUrl: string | null;
  onLongPress: () => void;
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

const linkify = (text: string): React.ReactNode[] => {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    URL_RE.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{part}</a>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
};

const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Bubble layout with consecutive-message grouping (showAvatar/
// showSenderName are computed by the parent, ConversationPage, by
// comparing neighboring messages — the same responsibility split
// MemoryCard's variants already use elsewhere in this app: the card
// itself renders, the parent decides layout context). A long
// press/right-click opens MessageActionsSheet (owned by the parent too,
// since only one can be open across the whole message list at a time).
const MessageBubbleImpl: React.FC<MessageBubbleProps> = ({
  message: m, isMine, showAvatar, showSenderName, otherName, otherPhotoUrl, onLongPress,
}) => {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => { pressTimer.current = setTimeout(onLongPress, 450); };
  const endPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const bubbleAlign = isMine ? 'items-end self-end' : 'items-start self-start';
  const bubbleColor = isMine
    ? 'bg-gradient-to-br from-purple-600 to-blue-500 text-white'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100';

  const mediaItems: MediaViewerItem[] = m.attachments
    .filter(a => a.mime_type?.startsWith('image/') || a.mime_type?.startsWith('video/'))
    .map(a => ({ url: a.url, type: a.mime_type?.startsWith('video/') ? 'video' : (m.type === 'gif' ? 'gif' : 'image') }));

  const reactionCounts = m.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const renderContent = () => {
    if (m.is_unsent) {
      return <p className="text-sm italic opacity-70">{isMine ? 'You unsent a message.' : `${otherName} unsent a message.`}</p>;
    }

    switch (m.type) {
      case 'sticker': {
        const meta = m.metadata as unknown as StickerMetadata;
        return <span className="text-6xl leading-none">{meta.emoji || '🎉'}</span>;
      }
      case 'location':
        return <LocationCard location={m.metadata as unknown as LocationMetadata} />;
      case 'image':
      case 'gif':
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {m.attachments.map((a, i) => (
              <button key={a.id} type="button" onClick={() => setViewerIndex(i)} className="block">
                <img src={a.thumbnail_url || a.url} alt={`Photo from ${isMine ? 'you' : otherName}`} loading="lazy" className="rounded-xl max-h-64 object-cover" />
              </button>
            ))}
            {m.content && <p className="text-sm w-full mt-1">{linkify(m.content)}</p>}
          </div>
        );
      case 'video':
        return (
          <div className="max-w-[240px]">
            {m.attachments.map((a, i) => (
              <button key={a.id} type="button" onClick={() => setViewerIndex(i)} className="relative block rounded-xl overflow-hidden">
                <video src={a.url} className="max-h-64 w-full" preload="metadata" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">▶</span>
                </span>
              </button>
            ))}
            {m.content && <p className="text-sm mt-1">{linkify(m.content)}</p>}
          </div>
        );
      case 'audio': {
        const a = m.attachments[0];
        return (
          <div className="flex items-center gap-2 min-w-[180px]">
            <audio src={a?.url} controls preload="metadata" className="h-9 max-w-[200px]" />
            <span className="text-xs opacity-70 flex-shrink-0">{formatDuration(a?.duration_seconds ?? null)}</span>
          </div>
        );
      }
      case 'file': {
        const a = m.attachments[0];
        return (
          <a href={a?.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 min-w-[180px]">
            <FileText size={22} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-sm">{m.content || 'File'}</span>
            <Download size={15} className="flex-shrink-0" aria-hidden="true" />
          </a>
        );
      }
      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{linkify(m.content || '')}</p>;
    }
  };

  const internalLink = m.type === 'text' && !m.is_unsent && m.content ? findInternalLink(m.content) : null;
  const isBareBubble = m.type === 'sticker';

  return (
    <div className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[70%] ${bubbleAlign}`}>
      {m.reply_to_message_id && (
        <div className={`text-xs px-3 py-1.5 rounded-xl border-l-2 border-purple-400 bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 max-w-full truncate ${isMine ? 'self-end' : 'self-start'}`}>
          <span className="font-medium">{m.reply_to_sender_name || 'Someone'}</span>: {m.reply_to_content || 'Attachment'}
        </div>
      )}

      <div className="flex items-end gap-2">
        {!isMine && (
          <div className="w-7 flex-shrink-0">
            {showAvatar && <Avatar src={otherPhotoUrl} name={otherName} size="xs" />}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {showSenderName && !isMine && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">{otherName}</span>
          )}
          <div
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onContextMenu={e => { e.preventDefault(); onLongPress(); }}
            className={[
              'relative select-none',
              isBareBubble ? '' : `px-3.5 py-2 rounded-2xl ${bubbleColor}`,
              isMine ? 'rounded-br-sm' : 'rounded-bl-sm',
            ].join(' ')}
          >
            {m.is_pinned && (
              <Pin size={10} className={`absolute -top-1.5 -right-1.5 ${isMine ? 'text-purple-300' : 'text-gray-400'}`} aria-label="Pinned" />
            )}
            {renderContent()}
            {m.is_edited && !m.is_unsent && (
              <span className="text-[10px] opacity-60 ml-1">(edited)</span>
            )}
          </div>

          {internalLink && <RichLinkPreview link={internalLink} />}

          {Object.keys(reactionCounts).length > 0 && (
            <div className={`flex gap-1 ${isMine ? 'self-end' : 'self-start'}`}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span key={emoji} className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-1.5 py-0.5 shadow-sm">
                  {emoji}{count > 1 ? ` ${count}` : ''}
                </span>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 px-1 ${isMine ? 'self-end' : 'self-start'}`}>
            {m.is_starred_by_me && <Star size={10} className="fill-current text-yellow-500" aria-label="Starred" />}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatClock(m.created_at)}</span>
            {isMine && !m.is_unsent && (
              m.read_at ? <CheckCheck size={13} className="text-purple-500" aria-label="Seen" />
                : m.delivered_at ? <CheckCheck size={13} className="text-gray-400" aria-label="Delivered" />
                : <Check size={13} className="text-gray-400" aria-label="Sent" />
            )}
          </div>
        </div>
      </div>

      {viewerIndex !== null && (
        <MediaViewer items={mediaItems} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  );
};

// Memoized — same reasoning as DropCard/MemoryCard/ConversationListItem:
// ConversationPage's refreshRecent() replaces the whole messages array on
// every realtime event, so memoizing keeps an update to one message from
// re-rendering the entire scrollback.
export const MessageBubble = React.memo(MessageBubbleImpl);
