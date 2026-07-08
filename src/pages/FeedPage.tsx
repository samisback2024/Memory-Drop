import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Compass, TrendingUp, Clock, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { StoriesRow } from '../components/feed/StoriesRow';
import { CapsuleCard } from '../components/feed/CapsuleCard';
import { Button } from '../components/ui/Button';

type Tab = 'discover' | 'trending' | 'recent' | 'friends';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'friends', label: 'Friends', icon: Users },
];

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const FeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getFeedCapsules, loading } = useCapsules();
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [search, setSearch] = useState('');

  const feedCapsules = getFeedCapsules();
  const filteredCapsules = search
    ? feedCapsules.filter(
        c =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.profiles?.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.tags.some(t => t.toLowerCase().includes(search.toLowerCase())),
      )
    : feedCapsules;

  return (
    <div className="flex flex-col gap-4">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl p-5 text-white">
        <p className="text-sm font-medium text-purple-200">{getGreeting()},</p>
        <h2 className="text-2xl font-bold mt-0.5">{profile?.full_name?.split(' ')[0] ?? 'there'} 👋</h2>
        <p className="text-sm text-purple-100 mt-2">
          You have{' '}
          <span className="font-semibold text-white">
            {feedCapsules.filter(c => new Date(c.unlock_date) <= new Date()).length} memories
          </span>{' '}
          waiting to be unlocked.
        </p>
      </div>

      {/* Stories */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <StoriesRow />
      </div>

      {/* Search friends */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search capsules, friends, or tags..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === id
                ? 'bg-black text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      ) : filteredCapsules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
            <PlusCircle size={28} className="text-purple-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 text-lg">No capsules yet</h3>
            <p className="text-sm text-gray-500 mt-1">Be the first to drop a memory!</p>
          </div>
          <Button variant="gradient" onClick={() => navigate('/create')}>
            <PlusCircle size={16} />
            Create Your First Capsule
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredCapsules.map(capsule => (
            <CapsuleCard key={capsule.id} capsule={capsule} showAuthor />
          ))}
        </div>
      )}
    </div>
  );
};
