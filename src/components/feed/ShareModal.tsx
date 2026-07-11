import React, { useState } from 'react';
import { Link2, Check, Share2, QrCode, Download, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDrops } from '../../hooks/useDrops';
import { useCapsules } from '../../hooks/useCapsules';
import { generateSharePreview, buildQrCodeUrl } from '../../utils/sharePreview';
import { useToast } from '../../hooks/useToast';
import { track } from '../../lib/analytics';
import { MOOD_META, type Mood } from '../../types/feed';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryType: 'drop' | 'capsule';
  memoryId: string;
  title?: string | null;
  caption?: string | null;
  mood?: Mood | null;
  coverUrl?: string | null;
  username?: string;
  onShared?: () => void;
}

// Generalized across Drops and Capsules (Phase 10c) — Moments have no
// permalink share concept anywhere else in this app (ephemeral, tray-
// only), so they're deliberately not a third memoryType here.
export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen, onClose, memoryType, memoryId, title = null, caption = null, mood = null, coverUrl = null, username = '', onShared,
}) => {
  const { incrementShareCount: incrementDropShare } = useDrops();
  const { incrementShareCount: incrementCapsuleShare } = useCapsules();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);

  const path = memoryType === 'drop' ? `/drop/${memoryId}` : `/capsules/${memoryId}`;
  const shareUrl = `${window.location.origin}${path}`;
  const shareText = `${title || caption?.slice(0, 60) || 'A memory'} — via Memory Drop\n${shareUrl}`;
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const recordShare = async () => {
    if (memoryType === 'drop') await incrementDropShare(memoryId);
    else await incrementCapsuleShare(memoryId);
    void track('share', { memory_type: memoryType });
    onShared?.();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    await recordShare();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(shareText);
    setTextCopied(true);
    await recordShare();
    setTimeout(() => setTextCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ url: shareUrl, text: shareText, title: title ?? undefined });
      await recordShare();
    } catch {
      // User cancelled the native share sheet — not an error.
    }
  };

  const handleDownloadCard = async () => {
    setGeneratingCard(true);
    const blob = await generateSharePreview({
      title, caption, coverUrl, username,
      moodEmoji: mood ? MOOD_META[mood].emoji : null,
    });
    setGeneratingCard(false);
    if (!blob) {
      showToast("Couldn't generate a preview card — try again.", 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'memory-drop-share.png';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Preview card downloaded.');
    await recordShare();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share this memory" size="sm">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border border-gray-100"
        >
          {copied ? <Check size={17} className="text-green-500" aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>

        <button
          type="button"
          onClick={handleCopyText}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border border-gray-100"
        >
          {textCopied ? <Check size={17} className="text-green-500" aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
          {textCopied ? 'Copied' : 'Copy shareable text'}
        </button>

        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border border-gray-100"
          >
            <Share2 size={17} aria-hidden="true" />
            Share via...
          </button>
        )}

        <button
          type="button"
          onClick={() => setQrOpen(p => !p)}
          aria-expanded={qrOpen}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border border-gray-100"
        >
          <QrCode size={17} aria-hidden="true" />
          {qrOpen ? 'Hide QR code' : 'Show QR code'}
        </button>
        {qrOpen && (
          <div className="flex justify-center py-2">
            <img src={buildQrCodeUrl(shareUrl)} alt={`QR code linking to ${shareUrl}`} width={180} height={180} className="rounded-xl border border-gray-100" />
          </div>
        )}

        <button
          type="button"
          onClick={handleDownloadCard}
          disabled={generatingCard}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border border-gray-100 disabled:opacity-50"
        >
          <Download size={17} aria-hidden="true" />
          {generatingCard ? 'Generating...' : 'Download preview card'}
        </button>
      </div>
      <Button variant="outline" fullWidth size="md" onClick={onClose} className="mt-4">
        Close
      </Button>
    </Modal>
  );
};
