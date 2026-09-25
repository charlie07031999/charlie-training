import { createClient, type User } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yjepvpflamlncpgncsun.supabase.co";

const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_m9I76Yiymq9k7ZA43FvLDg_Z0mpnZBO";

export const isCloudConfigured = Boolean(url && publishableKey);

export const supabase = isCloudConfigured
  ? createClient(url as string, publishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export type CloudWorkoutSession = {
  id:string;
  client_session_id?:string|null;
  workout_id:string;
  started_at?:string|null;
  finished_at:string;
  logs:Record<string, any[]>;
  cardio?:Record<string, any>|null;
  coach_mode?:string|null;
  notes?:string|null;
};

export type CloudSleepSession = {
  id:string;
  bed_at:string;
  lights_out_at?:string|null;
  planned_wake_at?:string|null;
  wake_at?:string|null;
  quality?:number|null;
};

export type CloudBodyMetric = {
  id:string;
  recorded_at:string;
  weight_kg?:number|null;
  waist_cm?:number|null;
};

export type CloudPreferences = {
  sleep_target:string;
  wake_target:string;
  prep_target:string;
  notifications_enabled:boolean;
  workout_reminder_time:string;
  creatine_reminder_time:string;
};

async function ensureUser():Promise<User|null> {
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return data.user ?? null;
}

export async function loadCloudState() {
  if (!supabase) return null;
  const user = await ensureUser();
  if (!user) return null;

  const [workoutsRes,sleepRes,metricsRes,prefsRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id,client_session_id,workout_id,started_at,finished_at,logs,cardio,coach_mode,notes")
      .eq("user_id",user.id)
      .order("finished_at",{ascending:false})
      .limit(120),
    supabase
      .from("sleep_sessions")
      .select("id,bed_at,lights_out_at,planned_wake_at,wake_at,quality")
      .eq("user_id",user.id)
      .order("bed_at",{ascending:false})
      .limit(60),
    supabase
      .from("body_metrics")
      .select("id,recorded_at,weight_kg,waist_cm")
      .eq("user_id",user.id)
      .order("recorded_at",{ascending:false})
      .limit(120),
    supabase
      .from("user_preferences")
      .select("sleep_target,wake_target,prep_target,notifications_enabled,workout_reminder_time,creatine_reminder_time")
      .eq("user_id",user.id)
      .maybeSingle()
  ]);

  return {
    user,
    workouts:(workoutsRes.data ?? []) as CloudWorkoutSession[],
    sleep:(sleepRes.data ?? []) as CloudSleepSession[],
    metrics:(metricsRes.data ?? []) as CloudBodyMetric[],
    preferences:(prefsRes.data ?? null) as CloudPreferences|null,
    errors:[workoutsRes.error,sleepRes.error,metricsRes.error,prefsRes.error].filter(Boolean)
  };
}

export async function syncWorkoutSession(item:{
  clientSessionId:string;
  workoutId:string;
  startedAt?:number;
  finishedAt:number;
  logs:Record<string,unknown>;
  cardio?:Record<string,unknown>|null;
  coachMode?:string|null;
  notes?:string|null;
}) {
  if (!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if (!user) return {ok:false,reason:"auth_failed" as const};

  const {data:existing}=await supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id",user.id)
    .eq("client_session_id",item.clientSessionId)
    .maybeSingle();

  const payload={
    user_id:user.id,
    client_session_id:item.clientSessionId,
    workout_id:item.workoutId,
    started_at:item.startedAt?new Date(item.startedAt).toISOString():null,
    finished_at:new Date(item.finishedAt).toISOString(),
    logs:item.logs,
    cardio:item.cardio ?? null,
    coach_mode:item.coachMode ?? null,
    notes:item.notes ?? null
  };

  const response=existing?.id
    ? await supabase.from("workout_sessions").update(payload).eq("id",existing.id).select("id").single()
    : await supabase.from("workout_sessions").insert(payload).select("id").single();

  return response.error
    ? {ok:false,reason:response.error.message}
    : {ok:true,id:response.data?.id as string|undefined};
}

export async function updateWorkoutLogs(
  id:string,
  logs:Record<string,unknown>,
  cardio?:Record<string,unknown>|null
){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("workout_sessions")
    .update({logs,cardio:cardio ?? null})
    .eq("id",id)
    .eq("user_id",user.id);

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function savePreferences(input:Partial<CloudPreferences>){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const payload={
    user_id:user.id,
    ...input,
    updated_at:new Date().toISOString()
  };

  const {error}=await supabase
    .from("user_preferences")
    .upsert(payload,{onConflict:"user_id"});

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function startSleepSession(input:{
  bedAt:string;
  lightsOutAt?:string|null;
  plannedWakeAt?:string|null;
}){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {data,error}=await supabase
    .from("sleep_sessions")
    .insert({
      user_id:user.id,
      bed_at:input.bedAt,
      lights_out_at:input.lightsOutAt ?? null,
      planned_wake_at:input.plannedWakeAt ?? null
    })
    .select("id")
    .single();

  return error
    ? {ok:false,reason:error.message}
    : {ok:true,id:data?.id as string};
}

export async function setLightsOut(
  id:string,
  lightsOutAt:string,
  plannedWakeAt?:string|null
){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("sleep_sessions")
    .update({
      lights_out_at:lightsOutAt,
      planned_wake_at:plannedWakeAt ?? null,
      updated_at:new Date().toISOString()
    })
    .eq("id",id)
    .eq("user_id",user.id);

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function updateSleepPlan(id:string,plannedWakeAt:string){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("sleep_sessions")
    .update({
      planned_wake_at:plannedWakeAt,
      updated_at:new Date().toISOString()
    })
    .eq("id",id)
    .eq("user_id",user.id);

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function finishSleepSession(id:string,wakeAt:string){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("sleep_sessions")
    .update({
      wake_at:wakeAt,
      updated_at:new Date().toISOString()
    })
    .eq("id",id)
    .eq("user_id",user.id);

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function setSleepQuality(id:string,quality:number){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("sleep_sessions")
    .update({quality,updated_at:new Date().toISOString()})
    .eq("id",id)
    .eq("user_id",user.id);

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function saveBodyMetric(input:{
  weightKg?:number|null;
  waistCm?:number|null;
}){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("body_metrics")
    .insert({
      user_id:user.id,
      weight_kg:input.weightKg ?? null,
      waist_cm:input.waistCm ?? null
    });

  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function getAuthUser(){
  if(!supabase) return null;
  const user=await ensureUser();
  return user;
}

export async function secureAnonymousAccount(email:string){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase.auth.updateUser({email});
  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function sendMagicLink(email:string){
  if(!supabase) return {ok:false,reason:"not_configured" as const};

  const redirectTo=typeof window!=="undefined"?window.location.origin:undefined;
  const {error}=await supabase.auth.signInWithOtp({
    email,
    options:{
      shouldCreateUser:false,
      emailRedirectTo:redirectTo
    }
  });

  return error?{ok:false,reason:error.message}:{ok:true};
}
