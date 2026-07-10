// Mirrors supabase/phase12_messaging.sql exactly — every field here is a
// real column or RPC return column, not a client-invented shape.

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'location' | 'file';
export type MessagingPrivacy = 'everyone' | 'followers' | 'mutual_followers' | 'nobody';
export type MessageGate = 'allowed' | 'request' | 'blocked';
export type ConversationFilter = 'all' | 'unread' | 'pinned' | 'muted' | 'archived';
export type RequestStatus = 'none' | 'pending' | 'accepted' | 'declined';

export interface Attachment {
  id: string;
  bucket: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  waveform: number[] | null;
  thumbnail_url: string | null;
}

export interface MessageReaction {
  emoji: string;
  user_id: string;
}

export interface LocationMetadata {
  lat: number;
  lng: number;
  label?: string;
}

export interface StickerMetadata {
  emoji: string;
}

// get_messages()'s exact return shape.
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string | null;
  sender_display_name: string | null;
  sender_profile_photo_url: string | null;
  type: MessageType;
  content: string | null;
  metadata: Record<string, unknown>;
  reply_to_message_id: string | null;
  reply_to_type: MessageType | null;
  reply_to_content: string | null;
  reply_to_sender_name: string | null;
  forwarded_from_message_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  is_unsent: boolean;
  is_pinned: boolean;
  pinned_by: string | null;
  pinned_at: string | null;
  created_at: string;
  attachments: Attachment[];
  reactions: MessageReaction[];
  is_starred_by_me: boolean;
  delivered_at: string | null;
  read_at: string | null;
}

// get_conversations()'s exact return shape.
export interface Conversation {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_display_name: string | null;
  other_profile_photo_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
  unread_count: number;
  request_status: RequestStatus;
  request_initiator_id: string | null;
  is_online: boolean;
  last_seen_at: string | null;
}

// get_message_requests()'s exact return shape.
export interface MessageRequest {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_display_name: string | null;
  other_profile_photo_url: string | null;
  last_message_preview: string | null;
  created_at: string | null;
}

// get_conversation_header()'s exact return shape — the one lookup that
// works even for a brand-new, message-less conversation (get_conversations()
// deliberately excludes those).
export interface ConversationHeader {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_display_name: string | null;
  other_profile_photo_url: string | null;
  request_status: RequestStatus;
  request_initiator_id: string | null;
  is_online: boolean;
  last_seen_at: string | null;
}

export interface ConversationSearchResult {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_display_name: string | null;
  other_profile_photo_url: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
}

export interface MessageSearchResult {
  id: string;
  conversation_id: string;
  other_display_name: string | null;
  content: string | null;
  created_at: string;
}

export interface ConversationMediaItem {
  id: string;
  message_id: string;
  type: MessageType;
  bucket: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface PresenceRow {
  user_id: string;
  is_online: boolean;
  last_seen_at: string | null;
}

export interface TypingRow {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

export const CONVERSATION_FILTERS: { id: ConversationFilter; label: string }[] = [
  { id: 'all', label: 'Recent' },
  { id: 'unread', label: 'Unread' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'muted', label: 'Muted' },
  { id: 'archived', label: 'Archived' },
];

export const MESSAGING_PRIVACY_META: Record<MessagingPrivacy, { label: string; description: string }> = {
  everyone: { label: 'Everyone', description: 'Anyone can message you directly.' },
  followers: { label: 'Followers', description: 'Only people who follow you can message you directly.' },
  mutual_followers: { label: 'Mutual followers', description: 'Only people you follow back can message you directly.' },
  nobody: { label: 'Nobody', description: 'No one can message you directly.' },
};

// A curated set of oversized emoji rendered without a bubble background —
// this app's "stickers," with no external asset pack or dependency.
export const STICKERS = [
  '🎉', '❤️', '🔥', '👍', '👏', '😂', '😍', '🥳', '🙌', '✨',
  '💯', '🤝', '🎂', '🌟', '💜', '🤗', '😢', '😮', '👋', '🙏',
];

// Internal-route detection for RichLinkPreview — matches this app's own
// URL shapes exactly (see App.tsx), never a guessed pattern.
const DROP_LINK_RE = /\/drop\/([0-9a-f-]{36})/i;
const CAPSULE_LINK_RE = /\/capsules\/([0-9a-f-]{36})/i;
const PROFILE_LINK_RE = /\/u\/([a-z0-9_.]{3,20})/i;

export type InternalLinkKind = 'drop' | 'capsule' | 'profile';
export interface InternalLink {
  kind: InternalLinkKind;
  id: string;
}

export const findInternalLink = (text: string): InternalLink | null => {
  const dropMatch = text.match(DROP_LINK_RE);
  if (dropMatch) return { kind: 'drop', id: dropMatch[1] };
  const capsuleMatch = text.match(CAPSULE_LINK_RE);
  if (capsuleMatch) return { kind: 'capsule', id: capsuleMatch[1] };
  const profileMatch = text.match(PROFILE_LINK_RE);
  if (profileMatch) return { kind: 'profile', id: profileMatch[1] };
  return null;
};

export const buildMapsUrl = (lat: number, lng: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
