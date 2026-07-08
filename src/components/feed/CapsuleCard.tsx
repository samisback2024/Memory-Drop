import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, MapPin, Tag, Clock, Globe, Users, Eye } from 'lucide-react';
import type { Capsule } from '../../types';
import { isUnlocked, formatCountdown, formatRelativeTime } from '../../utils/date';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface CapsuleCardProps {
  capsule: Capsule;
  showAuthor?: boolean;
}

const VISIBILITY_ICONS = {
  public: Globe,
  friends: Users,
  private: Eye,
  specific: Users,
};

const VISIBILITY_LABELS = {
  public: 'Public',
  friends: 'Friends',
  private: 'Only Me',
  specific: 'Specific',
};

export const CapsuleCard: React.FC<CapsuleCardProps> = ({ capsule, showAuthor = true }) => {
  const navigate = useNavigate();
  const unlocked = isUnlocked(capsule.unlock_date);
  const VisibilityIcon = VISIBILITY_ICONS[capsule.visibility];
  const photo = capsule.capsule_media?.find(m => m.type === 'photo');

  return (
    <Card padding="none" onClick={() => {}} className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Media preview */}
      {photo && unlocked && (
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          <img src={photo.url} alt={capsule.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      )}
      {!unlocked && (
        <div className="relative h-28 bg-gradient-to-br from-purple-600/20 to-blue-500/20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <Lock size={24} className="text-purple-500" />
            <p className="text-xs font-medium text-purple-600">{formatCountdown(capsule.unlock_date)}</p>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Author */}
        {showAuthor && capsule.profiles && (
          <div className="flex items-center gap-2 mb-3">
            <Avatar
              src={capsule.profiles.avatar_url}
              name={capsule.profiles.full_name}
              size="sm"
              onClick={() => navigate(`/profile/${capsule.profiles!.username}`)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{capsule.profiles.full_name}</p>
              <p className="text-xs text-gray-500">@{capsule.profiles.username} · {formatRelativeTime(capsule.created_at)}</p>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <VisibilityIcon size={12} />
              <span className="text-xs">{VISIBILITY_LABELS[capsule.visibility]}</span>
            </div>
          </div>
        )}

        {/* Title + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-base leading-tight flex-1">{capsule.title}</h3>
          <Badge variant={unlocked ? 'success' : 'purple'} dot>
            {unlocked ? 'Unlocked' : 'Locked'}
          </Badge>
        </div>

        {/* Message (only if unlocked) */}
        {unlocked && capsule.message && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-3">{capsule.message}</p>
        )}
        {!unlocked && (
          <p className="text-sm text-gray-400 italic mb-3">Content locked until {formatCountdown(capsule.unlock_date).toLowerCase().replace('unlocks ', '')}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {unlocked ? (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <Unlock size={11} /> Unlocked
              </span>
            ) : formatCountdown(capsule.unlock_date)}
          </span>
          {capsule.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {capsule.location}
            </span>
          )}
        </div>

        {/* Tags */}
        {capsule.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {capsule.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="outline" className="flex items-center gap-1">
                <Tag size={9} />
                {tag}
              </Badge>
            ))}
            {capsule.tags.length > 4 && (
              <Badge variant="outline">+{capsule.tags.length - 4}</Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
