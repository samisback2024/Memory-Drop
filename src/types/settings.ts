import type { Visibility } from './feed';
import type { MomentPrivacy } from './moment';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

// Twelve named hues, any of which can fill either the PRIMARY or
// SECONDARY slot ("purple"/"blue" in Tailwind classes app-wide — see
// index.css for why those names stuck) — mix and match, not fixed
// pairs. The last four (amber/graphite/forest/plum) are designed
// around this app's own concept rather than more red/white/blue:
// amber for the unlock-reveal moment, graphite for a clean minimal-
// professional look, forest/plum for two calmer editorial directions.
export type ColorHue =
  | 'classic_purple' | 'classic_blue' | 'navy' | 'claret' | 'cornflower' | 'terracotta'
  | 'royal_blue' | 'scarlet' | 'amber' | 'graphite' | 'forest' | 'plum';

export const COLOR_HUE_META: Record<ColorHue, { label: string; swatch: string }> = {
  classic_purple: { label: 'Classic Purple', swatch: '#9333ea' },
  classic_blue: { label: 'Classic Blue', swatch: '#2563eb' },
  navy: { label: 'Navy', swatch: '#3b56b0' },
  claret: { label: 'Claret', swatch: '#b93148' },
  cornflower: { label: 'Cornflower', swatch: '#4270a9' },
  terracotta: { label: 'Terracotta', swatch: '#b64f35' },
  royal_blue: { label: 'Royal Blue', swatch: '#1552d5' },
  scarlet: { label: 'Scarlet', swatch: '#d11a26' },
  amber: { label: 'Amber', swatch: '#d58f15' },
  graphite: { label: 'Graphite', swatch: '#677083' },
  forest: { label: 'Forest', swatch: '#3fab79' },
  plum: { label: 'Plum', swatch: '#a942a9' },
};

// One-tap curated combinations — a starting point, not the only
// option. "Memory Gold" and "Sage & Plum" are new, built specifically
// to feel like this product rather than a generic palette.
export const SIGNATURE_PAIRS: { label: string; description: string; primary: ColorHue; secondary: ColorHue }[] = [
  { label: 'Classic', description: "The original Memory Drop purple-to-blue.", primary: 'classic_purple', secondary: 'classic_blue' },
  { label: 'Ink & Claret', description: 'Quiet navy with a claret accent.', primary: 'navy', secondary: 'claret' },
  { label: 'Riviera', description: 'Warm cornflower and terracotta.', primary: 'cornflower', secondary: 'terracotta' },
  { label: 'Grand Prix', description: 'Bold royal blue and true red.', primary: 'royal_blue', secondary: 'scarlet' },
  { label: 'Memory Gold', description: 'Amber unlock-gold on graphite — this app\'s own signature.', primary: 'graphite', secondary: 'amber' },
  { label: 'Sage & Plum', description: 'Calm forest green with a plum accent.', primary: 'forest', secondary: 'plum' },
];

export interface UserSettings {
  user_id: string;
  default_drop_visibility: Visibility;
  default_moment_visibility: MomentPrivacy;
  theme: Theme;
  color_theme_primary: ColorHue;
  color_theme_secondary: ColorHue;
  font_size: FontSize;
  reduced_motion: boolean;
  high_contrast: boolean;
  larger_touch_targets: boolean;
  analytics_enabled: boolean;
  visible_stats: ProfileStatKey[];
  show_interest_counts: boolean;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

// The 14 Memory Stats tiles a profile owner can opt into showing on
// their public profile — Orbiting You/In Orbit stay unconditionally
// public (a separate, already-existing display) and aren't part of
// this list. The four interest-reaction stats (Save to Unlock/
// Interested/Can't Wait/Good Vibes) are lifetime totals received on your
// own Drops — they survive a Drop rolling off the feed 2 days after
// unlocking (Phase 16), since the underlying counts live on the Drop row
// itself, not on whether it's currently showing in anyone's feed tab.
export type ProfileStatKey =
  | 'total_drops' | 'locked_items' | 'unlocked_items' | 'expired_moments' | 'saved_to_unlock'
  | 'public_drops' | 'total_views' | 'total_unlocks' | 'total_reactions' | 'total_comments' | 'total_moments'
  | 'interested_received' | 'cant_wait_received' | 'good_vibes_received';

export const PROFILE_STAT_META: Record<ProfileStatKey, { label: string; description: string }> = {
  total_drops: { label: 'Drops', description: 'Total number of Drops you\'ve made.' },
  locked_items: { label: 'Locked', description: 'How many of your memories are still sealed.' },
  unlocked_items: { label: 'Unlocked', description: 'How many of your memories have unlocked.' },
  expired_moments: { label: 'Expired moments', description: 'How many Moments you\'ve posted that have expired.' },
  saved_to_unlock: { label: 'Save to Unlock', description: 'How many times people have saved one of your Drops to unlock later.' },
  public_drops: { label: 'Public drops', description: 'How many of your Drops are set to Everyone.' },
  total_views: { label: 'Views received', description: 'Total views across everything you\'ve unlocked or posted.' },
  total_unlocks: { label: 'Unlocks received', description: 'How many times your content has been unlocked by others.' },
  total_reactions: { label: 'Reactions received', description: 'Sparkle Drops and reactions across all your content.' },
  total_comments: { label: 'Comments received', description: 'Comments and replies across all your content.' },
  total_moments: { label: 'Moments', description: 'Total number of Moments you\'ve posted.' },
  interested_received: { label: 'I\'m Interested', description: 'How many times people reacted "I\'m Interested" to one of your sealed Drops.' },
  cant_wait_received: { label: 'Can\'t Wait', description: 'How many times people reacted "Can\'t Wait" to one of your sealed Drops.' },
  good_vibes_received: { label: 'Good Vibes', description: 'How many times people sent "Good Vibes" to one of your sealed Drops.' },
};

export interface NotificationPreferences {
  user_id: string;
  unlock_reminders: boolean;
  new_orbiters: boolean;
  orbit_requests: boolean;
  comments: boolean;
  reactions: boolean;
  replies: boolean;
  weekly_recap: boolean;
  product_updates: boolean;
  mentions: boolean;
  security_alerts: boolean;
  messages: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_label: string | null;
  created_at: string;
}

export type FeedbackType = 'bug' | 'feedback' | 'support';

export interface ManagedUser {
  id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  created_at: string;
}

export const FONT_SIZE_META: Record<FontSize, { label: string; scale: number }> = {
  small: { label: 'Small', scale: 0.9 },
  medium: { label: 'Medium', scale: 1 },
  large: { label: 'Large', scale: 1.15 },
  xlarge: { label: 'Extra Large', scale: 1.3 },
};

export const NOTIFICATION_PREFERENCE_META: Record<keyof Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>, { label: string; description: string }> = {
  unlock_reminders: { label: 'Unlock reminders', description: 'When a capsule or moment you can see is about to unlock.' },
  new_orbiters: { label: 'New orbiters', description: 'When someone enters your Orbit.' },
  orbit_requests: { label: 'Orbit requests', description: 'When someone requests to join your private account\'s Orbit.' },
  comments: { label: 'Comments', description: 'When someone comments on your drop or capsule.' },
  reactions: { label: 'Reactions', description: 'When someone reacts to your moment or Sparkle Drops your capsule.' },
  replies: { label: 'Replies', description: 'When someone replies to your moment.' },
  weekly_recap: { label: 'Weekly recap', description: 'A weekly summary of what unlocked and what you missed.' },
  product_updates: { label: 'Product updates', description: 'News about new Memory Drop features.' },
  mentions: { label: 'Mentions', description: 'When someone @mentions you in a comment.' },
  security_alerts: { label: 'Security alerts', description: 'Password changes and new sign-ins on your account.' },
  messages: { label: 'Messages', description: 'New messages, replies, and reactions in Memory Chat.' },
};
