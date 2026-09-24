import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isCloudConfigured = Boolean(url && anonKey);

export const supabase = isCloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

async function ensureUser() {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return data.user ?? null;
}

export async function syncWorkoutSession(item: {
  workoutId: string;
  startedAt?: number;
  finishedAt: number;
  logs: Record<string, unknown>;
}) {
  if (!supabase) return { ok:false, reason:"not_configured" as const };
  const user = await ensureUser();
  if (!user) return { ok:false, reason:"auth_failed" as const };

  const { error } = await supabase.from("workout_sessions").insert({
    user_id: user.id,
    workout_id: item.workoutId,
    started_at: item.startedAt ? new Date(item.startedAt).toISOString() : null,
    finished_at: new Date(item.finishedAt).toISOString(),
    logs: item.logs
  });

  return error ? { ok:false, reason:error.message } : { ok:true };
}

export async function syncSleepEvent(type: "bed"|"wake", at: string) {
  if (!supabase) return { ok:false, reason:"not_configured" as const };
  const user = await ensureUser();
  if (!user) return { ok:false, reason:"auth_failed" as const };

  const { error } = await supabase.from("sleep_events").insert({
    user_id: user.id,
    event_type: type,
    event_at: at
  });

  return error ? { ok:false, reason:error.message } : { ok:true };
}
