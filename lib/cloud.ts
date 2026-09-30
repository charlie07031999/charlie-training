import { createClient, type User } from "@supabase/supabase-js";
import type { NativeHealthSnapshot } from "./health";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yjepvpflamlncpgncsun.supabase.co";

const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_m9I76Yiymq9k7ZA43FvLDg_Z0mpnZBO";

export const isCloudConfigured = Boolean(url && publishableKey);
export const VAPID_PUBLIC_KEY = "BI7VvAirYWnr9SWTpmiQURZfLNyAvBEbYrEWJ9k4Yrsv81szoU3oHkUO5amfrbhlXRlBLiOnKxwmcma9fbhc-cA";

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
  source?:string|null;
  external_id?:string|null;
  health_metadata?:Record<string,any>|null;
  exercise_variants?:Record<string,string>|null;
  started_at?:string|null;
  finished_at:string;
  logs:Record<string, any[]>;
  cardio?:Record<string, any>|null;
  coach_mode?:string|null;
  notes?:string|null;
};

export type CloudLiveWorkout = {
  id:string;
  client_session_id:string;
  workout_id:string;
  started_at:string;
  current_exercise_id?:string|null;
  current_exercise_name?:string|null;
  current_exercise_index:number;
  current_set_index:number;
  completed_ids:string[];
  deferred_ids:string[];
  logs:Record<string, any[]>;
  exercise_variants?:Record<string,string>|null;
  coach_mode?:string|null;
  last_set?:Record<string, any>|null;
  last_action?:string|null;
  updated_at:string;
};

export type CloudSleepSession = {
  id:string;
  bed_at:string;
  external_id?:string|null;
  lights_out_at?:string|null;
  planned_wake_at?:string|null;
  wake_at?:string|null;
  quality?:number|null;
  energy?:number|null;
  notes?:string|null;
  source?:string|null;
};

export type CloudBodyMetric = {
  id:string;
  recorded_at:string;
  weight_kg?:number|null;
  waist_cm?:number|null;
  source?:string|null;
  external_id?:string|null;
};

export type CloudHealthDailyMetric = {
  id:string;
  metric_date:string;
  steps?:number|null;
  active_energy_kcal?:number|null;
  avg_heart_rate_bpm?:number|null;
  resting_heart_rate_bpm?:number|null;
  source:string;
  updated_at:string;
};

export type CloudHealthSyncState = {
  enabled:boolean;
  device_id?:string|null;
  permissions:Record<string,any>;
  last_pull_at?:string|null;
  last_push_at?:string|null;
  last_error?:string|null;
};

export type CloudJourneyEvent = {
  id:string;
  event_key:string;
  event_date:string;
  kind:"milestone"|"strength"|"cardio"|"program"|"recovery";
  title:string;
  summary:string;
  metrics:Record<string,any>;
  source:string;
};

export type CloudPreferences = {
  sleep_target:string;
  wake_target:string;
  prep_target:string;
  disconnect_target:string;
  sleep_goal_minutes:number;
  weekend_sleep_target?:string|null;
  weekend_wake_target?:string|null;
  appearance_mode:"auto"|"light"|"dark";
  notifications_enabled:boolean;
  workout_reminder_time:string;
  creatine_reminder_time:string;
  display_name:string;
  fitness_goal:"muscle"|"strength"|"fitness"|"recomposition";
  experience_level:"beginner"|"intermediate"|"advanced";
  training_days:number;
  onboarding_completed:boolean;
  plan_started_at?:string|null;
  preferred_exercise_variants:Record<string,string>;
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

  try{ await supabase.rpc("seed_training_journey"); }catch{}

  const [workoutsRes,sleepRes,metricsRes,prefsRes,journeyRes,healthDailyRes,healthSyncRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id,client_session_id,workout_id,started_at,finished_at,logs,cardio,coach_mode,notes,source,external_id,health_metadata,exercise_variants")
      .eq("user_id",user.id)
      .order("finished_at",{ascending:false})
      .limit(120),
    supabase
      .from("sleep_sessions")
      .select("id,bed_at,lights_out_at,planned_wake_at,wake_at,quality,energy,notes,source,external_id")
      .eq("user_id",user.id)
      .order("bed_at",{ascending:false})
      .limit(60),
    supabase
      .from("body_metrics")
      .select("id,recorded_at,weight_kg,waist_cm,source,external_id")
      .eq("user_id",user.id)
      .order("recorded_at",{ascending:false})
      .limit(120),
    supabase
      .from("user_preferences")
      .select("sleep_target,wake_target,prep_target,disconnect_target,sleep_goal_minutes,weekend_sleep_target,weekend_wake_target,appearance_mode,notifications_enabled,workout_reminder_time,creatine_reminder_time,display_name,fitness_goal,experience_level,training_days,onboarding_completed,plan_started_at,preferred_exercise_variants")
      .eq("user_id",user.id)
      .maybeSingle(),
    supabase
      .from("training_journey_events")
      .select("id,event_key,event_date,kind,title,summary,metrics,source")
      .eq("user_id",user.id)
      .order("event_date",{ascending:false})
      .limit(100),
    supabase
      .from("health_daily_metrics")
      .select("id,metric_date,steps,active_energy_kcal,avg_heart_rate_bpm,resting_heart_rate_bpm,source,updated_at")
      .eq("user_id",user.id)
      .order("metric_date",{ascending:false})
      .limit(60),
    supabase
      .from("health_sync_state")
      .select("enabled,device_id,permissions,last_pull_at,last_push_at,last_error")
      .eq("user_id",user.id)
      .maybeSingle()
  ]);

  return {
    user,
    workouts:(workoutsRes.data ?? []) as CloudWorkoutSession[],
    sleep:(sleepRes.data ?? []) as CloudSleepSession[],
    metrics:(metricsRes.data ?? []) as CloudBodyMetric[],
    preferences:(prefsRes.data ?? null) as CloudPreferences|null,
    journey:(journeyRes.data ?? []) as CloudJourneyEvent[],
    healthDaily:(healthDailyRes.data ?? []) as CloudHealthDailyMetric[],
    healthSync:(healthSyncRes.data ?? null) as CloudHealthSyncState|null,
    errors:[
      workoutsRes.error,
      sleepRes.error,
      metricsRes.error,
      prefsRes.error,
      journeyRes.error,
      healthDailyRes.error,
      healthSyncRes.error
    ].filter(Boolean)
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
  exerciseVariants?:Record<string,string>;
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
    notes:item.notes ?? null,
    exercise_variants:item.exerciseVariants ?? {}
  };

  const response=existing?.id
    ? await supabase.from("workout_sessions").update(payload).eq("id",existing.id).select("id").single()
    : await supabase.from("workout_sessions").insert(payload).select("id").single();

  return response.error
    ? {ok:false,reason:response.error.message}
    : {ok:true,id:response.data?.id as string|undefined};
}

export async function syncLiveWorkout(input:{
  clientSessionId:string;
  workoutId:string;
  startedAt:number;
  currentExerciseId?:string|null;
  currentExerciseName?:string|null;
  currentExerciseIndex:number;
  currentSetIndex:number;
  completedIds:string[];
  deferredIds:string[];
  logs:Record<string,unknown>;
  exerciseVariants?:Record<string,string>;
  coachMode?:string|null;
  lastSet?:Record<string,unknown>|null;
  lastAction?:string|null;
}){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const payload={
    user_id:user.id,
    client_session_id:input.clientSessionId,
    workout_id:input.workoutId,
    started_at:new Date(input.startedAt).toISOString(),
    current_exercise_id:input.currentExerciseId ?? null,
    current_exercise_name:input.currentExerciseName ?? null,
    current_exercise_index:input.currentExerciseIndex,
    current_set_index:input.currentSetIndex,
    completed_ids:input.completedIds,
    deferred_ids:input.deferredIds,
    logs:input.logs,
    exercise_variants:input.exerciseVariants ?? {},
    coach_mode:input.coachMode ?? null,
    last_set:input.lastSet ?? null,
    last_action:input.lastAction ?? null,
    updated_at:new Date().toISOString()
  };

  const {data,error}=await supabase
    .from("live_workout_sessions")
    .upsert(payload,{onConflict:"user_id,client_session_id"})
    .select("id")
    .single();

  if(!error){
    try{
      await supabase.functions.invoke("nolan-live-feed",{
        body:{
          action:input.lastAction ?? "live_update",
          workout_id:input.workoutId,
          exercise_name:input.currentExerciseName ?? null,
          current_set_index:input.currentSetIndex,
          completed_count:input.completedIds.length,
          deferred_count:input.deferredIds.length,
          last_set:input.lastSet ?? null,
          client_time:new Date().toISOString()
        }
      });
    }catch{}
  }

  return error
    ? {ok:false,reason:error.message}
    : {ok:true,id:data?.id as string|undefined};
}

export async function loadLatestLiveWorkout(){
  if(!supabase) return null;
  const user=await ensureUser();
  if(!user) return null;

  const {data,error}=await supabase
    .from("live_workout_sessions")
    .select("id,client_session_id,workout_id,started_at,current_exercise_id,current_exercise_name,current_exercise_index,current_set_index,completed_ids,deferred_ids,logs,exercise_variants,coach_mode,last_set,last_action,updated_at")
    .eq("user_id",user.id)
    .gte("updated_at",new Date(Date.now()-12*60*60*1000).toISOString())
    .order("updated_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(error||!data) return null;
  return data as CloudLiveWorkout;
}

export async function clearLiveWorkout(clientSessionId:string){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("live_workout_sessions")
    .delete()
    .eq("user_id",user.id)
    .eq("client_session_id",clientSessionId);

  return error?{ok:false,reason:error.message}:{ok:true};
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

export async function saveSleepCheckin(
  id:string,
  input:{quality?:number|null;energy?:number|null;notes?:string|null}
){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const payload:Record<string,unknown>={updated_at:new Date().toISOString()};
  if("quality" in input) payload.quality=input.quality ?? null;
  if("energy" in input) payload.energy=input.energy ?? null;
  if("notes" in input) payload.notes=input.notes?.trim() || null;

  const {error}=await supabase
    .from("sleep_sessions")
    .update(payload)
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

  const redirectTo=typeof window!=="undefined"?window.location.origin:undefined;
  const {error}=await (supabase.auth as any).updateUser(
    {email},
    redirectTo?{emailRedirectTo:redirectTo}:undefined
  );
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


export async function savePushSubscription(input:{
  endpoint:string;
  p256dh:string;
  auth:string;
}){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("push_subscriptions")
    .upsert({
      user_id:user.id,
      endpoint:input.endpoint,
      p256dh:input.p256dh,
      auth:input.auth,
      updated_at:new Date().toISOString()
    },{onConflict:"endpoint"});

  return error?{ok:false,reason:error.message}:{ok:true};
}


export async function loadHealthSyncState():Promise<CloudHealthSyncState|null>{
  if(!supabase) return null;
  const user=await ensureUser();
  if(!user) return null;

  const {data,error}=await supabase
    .from("health_sync_state")
    .select("enabled,device_id,permissions,last_pull_at,last_push_at,last_error")
    .eq("user_id",user.id)
    .maybeSingle();

  if(error) return null;
  return (data ?? null) as CloudHealthSyncState|null;
}

export async function setHealthSyncState(input:Partial<CloudHealthSyncState>){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const {error}=await supabase
    .from("health_sync_state")
    .upsert({
      user_id:user.id,
      ...input,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});

  return error?{ok:false,reason:error.message}:{ok:true};
}

function healthWorkoutId(activityName:string){
  const name=activityName.toLowerCase();
  if(name.includes("running")||name.includes("course")) return "health-running";
  if(name.includes("walking")||name.includes("marche")) return "health-walking";
  if(name.includes("strength")||name.includes("training")||name.includes("musculation")) return "health-strength";
  if(name.includes("cycling")||name.includes("vélo")) return "health-cycling";
  return "health-workout";
}

export async function syncAppleHealthSnapshot(
  snapshot:NativeHealthSnapshot,
  input:{deviceId:string;permissions?:Record<string,unknown>}
){
  if(!supabase) return {ok:false,reason:"not_configured" as const};
  const user=await ensureUser();
  if(!user) return {ok:false,reason:"auth_failed" as const};

  const errors:string[]=[];

  if(snapshot.weights.length){
    const {error}=await supabase.from("body_metrics").upsert(
      snapshot.weights.map(item=>({
        user_id:user.id,
        recorded_at:item.recordedAt,
        weight_kg:item.kilograms,
        waist_cm:null,
        source:"apple_health",
        external_id:item.externalId
      })),
      {onConflict:"user_id,source,external_id"}
    );
    if(error) errors.push(error.message);
  }

  if(snapshot.sleepSessions.length){
    const {error}=await supabase.from("sleep_sessions").upsert(
      snapshot.sleepSessions.map(item=>({
        user_id:user.id,
        bed_at:item.start,
        lights_out_at:item.start,
        planned_wake_at:null,
        wake_at:item.end,
        quality:null,
        energy:null,
        notes:null,
        source:"apple_health",
        external_id:item.externalId,
        updated_at:new Date().toISOString()
      })),
      {onConflict:"user_id,source,external_id"}
    );
    if(error) errors.push(error.message);
  }

  const externalWorkouts=snapshot.workouts.filter(item=>!item.clientSessionId);
  if(externalWorkouts.length){
    const {error}=await supabase.from("workout_sessions").upsert(
      externalWorkouts.map(item=>({
        user_id:user.id,
        client_session_id:null,
        workout_id:healthWorkoutId(item.activityName),
        started_at:item.start,
        finished_at:item.end,
        logs:{},
        cardio:{
          durationMinutes:Math.round((item.durationSeconds/60)*10)/10,
          durationSeconds:item.durationSeconds,
          distanceKm:item.distanceMeters==null?undefined:Math.round((item.distanceMeters/1000)*1000)/1000,
          source:"apple_health"
        },
        coach_mode:null,
        notes:"Importé depuis Apple Santé",
        source:"apple_health",
        external_id:item.externalId,
        health_metadata:{
          activityType:item.activityType,
          activityName:item.activityName,
          activeEnergyKcal:item.activeEnergyKcal ?? null,
          distanceMeters:item.distanceMeters ?? null
        }
      })),
      {onConflict:"user_id,source,external_id"}
    );
    if(error) errors.push(error.message);
  }

  if(snapshot.daily.length){
    const {error}=await supabase.from("health_daily_metrics").upsert(
      snapshot.daily.map(item=>({
        user_id:user.id,
        metric_date:item.date,
        steps:item.steps ?? null,
        active_energy_kcal:item.activeEnergyKcal ?? null,
        avg_heart_rate_bpm:item.averageHeartRateBpm ?? null,
        resting_heart_rate_bpm:item.restingHeartRateBpm ?? null,
        source:"apple_health",
        updated_at:new Date().toISOString()
      })),
      {onConflict:"user_id,metric_date,source"}
    );
    if(error) errors.push(error.message);
  }

  const pulledAt=new Date().toISOString();
  const state=await setHealthSyncState({
    enabled:errors.length===0,
    device_id:input.deviceId,
    permissions:input.permissions ?? {},
    last_pull_at:pulledAt,
    last_error:errors.length?errors.join(" · "):null
  });
  if(!state.ok) errors.push(String(state.reason));

  return errors.length
    ? {ok:false,reason:errors.join(" · ")}
    : {
        ok:true,
        imported:{
          weights:snapshot.weights.length,
          sleep:snapshot.sleepSessions.length,
          workouts:externalWorkouts.length,
          daily:snapshot.daily.length
        },
        pulledAt
      };
}

export async function markHealthPush(input:{deviceId?:string|null;error?:string|null}){
  return setHealthSyncState({
    enabled:!input.error,
    device_id:input.deviceId ?? undefined,
    last_push_at:new Date().toISOString(),
    last_error:input.error ?? null
  });
}
