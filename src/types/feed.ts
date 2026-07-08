export type PostType = 'photo' | 'video' | 'text';
export type FeedTab = 'following' | 'discover' | 'trending' | 'recent';
export type ReportReason = 'spam' | 'harassment' | 'violence' | 'nudity' | 'fake_account' | 'other';

export interface PostImage {
  url: string;
  position: number;
}

// Mirrors the row shape returned by get_feed / get_saved_posts — author
// info and the viewer's like/save state ride along per post so the feed
// never needs a follow-up call per card.
export interface FeedPost {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  is_private: boolean;
  caption: string | null;
  post_type: PostType;
  video_url: string | null;
  images: PostImage[];
  like_count: number;
  comment_count: number;
  share_count: number;
  save_count: number;
  is_liked: boolean;
  is_saved: boolean;
  created_at: string;
}

export interface PostComment {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  content: string;
  created_at: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  violence: 'Violence',
  nudity: 'Nudity',
  fake_account: 'Fake account',
  other: 'Other',
};
