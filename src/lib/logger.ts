// Structured logging — client-side. There's no custom backend server in
// this app's architecture (Supabase is the database/auth/storage/realtime
// layer, Vercel serves static assets), so "server logging" realistically
// means the SQL functions' own `raise exception` messages (already
// surfaced to the client on every RPC failure) plus whatever Supabase's
// own dashboard logs — there's no separate server process to instrument.
// This file is the client-side half: every entry gets a consistent
// shape, always reaches the browser console (so local dev/debugging
// never regresses), and `error`-level entries additionally get sent to
// `analytics_events` (see analytics.ts) as a `client_error` event, so
// production crashes have real visibility without a second pipeline.
import { track } from './analytics';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

const RECENT_LOG_CAP = 50;
const recentLogs: LogEntry[] = [];

const record = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
  const entry: LogEntry = { level, message, context, timestamp: new Date().toISOString() };
  recentLogs.push(entry);
  if (recentLogs.length > RECENT_LOG_CAP) recentLogs.shift();

  const consoleMethod = level === 'debug' ? 'log' : level;
  // eslint-disable-next-line no-console
  console[consoleMethod](`[${level}] ${message}`, context ?? '');

  if (level === 'error') {
    void track('client_error', {
      message,
      ...context,
    });
  }
};

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => record('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => record('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => record('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => record('error', message, context),
  // For a future "copy debug info" support flow — not wired to any UI
  // yet, but the buffer already exists so that's a small follow-up, not
  // a new logging system.
  getRecentLogs: (): LogEntry[] => [...recentLogs],
};

export type ErrorKind = 'permission_denied' | 'network' | 'expired_session' | 'not_found' | 'validation' | 'unknown';

// A single place that turns a raw Supabase/fetch error into a category a
// toast/UI can react to consistently, generalizing the ad hoc
// `/row-level security/i` checks a few hooks already had one-off copies
// of (useComments.ts, useDrops.ts) into one reusable classifier.
export const classifyError = (error: unknown): ErrorKind => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/row-level security|permission denied|not authorized/i.test(message)) return 'permission_denied';
  if (/jwt expired|refresh_token_not_found|invalid refresh token/i.test(message)) return 'expired_session';
  if (/failed to fetch|network|timeout|timed out/i.test(message)) return 'network';
  if (/not found|no rows/i.test(message)) return 'not_found';
  if (/violates check constraint|invalid input|required/i.test(message)) return 'validation';
  return 'unknown';
};

export const ERROR_KIND_MESSAGES: Record<ErrorKind, string> = {
  permission_denied: "You don't have permission to do that.",
  network: 'Connection problem — check your internet and try again.',
  expired_session: 'Your session expired — please sign in again.',
  not_found: "That couldn't be found — it may have been deleted.",
  validation: "That doesn't look right — double-check and try again.",
  unknown: 'Something went wrong. Please try again.',
};

// Convenience for the common "I have a raw error, give me a toast-ready
// message" call site — classifyError() + ERROR_KIND_MESSAGES combined.
export const describeError = (error: unknown): string => ERROR_KIND_MESSAGES[classifyError(error)];
