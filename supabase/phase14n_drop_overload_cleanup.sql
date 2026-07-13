-- Phase 14n — fix: two overloaded get_drops_feed() functions coexist.
--
-- phase14j_feed_media_filter.sql added a new p_post_type parameter via
-- `create or replace function get_drops_feed(p_tab text, p_limit int
-- default 10, p_offset int default 0, p_post_type text default null)`.
-- CREATE OR REPLACE only replaces a function with an IDENTICAL parameter
-- signature — a changed parameter list creates a second, separate
-- overloaded function instead, silently leaving the original 3-parameter
-- get_drops_feed(text, int, int) in place alongside the new 4-parameter
-- one. This app's own client always passes all four parameters
-- (src/hooks/useDrops.ts), so it never hit the ambiguity — but any other
-- caller invoking get_drops_feed with just (p_tab, p_limit, p_offset) gets
-- PGRST203 ("Could not choose the best candidate function"), since
-- PostgREST can't tell whether to use the 3-arg function or the 4-arg one
-- with p_post_type defaulted. Found while diagnosing a live RLS bug (see
-- phase14m) with a direct RPC call — worth closing regardless.

drop function if exists public.get_drops_feed(text, int, int);
