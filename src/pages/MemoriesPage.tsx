import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, PlusCircle, Unlock, Lock } from 'lucide-react';
import { useCapsules } from '../hooks/useCapsules';
import { CapsuleCard } from '../components/feed/CapsuleCard';
import { Button } from '../components/ui/Button';
import { formatDate } from '../utils/date';
import { isUnlocked } from '../utils/date';

const getYear = (dateStr: string) => new Date(dateStr).getFullYear().toString();

export const MemoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { getMyCapsules, loading } = useCapsules();

  const myCapsules = getMyCapsules();
  const unlocked = myCapsules.filter(c => isUnlocked(c.unlock_date));
  const locked = myCapsules.filter(c => !isUnlocked(c.unlock_date));

  // Group unlocked by year
  const byYear = unlocked.reduce<Record<string, typeof unlocked>>((acc, c) => {
    const year = getYear(c.unlock_date);
    acc[year] = [...(acc[year] ?? []), c];
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Memories</h1>
        <p className="text-sm text-gray-500">Your personal timeline of unlocked capsules.</p>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-sm text-gray-600">
            <Unlock size={14} className="text-green-500" />
            <span className="font-semibold text-gray-900">{unlocked.length}</span> unlocked
          </span>
          <span className="flex items-center gap-1.5 text-sm text-gray-600">
            <Lock size={14} className="text-purple-500" />
            <span className="font-semibold text-gray-900">{locked.length}</span> locked
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      ) : unlocked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
            <Archive size={28} className="text-purple-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 text-lg">No memories yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create capsules and come back when their unlock date arrives.
            </p>
          </div>
          <Button variant="gradient" onClick={() => navigate('/create')}>
            <PlusCircle size={16} />
            Create a Capsule
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {years.map(year => (
            <div key={year}>
              {/* Year marker */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">{year}</span>
                </div>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-500 font-medium">{byYear[year].length} memories</span>
              </div>
              <div className="flex flex-col gap-3">
                {byYear[year].map(capsule => (
                  <div key={capsule.id} className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center mt-5 flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow" />
                      <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1.5 font-medium">
                        {formatDate(capsule.unlock_date)}
                      </p>
                      <CapsuleCard capsule={capsule} showAuthor={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming locked capsules */}
      {locked.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-purple-500" />
              <h3 className="font-semibold text-gray-700 text-sm">Still Locked</h3>
            </div>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {locked.map(capsule => (
            <CapsuleCard key={capsule.id} capsule={capsule} showAuthor={false} />
          ))}
        </div>
      )}
    </div>
  );
};
