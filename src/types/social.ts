export interface SocialUser {
  id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  is_private: boolean;
}

// The shape returned by every list RPC (search, suggested, followers,
// following) — each row already carries the viewer's relationship to that
// user, computed server-side, so lists never need a per-row follow-up call.
// is_muted/is_restricted/i_blocked are only populated by get_followers and
// get_following (the two lists RelationshipMenu appears on) — search and
// suggestions omit them since that menu isn't shown there.
export interface SocialUserWithRelationship extends SocialUser {
  is_following: boolean;
  is_pending: boolean;
  is_followed_by: boolean;
  is_muted?: boolean;
  is_restricted?: boolean;
  i_blocked?: boolean;
}

export interface SuggestedUser extends SocialUser {
  mutual_count: number;
}

export interface PendingRequest extends SocialUser {
  requested_at: string;
}

export interface Relationship {
  is_following: boolean;
  is_pending: boolean;
  is_followed_by: boolean;
  i_blocked: boolean;
  blocked_me: boolean;
  i_muted: boolean;
  i_restricted: boolean;
}

export interface SocialCounts {
  followers_count: number;
  following_count: number;
}

export type FollowButtonState =
  | 'follow'
  | 'requested'
  | 'following'
  | 'follow_back'
  | 'blocked'
  | 'unavailable';
