import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yjepvpflamlncpgncsun.supabase.co";

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_m9I76Yiymq9k7ZA43FvLDg_Z0mpnZBO";

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

export async function syncSleepEvent(
  type: "bed"|"wake",
  at: string,
  options?: { plannedWakeAt?: string | null; targetMinutes?: number | null }
) {
  if (!supabase) return { ok:false, reason:"not_configured" as const };
  const user = await ensureUser();
  if (!user) return { ok:false, reason:"auth_failed" as const };

  const payload: Record<string, unknown> = {
    user_id: user.id,
    event_type: type,
    event_at: at
  };

  if(type==="bed"){
    payload.planned_wake_at = options?.plannedWakeAt ?? null;
    payload.target_minutes = options?.targetMinutes ?? null;
  }

  const { error } = await supabase.from("sleep_events").insert(payload);
  return error ? { ok:false, reason:error.message } : { ok:true };
}

export async function updateLatestBedPlan(plannedWakeAt:string,targetMinutes:number) {
  if (!supabase) return { ok:false, reason:"not_configured" as const };
  const user = await ensureUser();
  if (!user) return { ok:false, reason:"auth_failed" as const };

  const { data: latest, error: readError } = await supabase
    .from("sleep_events")
    .select("id")
    .eq("user_id",user.id)
    .eq("event_type","bed")
    .order("event_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(readError || !latest) return { ok:false, reason:readError?.message ?? "no_bed_event" };

  const { error } = await supabase
    .from("sleep_events")
    .update({
      planned_wake_at: plannedWakeAt,
      target_minutes: targetMinutes
    })
    .eq("id",latest.id);

  return error ? { ok:false, reason:error.message } : { ok:true };
}
