export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  capsule_count: number;
  follower_count: number;
  following_count: number;
  streak: number;
  badges: string[];
  created_at: string;
}

export interface Capsule {
  id: string;
  user_id: string;
  title: string;
  message: string;
  unlock_date: string;
  visibility: VisibilityType;
  tags: string[];
  location: string | null;
  created_at: string;
  profiles?: Profile;
  capsule_media?: CapsuleMedia[];
}

export interface CapsuleMedia {
  id: string;
  capsule_id: string;
  type: 'photo' | 'video' | 'audio';
  url: string;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  content_url: string | null;
  content_type: 'photo' | 'video' | 'text';
  text_content?: string;
  duration_hours: 12 | 24 | 48;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowRequest {
  id: string;
  requester_id: string;
  target_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  profiles?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  other_user?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'follow' | 'follow_request' | 'capsule_unlock' | 'message' | 'like';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
  blocked_profile?: Profile;
}

export type VisibilityType = 'public' | 'friends' | 'private' | 'specific';
export type ContentType = 'photo' | 'video' | 'audio' | 'text';
export type DurationHours = 12 | 24 | 48;

export interface CreateCapsuleForm {
  title: string;
  message: string;
  unlock_date: string;
  visibility: VisibilityType;
  tags: string[];
  location: string;
  media_files: File[];
}

export interface CreateStoryForm {
  content_type: 'photo' | 'video' | 'text';
  text_content?: string;
  media_file?: File;
  duration_hours: DurationHours;
}
