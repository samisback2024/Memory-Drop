import type { Visibility } from './feed';
import type { MomentPrivacy } from './moment';

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
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

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
};
