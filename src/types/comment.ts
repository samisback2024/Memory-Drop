// Phase 10d — shared comment shape for both Drops and Capsules.
// get_drop_comments()/get_capsule_comments() return the identical
// column set, so one type + one set of components serve both, rather
// than the two near-duplicate DropComment/CapsuleComment types and the
// two near-duplicate comment UIs that existed before this phase.
export type CommentContentType = 'drop' | 'capsule';

export interface Comment {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  parent_comment_id: string | null;
  is_pinned: boolean;
  reaction_count: number;
  my_reaction: string | null;
}

export interface CommentReactionBreakdown {
  emoji: string;
  reaction_count: number;
}

export interface RecentLiker {
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  liked_at: string;
}
