import React, { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { MediaViewer, type MediaViewerItem } from './MediaViewer';
import { useMessages } from '../../hooks/useMessages';
import type { ConversationMediaItem } from '../../types/message';

interface ConversationMediaPanelProps {
  conversationId: string;
  onClose: () => void;
}

// The "Media" and part of the "Links" search surface the brief asks for
// — a per-conversation gallery (get_conversation_media()), not a global
// cross-conversation media search. Simpler and matches how a real chat
// app's "chat info" media tab actually works.
export const ConversationMediaPanel: React.FC<ConversationMediaPanelProps> = ({ conversationId, onClose }) => {
  const { getConversationMedia } = useMessages();
  const [items, setItems] = useState<ConversationMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    getConversationMedia(conversationId).then(rows => { setItems(rows); setLoading(false); });
  }, [conversationId, getConversationMedia]);

  const viewerItems: MediaViewerItem[] = items
    .filter(i => i.type === 'image' || i.type === 'video' || i.type === 'gif')
    .map(i => ({ url: i.url, type: i.type as 'image' | 'video' | 'gif' }));

  return (
    <Modal isOpen onClose={onClose} title="Shared media" size="lg">
      {loading ? (
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />)}
        </div>
      ) : viewerItems.length === 0 ? (
        <EmptyState icon={Images} title="No shared media yet" description="Photos and videos sent in this conversation will show up here." />
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {viewerItems.map((item, i) => (
            <button key={i} type="button" onClick={() => setViewerIndex(i)} className="aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
              {item.type === 'video' ? (
                <video src={item.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={item.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
      {viewerIndex !== null && (
        <MediaViewer items={viewerItems} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </Modal>
  );
};
