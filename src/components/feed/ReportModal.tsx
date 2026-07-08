import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { useDrops } from '../../hooks/useDrops';
import { REPORT_REASON_LABELS, type ReportReason } from '../../types/feed';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dropId: string;
}

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, dropId }) => {
  const { reportDrop } = useDrops();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setReason(null);
    setDetails('');
    setError(null);
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setLoading(true);
    setError(null);
    const { error: reportError } = await reportDrop(dropId, reason, details);
    setLoading(false);
    if (reportError) {
      setError(reportError);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Thanks for letting us know" size="sm">
        <p className="text-sm text-gray-600">
          We've received your report and will review this drop.
        </p>
        <Button variant="primary" fullWidth size="md" onClick={handleClose} className="mt-4">
          Done
        </Button>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Report this drop" size="sm">
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Reason for reporting" className="flex flex-col gap-1.5">
          {REASONS.map(r => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={[
                'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border',
                reason === r ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {REPORT_REASON_LABELS[r]}
            </button>
          ))}
        </div>

        {reason === 'other' && (
          <Textarea
            label="Details (optional)"
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What's going on with this drop?"
          />
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button variant="primary" fullWidth size="md" onClick={handleSubmit} loading={loading} disabled={!reason}>
          Submit report
        </Button>
      </div>
    </Modal>
  );
};
