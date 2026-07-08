import React, { useState } from 'react';
import { Link2, Check, Share2, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useFeed } from '../../hooks/useFeed';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  onShared?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, postId, onShared }) => {
  const { incrementShareCount } = useFeed();
  const [copied, setCopied] = useState(false);
  const postUrl = `${window.location.origin}/post/${postId}`;
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const recordShare = async () => {
    await incrementShareCount(postId);
    onShared?.();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(postUrl);
    setCopied(true);
    await recordShare();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ url: postUrl });
      await recordShare();
    } catch {
      // User cancelled the native share sheet — not an error.
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share post" size="sm">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border border-gray-100"
        >
          {copied ? <Check size={17} className="text-green-500" aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
          {copied ? 'Link copied' : 'Copy link'}
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

        <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 border border-gray-100 cursor-not-allowed">
          <Users size={17} aria-hidden="true" />
          Share inside Memory Drop
          <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Coming soon</span>
        </div>
      </div>
      <Button variant="outline" fullWidth size="md" onClick={onClose} className="mt-4">
        Close
      </Button>
    </Modal>
  );
};
