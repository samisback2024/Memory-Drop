import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, MessageCircle, Clock } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { EmptyState } from '../ui/EmptyState';
import { formatDate } from '../../utils/date';
import type { ActivityItem } from '../../types/memory';

const SOURCE_LABEL: Record<ActivityItem['source_type'], string> = {
  drop: 'a Drop',
  capsule: 'a Capsule',
  moment: 'a Moment',
};

const describe = (item: ActivityItem): string => {
  if (item.activity_type === 'created') return `Created ${SOURCE_LABEL[item.source_type]}${item.snippet ? ` — "${item.snippet}"` : ''}`;
  return `Commented on ${SOURCE_LABEL[item.source_type]}${item.snippet ? `: "${item.snippet}"` : ''}`;
};

// Live-computed from creation/comment timestamps (get_activity_timeline),
// not a separately-tracked log — see phase10b_profile_polish.sql. Every
// row is already visibility-filtered server-side, so nothing extra to
// check here.
export const ActivityTimeline: React.FC<{ userId?: string }> = ({ userId }) => {
  const { getActivityTimeline } = useMemories();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActivityTimeline(userId, 20, 0).then(data => { setItems(data); setLoading(false); });
  }, [userId, getActivityTimeline]);

  if (loading) return <div className="flex flex-col gap-2">{[0, 1, 2].map(i => <div key={i} className="h-10 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>;

  if (items.length === 0) {
    return <EmptyState icon={Clock} title="No activity yet" description="Drops, Capsules, and Moments you create will show up here." />;
  }

  return (
    <div className="flex flex-col divide-y divide-gray-50 dark:divide-gray-800">
      {items.map((item, i) => (
        <Link
          key={`${item.activity_type}-${item.source_type}-${item.source_id}-${i}`}
          to={`/memories/${item.source_type}/${item.source_id}`}
          className="flex items-start gap-2.5 py-2.5 text-sm hover:bg-gray-50/60 dark:hover:bg-gray-800/60 -mx-1 px-1 rounded-lg transition-colors"
        >
          {item.activity_type === 'created' ? (
            <Sparkles size={14} className="text-purple-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <MessageCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 dark:text-gray-200 truncate">{describe(item)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(item.created_at)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
};
