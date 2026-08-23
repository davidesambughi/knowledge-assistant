// Client Supabase server-only, usa SUPABASE_SECRET_KEY (bypassa RLS, Invariant #20).
// Condiviso da ingest (01b) e retrieval (02) — non istanziare un altro client altrove.

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
