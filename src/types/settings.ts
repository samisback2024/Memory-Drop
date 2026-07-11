import type { Visibility } from './feed';
import type { MomentPrivacy } from './moment';
import type { MessagingPrivacy } from './message';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface UserSettings {
  user_id: string;
  default_drop_visibility: Visibility;
  default_moment_visibility: MomentPrivacy;
  theme: Theme;
  font_size: FontSize;
  reduced_motion: boolean;
  high_contrast: boolean;
  larger_touch_targets: boolean;
  messaging_privacy: MessagingPrivacy;
  allow_message_requests: boolean;
  analytics_enabled: boolean;
  visible_stats: ProfileStatKey[];
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

// The 10 Memory Stats tiles a profile owner can opt into showing on
// their public profile — followers/following stay unconditionally
// public (a separate, already-existing display) and aren't part of
// this list.
export type ProfileStatKey =
  | 'total_drops' | 'locked_items' | 'unlocked_items' | 'expired_moments' | 'saved_to_unlock'
  | 'public_drops' | 'total_views' | 'total_unlocks' | 'total_reactions' | 'total_comments';

export const PROFILE_STAT_META: Record<ProfileStatKey, { label: string; description: string }> = {
  total_drops: { label: 'Drops', description: 'Total number of Drops you\'ve made.' },
  locked_items: { label: 'Locked', description: 'How many of your memories are still sealed.' },
  unlocked_items: { label: 'Unlocked', description: 'How many of your memories have unlocked.' },
  expired_moments: { label: 'Expired moments', description: 'How many Moments you\'ve posted that have expired.' },
  saved_to_unlock: { label: 'Saved to unlock', description: 'How many Drops you\'ve saved to unlock later.' },
  public_drops: { label: 'Public drops', description: 'How many of your Drops are set to Everyone.' },
  total_views: { label: 'Views received', description: 'Total views across everything you\'ve unlocked or posted.' },
  total_unlocks: { label: 'Unlocks received', description: 'How many times your content has been unlocked by others.' },
  total_reactions: { label: 'Reactions received', description: 'Likes and reactions across all your content.' },
  total_comments: { label: 'Comments received', description: 'Comments and replies across all your content.' },
};

export interface NotificationPreferences {
  user_id: string;
  unlock_reminders: boolean;
  new_followers: boolean;
  follow_requests: boolean;
  comments: boolean;
  reactions: boolean;
  replies: boolean;
  weekly_recap: boolean;
  product_updates: boolean;
  mentions: boolean;
  security_alerts: boolean;
  messages: boolean;
  message_requests: boolean;
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
  new_followers: { label: 'New followers', description: 'When someone starts following you.' },
  follow_requests: { label: 'Follow requests', description: 'When someone requests to follow your private account.' },
  comments: { label: 'Comments', description: 'When someone comments on your drop or capsule.' },
  reactions: { label: 'Reactions', description: 'When someone reacts to your moment or likes your capsule.' },
  replies: { label: 'Replies', description: 'When someone replies to your moment.' },
  weekly_recap: { label: 'Weekly recap', description: 'A weekly summary of what unlocked and what you missed.' },
  product_updates: { label: 'Product updates', description: 'News about new Memory Drop features.' },
  mentions: { label: 'Mentions', description: 'When someone @mentions you in a comment.' },
  security_alerts: { label: 'Security alerts', description: 'Password changes and new sign-ins on your account.' },
  messages: { label: 'Messages', description: 'New messages, replies, and reactions in Memory Chat.' },
  message_requests: { label: 'Message requests', description: 'When someone outside your circle wants to message you.' },
};
