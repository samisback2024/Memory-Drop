import type { MomentTrayItem } from '../types/moment';

export interface MomentAuthorGroup {
  userId: string;
  name: string;
  photoUrl: string | null;
  hasUnviewed: boolean;
  itemCount: number;
}

// Groups the flat per-moment tray rows by author, in first-seen order —
// shared by every moments entry point (sidebar, pile) so "does this
// author still have anything unviewed" is computed identically
// everywhere rather than three slightly different reimplementations.
export const groupMomentTrayItems = (items: MomentTrayItem[]): MomentAuthorGroup[] => {
  const order: string[] = [];
  const map = new Map<string, MomentAuthorGroup>();
  for (const item of items) {
    const existing = map.get(item.user_id);
    if (!existing) {
      order.push(item.user_id);
      map.set(item.user_id, {
        userId: item.user_id,
        name: item.display_name || item.username,
        photoUrl: item.profile_photo_url,
        hasUnviewed: !item.is_viewed,
        itemCount: 1,
      });
    } else {
      existing.itemCount += 1;
      if (!item.is_viewed) existing.hasUnviewed = true;
    }
  }
  return order.map(id => map.get(id)!);
};

// A small deterministic hash, seeded only from a user id — used purely
// for decorative per-capsule variation (tilt angle, float delay, hue
// nudge) so the same person's capsule looks the same on every render
// without needing to persist a random value anywhere.
export const seededFraction = (seed: string): number => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return h / 997;
};
