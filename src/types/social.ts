export interface SocialUser {
  id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  is_private: boolean;
}

// The shape returned by every list RPC (search, suggested, orbiters,
// orbiting) — each row already carries the viewer's relationship to that
// user, computed server-side, so lists never need a per-row follow-up call.
// is_muted/is_restricted/i_blocked are only populated by get_orbiters and
// get_orbiting (the two lists RelationshipMenu appears on) — search and
// suggestions omit them since that menu isn't shown there.
export interface SocialUserWithRelationship extends SocialUser {
  is_in_orbit: boolean;
  is_orbit_pending: boolean;
  is_orbiting_you: boolean;
  is_muted?: boolean;
  is_restricted?: boolean;
  i_blocked?: boolean;
}

export interface SuggestedUser extends SocialUser {
  mutual_count: number;
  is_in_orbit: boolean;
  is_orbit_pending: boolean;
  is_orbiting_you: boolean;
}

export interface PendingRequest extends SocialUser {
  requested_at: string;
}

export interface Relationship {
  is_in_orbit: boolean;
  is_orbit_pending: boolean;
  is_orbiting_you: boolean;
  i_blocked: boolean;
  blocked_me: boolean;
  i_muted: boolean;
  i_restricted: boolean;
}

export interface SocialCounts {
  orbiting_count: number;
  in_orbit_count: number;
}

export type OrbitButtonState =
  | 'orbit'
  | 'requested'
  | 'in_orbit'
  | 'orbit_back'
  | 'blocked'
  | 'unavailable';
