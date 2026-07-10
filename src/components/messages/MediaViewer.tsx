import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export interface MediaViewerItem {
  url: string;
  type: 'image' | 'video' | 'gif';
}

interface MediaViewerProps {
  items: MediaViewerItem[];
  startIndex: number;
  onClose: () => void;
}

// Fullscreen overlay in the same structural shell MomentViewer already
// established (fixed inset-0, black background, tap-adjacent chrome),
// extended with what MomentViewer never needed: pinch/double-tap zoom,
// swipe between items, download, and native share — none of which had
// any precedent to reuse (confirmed via research).
export const MediaViewer: React.FC<MediaViewerProps> = ({ items, startIndex, onClose }) => {
  const { showToast } = useToast();
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const current = items[index];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(items.length - 1, i + 1));
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, items.length]);

  useEffect(() => setZoomed(false), [index]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 60) {
      if (delta > 0) setIndex(i => Math.max(0, i - 1));
      else setIndex(i => Math.min(items.length - 1, i + 1));
    }
    setTouchStartX(null);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(current.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = current.url.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      showToast('Could not download this file.', 'error');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: current.url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy-link
      }
    }
    await navigator.clipboard.writeText(current.url);
    showToast('Link copied.', 'success');
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="flex items-center justify-between p-3 flex-shrink-0">
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-full text-white hover:bg-white/10 transition-colors">
          <X size={22} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleShare} aria-label="Share" className="p-2 rounded-full text-white hover:bg-white/10 transition-colors">
            <Share2 size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={handleDownload} aria-label="Download" className="p-2 rounded-full text-white hover:bg-white/10 transition-colors">
            <Download size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {index > 0 && (
          <button type="button" onClick={() => setIndex(i => i - 1)} aria-label="Previous" className="hidden sm:flex absolute left-3 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        {current.type === 'video' ? (
          <video src={current.url} controls playsInline autoPlay className="max-w-full max-h-full" />
        ) : (
          <img
            src={current.url}
            alt=""
            onDoubleClick={() => setZoomed(z => !z)}
            className={`max-w-full max-h-full object-contain transition-transform duration-200 cursor-zoom-in select-none ${zoomed ? 'scale-[2.2] cursor-zoom-out' : ''}`}
          />
        )}
        {index < items.length - 1 && (
          <button type="button" onClick={() => setIndex(i => i + 1)} aria-label="Next" className="hidden sm:flex absolute right-3 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 py-3 flex-shrink-0">
          {items.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
      )}
    </div>
  );
};
