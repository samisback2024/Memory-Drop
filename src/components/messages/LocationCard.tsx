import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { buildMapsUrl, type LocationMetadata } from '../../types/message';

interface LocationCardProps {
  location: LocationMetadata;
}

// A static link-out card, not an embedded interactive map — no Mapbox/
// Google Maps JS dependency. Opens OpenStreetMap (no API key needed) in
// a new tab.
export const LocationCard: React.FC<LocationCardProps> = ({ location }) => (
  <a
    href={buildMapsUrl(location.lat, location.lng)}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors max-w-[240px]"
  >
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
      <MapPin size={18} className="text-white" aria-hidden="true" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{location.label || 'Shared location'}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
        Open in Maps <ExternalLink size={11} aria-hidden="true" />
      </p>
    </div>
  </a>
);
