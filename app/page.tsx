"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { history, workouts } from "../lib/workouts";
import type { CardioLog, CardioRoutePoint, CardioSplit, Exercise, SetLog, SupersetPart, Workout } from "../lib/types";
import {
  clearLiveWorkout,
  finishSleepSession,
  isCloudConfigured,
  loadCloudState,
  loadLatestLiveWorkout,
  saveBodyMetric,
  savePreferences,
  savePushSubscription,
  secureAnonymousAccount,
  sendMagicLink,
  setLightsOut,
  setSleepQuality,
  saveSleepCheckin,
  startSleepSession,
  syncAppleHealthSnapshot,
  syncLiveWorkout,
  syncWorkoutSession,
  loadHealthSyncState,
  markHealthPush,
  updateSleepPlan,
  VAPID_PUBLIC_KEY,
  type CloudHealthDailyMetric,
  type CloudHealthSyncState,
  type CloudJourneyEvent
} from "../lib/cloud";
import {
  getNativeHealthStatus,
  nativeHealthAvailable,
  pullNativeHealthSnapshot,
  requestNativeHealthAuthorization,
  writeNativeHealthSleep,
  writeNativeHealthWeight,
  writeNativeHealthWorkout,
  type NativeHealthStatus
} from "../lib/health";

type CoachMode = "normal"|"tired"|"short"|"crowded";
type FitnessGoal = "muscle"|"strength"|"fitness"|"recomposition";
type ExperienceLevel = "beginner"|"intermediate"|"advanced";
type PlanDay = {label:string;name:string;workoutId:string|null};

type SupersetDraft = {
  weight:string;
  reps:string;
  rir:string;
  failed:boolean;
};

type SessionState = {
  clientSessionId:string;
  workoutId:string;
  exerciseIndex:number;
  setIndex:number;
  logs:Record<string,SetLog[]>;
  startedAt:number;
  completedIds:string[];
  deferredIds:string[];
  coachMode:CoachMode;
  restOverrides:Record<string,number>;
};

type CompletedSession = {
  id?:string;
  clientSessionId:string;
  workoutId:string;
  finishedAt:number;
  startedAt?:number;
  logs:Record<string,SetLog[]>;
  cardio?:CardioLog|null;
  coachMode?:string|null;
  notes?:string|null;
};

type SleepSession = {
  id:string;
  bedAt:number;
  lightsOutAt?:number|null;
  plannedWakeAt?:number|null;
  wakeAt?:number|null;
  quality?:number|null;
  energy?:number|null;
  notes?:string|null;
};

type BodyMetric = {
  id:string;
  recordedAt:number;
  weightKg?:number|null;
  waistCm?:number|null;
};

const STORAGE_KEY="charlie-training-v4-cache";
const SESSION_KEY="charlie-training-live-v4";

const dayLabels=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function buildPersonalSchedule(trainingDays:number):PlanDay[]{
  const days:PlanDay[]=dayLabels.map(label=>({label,name:"Repos",workoutId:null}));

  if(trainingDays<=3){
    days[0]={label:"Lun",name:"Push",workoutId:"push"};
    days[2]={label:"Mer",name:"Pull",workoutId:"pull"};
    days[5]={label:"Sam",name:"Legs",workoutId:"legs"};
    return days;
  }

  if(trainingDays===4){
    days[0]={label:"Lun",name:"Push",workoutId:"push"};
    days[1]={label:"Mar",name:"Pull",workoutId:"pull"};
    days[3]={label:"Jeu",name:"Legs",workoutId:"legs"};
    days[5]={label:"Sam",name:"Upper",workoutId:"upper"};
    return days;
  }

  days[0]={label:"Lun",name:"Push",workoutId:"push"};
  days[1]={label:"Mar",name:"Pull",workoutId:"pull"};
  days[2]={label:"Mer",name:"Cardio",workoutId:"cardio"};
  days[3]={label:"Jeu",name:"Legs",workoutId:"legs"};
  days[4]={label:"Ven",name:"Récup",workoutId:null};
  days[5]={label:"Sam",name:"Upper",workoutId:"upper"};
  days[6]={label:"Dim",name:"Repos",workoutId:null};
  return days;
}

function goalLabel(goal:FitnessGoal){
  if(goal==="strength") return "Force";
  if(goal==="fitness") return "Forme";
  if(goal==="recomposition") return "Recomposition";
  return "Prise de muscle";
}

function levelLabel(level:ExperienceLevel){
  if(level==="beginner") return "Débutant";
  if(level==="advanced") return "Avancé";
  return "Intermédiaire";
}

function formatTimer(s:number){
  const m=Math.floor(s/60).toString().padStart(2,"0");
  const sec=(s%60).toString().padStart(2,"0");
  return `${m}:${sec}`;
}

function durationLabel(minutes:number){
  const h=Math.floor(minutes/60);
  const m=minutes%60;
  return m?`${h}h${String(m).padStart(2,"0")}`:`${h}h`;
}

function sleepWindowMinutes(sleepTime:string,wakeTime:string){
  const [sh,sm]=sleepTime.split(":").map(Number);
  const [wh,wm]=wakeTime.split(":").map(Number);
  const start=sh*60+sm;
  const end=wh*60+wm;
  const diff=end-start;
  return diff>0?diff:diff+24*60;
}

function clock(dateOrMs:number|Date){
  return new Date(dateOrMs).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
}

function wakeDateForClock(startMs:number,time:string){
  const d=new Date(startMs);
  const [h,m]=time.split(":").map(Number);
  d.setHours(h,m,0,0);
  if(d.getTime()<=startMs) d.setDate(d.getDate()+1);
  return d;
}

function mondayStart(date=new Date()){
  const d=new Date(date);
  const day=(d.getDay()+6)%7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()-day);
  return d;
}

function dateKey(ms:number){
  return new Date(ms).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
}

const RUN_STORAGE_KEY="charlie-training-active-run-v1";

function haversineMeters(a:CardioRoutePoint,b:CardioRoutePoint){
  const R=6371000;
  const toRad=(v:number)=>v*Math.PI/180;
  const dLat=toRad(b.lat-a.lat);
  const dLng=toRad(b.lng-a.lng);
  const lat1=toRad(a.lat);
  const lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}

function formatPace(secondsPerKm:number){
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0) return "—";
  const m=Math.floor(secondsPerKm/60);
  const s=Math.round(secondsPerKm%60).toString().padStart(2,"0");
  return `${m}:${s}/km`;
}

function formatDistance(meters:number){
  return meters<1000?`${Math.round(meters)} m`:`${(meters/1000).toFixed(2)} km`;
}

function RunRouteMap({points}:{points:CardioRoutePoint[]}){
  if(points.length<2){
    return <div className="run-map-empty">
      <div className="run-map-grid"/>
      <span>Le tracé apparaîtra ici pendant ta course.</span>
    </div>;
  }
  const lats=points.map(p=>p.lat);
  const lngs=points.map(p=>p.lng);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats);
  const minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
  const latSpan=Math.max(.00015,maxLat-minLat);
  const lngSpan=Math.max(.00015,maxLng-minLng);
  const pad=18;
  const width=320, height=190;
  const coords=points.map(p=>{
    const x=pad+((p.lng-minLng)/lngSpan)*(width-pad*2);
    const y=height-pad-((p.lat-minLat)/latSpan)*(height-pad*2);
    return [x,y];
  });
  const path=coords.map(([x,y],i)=>`${i===0?"M":"L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [sx,sy]=coords[0];
  const [ex,ey]=coords[coords.length-1];
  return <svg className="run-route-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tracé GPS de la course">
    <defs>
      <linearGradient id="runRouteGradient" x1="0" x2="1"><stop stopColor="#2369f6"/><stop offset="1" stopColor="#20bff4"/></linearGradient>
      <pattern id="runGrid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1"/>
      </pattern>
    </defs>
    <rect width={width} height={height} rx="20" fill="currentColor" opacity=".035"/>
    <rect width={width} height={height} rx="20" fill="url(#runGrid)"/>
    <path d={path} fill="none" stroke="url(#runRouteGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={sx} cy={sy} r="6" fill="#19b56b" stroke="white" strokeWidth="3"/>
    <circle cx={ex} cy={ey} r="7" fill="#2369f6" stroke="white" strokeWidth="3"/>
  </svg>;
}

function urlBase64ToUint8Array(base64String:string){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=window.atob(base64);
  return Uint8Array.from([...rawData].map(ch=>ch.charCodeAt(0)));
}

const exerciseAliases:Record<string,string[]>={
  "incline-bench":["incline-bench","incline-upper"],
  "incline-upper":["incline-bench","incline-upper"],
  "row":["row","row-upper"],
  "row-upper":["row","row-upper"],
  "lat-pulldown":["lat-pulldown","lat-upper"],
  "lat-upper":["lat-pulldown","lat-upper"],
  "shoulder-press":["shoulder-press","shoulder-upper"],
  "shoulder-upper":["shoulder-press","shoulder-upper"],
  "lateral":["lateral","lateral-upper"],
  "lateral-upper":["lateral","lateral-upper"]
};

const exerciseLoadSteps:Record<string,number>={
  "incline-bench":5,
  "incline-upper":5,
  "smith-squat":5,
  "rdl":5,
  "leg-press":7,
  "crunch":4,
  "abs-upper":4
};

function incrementFor(ex:Exercise){
  if(exerciseLoadSteps[ex.id]!=null) return exerciseLoadSteps[ex.id];
  if(ex.unit==="kg/bras") return 2;
  if(ex.unit==="+kg") return 2.5;
  if(ex.unit==="kg") return 2.5;
  return 0;
}

function MiniChart({values,suffix=""}:{values:number[];suffix?:string}){
  if(values.length===0) return <div className="chart-empty">Pas encore assez de données.</div>;
  const width=320;
  const height=112;
  const min=Math.min(...values);
  const max=Math.max(...values);
  const spread=Math.max(1,max-min);
  const points=values.map((v,i)=>{
    const x=values.length===1?width/2:(i/(values.length-1))*width;
    const y=height-12-((v-min)/spread)*(height-28);
    return `${x},${y}`;
  }).join(" ");
  return <div className="mini-chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart" role="img" aria-label="Évolution">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {points.split(" ").map((p,i)=>{
        const [cx,cy]=p.split(",");
        return <circle key={i} cx={cx} cy={cy} r="4" fill="currentColor"/>;
      })}
    </svg>
    <div className="chart-range"><span>{values[0]}{suffix}</span><strong>{values.at(-1)}{suffix}</strong></div>
  </div>;
}

function TabIcon({id}:{id:"home"|"programs"|"exercises"|"analysis"|"more"}){
  const common={width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
  if(id==="home") return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
  if(id==="programs") return <svg {...common}><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/><circle cx="7" cy="5" r="1.5"/><circle cx="14" cy="12" r="1.5"/><circle cx="10" cy="19" r="1.5"/></svg>;
  if(id==="exercises") return <svg {...common}><path d="M5 9v6"/><path d="M19 9v6"/><path d="M8 7v10"/><path d="M16 7v10"/><path d="M8 12h8"/></svg>;
  if(id==="analysis") return <svg {...common}><path d="M4 19V10"/><path d="M9 19V6"/><path d="M14 19v-4"/><path d="M19 19V3"/></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
}

function ExerciseGlyph({exercise}:{exercise:Exercise}){
  const key=(exercise.id+" "+exercise.name).toLowerCase();
  const common={viewBox:"0 0 64 64",fill:"none",stroke:"currentColor",strokeWidth:3,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
  if(/row|pulldown|curl|pull|lat/.test(key)) return <svg {...common}><circle cx="32" cy="12" r="5"/><path d="M31 18v16l-9 12"/><path d="M32 25l14-7"/><path d="M19 18h28"/><path d="M32 34l10 13"/></svg>;
  if(/squat|press|leg|rdl|fente/.test(key)) return <svg {...common}><circle cx="30" cy="11" r="5"/><path d="M29 17l-4 16 12 7"/><path d="M25 33l-10 11"/><path d="M37 40l8 11"/><path d="M16 23h29"/><path d="M20 20v6M41 20v6"/></svg>;
  if(/cardio|run|foot|course/.test(key)) return <svg {...common}><circle cx="34" cy="10" r="5"/><path d="M31 17l-7 12 10 6"/><path d="M27 22l12 5 9-6"/><path d="M34 35l-12 14"/><path d="M34 35l13 10"/></svg>;
  if(/crunch|abs|gainage/.test(key)) return <svg {...common}><circle cx="18" cy="35" r="5"/><path d="M23 35h15l8-10"/><path d="M37 35l10 12"/><path d="M12 48h40"/></svg>;
  return <svg {...common}><circle cx="32" cy="11" r="5"/><path d="M32 17v18"/><path d="M20 24h24"/><path d="M20 20v8M44 20v8"/><path d="M32 35l-10 15"/><path d="M32 35l10 15"/></svg>;
}

function ExerciseArt({exercise,large=false}:{exercise:Exercise;large?:boolean}){
  const key=(exercise.id+" "+exercise.name+" "+exercise.target).toLowerCase();
  const chest=/pec|bench|chest|développé|incline/.test(key);
  const back=/dos|row|pull|lat|traction/.test(key);
  const legs=/squat|leg|rdl|fente|ischio|quad/.test(key);
  const shoulders=/shoulder|lateral|élévation|épaule/.test(key);
  const arms=/curl|triceps|biceps|bras/.test(key);
  return <svg className={large?"exercise-art large":"exercise-art"} viewBox="0 0 320 220" role="img" aria-label={"Illustration "+exercise.name}>
    <defs>
      <linearGradient id={"skin-"+exercise.id} x1="0" x2="1"><stop stopColor="#d3d8df"/><stop offset="1" stopColor="#9fa8b5"/></linearGradient>
      <linearGradient id={"accent-"+exercise.id} x1="0" x2="1"><stop stopColor="#ff765e"/><stop offset="1" stopColor="#ee4339"/></linearGradient>
    </defs>
    <rect x="34" y="163" width="248" height="10" rx="5" fill="#c6ccd4"/>
    <rect x="68" y="173" width="8" height="28" rx="4" fill="#aeb6c1"/>
    <rect x="244" y="173" width="8" height="28" rx="4" fill="#aeb6c1"/>
    <circle cx="163" cy="62" r="18" fill={"url(#skin-"+exercise.id+")"}/>
    <path d="M148 81 C136 100 135 126 145 153 L179 153 C187 125 185 101 176 82 Z" fill={"url(#skin-"+exercise.id+")"}/>
    <path d="M146 94 L105 117 L111 128 L152 112" fill={"url(#skin-"+exercise.id+")"}/>
    <path d="M178 94 L219 117 L213 128 L174 112" fill={"url(#skin-"+exercise.id+")"}/>
    <path d="M151 151 L126 186 L139 191 L163 160" fill={"url(#skin-"+exercise.id+")"}/>
    <path d="M176 151 L197 187 L184 192 L160 160" fill={"url(#skin-"+exercise.id+")"}/>
    {chest&&<path d="M147 91 Q162 82 178 91 L175 111 Q162 119 149 111 Z" fill={"url(#accent-"+exercise.id+")"} opacity=".95"/>}
    {back&&<path d="M144 91 Q162 78 180 91 L175 129 Q161 138 147 127 Z" fill={"url(#accent-"+exercise.id+")"} opacity=".95"/>}
    {legs&&<><path d="M148 145 L163 155 L140 188 L127 184 Z" fill={"url(#accent-"+exercise.id+")"}/><path d="M174 145 L160 157 L184 190 L198 185 Z" fill={"url(#accent-"+exercise.id+")"}/></>}
    {shoulders&&<><circle cx="144" cy="95" r="9" fill={"url(#accent-"+exercise.id+")"}/><circle cx="180" cy="95" r="9" fill={"url(#accent-"+exercise.id+")"}/></>}
    {arms&&<><path d="M137 100 L106 117 L112 130 L145 113 Z" fill={"url(#accent-"+exercise.id+")"}/><path d="M188 101 L218 117 L212 130 L179 113 Z" fill={"url(#accent-"+exercise.id+")"}/></>}
    <path d="M87 113 H235" stroke="#343b46" strokeWidth="7" strokeLinecap="round"/>
    <circle cx="83" cy="113" r="20" fill="#262c35"/><circle cx="239" cy="113" r="20" fill="#262c35"/>
    <circle cx="83" cy="113" r="12" fill="#4a515b"/><circle cx="239" cy="113" r="12" fill="#4a515b"/>
  </svg>;
}

export default function Home(){
  const [tab,setTab]=useState<"home"|"programs"|"exercises"|"analysis"|"more">("home");
  const [trackingView,setTrackingView]=useState<"sleep"|"training">("training");
  const [exerciseSearch,setExerciseSearch]=useState("");
  const [exerciseFilter,setExerciseFilter]=useState("Tous");
  const [selectedExerciseDetailId,setSelectedExerciseDetailId]=useState<string|null>(null);
  const [quickMenuOpen,setQuickMenuOpen]=useState(false);
  const [selectedWorkoutId,setSelectedWorkoutId]=useState("legs");
  const [session,setSession]=useState<SessionState|null>(null);
  const [completedSessions,setCompletedSessions]=useState<CompletedSession[]>([]);
  const [sleepSessions,setSleepSessions]=useState<SleepSession[]>([]);
  const [bodyMetrics,setBodyMetrics]=useState<BodyMetric[]>([]);
  const [journeyEvents,setJourneyEvents]=useState<CloudJourneyEvent[]>([]);
  const [healthDaily,setHealthDaily]=useState<CloudHealthDailyMetric[]>([]);
  const [healthSyncState,setHealthSyncStateLocal]=useState<CloudHealthSyncState|null>(null);
  const [nativeHealthStatus,setNativeHealthStatus]=useState<NativeHealthStatus|null>(null);
  const [healthSyncing,setHealthSyncing]=useState(false);
  const [healthMessage,setHealthMessage]=useState("");
  const healthBootstrappedRef=useRef(false);
  const lastHealthAutoSyncRef=useRef(0);
  const [authUser,setAuthUser]=useState<any>(null);
  const [cloudLoading,setCloudLoading]=useState(true);
  const [cloudStatus,setCloudStatus]=useState<"idle"|"syncing"|"ok"|"error">("idle");

  const [rest,setRest]=useState(0);
  const [restEndAt,setRestEndAt]=useState<number|null>(null);
  const [restNotificationArmed,setRestNotificationArmed]=useState(false);
  const [reps,setReps]=useState("8");
  const [weight,setWeight]=useState("");
  const [rir,setRir]=useState("2");
  const [failed,setFailed]=useState(false);
  const [supersetDrafts,setSupersetDrafts]=useState<Record<string,SupersetDraft>>({});
  const [coachMode,setCoachMode]=useState<CoachMode>("normal");
  const [now,setNow]=useState(Date.now());
  const wakeLockRef=useRef<any>(null);

  const [cardioDuration,setCardioDuration]=useState("45");
  const [cardioDistance,setCardioDistance]=useState("");
  const [cardioHr,setCardioHr]=useState("");
  const [cardioRpe,setCardioRpe]=useState("4");

  const [runStatus,setRunStatus]=useState<"idle"|"locating"|"ready"|"running"|"paused"|"finished">("idle");
  const [runPoints,setRunPoints]=useState<CardioRoutePoint[]>([]);
  const [runStartedAt,setRunStartedAt]=useState<number|null>(null);
  const [runFinishedAt,setRunFinishedAt]=useState<number|null>(null);
  const [runPausedMs,setRunPausedMs]=useState(0);
  const [runPauseStartedAt,setRunPauseStartedAt]=useState<number|null>(null);
  const [runLocationError,setRunLocationError]=useState("");
  const [runGpsAccuracy,setRunGpsAccuracy]=useState<number|null>(null);
  const runWatchIdRef=useRef<number|null>(null);

  const [sleepTarget,setSleepTarget]=useState("23:00");
  const [prepTarget,setPrepTarget]=useState("22:15");
  const [disconnectTarget,setDisconnectTarget]=useState("22:00");
  const [wakeTarget,setWakeTarget]=useState("07:00");
  const [sleepGoalMinutes,setSleepGoalMinutes]=useState(510);
  const [plannedWakeTime,setPlannedWakeTime]=useState("07:00");
  const [morningNotes,setMorningNotes]=useState("");
  const [notificationsEnabled,setNotificationsEnabled]=useState(false);
  const [pushReady,setPushReady]=useState(false);
  const [workoutReminderTime,setWorkoutReminderTime]=useState("08:00");
  const [creatineReminderTime,setCreatineReminderTime]=useState("12:00");
  const [appearanceMode,setAppearanceMode]=useState<"auto"|"light"|"dark">("auto");
  const [systemDark,setSystemDark]=useState(false);
  const [selectedHomeDayIndex,setSelectedHomeDayIndex]=useState<number|null>(null);
  const [prefsLoaded,setPrefsLoaded]=useState(false);

  const [displayName,setDisplayName]=useState("Charlie");
  const [fitnessGoal,setFitnessGoal]=useState<FitnessGoal>("muscle");
  const [experienceLevel,setExperienceLevel]=useState<ExperienceLevel>("intermediate");
  const [trainingDays,setTrainingDays]=useState(5);
  const [onboardingCompleted,setOnboardingCompleted]=useState(true);
  const [onboardingStep,setOnboardingStep]=useState(0);
  const [planStartedAt,setPlanStartedAt]=useState<string|null>(null);
  const [profileLoaded,setProfileLoaded]=useState(false);

  const [metricWeight,setMetricWeight]=useState("");
  const [metricWaist,setMetricWaist]=useState("");
  const [accountEmail,setAccountEmail]=useState("");
  const [accountMessage,setAccountMessage]=useState("");
  const [chartExerciseId,setChartExerciseId]=useState("incline-bench");

  const schedule=useMemo(()=>buildPersonalSchedule(trainingDays),[trainingDays]);

  const selectedWorkout=useMemo(
    ()=>workouts.find(w=>w.id===selectedWorkoutId)??workouts[0],
    [selectedWorkoutId]
  );
  const selectedExerciseDetail=useMemo(
    ()=>workouts.flatMap(w=>w.exercises).find(ex=>ex.id===selectedExerciseDetailId)??null,
    [selectedExerciseDetailId]
  );
  const selectedExerciseWorkout=useMemo(
    ()=>selectedExerciseDetail
      ? workouts.find(w=>w.exercises.some(ex=>ex.id===selectedExerciseDetail.id))??null
      : null,
    [selectedExerciseDetail]
  );
  const currentWorkout=session
    ? workouts.find(w=>w.id===session.workoutId)??selectedWorkout
    : selectedWorkout;
  const currentExercise=session&&currentWorkout.id!=="cardio"
    ? currentWorkout.exercises[session.exerciseIndex]
    : null;

  async function refreshCloud(){
    setCloudLoading(true);
    const state=await loadCloudState();
    if(!state){
      setCloudStatus("error");
      setCloudLoading(false);
      return;
    }

    setAuthUser(state.user);
    const mapped:CompletedSession[]=state.workouts.map(s=>({
      id:s.id,
      clientSessionId:s.client_session_id??s.id,
      workoutId:s.workout_id,
      startedAt:s.started_at?new Date(s.started_at).getTime():undefined,
      finishedAt:new Date(s.finished_at).getTime(),
      logs:(s.logs??{}) as Record<string,SetLog[]>,
      cardio:(s.cardio??null) as CardioLog|null,
      coachMode:s.coach_mode,
      notes:s.notes
    })).sort((a,b)=>a.finishedAt-b.finishedAt);

    setCompletedSessions(mapped);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(mapped));

    setSleepSessions(state.sleep.map(s=>({
      id:s.id,
      bedAt:new Date(s.bed_at).getTime(),
      lightsOutAt:s.lights_out_at?new Date(s.lights_out_at).getTime():null,
      plannedWakeAt:s.planned_wake_at?new Date(s.planned_wake_at).getTime():null,
      wakeAt:s.wake_at?new Date(s.wake_at).getTime():null,
      quality:s.quality??null,
      energy:s.energy??null,
      notes:s.notes??null
    })));

    setBodyMetrics(state.metrics.map(m=>({
      id:m.id,
      recordedAt:new Date(m.recorded_at).getTime(),
      weightKg:m.weight_kg==null?null:Number(m.weight_kg),
      waistCm:m.waist_cm==null?null:Number(m.waist_cm)
    })));

    setJourneyEvents(state.journey??[]);
    setHealthDaily(state.healthDaily??[]);
    setHealthSyncStateLocal(state.healthSync??null);

    if(state.preferences){
      setSleepTarget(state.preferences.sleep_target.slice(0,5));
      setWakeTarget(state.preferences.wake_target.slice(0,5));
      setPrepTarget(state.preferences.prep_target.slice(0,5));
      setDisconnectTarget((state.preferences.disconnect_target??"22:00").slice(0,5));
      setSleepGoalMinutes(Number(state.preferences.sleep_goal_minutes??510));
      setAppearanceMode((state.preferences.appearance_mode??"auto") as "auto"|"light"|"dark");
      setNotificationsEnabled(Boolean(state.preferences.notifications_enabled));
      setWorkoutReminderTime(state.preferences.workout_reminder_time.slice(0,5));
      setCreatineReminderTime(state.preferences.creatine_reminder_time.slice(0,5));
      setDisplayName(state.preferences.display_name||"Charlie");
      setFitnessGoal((state.preferences.fitness_goal||"muscle") as FitnessGoal);
      setExperienceLevel((state.preferences.experience_level||"intermediate") as ExperienceLevel);
      setTrainingDays(Math.max(3,Math.min(5,Number(state.preferences.training_days??5))));
      setOnboardingCompleted(Boolean(state.preferences.onboarding_completed));
      setPlanStartedAt(state.preferences.plan_started_at??null);
    }else{
      setOnboardingCompleted(false);
    }
    setProfileLoaded(true);
    setPrefsLoaded(true);
    setCloudStatus(state.errors.length?"error":"ok");
    setCloudLoading(false);
  }

  useEffect(()=>{
    let restoredLocal:SessionState|null=null;
    try{
      const cached=JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]");
      if(Array.isArray(cached)) setCompletedSessions(cached);
    }catch{}
    try{
      const raw=localStorage.getItem(SESSION_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        const restored:SessionState={
          ...parsed,
          completedIds:parsed.completedIds??[],
          deferredIds:parsed.deferredIds??[],
          clientSessionId:parsed.clientSessionId??`legacy-${parsed.startedAt}`,
          coachMode:parsed.coachMode??"normal",
          restOverrides:parsed.restOverrides??{}
        };
        restoredLocal=restored;
        setSession(restored);
        pushLiveSession(restored,"session_restored");
      }
    }catch{}

    if(!restoredLocal){
      void loadLatestLiveWorkout().then(live=>{
        if(!live) return;
        const restored:SessionState={
          clientSessionId:live.client_session_id,
          workoutId:live.workout_id,
          exerciseIndex:live.current_exercise_index??0,
          setIndex:live.current_set_index??0,
          logs:(live.logs??{}) as Record<string,SetLog[]>,
          startedAt:new Date(live.started_at).getTime(),
          completedIds:Array.isArray(live.completed_ids)?live.completed_ids:[],
          deferredIds:Array.isArray(live.deferred_ids)?live.deferred_ids:[],
          coachMode:(["normal","tired","short","crowded"] as CoachMode[]).includes(live.coach_mode as CoachMode)
            ? live.coach_mode as CoachMode
            : "normal",
          restOverrides:{}
        };
        setSession(restored);
      });
    }

    if("serviceWorker" in navigator){
      void navigator.serviceWorker.register("/sw.js").then(async reg=>{
        try{
          const existing=await reg.pushManager.getSubscription();
          setPushReady(Boolean(existing));
        }catch{}
      });
    }
    void refreshCloud();
  },[]);

  useEffect(()=>{
    const t=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(!authUser?.id||healthBootstrappedRef.current) return;
    healthBootstrappedRef.current=true;

    if(!nativeHealthAvailable()){
      setNativeHealthStatus(null);
      return;
    }

    void (async()=>{
      try{
        const status=await getNativeHealthStatus();
        setNativeHealthStatus(status);
        if(status.authorizationRequested){
          setHealthSyncing(true);
          const snapshot=await pullNativeHealthSnapshot(45);
          const synced=await syncAppleHealthSnapshot(snapshot,{
            deviceId:status.deviceId,
            permissions:status.writeAuthorization
          });
          if(synced.ok){
            setHealthMessage("Apple Santé synchronisé.");
            await refreshCloud();
          }else{
            setHealthMessage("Synchro Apple Santé à vérifier.");
          }
        }
      }catch(error:any){
        setHealthMessage(error?.message==="native_health_unavailable"
          ?"Apple Santé est disponible dans l’app iPhone native."
          :"Apple Santé indisponible pour le moment.");
      }finally{
        setHealthSyncing(false);
      }
    })();
  },[authUser?.id]);

  useEffect(()=>{
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const sync=()=>setSystemDark(media.matches);
    sync();
    media.addEventListener?.("change",sync);
    return()=>media.removeEventListener?.("change",sync);
  },[]);

  useEffect(()=>{
    const handleVisibility=()=>{
      if(
        document.visibilityState!=="visible" ||
        !nativeHealthStatus?.authorizationRequested ||
        healthSyncing ||
        Date.now()-lastHealthAutoSyncRef.current<10*60*1000
      ) return;

      lastHealthAutoSyncRef.current=Date.now();
      void syncAppleHealthNow(false);
    };

    document.addEventListener("visibilitychange",handleVisibility);
    return()=>document.removeEventListener("visibilitychange",handleVisibility);
  },[nativeHealthStatus?.authorizationRequested,healthSyncing]);

  useEffect(()=>{
    if(session) localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  },[session]);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(RUN_STORAGE_KEY);
      if(!raw) return;
      const saved=JSON.parse(raw);
      if(!saved?.startedAt) return;
      setRunStartedAt(saved.startedAt);
      setRunFinishedAt(saved.finishedAt??null);
      setRunPausedMs(saved.pausedMs??0);
      setRunPauseStartedAt(saved.pauseStartedAt??null);
      setRunPoints(Array.isArray(saved.points)?saved.points:[]);
      setRunStatus(saved.status==="running"?"paused":saved.status??"paused");
      if(saved.status==="running") setRunPauseStartedAt(Date.now());
    }catch{}
  },[]);

  useEffect(()=>{
    if(!runStartedAt||runStatus==="idle"||runStatus==="ready"||runStatus==="locating"){
      if(runStatus==="idle") localStorage.removeItem(RUN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(RUN_STORAGE_KEY,JSON.stringify({
      status:runStatus,
      startedAt:runStartedAt,
      finishedAt:runFinishedAt,
      pausedMs:runPausedMs,
      pauseStartedAt:runPauseStartedAt,
      points:runPoints.slice(-3000)
    }));
  },[runStatus,runStartedAt,runFinishedAt,runPausedMs,runPauseStartedAt,runPoints]);

  useEffect(()=>{
    if(runStatus!=="running"||!runStartedAt||!navigator.geolocation) return;
    const watchId=navigator.geolocation.watchPosition(position=>{
      const accuracy=position.coords.accuracy??999;
      setRunGpsAccuracy(accuracy);
      setRunLocationError("");
      if(accuracy>80) return;

      const elapsedSeconds=Math.max(0,Math.floor((position.timestamp-runStartedAt-runPausedMs)/1000));
      const point:CardioRoutePoint={
        lat:position.coords.latitude,
        lng:position.coords.longitude,
        altitude:position.coords.altitude,
        accuracy,
        speedMps:position.coords.speed,
        timestamp:position.timestamp,
        elapsedSeconds
      };

      setRunPoints(prev=>{
        const last=prev.at(-1);
        if(!last) return [point];
        const dt=Math.max(.001,(point.timestamp-last.timestamp)/1000);
        const distance=haversineMeters(last,point);
        const impliedSpeed=distance/dt;
        if(impliedSpeed>12||distance>250) return prev;
        if(distance<1.5&&dt<8) return prev;
        return [...prev,point].slice(-3000);
      });
    },error=>{
      setRunLocationError(error.code===1
        ?"Accès GPS refusé. Autorise la localisation pour enregistrer le parcours."
        :"Signal GPS indisponible pour le moment.");
    },{
      enableHighAccuracy:true,
      maximumAge:1000,
      timeout:12000
    });
    runWatchIdRef.current=watchId;
    return()=>{
      navigator.geolocation.clearWatch(watchId);
      if(runWatchIdRef.current===watchId) runWatchIdRef.current=null;
    };
  },[runStatus,runStartedAt,runPausedMs]);

  useEffect(()=>{
    if(!prefsLoaded) return;
    const t=setTimeout(()=>{
      setCloudStatus("syncing");
      void savePreferences({
        sleep_target:sleepTarget,
        wake_target:wakeTarget,
        prep_target:prepTarget,
        disconnect_target:disconnectTarget,
        sleep_goal_minutes:sleepGoalMinutes,
        appearance_mode:appearanceMode,
        notifications_enabled:notificationsEnabled,
        workout_reminder_time:workoutReminderTime,
        creatine_reminder_time:creatineReminderTime,
        display_name:displayName,
        fitness_goal:fitnessGoal,
        experience_level:experienceLevel,
        training_days:trainingDays,
        onboarding_completed:onboardingCompleted,
        plan_started_at:planStartedAt
      }).then(r=>setCloudStatus(r.ok?"ok":"error"));
    },500);
    return()=>clearTimeout(t);
  },[
    prefsLoaded,sleepTarget,wakeTarget,prepTarget,disconnectTarget,sleepGoalMinutes,appearanceMode,notificationsEnabled,
    workoutReminderTime,creatineReminderTime,
    displayName,fitnessGoal,experienceLevel,trainingDays,onboardingCompleted,planStartedAt
  ]);

  useEffect(()=>{
    const saved=Number(localStorage.getItem("charlie-rest-end-at")||0);
    if(saved>Date.now()){
      setRestEndAt(saved);
      setRest(Math.max(0,Math.ceil((saved-Date.now())/1000)));
      setRestNotificationArmed(true);
    }else{
      localStorage.removeItem("charlie-rest-end-at");
    }
  },[]);

  useEffect(()=>{
    if(!restEndAt) return;
    localStorage.setItem("charlie-rest-end-at",String(restEndAt));
    const tick=()=>{
      const remaining=Math.max(0,Math.ceil((restEndAt-Date.now())/1000));
      setRest(remaining);
      if(remaining<=0){
        setRestEndAt(null);
        localStorage.removeItem("charlie-rest-end-at");
      }
    };
    tick();
    const t=setInterval(tick,250);
    document.addEventListener("visibilitychange",tick);
    return()=>{
      clearInterval(t);
      document.removeEventListener("visibilitychange",tick);
    };
  },[restEndAt]);

  function scheduleRestNotification(dueAt:number){
    if(!notificationsEnabled || typeof navigator==="undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then(reg=>{
      reg.active?.postMessage({type:"SCHEDULE_REST",dueAt});
    }).catch(()=>{});
  }

  function startRestTimer(seconds:number){
    const safe=Math.max(0,Math.round(seconds));
    if(!safe){
      stopRestTimer();
      return;
    }
    const dueAt=Date.now()+safe*1000;
    setRest(safe);
    setRestEndAt(dueAt);
    setRestNotificationArmed(true);
    scheduleRestNotification(dueAt);
  }

  function stopRestTimer(){
    setRest(0);
    setRestEndAt(null);
    setRestNotificationArmed(false);
    localStorage.removeItem("charlie-rest-end-at");
    if(typeof navigator!=="undefined"&&"serviceWorker" in navigator){
      void navigator.serviceWorker.ready.then(reg=>reg.active?.postMessage({type:"CANCEL_REST"})).catch(()=>{});
    }
  }

  function adjustActiveRest(delta:number){
    if(!restEndAt) return;
    const dueAt=Math.max(Date.now(),restEndAt+delta*1000);
    if(dueAt<=Date.now()){
      stopRestTimer();
      return;
    }
    setRestEndAt(dueAt);
    setRest(Math.max(0,Math.ceil((dueAt-Date.now())/1000)));
    scheduleRestNotification(dueAt);
  }

  function pulse(pattern:number|number[]){
    try{ (navigator as any).vibrate?.(pattern); }catch{}
  }

  useEffect(()=>{
    let cancelled=false;

    async function acquireWakeLock(){
      if(!session||document.visibilityState!=="visible") return;
      try{
        const wakeLock=(navigator as any).wakeLock;
        if(!wakeLock?.request) return;
        const lock=await wakeLock.request("screen");
        if(cancelled){
          try{ await lock.release(); }catch{}
          return;
        }
        wakeLockRef.current=lock;
      }catch{}
    }

    function onVisibility(){
      if(document.visibilityState==="visible"&&session) void acquireWakeLock();
    }

    if(session) void acquireWakeLock();
    document.addEventListener("visibilitychange",onVisibility);

    return()=>{
      cancelled=true;
      document.removeEventListener("visibilitychange",onVisibility);
      const lock=wakeLockRef.current;
      wakeLockRef.current=null;
      if(lock) void lock.release().catch(()=>{});
    };
  },[Boolean(session)]);

  function adjustWeightDraft(delta:number){
    if(!currentExercise||currentExercise.unit==="PDC") return;
    const base=Number(String(weight||(recommendationFor(currentExercise).weight??0)).replace(",","."));
    const next=Math.max(0,Math.round((base+delta)*10)/10);
    setWeight(String(next));
    pulse(8);
  }

  function adjustSupersetWeight(part:SupersetPart,parent:Exercise,delta:number){
    if(part.unit==="PDC") return;
    const current=supersetDrafts[part.id]??{weight:"",reps:String(part.repMin),rir:"2",failed:false};
    const ex=supersetPartAsExercise(part,parent);
    const base=Number(String(current.weight||(recommendationFor(ex).weight??0)).replace(",","."));
    const next=Math.max(0,Math.round((base+delta)*10)/10);
    setSupersetDrafts(prev=>({...prev,[part.id]:{...current,weight:String(next)}}));
    pulse(8);
  }

  async function notify(title:string,body:string){
    if(!notificationsEnabled || typeof window==="undefined" || !("Notification" in window)) return;
    if(Notification.permission!=="granted") return;
    try{
      const reg=await navigator.serviceWorker.ready;
      await reg.showNotification(title,{body,icon:"/icon.svg",badge:"/icon.svg"});
    }catch{}
  }

  useEffect(()=>{
    if(rest===0&&restNotificationArmed){
      setRestNotificationArmed(false);
      pulse([70,45,70]);
      void notify("Repos terminé","Prochaine série. Repars proprement.");
    }
  },[rest,restNotificationArmed]);

  const weekStart=useMemo(()=>mondayStart(new Date()).getTime(),[now]);
  const weekEnd=weekStart+7*86400000;
  const weekSessions=useMemo(
    ()=>completedSessions.filter(s=>s.finishedAt>=weekStart&&s.finishedAt<weekEnd),
    [completedSessions,weekStart,weekEnd]
  );
  const doneWorkoutIds=useMemo(()=>new Set(weekSessions.map(s=>s.workoutId)),[weekSessions]);
  const todayIndex=(new Date().getDay()+6)%7;

  const dueWorkoutId=useMemo(()=>{
    const today=schedule[todayIndex];
    if(today.workoutId&&!doneWorkoutIds.has(today.workoutId)) return today.workoutId;
    const missed=schedule
      .slice(0,todayIndex)
      .filter(x=>x.workoutId&&!doneWorkoutIds.has(x.workoutId));
    return missed.at(-1)?.workoutId??null;
  },[todayIndex,doneWorkoutIds]);

  useEffect(()=>{
    if(!session&&dueWorkoutId) setSelectedWorkoutId(dueWorkoutId);
  },[dueWorkoutId,session]);

  const openSleep=useMemo(()=>sleepSessions.find(s=>!s.wakeAt)??null,[sleepSessions]);
  const latestSleep=useMemo(()=>sleepSessions.find(s=>Boolean(s.wakeAt))??null,[sleepSessions]);
  const latestSleepMinutes=latestSleep?.wakeAt
    ? Math.round((latestSleep.wakeAt-(latestSleep.lightsOutAt??latestSleep.bedAt))/60000)
    : 0;
  const latestSleepHours=latestSleepMinutes/60;

  useEffect(()=>{
    if(openSleep?.plannedWakeAt) setPlannedWakeTime(clock(openSleep.plannedWakeAt));
    else if(!openSleep) setPlannedWakeTime(wakeTarget);
  },[openSleep?.id,wakeTarget]);

  const latestHealthDayForCoach=healthDaily[0]??null;
  const recentRestingHr=healthDaily
    .slice(0,7)
    .map(x=>Number(x.resting_heart_rate_bpm))
    .filter(Number.isFinite);
  const restingHrBaseline=recentRestingHr.length
    ? recentRestingHr.reduce((a,b)=>a+b,0)/recentRestingHr.length
    : 0;
  const currentRestingHr=latestHealthDayForCoach?.resting_heart_rate_bpm!=null
    ? Number(latestHealthDayForCoach.resting_heart_rate_bpm)
    : 0;

  const sleepScore=latestSleepMinutes
    ? Math.max(0,Math.min(50,Math.round((latestSleepMinutes/Math.max(360,targetSleepMinutes))*50)))
    : 30;
  const energyScore=latestSleep?.energy!=null
    ? Math.round((latestSleep.energy/5)*25)
    : 16;
  const hrPenalty=currentRestingHr&&restingHrBaseline
    ? Math.max(0,Math.min(15,Math.round((currentRestingHr-restingHrBaseline)*2)))
    : 0;
  const healthScore=20-hrPenalty;
  const completionScore=Math.min(5,weekSessions.length);
  const readinessScore=Math.max(25,Math.min(100,sleepScore+energyScore+healthScore+completionScore));
  const readinessLabel=readinessScore>=82?"Prêt à performer":readinessScore>=68?"Bonne disponibilité":readinessScore>=55?"Journée normale":"Récupération prioritaire";

  const autoCoachMode:CoachMode=readinessScore<55||latestSleepHours>0&&latestSleepHours<6.5?"tired":"normal";
  const autoCoachText=latestSleepMinutes===0
    ?`Disponibilité ${readinessScore}/100 · commence normalement et ajuste au ressenti.`
    : autoCoachMode==="tired"
      ?`Disponibilité ${readinessScore}/100 · réduis le volume et garde 2–3 RIR.`
      :`Disponibilité ${readinessScore}/100 · ${readinessLabel.toLowerCase()}.`;

  function recentExerciseLogs(exerciseId:string,limit=3){
    const ids=exerciseAliases[exerciseId]??[exerciseId];
    return [...completedSessions]
      .sort((a,b)=>b.finishedAt-a.finishedAt)
      .map(session=>{
        const match=ids.find(id=>(session.logs?.[id]??[]).length>0);
        return {session,logs:match?(session.logs?.[match]??[]):[],matchedId:match??exerciseId};
      })
      .filter(x=>x.logs.length>0)
      .slice(0,limit);
  }

  function latestExerciseLogs(exerciseId:string){
    return recentExerciseLogs(exerciseId,1)[0]??null;
  }

  function recommendationFor(ex:Exercise){
    const recent=recentExerciseLogs(ex.id,3);
    const last=recent[0];
    if(!last){
      return {
        weight:ex.suggestedWeight,
        label:ex.suggestedWeight!=null
          ? `Base actuelle : ${ex.suggestedWeight} ${ex.unit}`
          :"Démarre proprement et calibre la charge."
      };
    }

    const logs=last.logs;
    const lastWeight=[...logs].reverse().find(x=>x.weight!=null)?.weight;
    const hasFail=logs.some(x=>x.failed||x.reps<ex.repMin);
    const weightedLogs=logs.filter(x=>x.weight!=null);
    const sameWorkingLoad=weightedLogs.length<=1||weightedLogs.every(x=>
      Math.abs(Number(x.weight)-Number(lastWeight??x.weight))<0.25
    );
    const allTop=logs.length>=ex.sets&&sameWorkingLoad&&logs.every(x=>
      x.reps>=ex.repMax&&!x.failed&&(x.rir==null||x.rir>=1)
    );

    const failureStreak=recent.slice(0,2).length===2&&recent.slice(0,2).every(entry=>
      entry.logs.some(x=>x.failed||x.reps<ex.repMin)
    );

    if(failureStreak&&lastWeight!=null&&ex.unit!=="PDC"){
      const reduced=Math.round(lastWeight*0.95*10)/10;
      return {
        weight:reduced,
        label:`Deux séances difficiles → allège vers ${reduced} ${ex.unit} et reconstruis proprement.`
      };
    }

    if(allTop&&lastWeight!=null&&incrementFor(ex)>0){
      const next=Math.round((lastWeight+incrementFor(ex))*10)/10;
      return {weight:next,label:`Haut de fourchette validé → tente ${next} ${ex.unit}.`};
    }

    if(recent.length>=3&&lastWeight!=null){
      const sameLoad=recent.every(entry=>{
        const w=[...entry.logs].reverse().find(x=>x.weight!=null)?.weight;
        return w!=null&&Math.abs(w-lastWeight)<0.25;
      });
      const totals=recent.map(entry=>entry.logs.reduce((sum,x)=>sum+x.reps,0));
      const stalled=sameLoad&&Math.max(...totals)-Math.min(...totals)<=1;
      if(stalled){
        const alternative=ex.alternatives?.[0];
        return {
          weight:lastWeight,
          label:alternative
            ? `Plateau sur 3 séances → garde la charge aujourd’hui. Si ça bloque encore, Nolan proposera ${alternative} au prochain cycle.`
            :"Plateau sur 3 séances → garde la charge et change le stimulus au prochain cycle si ça ne repart pas."
        };
      }
    }

    if(hasFail){
      return {
        weight:lastWeight??ex.suggestedWeight,
        label:"Consolide la charge : cherche plus de reps propres avant d’augmenter."
      };
    }

    if(weightedLogs.length>1&&!sameWorkingLoad&&lastWeight!=null){
      return {
        weight:lastWeight,
        label:`Top set à ${lastWeight} ${ex.unit} validé → transforme-le maintenant en vraie charge de travail.`
      };
    }

    const previous=recent[1];
    const previousTotal=previous?.logs.reduce((sum,x)=>sum+x.reps,0)??0;
    const currentTotal=logs.reduce((sum,x)=>sum+x.reps,0);
    return {
      weight:lastWeight??ex.suggestedWeight,
      label:currentTotal>previousTotal&&previous
        ? `Progression détectée (+${currentTotal-previousTotal} rep). Garde la charge et vise le haut de fourchette.`
        :"Garde la charge et ajoute progressivement des reps."
    };
  }

  function supersetPartAsExercise(part:SupersetPart,parent:Exercise):Exercise{
    return {
      id:part.id,
      name:part.name,
      target:part.target,
      unit:part.unit,
      suggestedWeight:part.suggestedWeight,
      sets:parent.sets,
      repMin:part.repMin,
      repMax:part.repMax,
      restSeconds:parent.restSeconds,
      cue:part.cue
    };
  }

  function exerciseContextByLogId(logId:string){
    for(let parentIndex=0;parentIndex<currentWorkout.exercises.length;parentIndex++){
      const parent=currentWorkout.exercises[parentIndex];
      if(parent.id===logId) return {exercise:parent,parent,parentIndex};
      const part=parent.superset?.find(x=>x.id===logId);
      if(part) return {exercise:supersetPartAsExercise(part,parent),parent,parentIndex};
    }
    return null;
  }

  function loggedRoundCount(exercise:Exercise,logs:Record<string,SetLog[]>){
    if(exercise.superset?.length){
      return Math.min(...exercise.superset.map(part=>(logs[part.id]??[]).length));
    }
    return (logs[exercise.id]??[]).length;
  }

  useEffect(()=>{
    if(!currentExercise) return;

    if(currentExercise.superset?.length){
      const nextDrafts:Record<string,SupersetDraft>={};
      currentExercise.superset.forEach(part=>{
        const ex=supersetPartAsExercise(part,currentExercise);
        const existing=session?.logs[part.id]?.at(-1);
        const rec=recommendationFor(ex);
        nextDrafts[part.id]={
          weight:existing?.weight!=null?String(existing.weight):(rec.weight!=null?String(rec.weight):""),
          reps:String(part.repMin),
          rir:"2",
          failed:false
        };
      });
      setSupersetDrafts(nextDrafts);
      return;
    }

    const existing=session?.logs[currentExercise.id]?.at(-1);
    const rec=recommendationFor(currentExercise);
    if(existing?.weight!=null) setWeight(String(existing.weight));
    else setWeight(rec.weight!=null?String(rec.weight):"");
    setReps(String(currentExercise.repMin));
    setRir("2");
    setFailed(false);
  },[currentExercise?.id]);

  function effectiveTarget(ex=currentExercise){
    if(!ex) return {sets:0,repMin:0,repMax:0};
    const mode=session?.coachMode??coachMode;
    if(mode==="tired") return {sets:Math.max(2,ex.sets-1),repMin:ex.repMin,repMax:ex.repMax};
    if(mode==="short") return {sets:Math.min(2,ex.sets),repMin:ex.repMin,repMax:ex.repMax};
    return {sets:ex.sets,repMin:ex.repMin,repMax:ex.repMax};
  }

  function pushLiveSession(
    liveSession:SessionState,
    action:string,
    lastSet?:Record<string,unknown>|null
  ){
    const workout=workouts.find(w=>w.id===liveSession.workoutId);
    const exercise=workout?.id==="cardio"
      ? null
      : workout?.exercises[liveSession.exerciseIndex]??null;

    setCloudStatus("syncing");
    void syncLiveWorkout({
      clientSessionId:liveSession.clientSessionId,
      workoutId:liveSession.workoutId,
      startedAt:liveSession.startedAt,
      currentExerciseId:exercise?.id??(workout?.id==="cardio"?"cardio":null),
      currentExerciseName:exercise?.name??(workout?.id==="cardio"?"Cardio":null),
      currentExerciseIndex:liveSession.exerciseIndex,
      currentSetIndex:liveSession.setIndex,
      completedIds:liveSession.completedIds,
      deferredIds:liveSession.deferredIds,
      logs:liveSession.logs,
      coachMode:liveSession.coachMode,
      lastSet:lastSet??null,
      lastAction:action
    }).then(result=>setCloudStatus(result.ok?"ok":"error"));
  }

  function lastSetPayload(exercise:Exercise,log:SetLog,setNumber:number){
    return {
      exercise_id:exercise.id,
      exercise_name:exercise.name,
      set_number:setNumber,
      reps:log.reps,
      weight:log.weight??null,
      unit:exercise.unit,
      rir:log.rir??null,
      failed:Boolean(log.failed),
      logged_at:log.loggedAt?new Date(log.loggedAt).toISOString():new Date().toISOString()
    };
  }

  async function syncAppleHealthNow(requestPermission=false){
    if(!nativeHealthAvailable()){
      setHealthMessage("Apple Santé nécessite l’app iPhone native Charlie Training.");
      return;
    }

    setHealthSyncing(true);
    setHealthMessage(requestPermission?"Autorisation Apple Santé…":"Synchronisation Apple Santé…");

    try{
      const status=requestPermission
        ? await requestNativeHealthAuthorization()
        : await getNativeHealthStatus();

      setNativeHealthStatus(status);

      const snapshot=await pullNativeHealthSnapshot(45);
      const synced=await syncAppleHealthSnapshot(snapshot,{
        deviceId:status.deviceId,
        permissions:status.writeAuthorization
      });

      const imported=synced.imported;
      if(!synced.ok||!imported) throw new Error(String(synced.reason));

      setHealthMessage(
        `Synchronisé : ${imported.sleep} nuit(s), ${imported.weights} poids, ${imported.workouts} entraînement(s).`
      );
      await refreshCloud();
    }catch(error:any){
      const message=String(error?.message??"");
      setHealthMessage(
        message.includes("native_health_unavailable")
          ?"Ouvre Charlie Training depuis l’app iPhone native pour connecter Santé."
          :"Impossible de synchroniser Apple Santé pour le moment."
      );
    }finally{
      setHealthSyncing(false);
    }
  }

  async function pushWorkoutToAppleHealth(item:CompletedSession){
    if(!nativeHealthAvailable()||nativeHealthStatus?.writeAuthorization.workouts!=="sharingAuthorized") return;

    try{
      await writeNativeHealthWorkout({
        start:new Date(item.startedAt??item.finishedAt).toISOString(),
        end:new Date(item.finishedAt).toISOString(),
        workoutKind:item.workoutId==="cardio"?"running":"strength",
        clientSessionId:item.clientSessionId,
        distanceMeters:item.cardio?.distanceKm!=null?item.cardio.distanceKm*1000:null,
        activeEnergyKcal:null
      });
      await markHealthPush({deviceId:nativeHealthStatus.deviceId});
    }catch(error:any){
      await markHealthPush({
        deviceId:nativeHealthStatus.deviceId,
        error:String(error?.message??"health_write_failed")
      });
    }
  }

  async function pushWeightToAppleHealth(kilograms:number,recordedAt:number,sourceId:string){
    if(!nativeHealthAvailable()||nativeHealthStatus?.writeAuthorization.weight!=="sharingAuthorized") return;
    try{
      await writeNativeHealthWeight({
        kilograms,
        recordedAt:new Date(recordedAt).toISOString(),
        sourceId
      });
      await markHealthPush({deviceId:nativeHealthStatus.deviceId});
    }catch(error:any){
      await markHealthPush({
        deviceId:nativeHealthStatus.deviceId,
        error:String(error?.message??"health_weight_write_failed")
      });
    }
  }

  async function pushSleepToAppleHealth(start:number,end:number,sourceId:string){
    if(!nativeHealthAvailable()||nativeHealthStatus?.writeAuthorization.sleep!=="sharingAuthorized") return;
    try{
      await writeNativeHealthSleep({
        start:new Date(start).toISOString(),
        end:new Date(end).toISOString(),
        sourceId
      });
      await markHealthPush({deviceId:nativeHealthStatus.deviceId});
    }catch(error:any){
      await markHealthPush({
        deviceId:nativeHealthStatus.deviceId,
        error:String(error?.message??"health_sleep_write_failed")
      });
    }
  }

  function startWorkout(w:Workout){
    if(w.id==="cardio") resetRunTracking();
    const mode=coachMode==="normal"?autoCoachMode:coachMode;
    const nextSession:SessionState={
      clientSessionId:crypto.randomUUID(),
      workoutId:w.id,
      exerciseIndex:0,
      setIndex:0,
      logs:{},
      startedAt:Date.now(),
      completedIds:[],
      deferredIds:[],
      coachMode:mode,
      restOverrides:{}
    };
    setCoachMode(mode);
    setSession(nextSession);
    pushLiveSession(nextSession,"session_started");
    setTab("home");
  }

  function nextExerciseIndex(s:SessionState,completedIds:string[],deferredIds:string[]){
    for(let offset=1;offset<=currentWorkout.exercises.length;offset++){
      const idx=(s.exerciseIndex+offset)%currentWorkout.exercises.length;
      const id=currentWorkout.exercises[idx].id;
      if(!completedIds.includes(id)&&!deferredIds.includes(id)) return idx;
    }
    const deferred=deferredIds.find(id=>!completedIds.includes(id));
    if(deferred) return currentWorkout.exercises.findIndex(ex=>ex.id===deferred);
    return -1;
  }

  function finishWorkout(
    logs:Record<string,SetLog[]>,
    cardio?:CardioLog|null,
    finalLastSet?:Record<string,unknown>|null
  ){
    if(!session) return;
    const finalLive:SessionState={...session,logs};
    const item:CompletedSession={
      clientSessionId:session.clientSessionId,
      workoutId:session.workoutId,
      startedAt:session.startedAt,
      finishedAt:Date.now(),
      logs,
      cardio:cardio??null,
      coachMode:session.coachMode
    };
    const next=[...completedSessions,item].sort((a,b)=>a.finishedAt-b.finishedAt);
    setCompletedSessions(next);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    setSession(null);
    stopRestTimer();
    setCloudStatus("syncing");

    void (async()=>{
      await syncLiveWorkout({
        clientSessionId:finalLive.clientSessionId,
        workoutId:finalLive.workoutId,
        startedAt:finalLive.startedAt,
        currentExerciseId:currentExercise?.id??(finalLive.workoutId==="cardio"?"cardio":null),
        currentExerciseName:currentExercise?.name??(finalLive.workoutId==="cardio"?"Cardio":null),
        currentExerciseIndex:finalLive.exerciseIndex,
        currentSetIndex:finalLive.setIndex,
        completedIds:finalLive.completedIds,
        deferredIds:finalLive.deferredIds,
        logs:finalLive.logs,
        coachMode:finalLive.coachMode,
        lastSet:finalLastSet??null,
        lastAction:"session_finishing"
      });

      const result=await syncWorkoutSession({
        clientSessionId:item.clientSessionId,
        workoutId:item.workoutId,
        startedAt:item.startedAt,
        finishedAt:item.finishedAt,
        logs:item.logs,
        cardio:item.cardio as Record<string,unknown>|null,
        coachMode:item.coachMode
      });

      if(result.ok){
        await clearLiveWorkout(item.clientSessionId);
        await pushWorkoutToAppleHealth(item);
        setCloudStatus("ok");
        await refreshCloud();
      }else{
        setCloudStatus("error");
      }
    })();
  }

  function completeExerciseWithLogs(
    nextLogs:Record<string,SetLog[]>,
    lastSet:Record<string,unknown>|null
  ){
    if(!session||!currentExercise) return;
    const target=effectiveTarget();
    const nextSet=session.setIndex+1;
    const restTarget=session.restOverrides[currentExercise.id]??currentExercise.restSeconds;

    if(restTarget>0){
      startRestTimer(restTarget);
    }

    if(nextSet>=target.sets){
      const completedIds=Array.from(new Set([...session.completedIds,currentExercise.id]));
      const deferredIds=session.deferredIds.filter(id=>id!==currentExercise.id);
      const nextIdx=nextExerciseIndex(session,completedIds,deferredIds);
      if(nextIdx===-1){
        finishWorkout(nextLogs,null,lastSet);
        return;
      }
      const nextId=currentWorkout.exercises[nextIdx].id;
      const nextSession:SessionState={
        ...session,
        logs:nextLogs,
        completedIds,
        deferredIds,
        exerciseIndex:nextIdx,
        setIndex:loggedRoundCount(currentWorkout.exercises[nextIdx],nextLogs)
      };
      setSession(nextSession);
      pushLiveSession(nextSession,"set_logged",lastSet);
    }else{
      const nextSession:SessionState={...session,logs:nextLogs,setIndex:nextSet};
      setSession(nextSession);
      pushLiveSession(nextSession,"set_logged",lastSet);
    }
  }

  function logSupersetRound(){
    if(!session||!currentExercise?.superset?.length) return;
    pulse(18);
    const loggedAt=Date.now();
    const nextLogs={...session.logs};
    const partsPayload:Record<string,unknown>[]=[];

    currentExercise.superset.forEach(part=>{
      const draft=supersetDrafts[part.id]??{
        weight:"",
        reps:String(part.repMin),
        rir:"2",
        failed:false
      };
      const log:SetLog={
        reps:Number(draft.reps||0),
        weight:part.unit==="PDC"?undefined:(draft.weight?Number(draft.weight.replace(",",".")):undefined),
        rir:Number(draft.rir||0),
        failed:draft.failed,
        loggedAt
      };
      nextLogs[part.id]=[...(session.logs[part.id]??[]),log];
      partsPayload.push(lastSetPayload(supersetPartAsExercise(part,currentExercise),log,nextLogs[part.id].length));
    });

    setSupersetDrafts(prev=>{
      const next={...prev};
      currentExercise.superset!.forEach(part=>{
        const current=next[part.id]??{weight:"",reps:String(part.repMin),rir:"2",failed:false};
        next[part.id]={...current,failed:false};
      });
      return next;
    });

    completeExerciseWithLogs(nextLogs,{
      superset:true,
      exercise_name:currentExercise.name,
      round:session.setIndex+1,
      parts:partsPayload
    });
  }

  function logSet(){
    if(!session||!currentExercise) return;
    pulse(18);
    if(currentExercise.superset?.length){
      logSupersetRound();
      return;
    }

    const log:SetLog={
      reps:Number(reps||0),
      weight:currentExercise.unit==="PDC"?undefined:(weight?Number(weight.replace(",",".")):undefined),
      rir:Number(rir||0),
      failed,
      loggedAt:Date.now()
    };
    const key=currentExercise.id;
    const nextLogs={...session.logs,[key]:[...(session.logs[key]??[]),log]};
    const lastSet=lastSetPayload(currentExercise,log,nextLogs[key].length);
    setFailed(false);
    completeExerciseWithLogs(nextLogs,lastSet);
  }

  function adjustSet(exerciseId:string,index:number,delta:number){
    if(!session) return;
    const arr=[...(session.logs[exerciseId]??[])];
    if(!arr[index]) return;
    arr[index]={...arr[index],reps:Math.max(0,arr[index].reps+delta)};
    const nextSession:SessionState={...session,logs:{...session.logs,[exerciseId]:arr}};
    setSession(nextSession);
    const context=exerciseContextByLogId(exerciseId);
    pushLiveSession(
      nextSession,
      "set_edited",
      context?lastSetPayload(context.exercise,arr[index],index+1):null
    );
  }

  function deleteSupersetRound(parent:Exercise,parentIndex:number,index:number){
    if(!session||!parent.superset?.length) return;
    const nextLogs={...session.logs};
    parent.superset.forEach(part=>{
      const arr=[...(session.logs[part.id]??[])];
      arr.splice(index,1);
      nextLogs[part.id]=arr;
    });
    const nextSession:SessionState={
      ...session,
      logs:nextLogs,
      exerciseIndex:parentIndex,
      setIndex:loggedRoundCount(parent,nextLogs),
      completedIds:session.completedIds.filter(id=>id!==parent.id)
    };
    setSession(nextSession);
    pushLiveSession(nextSession,"superset_round_deleted");
  }

  function deleteSet(exerciseId:string,index:number){
    if(!session) return;
    const context=exerciseContextByLogId(exerciseId);

    if(context?.parent.superset?.some(part=>part.id===exerciseId)){
      deleteSupersetRound(context.parent,context.parentIndex,index);
      return;
    }

    const arr=[...(session.logs[exerciseId]??[])];
    arr.splice(index,1);
    const exIndex=context?.parentIndex??session.exerciseIndex;
    const parentId=context?.parent.id??exerciseId;
    const nextSession:SessionState={
      ...session,
      logs:{...session.logs,[exerciseId]:arr},
      exerciseIndex:exIndex,
      setIndex:arr.length,
      completedIds:session.completedIds.filter(id=>id!==parentId)
    };
    setSession(nextSession);
    pushLiveSession(nextSession,"set_deleted");
  }

  function undoLastSet(){
    if(!session) return;
    let latest:{exId:string;index:number;time:number}|null=null;
    Object.entries(session.logs).forEach(([exId,arr])=>{
      arr.forEach((s,index)=>{
        const t=s.loggedAt??0;
        if(!latest||t>latest.time) latest={exId,index,time:t};
      });
    });

    if(!latest){
      const entries=Object.entries(session.logs).filter(([,arr])=>arr.length);
      const last=entries.at(-1);
      if(!last) return;
      latest={exId:last[0],index:last[1].length-1,time:0};
    }

    const context=exerciseContextByLogId(latest.exId);
    if(context?.parent.superset?.some(part=>part.id===latest!.exId)){
      deleteSupersetRound(context.parent,context.parentIndex,latest.index);
    }else{
      deleteSet(latest.exId,latest.index);
    }
    stopRestTimer();
  }

  function skipMachine(){
    if(!session||!currentExercise) return;
    const deferredIds=Array.from(new Set([...session.deferredIds,currentExercise.id]));
    const nextIdx=nextExerciseIndex(session,session.completedIds,deferredIds);
    if(nextIdx===-1) return;
    const nextId=currentWorkout.exercises[nextIdx].id;
    const nextSession:SessionState={
      ...session,
      deferredIds,
      exerciseIndex:nextIdx,
      setIndex:loggedRoundCount(currentWorkout.exercises[nextIdx],session.logs)
    };
    setSession(nextSession);
    pushLiveSession(nextSession,"exercise_deferred");
    stopRestTimer();
  }

  function changeRestTarget(delta:number){
    if(!session||!currentExercise) return;
    const current=session.restOverrides[currentExercise.id]??currentExercise.restSeconds;
    const next=Math.max(0,Math.min(600,current+delta));
    const nextSession:SessionState={
      ...session,
      restOverrides:{...session.restOverrides,[currentExercise.id]:next}
    };
    setSession(nextSession);
    if(rest>0) startRestTimer(next);
  }

  function setExactRestTarget(seconds:number){
    if(!session||!currentExercise||!Number.isFinite(seconds)) return;
    const next=Math.max(0,Math.min(600,Math.round(seconds)));
    const nextSession:SessionState={
      ...session,
      restOverrides:{...session.restOverrides,[currentExercise.id]:next}
    };
    setSession(nextSession);
    if(rest>0) startRestTimer(next);
  }

  function resetRunTracking(){
    if(runWatchIdRef.current!=null&&navigator.geolocation){
      navigator.geolocation.clearWatch(runWatchIdRef.current);
      runWatchIdRef.current=null;
    }
    setRunStatus("idle");
    setRunPoints([]);
    setRunStartedAt(null);
    setRunFinishedAt(null);
    setRunPausedMs(0);
    setRunPauseStartedAt(null);
    setRunLocationError("");
    setRunGpsAccuracy(null);
    localStorage.removeItem(RUN_STORAGE_KEY);
  }

  function abandonWorkout(){
    if(!session) return;
    const id=session.clientSessionId;
    if(session.workoutId==="cardio") resetRunTracking();
    setSession(null);
    stopRestTimer();
    void clearLiveWorkout(id).then(result=>setCloudStatus(result.ok?"ok":"error"));
  }

  function prepareRun(){
    if(!navigator.geolocation){
      setRunLocationError("Le GPS n’est pas disponible sur cet appareil.");
      return;
    }
    setRunStatus("locating");
    setRunLocationError("");
    navigator.geolocation.getCurrentPosition(position=>{
      const accuracy=position.coords.accuracy??999;
      setRunGpsAccuracy(accuracy);
      const point:CardioRoutePoint={
        lat:position.coords.latitude,
        lng:position.coords.longitude,
        altitude:position.coords.altitude,
        accuracy,
        speedMps:position.coords.speed,
        timestamp:Date.now(),
        elapsedSeconds:0
      };
      setRunPoints([point]);
      setRunStatus("ready");
    },error=>{
      setRunStatus("idle");
      setRunLocationError(error.code===1
        ?"Localisation refusée. Autorise Charlie Training dans Réglages > Confidentialité > Localisation."
        :"Impossible d’obtenir ta position GPS.");
    },{
      enableHighAccuracy:true,
      timeout:15000,
      maximumAge:0
    });
  }

  function startRun(){
    const started=Date.now();
    setRunStartedAt(started);
    setRunFinishedAt(null);
    setRunPausedMs(0);
    setRunPauseStartedAt(null);
    setRunPoints(prev=>prev.length?[{...prev.at(-1)!,timestamp:started,elapsedSeconds:0}]:[]);
    setRunStatus("running");
    pulse([50,30,50]);
  }

  function pauseRun(){
    if(runStatus!=="running") return;
    setRunPauseStartedAt(Date.now());
    setRunStatus("paused");
    pulse(35);
  }

  function resumeRun(){
    if(runStatus!=="paused") return;
    const t=Date.now();
    if(runPauseStartedAt) setRunPausedMs(v=>v+(t-runPauseStartedAt));
    setRunPauseStartedAt(null);
    setRunStatus("running");
    pulse(35);
  }

  function finishRun(){
    if(!runStartedAt) return;
    const t=Date.now();
    let pausedMs=runPausedMs;
    if(runStatus==="paused"&&runPauseStartedAt) pausedMs+=t-runPauseStartedAt;
    setRunPausedMs(pausedMs);
    setRunPauseStartedAt(null);
    setRunFinishedAt(t);
    setRunStatus("finished");
    pulse([70,45,70]);
  }

  function saveCardio(){
    const duration=Number(cardioDuration);
    if(!session||!Number.isFinite(duration)||duration<=0) return;
    const cardio:CardioLog={
      durationMinutes:duration,
      distanceKm:cardioDistance?Number(cardioDistance.replace(",",".")):undefined,
      avgHr:cardioHr?Number(cardioHr):undefined,
      rpe:cardioRpe?Number(cardioRpe):undefined,
      source:"manual"
    };
    finishWorkout({},cardio);
  }

  const targetSleepMinutes=sleepGoalMinutes || sleepWindowMinutes(sleepTarget,wakeTarget);

  async function beginSleep(lightsOut:boolean){
    const at=Date.now();
    let plannedWakeAt:number|null=null;
    let lightsOutAt:number|null=null;
    if(lightsOut){
      lightsOutAt=at;
      plannedWakeAt=at+targetSleepMinutes*60000;
      setPlannedWakeTime(clock(plannedWakeAt));
    }
    setCloudStatus("syncing");
    const res=await startSleepSession({
      bedAt:new Date(at).toISOString(),
      lightsOutAt:lightsOutAt?new Date(lightsOutAt).toISOString():null,
      plannedWakeAt:plannedWakeAt?new Date(plannedWakeAt).toISOString():null
    });
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok) await refreshCloud();
  }

  async function lightsOutNow(){
    if(!openSleep) return;
    const at=Date.now();
    const suggested=at+targetSleepMinutes*60000;
    setPlannedWakeTime(clock(suggested));
    setCloudStatus("syncing");
    const res=await setLightsOut(
      openSleep.id,
      new Date(at).toISOString(),
      new Date(suggested).toISOString()
    );
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok) await refreshCloud();
  }

  async function wakeNow(){
    if(!openSleep) return;
    const endAt=Date.now();
    const startAt=openSleep.lightsOutAt??openSleep.bedAt;
    setCloudStatus("syncing");
    const res=await finishSleepSession(openSleep.id,new Date(endAt).toISOString());
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok){
      await pushSleepToAppleHealth(startAt,endAt,openSleep.id);
      await refreshCloud();
    }
  }

  async function changeWakePlan(time:string){
    setPlannedWakeTime(time);
    if(!openSleep) return;
    const start=openSleep.lightsOutAt??openSleep.bedAt;
    const planned=wakeDateForClock(start,time).getTime();
    setCloudStatus("syncing");
    const res=await updateSleepPlan(openSleep.id,new Date(planned).toISOString());
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok) await refreshCloud();
  }

  async function rateSleep(q:number){
    if(!latestSleep) return;
    const res=await setSleepQuality(latestSleep.id,q);
    if(res.ok) await refreshCloud();
  }

  async function rateEnergy(energy:number){
    if(!latestSleep) return;
    const res=await saveSleepCheckin(latestSleep.id,{energy});
    if(res.ok) await refreshCloud();
  }

  async function saveMorningNote(){
    if(!latestSleep) return;
    const res=await saveSleepCheckin(latestSleep.id,{notes:morningNotes});
    if(res.ok) await refreshCloud();
  }

  useEffect(()=>{
    setMorningNotes(latestSleep?.notes??"");
  },[latestSleep?.id,latestSleep?.notes]);

  async function addMetric(){
    const weightKg=metricWeight?Number(metricWeight.replace(",",".")):null;
    const waistCm=metricWaist?Number(metricWaist.replace(",",".")):null;
    if(weightKg==null&&waistCm==null) return;
    const recordedAt=Date.now();
    setCloudStatus("syncing");
    const res=await saveBodyMetric({weightKg,waistCm});
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok){
      if(weightKg!=null){
        await pushWeightToAppleHealth(weightKg,recordedAt,`metric-${recordedAt}`);
      }
      setMetricWeight("");
      setMetricWaist("");
      await refreshCloud();
    }
  }

  async function enableNotifications(){
    if(typeof window==="undefined"||!("Notification" in window)||!("serviceWorker" in navigator)){
      setAccountMessage("Notifications non prises en charge sur ce navigateur.");
      return;
    }

    const permission=await Notification.requestPermission();
    if(permission!=="granted"){
      setNotificationsEnabled(false);
      setAccountMessage("Autorisation de notification refusée.");
      return;
    }

    try{
      const registration=await navigator.serviceWorker.register("/sw.js");
      const ready=await navigator.serviceWorker.ready;
      let subscription=await ready.pushManager.getSubscription();

      if(!subscription){
        subscription=await ready.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const json=subscription.toJSON();
      const p256dh=json.keys?.p256dh;
      const auth=json.keys?.auth;
      if(!json.endpoint||!p256dh||!auth) throw new Error("subscription_incomplete");

      const saved=await savePushSubscription({
        endpoint:json.endpoint,
        p256dh,
        auth
      });
      if(!saved.ok) throw new Error(saved.reason);

      setNotificationsEnabled(true);
      setPushReady(true);
      setPrefsLoaded(true);
      setAccountMessage("Web Push activé sur cet appareil.");
      await registration.showNotification("Charlie Training",{
        body:"Web Push activé. Les rappels peuvent arriver même quand l’app est fermée.",
        icon:"/icon.svg",
        badge:"/icon.svg"
      });
    }catch(error:any){
      setPushReady(false);
      setAccountMessage(`Activation Web Push impossible : ${error?.message??"erreur inconnue"}`);
    }
  }

  async function secureAccount(){
    const email=accountEmail.trim();
    if(!email) return;
    setAccountMessage("Envoi…");
    const res=await secureAnonymousAccount(email);
    setAccountMessage(res.ok
      ?"Vérifie ton email pour sécuriser ce compte."
      : `Impossible pour l’instant : ${res.reason}`);
    if(res.ok) await refreshCloud();
  }

  async function requestMagicLink(){
    const email=accountEmail.trim()||authUser?.email||"";
    if(!email) return;
    setAccountMessage("Envoi…");
    const res=await sendMagicLink(email);
    setAccountMessage(res.ok
      ?"Lien de connexion envoyé. Ouvre-le sur l’appareil à connecter."
      : `Impossible : ${res.reason}`);
  }

  const currentSetLogs=currentExercise&&session?session.logs[currentExercise.id]??[]:[];
  const currentPrevious=currentExercise?latestExerciseLogs(currentExercise.id):null;
  const currentPreviousBest=currentPrevious?.logs.reduce<SetLog|null>((best,set)=>{
    if(!best) return set;
    const bw=best.weight??0;
    const sw=set.weight??0;
    if(sw>bw) return set;
    if(sw===bw&&set.reps>best.reps) return set;
    return best;
  },null)??null;
  const currentPreviousReps=currentPrevious?.logs.reduce((sum,set)=>sum+set.reps,0)??0;
  const currentRestTarget=currentExercise&&session
    ? session.restOverrides[currentExercise.id]??currentExercise.restSeconds
    : 0;

  const nextExercisePreview=useMemo(()=>{
    if(!session||!currentExercise||currentWorkout.id==="cardio") return null;
    const completed=Array.from(new Set([...session.completedIds,currentExercise.id]));
    const idx=nextExerciseIndex(session,completed,session.deferredIds);
    return idx>=0?currentWorkout.exercises[idx]:null;
  },[
    session?.exerciseIndex,
    session?.completedIds.join("|"),
    session?.deferredIds.join("|"),
    currentExercise?.id,
    currentWorkout.id
  ]);

  const allTrackableExercises=useMemo(
    ()=>workouts.flatMap(w=>w.exercises.flatMap(ex=>
      ex.superset?.length
        ? ex.superset.map(part=>supersetPartAsExercise(part,ex))
        : [ex]
    )),
    []
  );
  const elapsed=session?Math.max(0,Math.floor((now-session.startedAt)/1000)):0;
  const sessionProgress=session&&currentWorkout.id!=="cardio"
    ? Math.min(100,Math.round((session.completedIds.length/currentWorkout.exercises.length)*100))
    : 0;

  const runClockEnd=runStatus==="finished"&&runFinishedAt
    ? runFinishedAt
    : runStatus==="paused"&&runPauseStartedAt
      ? runPauseStartedAt
      : now;
  const runElapsedSeconds=runStartedAt
    ? Math.max(0,Math.floor((runClockEnd-runStartedAt-runPausedMs)/1000))
    : 0;
  const runDistanceMeters=useMemo(()=>{
    let total=0;
    for(let i=1;i<runPoints.length;i++) total+=haversineMeters(runPoints[i-1],runPoints[i]);
    return total;
  },[runPoints]);
  const runElevationGain=useMemo(()=>{
    let gain=0;
    for(let i=1;i<runPoints.length;i++){
      const a=runPoints[i-1].altitude;
      const b=runPoints[i].altitude;
      if(a==null||b==null) continue;
      const delta=b-a;
      if(delta>1.5&&delta<30) gain+=delta;
    }
    return Math.round(gain);
  },[runPoints]);
  const runAvgSpeedKmh=runElapsedSeconds>0?(runDistanceMeters/runElapsedSeconds)*3.6:0;
  const runAvgPace=runDistanceMeters>=50&&runElapsedSeconds>0?runElapsedSeconds/(runDistanceMeters/1000):0;
  const runInstantSpeedKmh=useMemo(()=>{
    const latest=runPoints.at(-1);
    if(latest?.speedMps!=null&&latest.speedMps>=0) return latest.speedMps*3.6;
    if(runPoints.length<2) return 0;
    const recent=runPoints.slice(-4);
    let distance=0;
    for(let i=1;i<recent.length;i++) distance+=haversineMeters(recent[i-1],recent[i]);
    const seconds=(recent.at(-1)!.timestamp-recent[0].timestamp)/1000;
    return seconds>0?(distance/seconds)*3.6:0;
  },[runPoints]);
  const runInstantPace=runInstantSpeedKmh>=2?3600/runInstantSpeedKmh:0;
  const runSplits=useMemo<CardioSplit[]>(()=>{
    const splits:CardioSplit[]=[];
    if(runPoints.length<2) return splits;
    let cumulative=0;
    let nextKm=1;
    let previousElapsed=0;
    for(let i=1;i<runPoints.length;i++){
      cumulative+=haversineMeters(runPoints[i-1],runPoints[i]);
      while(cumulative>=nextKm*1000){
        const elapsedAtKm=runPoints[i].elapsedSeconds??0;
        const splitSeconds=Math.max(1,elapsedAtKm-previousElapsed);
        splits.push({
          km:nextKm,
          elapsedSeconds:elapsedAtKm,
          splitSeconds,
          paceSecondsPerKm:splitSeconds
        });
        previousElapsed=elapsedAtKm;
        nextKm++;
      }
    }
    return splits;
  },[runPoints]);
  const runTargetSeconds=Math.max(60,Number(cardioDuration||45)*60);
  const runRemainingSeconds=Math.max(0,runTargetSeconds-runElapsedSeconds);
  const runProgress=Math.min(100,(runElapsedSeconds/runTargetSeconds)*100);
  const runGpsLabel=runGpsAccuracy==null
    ?"GPS en attente"
    : runGpsAccuracy<=12
      ?"GPS excellent"
      : runGpsAccuracy<=30
        ?"GPS prêt"
        :"GPS moyen";

  function saveGpsRun(){
    if(!session||session.workoutId!=="cardio"||!runStartedAt||runElapsedSeconds<=0) return;
    const cardio:CardioLog={
      durationMinutes:Math.round((runElapsedSeconds/60)*10)/10,
      durationSeconds:runElapsedSeconds,
      distanceKm:Math.round((runDistanceMeters/1000)*1000)/1000,
      avgHr:cardioHr?Number(cardioHr):undefined,
      rpe:cardioRpe?Number(cardioRpe):undefined,
      avgSpeedKmh:Math.round(runAvgSpeedKmh*100)/100,
      avgPaceSecondsPerKm:runAvgPace?Math.round(runAvgPace):undefined,
      elevationGainM:runElevationGain,
      route:runPoints,
      splits:runSplits,
      source:"gps"
    };
    setCardioDuration(String(cardio.durationMinutes));
    setCardioDistance(cardio.distanceKm?.toFixed(2)??"");
    resetRunTracking();
    finishWorkout({},cardio);
  }

  const todayWorkout=dueWorkoutId?workouts.find(w=>w.id===dueWorkoutId)??null:null;
  const weekDoneCount=doneWorkoutIds.size;
  const weekTrainingCount=schedule.filter(x=>x.workoutId).length;
  const activeHomeDayIndex=selectedHomeDayIndex??todayIndex;
  const activeHomeSchedule=schedule[activeHomeDayIndex];
  const activeHomeWorkout=activeHomeDayIndex===todayIndex
    ? todayWorkout
    : activeHomeSchedule.workoutId
      ? workouts.find(w=>w.id===activeHomeSchedule.workoutId)??null
      : null;

  const plannedWakeAt=openSleep
    ? wakeDateForClock(openSleep.lightsOutAt??openSleep.bedAt,plannedWakeTime).getTime()
    : null;
  const plannedSleepMinutes=openSleep&&openSleep.lightsOutAt&&plannedWakeAt
    ? Math.max(0,Math.round((plannedWakeAt-openSleep.lightsOutAt)/60000))
    : 0;
  const suggestedWakeAt=openSleep?.lightsOutAt
    ? openSleep.lightsOutAt+targetSleepMinutes*60000
    : null;

  const chartExercise=allTrackableExercises.find(ex=>ex.id===chartExerciseId);
  const chartExerciseIds=exerciseAliases[chartExerciseId]??[chartExerciseId];
  const chartValues=completedSessions
    .map(s=>{
      const id=chartExerciseIds.find(key=>s.logs?.[key]?.some(x=>x.weight!=null));
      if(!id) return null;
      return Math.max(...s.logs[id].filter(x=>x.weight!=null).map(x=>Number(x.weight)));
    })
    .filter((v):v is number=>v!=null)
    .slice(-10);

  const sixWeeks=Array.from({length:6},(_,i)=>{
    const start=weekStart-(5-i)*7*86400000;
    const end=start+7*86400000;
    const ss=completedSessions.filter(s=>s.finishedAt>=start&&s.finishedAt<end);
    const volume=Math.round(ss.reduce((sum,s)=>sum+
      Object.values(s.logs).flat().reduce((n,x)=>n+(x.weight??0)*x.reps,0),0));
    return {label:dateKey(start),count:ss.length,volume};
  });
  const maxWeekCount=Math.max(1,...sixWeeks.map(x=>x.count));

  const weightSeries=[...bodyMetrics]
    .filter(x=>x.weightKg!=null)
    .sort((a,b)=>a.recordedAt-b.recordedAt)
    .map(x=>Number(x.weightKg))
    .slice(-12);
  const waistSeries=[...bodyMetrics]
    .filter(x=>x.waistCm!=null)
    .sort((a,b)=>a.recordedAt-b.recordedAt)
    .map(x=>Number(x.waistCm))
    .slice(-12);

  const recentSessions=[...completedSessions].sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,8);
  const monthStart=now-30*86400000;
  const monthSessions=completedSessions.filter(s=>s.finishedAt>=monthStart);
  const monthStrengthSessions=monthSessions.filter(s=>!s.cardio);
  const monthCardioSessions=monthSessions.filter(s=>Boolean(s.cardio));
  const monthVolume=Math.round(monthStrengthSessions.reduce((sum,s)=>sum+
    Object.values(s.logs).flat().reduce((n,x)=>n+(x.weight??0)*x.reps,0),0));
  const latestCardio=[...completedSessions]
    .filter(s=>Boolean(s.cardio))
    .sort((a,b)=>b.finishedAt-a.finishedAt)[0]?.cardio??null;
  const currentStreak=(()=>{
    const days=new Set(completedSessions.map(s=>new Date(s.finishedAt).toDateString()));
    let streak=0;
    const cursor=new Date();
    for(let i=0;i<30;i++){
      if(days.has(cursor.toDateString())) streak++;
      else if(i>0) break;
      cursor.setDate(cursor.getDate()-1);
    }
    return streak;
  })();

  const validSleeps=[...sleepSessions]
    .filter(s=>{
      if(!s.wakeAt) return false;
      const minutes=Math.round((s.wakeAt-(s.lightsOutAt??s.bedAt))/60000);
      return minutes>=180&&minutes<=840;
    })
    .sort((a,b)=>(b.wakeAt??0)-(a.wakeAt??0));
  const sleep7=validSleeps.slice(0,7);
  const previousSleep7=validSleeps.slice(7,14);
  const sleepMinutesFor=(s:SleepSession)=>s.wakeAt?Math.round((s.wakeAt-(s.lightsOutAt??s.bedAt))/60000):0;
  const avgSleep7=sleep7.length?Math.round(sleep7.reduce((n,s)=>n+sleepMinutesFor(s),0)/sleep7.length):0;
  const avgPrevSleep7=previousSleep7.length?Math.round(previousSleep7.reduce((n,s)=>n+sleepMinutesFor(s),0)/previousSleep7.length):0;
  const avgSleepDelta=avgSleep7&&avgPrevSleep7?avgSleep7-avgPrevSleep7:0;
  const energyValues=sleep7.map(s=>s.energy).filter((v):v is number=>typeof v==="number");
  const avgEnergy=energyValues.length?energyValues.reduce((a,b)=>a+b,0)/energyValues.length:0;
  const targetBedParts=sleepTarget.split(":").map(Number);
  const targetBedMinutes=targetBedParts[0]*60+targetBedParts[1];
  const bedtimeDeviations=sleep7.map(s=>{
    const d=new Date(s.lightsOutAt??s.bedAt);
    const actual=d.getHours()*60+d.getMinutes();
    let diff=Math.abs(actual-targetBedMinutes);
    if(diff>720) diff=1440-diff;
    return diff;
  });
  const avgBedDeviation=bedtimeDeviations.length?bedtimeDeviations.reduce((a,b)=>a+b,0)/bedtimeDeviations.length:0;
  const sleepRegularity=sleep7.length?Math.max(0,Math.min(100,Math.round(100-(avgBedDeviation/120)*100))):0;
  const nowDate=new Date(now);
  const homeWeekDays=Array.from({length:7},(_,i)=>{
    const d=new Date(nowDate);
    const day=(nowDate.getDay()+6)%7;
    d.setDate(nowDate.getDate()-day+i);
    return {
      index:i,
      short:d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".",""),
      date:d.getDate(),
      today:d.toDateString()===nowDate.toDateString(),
      selected:i===activeHomeDayIndex
    };
  });
  const currentMinutes=nowDate.getHours()*60+nowDate.getMinutes();
  const disconnectParts=disconnectTarget.split(":").map(Number);
  const disconnectMinutes=disconnectParts[0]*60+disconnectParts[1];
  const isEvening=currentMinutes>=disconnectMinutes||currentMinutes<120;
  const minutesUntilDisconnect=currentMinutes<=disconnectMinutes?disconnectMinutes-currentMinutes:0;
  const recentWake=latestSleep?.wakeAt??0;
  const morningCheckin=Boolean(
    latestSleep?.wakeAt &&
    now-recentWake<10*60*60*1000 &&
    (latestSleep.energy==null||latestSleep.quality==null) &&
    nowDate.getHours()<13
  );

  const exerciseLibrary=useMemo(()=>{
    const seen=new Set<string>();
    return workouts.flatMap(w=>w.exercises).filter(ex=>{
      if(seen.has(ex.id)) return false;
      seen.add(ex.id);
      return true;
    });
  },[]);
  const exerciseCategories=["Tous","Pectoraux","Dos","Jambes","Épaules","Bras","Abdos"];
  const exerciseCategory=(ex:Exercise)=>{
    const key=(ex.id+" "+ex.name+" "+ex.target).toLowerCase();
    if(/pec|bench|chest|développé couché|incline/.test(key)) return "Pectoraux";
    if(/dos|row|pull|lat|traction/.test(key)) return "Dos";
    if(/squat|leg|rdl|fente|mollet|ischio|quad/.test(key)) return "Jambes";
    if(/shoulder|lateral|élévation|épaule/.test(key)) return "Épaules";
    if(/curl|triceps|biceps|bras/.test(key)) return "Bras";
    if(/crunch|abs|gainage/.test(key)) return "Abdos";
    return "Autres";
  };
  const filteredExerciseLibrary=exerciseLibrary.filter(ex=>{
    const matchesSearch=(ex.name+" "+ex.target).toLowerCase().includes(exerciseSearch.trim().toLowerCase());
    const matchesFilter=exerciseFilter==="Tous"||exerciseCategory(ex)===exerciseFilter;
    return matchesSearch&&matchesFilter;
  });

  const latestHealthDay=latestHealthDayForCoach;
  const healthNativeReady=Boolean(nativeHealthStatus?.available);
  const healthConnected=Boolean(healthSyncState?.enabled);
  const healthLastSyncLabel=healthSyncState?.last_pull_at
    ? new Date(healthSyncState.last_pull_at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})
    : null;

  const authAnonymous=Boolean(authUser?.is_anonymous);
  const cloudLabel=cloudLoading?"Chargement":cloudStatus==="ok"?"Synchronisé":cloudStatus==="syncing"?"Synchro…":"À vérifier";

  const resolvedAppearance=appearanceMode==="auto"?(systemDark?"dark":"light"):appearanceMode;
  const activeAppearance=resolvedAppearance;

  useEffect(()=>{
    document.documentElement.dataset.appTheme=activeAppearance;
    document.documentElement.style.colorScheme=activeAppearance;
    document.body.dataset.appTheme=activeAppearance;
    const color=activeAppearance==="light"?"#f4f6fa":"#090c12";
    let meta=document.querySelector('meta[name="theme-color"]') as HTMLMetaElement|null;
    if(!meta){
      meta=document.createElement("meta");
      meta.name="theme-color";
      document.head.appendChild(meta);
    }
    meta.content=color;
    return()=>{
      delete document.documentElement.dataset.appTheme;
      delete document.body.dataset.appTheme;
    };
  },[activeAppearance]);

  return <main className={"app-shell app-v7 theme-"+activeAppearance+" "+(session?"gym-mode ":"")+(isEvening?"evening-ui":"day-ui")}>
    {!session&&<>
      {tab==="home"&&<header className="v14-app-header">
        <div>
          <span>CHARLIE TRAINING</span>
          <strong>Bonjour Charlie 👋</strong>
        </div>
        <button className="v14-header-action" onClick={()=>setQuickMenuOpen(true)} aria-label="Actions rapides">+</button>
      </header>}

      <nav className="tabs v7-tabs v14-tabs">
        {([
          ["home","Accueil"],
          ["programs","Programmes"],
          ["exercises","Exercices"],
          ["analysis","Analyse"],
          ["more","Plus"]
        ] as const).map(([id,label])=>
          <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>
            <span className="v7-tab-icon"><TabIcon id={id}/></span>
            <span>{label}</span>
          </button>
        )}
      </nav>
    </>}

    {tab==="home"&&<section className={session?"today-v5 session-v5":"today-v5 home-v5"}>
      {!session?<>
        {openSleep?.lightsOutAt?
          <div className="v7-night-minimal">
            <div className="v7-moon">☾</div>
            <span>NUIT EN COURS</span>
            <h2>Il est temps<br/>de dormir.</h2>
            <p>Réveil prévu à <strong>{plannedWakeTime}</strong></p>
            <button className="v7-subtle-action" onClick={wakeNow}>Je suis réveillé</button>
          </div>
        :openSleep?
          <div className="v7-routine-focus">
            <div className="v7-focus-head"><button className="v7-close" onClick={()=>setTab("home")}>×</button><span>2 / 3</span></div>
            <h2>Préparation</h2>
            <p>Tu es au lit depuis {clock(openSleep.bedAt)}.</p>
            <div className="v7-checklist">
              <div><i>✓</i><strong>Hygiène</strong><small>Douche, brossage…</small></div>
              <div><i>✓</i><strong>Tenue de nuit</strong><small>Confort avant tout.</small></div>
              <div><i>✓</i><strong>Chambre prête</strong><small>Température, lumière.</small></div>
              <div><i>○</i><strong>Respiration</strong><small>2–5 minutes.</small></div>
            </div>
            <button className="primary v7-full" onClick={lightsOutNow}>Lumières éteintes</button>
          </div>
        :morningCheckin?
          <div className="v7-morning-card">
            <div className="v7-sun">☀</div>
            <span>BONJOUR CHARLIE</span>
            <h2>Comment s’est passée ta nuit ?</h2>
            <div className="v7-sleep-summary">
              <span>Sommeil</span>
              <strong>{latestSleepMinutes?durationLabel(latestSleepMinutes):"—"}</strong>
              <small>{latestSleep?(clock(latestSleep.lightsOutAt??latestSleep.bedAt)+" → "+(latestSleep.wakeAt?clock(latestSleep.wakeAt):"—")):""}</small>
            </div>
            <div className="v7-morning-question">
              <span>Énergie au réveil</span>
              <div>{[1,2,3,4,5].map(q=><button key={q} className={latestSleep?.energy===q?"active":""} onClick={()=>rateEnergy(q)}>{q}</button>)}</div>
            </div>
            <div className="v7-morning-question">
              <span>Qualité du sommeil</span>
              <div>{[1,2,3,4,5].map(q=><button key={q} className={latestSleep?.quality===q?"active":""} onClick={()=>rateSleep(q)}>{q}</button>)}</div>
            </div>
            <label className="v7-morning-note">
              <span>Commentaire <small>optionnel</small></span>
              <textarea value={morningNotes} onChange={e=>setMorningNotes(e.target.value)} onBlur={saveMorningNote} placeholder="Bonne nuit, réveil facile…"/>
            </label>
          </div>
        :isEvening?
          <div className="v7-evening-home">
            <div className="v7-evening-title">
              <div>
                <h2>Bonsoir Charlie</h2>
                <p>{currentMinutes>targetBedMinutes
  ?"Ton heure cible est passée. On coupe maintenant."
  :minutesUntilDisconnect>0
    ?"Plus que "+minutesUntilDisconnect+" min avant la déconnexion."
    :"Ta routine du soir peut commencer."}</p>
              </div>
              <div className="v7-moon-small">☾</div>
            </div>

            <div className="v9-evening-card">
              <div className="v9-evening-goal">
                <div><span>OBJECTIF CE SOIR</span><strong>Au lit à {sleepTarget}</strong></div>
                <small>{currentMinutes>targetBedMinutes?"+"+Math.min(180,currentMinutes-targetBedMinutes)+" min":minutesUntilDisconnect>0?"dans "+minutesUntilDisconnect+" min":"maintenant"}</small>
              </div>

              <div className="v9-routine-lines">
                <div className={currentMinutes>=disconnectMinutes&&currentMinutes<targetBedMinutes?"active":""}>
                  <i>1</i><span>{disconnectTarget}</span><strong>Déconnexion</strong>
                </div>
                <div className={currentMinutes>=disconnectMinutes&&currentMinutes<targetBedMinutes?"active":""}>
                  <i>2</i><span>{prepTarget}</span><strong>Préparation</strong>
                </div>
                <div className={currentMinutes>=targetBedMinutes?"active":""}>
                  <i>3</i><span>{sleepTarget}</span><strong>Au lit</strong>
                </div>
              </div>

              <button className="primary v7-full v9-evening-cta" onClick={()=>setTab("programs")}>
                {currentMinutes>=targetBedMinutes?"Aller dormir":"Ouvrir ma routine"}
              </button>
              <div className="v9-tomorrow">Demain · réveil {wakeTarget} · objectif {durationLabel(targetSleepMinutes)}</div>
            </div>
          </div>
        :
          <div className="v15-home">
            <div className="v15-calendar" aria-label="Choisir un jour">
              {homeWeekDays.map(day=><button
                key={day.short}
                type="button"
                className={(day.selected?"selected ":"")+(day.today?"today":"")}
                onClick={()=>setSelectedHomeDayIndex(day.index)}
                aria-pressed={day.selected}
              ><span>{day.short}</span><strong>{day.date}</strong>{day.today&&<i/>}</button>)}
            </div>

            <div className="v15-workout-hero">
              <div className="v15-hero-copy">
                <span>SÉANCE DU JOUR</span>
                <h2>{activeHomeWorkout?.title??activeHomeSchedule.name}</h2>
                <p>{activeHomeWorkout?.subtitle??(activeHomeSchedule.name==="Repos"?"Repos complet aujourd’hui.":"Récupération et mobilité.")}</p>
                {activeHomeWorkout&&<div className="v15-hero-meta"><span>◷ ~45 min</span><span>⌁ {activeHomeWorkout.exercises.length} exercices</span></div>}
              </div>
              {activeHomeWorkout&&<div className="v15-hero-art"><ExerciseArt exercise={activeHomeWorkout.exercises[0]} large/></div>}
              {activeHomeWorkout&&<button className="v15-hero-arrow" onClick={()=>startWorkout(activeHomeWorkout)}>→</button>}
            </div>

            <div className="v15-health-row">
              <button onClick={()=>{setTrackingView("sleep");setTab("analysis");}}>
                <div><span>Sommeil</span><strong>{latestSleepMinutes?durationLabel(latestSleepMinutes):"—"}</strong><small>{latestSleep?.energy?"+ énergie "+latestSleep.energy+"/5":"Dernière nuit"}</small></div>
                <i>☾</i>
              </button>
              <button onClick={()=>{setTrackingView("training");setTab("analysis");}}>
                <div><span>Séances</span><strong>{weekDoneCount}/{weekTrainingCount}</strong><small>cette semaine</small></div>
                <i>↗</i>
              </button>
            </div>

            <div className="v15-progress-card">
              <div className="v15-progress-head"><strong>Progression hebdo</strong><span>{weekDoneCount}/{weekTrainingCount}<small> séances</small></span></div>
              <div className="v15-week-bars">
                {schedule.filter(x=>x.workoutId).map((item,i)=>{
                  const done=item.workoutId?doneWorkoutIds.has(item.workoutId):false;
                  const active=item.workoutId===todayWorkout?.id;
                  return <div key={item.label}><i className={(done?"done ":"")+(active?"active":"")}/><span>{item.label.charAt(0)}</span></div>;
                })}
              </div>
            </div>

            {activeHomeWorkout&&<button className="primary v15-main-cta" onClick={()=>startWorkout(activeHomeWorkout)}>Démarrer {activeHomeDayIndex===todayIndex?"la séance":activeHomeWorkout.title} <span>→</span></button>}

            <button className="v15-coach-strip" onClick={()=>setTab("more")}>
              <div className="v15-coach-logo">C</div>
              <div><strong>Coach Charlie</strong><small>{autoCoachMode==="tired"?"On allège aujourd’hui.":autoCoachText}</small></div>
              <span>›</span>
            </button>
          </div>
        }
      </>:currentWorkout.id==="cardio"?<>
        <div className="run-screen">
          <div className="run-topbar">
            <button className="run-back" onClick={()=>confirm("Quitter la course ?")&&abandonWorkout()}>‹</button>
            <div><span>RUNNING</span><strong>Course facile</strong></div>
            <div className={"run-gps-pill "+(runGpsAccuracy!=null&&runGpsAccuracy<=30?"ready":"")}>
              <i/>{runGpsLabel}
            </div>
          </div>

          {(runStatus==="idle"||runStatus==="locating"||runStatus==="ready")&&<>
            <div className="run-pre-card">
              <div className="run-pre-copy">
                <span>OBJECTIF DU JOUR</span>
                <h2>{cardioDuration} min faciles</h2>
                <p>Endurance fondamentale. Tu dois pouvoir parler en phrases complètes.</p>
              </div>
              <div className="run-pre-targets">
                <div><span>Intensité</span><strong>RPE 3–4</strong></div>
                <div><span>Allure</span><strong>Confortable</strong></div>
                <div><span>But</span><strong>Base aérobie</strong></div>
              </div>
            </div>

            <div className="run-map-card">
              <RunRouteMap points={runPoints}/>
              <div className="run-map-status">
                <span>{runStatus==="locating"?"Recherche du signal…":runStatus==="ready"?"Position acquise":"Active le GPS pour enregistrer ton tracé"}</span>
                {runGpsAccuracy!=null&&<strong>± {Math.round(runGpsAccuracy)} m</strong>}
              </div>
            </div>

            {runLocationError&&<div className="run-warning">{runLocationError}</div>}

            <div className="run-pre-actions">
              {runStatus==="idle"&&<button className="primary run-primary" onClick={prepareRun}>Activer le GPS</button>}
              {runStatus==="locating"&&<button className="primary run-primary" disabled>Recherche GPS…</button>}
              {runStatus==="ready"&&<button className="primary run-primary" onClick={startRun}>Démarrer la course</button>}
              {runStatus==="idle"&&runLocationError&&<button className="secondary" onClick={startRun}>Démarrer sans GPS</button>}
            </div>

            <details className="run-manual-entry">
              <summary>Saisir une course manuellement</summary>
              <div className="cardio-card">
                <label>Durée (min)<input inputMode="numeric" value={cardioDuration} onChange={e=>setCardioDuration(e.target.value)}/></label>
                <label>Distance (km)<input inputMode="decimal" placeholder="5.0" value={cardioDistance} onChange={e=>setCardioDistance(e.target.value)}/></label>
                <label>FC moyenne<input inputMode="numeric" placeholder="145" value={cardioHr} onChange={e=>setCardioHr(e.target.value)}/></label>
                <label>RPE /10<input inputMode="numeric" value={cardioRpe} onChange={e=>setCardioRpe(e.target.value)}/></label>
                <button className="secondary" onClick={saveCardio}>Enregistrer manuellement</button>
              </div>
            </details>
          </>}

          {(runStatus==="running"||runStatus==="paused")&&<>
            <div className="run-live-hero">
              <div className="run-live-time">
                <span>{runStatus==="paused"?"EN PAUSE":"COURSE EN COURS"}</span>
                <strong>{formatTimer(runElapsedSeconds)}</strong>
                <small>{runRemainingSeconds>0?"Encore "+formatTimer(runRemainingSeconds)+" sur l’objectif":"Objectif temps atteint"}</small>
              </div>
              <div className="run-progress-ring" style={{"--run-progress":runProgress+"%"} as React.CSSProperties}>
                <span>{Math.round(runProgress)}%</span>
              </div>
            </div>

            <div className="run-live-grid">
              <div className="featured"><span>Distance</span><strong>{formatDistance(runDistanceMeters)}</strong></div>
              <div><span>Allure</span><strong>{formatPace(runInstantPace)}</strong><small>instantanée</small></div>
              <div><span>Vitesse</span><strong>{runInstantSpeedKmh?runInstantSpeedKmh.toFixed(1):"—"}</strong><small>km/h</small></div>
              <div><span>Moyenne</span><strong>{formatPace(runAvgPace)}</strong><small>allure moy.</small></div>
              <div><span>Dénivelé</span><strong>{runElevationGain}</strong><small>m D+</small></div>
            </div>

            <div className="run-live-map">
              <RunRouteMap points={runPoints}/>
              <div className="run-map-overlay">
                <span>{runGpsLabel}</span>
                <strong>{runElevationGain} m D+</strong>
              </div>
            </div>

            <div className="run-coach-card">
              <div className="run-coach-icon">C</div>
              <div>
                <span>COACH CHARLIE</span>
                <strong>{runInstantPace&&runAvgPace&&runInstantPace<runAvgPace*.82?"Ralentis légèrement.":"Reste facile."}</strong>
                <small>Objectif récupération : garde une respiration confortable.</small>
              </div>
            </div>

            {runSplits.length>0&&<div className="run-splits-live">
              <div className="run-section-head"><strong>Splits</strong><span>par km</span></div>
              {runSplits.slice(-3).map(split=><div key={split.km}><span>KM {split.km}</span><strong>{formatPace(split.paceSecondsPerKm)}</strong></div>)}
            </div>}

            <div className="run-controls">
              {runStatus==="running"
                ?<button className="run-pause" onClick={pauseRun}>Pause</button>
                :<button className="run-resume" onClick={resumeRun}>Reprendre</button>}
              <button className="run-finish" onClick={()=>confirm("Terminer la course ?")&&finishRun()}>Terminer</button>
            </div>
          </>}

          {runStatus==="finished"&&<>
            <div className="run-summary-head">
              <span>COURSE TERMINÉE</span>
              <h2>{formatDistance(runDistanceMeters)}</h2>
              <p>{formatTimer(runElapsedSeconds)} · {formatPace(runAvgPace)}</p>
            </div>

            <div className="run-live-map summary">
              <RunRouteMap points={runPoints}/>
            </div>

            <div className="run-summary-grid">
              <div><span>Temps</span><strong>{formatTimer(runElapsedSeconds)}</strong></div>
              <div><span>Distance</span><strong>{(runDistanceMeters/1000).toFixed(2)} km</strong></div>
              <div><span>Allure moy.</span><strong>{formatPace(runAvgPace)}</strong></div>
              <div><span>Vitesse moy.</span><strong>{runAvgSpeedKmh.toFixed(1)} km/h</strong></div>
              <div><span>Dénivelé +</span><strong>{runElevationGain} m</strong></div>
              <div><span>Splits</span><strong>{runSplits.length}</strong></div>
            </div>

            {runSplits.length>0&&<div className="run-splits">
              <div className="run-section-head"><strong>Splits kilométriques</strong><span>{runSplits.length} km complets</span></div>
              {runSplits.map(split=><div key={split.km}>
                <span>{split.km} km</span>
                <strong>{formatTimer(split.splitSeconds)}</strong>
                <small>{formatPace(split.paceSecondsPerKm)}</small>
              </div>)}
            </div>}

            <div className="run-post-fields">
              <label><span>FC moyenne <small>optionnel</small></span><input inputMode="numeric" placeholder="145" value={cardioHr} onChange={e=>setCardioHr(e.target.value)}/></label>
              <label><span>RPE /10</span><input inputMode="numeric" value={cardioRpe} onChange={e=>setCardioRpe(e.target.value)}/></label>
            </div>

            <button className="primary run-save" onClick={saveGpsRun}>Enregistrer la course</button>
            <button className="ghost danger run-discard" onClick={()=>confirm("Supprimer cette course ?")&&abandonWorkout()}>Supprimer</button>
          </>}
        </div>
      </>:<>
        <div className="v15-session-top">
          <button className="v15-back" onClick={()=>confirm("Quitter la séance ?")&&abandonWorkout()}>‹</button>
          <strong>{currentExercise?.name}</strong>
          <button className="v15-menu">•••</button>
        </div>

        <div className="v15-session-tabs">
          <button className="active">Série {session.setIndex+1}/{effectiveTarget().sets}</button>
          <button>Historique</button>
          <button>Notes</button>
        </div>

        {currentExercise&&<div className="v15-exercise-stage">
          <ExerciseArt exercise={currentExercise} large/>
          <div className="v15-muscle-chips"><span>{currentExercise.target}</span><span>{currentWorkout.title}</span></div>
        </div>}

        <div className="v15-session-cue">{currentExercise?.cue}</div>

        <div className="v15-session-metrics">
          <span><small>Temps</small><strong>{formatTimer(elapsed)}</strong></span>
          <span><small>Exercice</small><strong>{session.exerciseIndex+1}/{currentWorkout.exercises.length}</strong></span>
          <span><small>Repos</small><strong>{formatTimer(currentRestTarget)}</strong></span>
        </div>

        {currentExercise&&<div className="target-card v15-target-card">
          <div className="v15-target-title"><span>OBJECTIF DE LA SÉRIE</span><strong>{effectiveTarget().repMin}–{effectiveTarget().repMax} répétitions</strong></div>
          <div className="target-grid">
            <div><span>Série</span><strong>{session.setIndex+1}/{effectiveTarget().sets}</strong></div>
            <div><span>Objectif</span><strong>{effectiveTarget().repMin}–{effectiveTarget().repMax}</strong></div>
            <div><span>Repos cible</span><strong>{formatTimer(currentRestTarget)}</strong></div>
          </div>
          {currentPrevious&&<div className="previous-performance">
            <span>DERNIÈRE FOIS</span>
            <strong>
              {currentPreviousBest?.weight!=null
                ? currentPreviousBest.weight+" "+currentExercise.unit+" × "+currentPreviousBest.reps
                : currentPreviousBest
                  ? currentPreviousBest.reps+" reps"
                  : "—"}
            </strong>
            <small>{dateKey(currentPrevious.session.finishedAt)} · {currentPrevious.logs.length} série(s) · {currentPreviousReps} reps</small>
          </div>}
          <p>{currentExercise.cue}</p>
        </div>}

        {nextExercisePreview&&<div className="next-exercise-card">
          <span>ENSUITE</span>
          <div>
            <strong>{nextExercisePreview.name}</strong>
            <small>
              {nextExercisePreview.superset?.length
                ? nextExercisePreview.sets+" tours · "+nextExercisePreview.superset.map(p=>p.name).join(" + ")
                : nextExercisePreview.sets+" × "+nextExercisePreview.repMin+"–"+nextExercisePreview.repMax}
            </small>
          </div>
          <b>→</b>
        </div>}

        {currentExercise&&!currentExercise.superset?.length&&
          <div className="progression-banner">{recommendationFor(currentExercise).label}</div>
        }

        {currentExercise?.superset?.map(part=>{
          const ex=supersetPartAsExercise(part,currentExercise);
          return <div className="progression-banner split" key={part.id}>
            <strong>{part.name}</strong>
            <span>{recommendationFor(ex).label}</span>
          </div>;
        })}

        {currentExercise?.superset?.length?<>
          {session.setIndex>0&&<details className="session-details">
            <summary>Derniers tours · {session.setIndex}</summary>
            <div className="set-history-card v5-history">
              {Array.from({length:session.setIndex},(_,i)=><div className="superset-history-row" key={i}>
                <span>T{i+1}</span>
                <div>
                  {currentExercise.superset!.map(part=>{
                    const s=session.logs[part.id]?.[i];
                    return <small key={part.id}>
                      <b>{part.name}</b> · {s?.weight!=null?`${s.weight} × `:""}{s?.reps??"—"} · RIR {s?.rir??"—"}{s?.failed?" · échec":""}
                    </small>;
                  })}
                </div>
                <button onClick={()=>deleteSupersetRound(currentExercise,session.exerciseIndex,i)}>×</button>
              </div>)}
            </div>
          </details>}
        </>:currentSetLogs.length>0&&<details className="session-details">
          <summary>Séries validées · {currentSetLogs.length}</summary>
          <div className="set-history-card v5-history">
            {currentSetLogs.map((s,i)=><div className="set-row" key={i}>
              <span>S{i+1}</span>
              <strong>{s.weight!=null?`${s.weight} × `:""}{s.reps}</strong>
              <small>RIR {s.rir??"—"}{s.failed?" · échec":""}</small>
              <div>
                <button onClick={()=>adjustSet(currentExercise!.id,i,-1)}>−1</button>
                <button onClick={()=>adjustSet(currentExercise!.id,i,1)}>+1</button>
                <button onClick={()=>deleteSet(currentExercise!.id,i)}>×</button>
              </div>
            </div>)}
          </div>
        </details>}

        <div className="rest-box">
          <span>Chrono repos</span>
          <strong className={rest>0?"running":""}>{formatTimer(rest)}</strong>
          <div className="rest-target-editor">
            <button onClick={()=>changeRestTarget(-15)}>−15s</button>
            <label>
              <span>Cible</span>
              <input
                type="number"
                min="0"
                max="600"
                step="5"
                value={currentRestTarget}
                onChange={e=>setExactRestTarget(Number(e.target.value))}
              />
              <small>sec</small>
            </label>
            <button onClick={()=>changeRestTarget(15)}>+15s</button>
          </div>
          <div className="rest-actions">
            <button onClick={()=>{setRest(currentRestTarget);setRestNotificationArmed(true)}}>Relancer</button>
            <button onClick={()=>setRest(0)}>Reset</button>
          </div>
        </div>

        {currentExercise?.superset?.length?<div className="superset-log-card">
          <div className="superset-round-head">
            <div><span>SUPERSET</span><strong>Tour {session.setIndex+1}/{effectiveTarget().sets}</strong></div>
            <small>Enchaîne les deux exercices puis prends ton repos.</small>
          </div>

          {currentExercise.superset.map((part,index)=>{
            const draft=supersetDrafts[part.id]??{weight:"",reps:String(part.repMin),rir:"2",failed:false};
            return <div className="superset-part-card" key={part.id}>
              <div className="superset-part-head">
                <span>{index===0?"A":"B"}</span>
                <div><strong>{part.name}</strong><small>{part.target} · {part.repMin}–{part.repMax} reps</small></div>
              </div>
              <div className="superset-fields">
                <label>Charge
                  <div className="input-wrap"><input value={draft.weight} onChange={e=>setSupersetDrafts(prev=>({...prev,[part.id]:{...draft,weight:e.target.value}}))} inputMode="decimal" disabled={part.unit==="PDC"}/><span>{part.unit}</span></div>
                  {part.unit!=="PDC"&&<div className="quick-load compact-load">
                    <button type="button" onClick={()=>adjustSupersetWeight(part,currentExercise,-incrementFor(supersetPartAsExercise(part,currentExercise)))}>−</button>
                    <button type="button" onClick={()=>adjustSupersetWeight(part,currentExercise,incrementFor(supersetPartAsExercise(part,currentExercise)))}>+</button>
                  </div>}
                </label>
                <label>Reps<div className="stepper"><button onClick={()=>setSupersetDrafts(prev=>({...prev,[part.id]:{...draft,reps:String(Math.max(0,Number(draft.reps)-1))}}))}>−</button><strong>{draft.reps}</strong><button onClick={()=>setSupersetDrafts(prev=>({...prev,[part.id]:{...draft,reps:String(Number(draft.reps)+1)}}))}>+</button></div></label>
                <label>RIR<div className="stepper compact"><button onClick={()=>setSupersetDrafts(prev=>({...prev,[part.id]:{...draft,rir:String(Math.max(0,Number(draft.rir)-1))}}))}>−</button><strong>{draft.rir}</strong><button onClick={()=>setSupersetDrafts(prev=>({...prev,[part.id]:{...draft,rir:String(Math.min(5,Number(draft.rir)+1))}}))}>+</button></div></label>
                <label className="fail-toggle"><input type="checkbox" checked={draft.failed} onChange={e=>setSupersetDrafts(prev=>({...prev,[part.id]:{...draft,failed:e.target.checked}}))}/><span>Échec</span></label>
              </div>
              <p>{part.cue}</p>
            </div>;
          })}

          <button className="primary big" onClick={logSupersetRound}>Valider les 2 exercices</button>
          <button className="secondary" onClick={skipMachine}>Machine prise → plus tard</button>
          <button className="ghost" onClick={undoLastSet}>Annuler mon dernier superset</button>
          <button className="ghost danger" onClick={()=>confirm("Terminer sans enregistrer ?")&&abandonWorkout()}>Abandonner la séance</button>
        </div>:<div className="log-card">
          <div className="field">
            <label>Charge</label>
            <div className="input-wrap">
              <input value={weight} onChange={e=>setWeight(e.target.value)} inputMode="decimal" disabled={currentExercise?.unit==="PDC"}/>
              <span>{currentExercise?.unit}</span>
            </div>
            {currentExercise&&currentExercise.unit!=="PDC"&&<div className="quick-load">
              <button type="button" onClick={()=>adjustWeightDraft(-incrementFor(currentExercise))}>−{incrementFor(currentExercise)}</button>
              <button type="button" onClick={()=>adjustWeightDraft(incrementFor(currentExercise))}>+{incrementFor(currentExercise)}</button>
            </div>}
          </div>
          <div className="field"><label>Reps</label><div className="stepper"><button onClick={()=>setReps(String(Math.max(0,Number(reps)-1)))}>−</button><strong>{reps}</strong><button onClick={()=>setReps(String(Number(reps)+1))}>+</button></div></div>
          <div className="field"><label>RIR</label><div className="stepper compact"><button onClick={()=>setRir(String(Math.max(0,Number(rir)-1)))}>−</button><strong>{rir}</strong><button onClick={()=>setRir(String(Math.min(5,Number(rir)+1)))}>+</button></div></div>
          <label className="fail-toggle"><input type="checkbox" checked={failed} onChange={e=>setFailed(e.target.checked)}/><span>Échec</span></label>
          <button className="primary big" onClick={logSet}>Valider la série</button>
          <button className="secondary" onClick={skipMachine}>Machine prise → plus tard</button>
          <button className="ghost" onClick={undoLastSet}>Annuler ma dernière validation</button>
          <button className="ghost danger" onClick={()=>confirm("Terminer sans enregistrer ?")&&abandonWorkout()}>Abandonner la séance</button>
        </div>}
      </>}
    </section>}

    {tab==="analysis"&&<section className="v8-tracking">
      <div className="v14-page-title"><span>ANALYSE</span><h2>Ta progression</h2><p>Visualise les tendances qui comptent vraiment.</p></div>
      <div className="v8-switch">
        <button className={trackingView==="sleep"?"active":""} onClick={()=>setTrackingView("sleep")}>Sommeil</button>
        <button className={trackingView==="training"?"active":""} onClick={()=>setTrackingView("training")}>Training</button>
      </div>

      {trackingView==="sleep"?<>
        <div className="v8-section-head">
          <div><span>7 DERNIERS JOURS</span><h2>Sommeil</h2></div>
          <strong>{avgSleep7?durationLabel(avgSleep7):"—"}</strong>
        </div>

        <div className="v7-tracking-hero v8-sleep-hero">
          <div className="v8-sleep-meta">
            <span>Moyenne</span>
            <strong>{avgSleep7?durationLabel(avgSleep7):"—"}</strong>
            <small>{avgSleepDelta?(avgSleepDelta>0?"+":"")+avgSleepDelta+" min vs période précédente":"Pas encore assez de recul"}</small>
          </div>
          <div className="v7-sleep-bars">
            {[...sleep7].reverse().map(s=>{
              const mins=sleepMinutesFor(s);
              return <div key={s.id}><i style={{height:Math.max(20,Math.min(100,(mins/600)*100))+"%"}}/><span>{new Date(s.wakeAt??s.bedAt).toLocaleDateString("fr-FR",{weekday:"narrow"})}</span></div>;
            })}
          </div>
        </div>

        <div className="v7-insight-grid">
          <div><span>Régularité</span><strong>{sleep7.length?sleepRegularity+" %":"—"}</strong><small>heure de coucher</small></div>
          <div><span>Énergie</span><strong>{avgEnergy?avgEnergy.toFixed(1)+"/5":"—"}</strong><small>{energyValues.length} check-in(s)</small></div>
        </div>

        <div className="v7-observations">
          <h3>À retenir</h3>
          <p><i>⌁</i>{avgBedDeviation<30&&sleep7.length?"Tes heures de coucher sont assez régulières.":sleep7.length?"Ton coucher varie d’environ "+Math.round(avgBedDeviation)+" min en moyenne.":"Encore quelques nuits et les tendances seront plus utiles."}</p>
          {avgSleep7>0&&<p><i>◐</i>Moyenne récente : {durationLabel(avgSleep7)} par nuit valide.</p>}
          {avgEnergy>0&&<p><i>✦</i>Énergie déclarée : {avgEnergy.toFixed(1)}/5 en moyenne.</p>}
        </div>
      </>:<>
        <div className="v19-kpi-grid">
          <div><span>30 JOURS</span><strong>{monthSessions.length}</strong><small>séances</small></div>
          <div><span>VOLUME</span><strong>{monthVolume>=1000?(monthVolume/1000).toFixed(1)+"k":monthVolume}</strong><small>kg soulevés</small></div>
          <div><span>CARDIO</span><strong>{monthCardioSessions.length}</strong><small>sorties</small></div>
          <div><span>SÉRIE</span><strong>{currentStreak}</strong><small>jour{currentStreak>1?"s":""}</small></div>
        </div>

        {latestCardio&&<div className="v19-last-run">
          <div className="v19-run-icon">⌁</div>
          <div>
            <span>DERNIÈRE COURSE</span>
            <strong>{latestCardio.distanceKm!=null?latestCardio.distanceKm.toFixed(2)+" km":"Cardio"}</strong>
            <small>{latestCardio.avgPaceSecondsPerKm?formatPace(latestCardio.avgPaceSecondsPerKm):Math.round(latestCardio.durationMinutes)+" min"}{latestCardio.avgSpeedKmh?" · "+latestCardio.avgSpeedKmh.toFixed(1)+" km/h":""}</small>
          </div>
          <button onClick={()=>{setSelectedWorkoutId("cardio");setTab("programs");}}>›</button>
        </div>}

        <div className="v8-section-head">
          <div><span>CETTE SEMAINE</span><h2>Training</h2></div>
          <strong>{weekDoneCount}/{weekTrainingCount}</strong>
        </div>

        <div className="v8-week-list">
          {schedule.map((item,i)=>{
            const done=item.workoutId?doneWorkoutIds.has(item.workoutId):false;
            const missed=Boolean(item.workoutId)&&i<todayIndex&&!done;
            return <div key={item.label} className={"v8-week-row "+(done?"done ":missed?"missed ":"")}>
              <span>{item.label}</span>
              <strong>{item.name}</strong>
              <small>{done?"Fait":missed?"À rattraper":item.workoutId?"À faire":"Repos"}</small>
            </div>;
          })}
        </div>

        <div className="section-title"><h3>Progression</h3><span>charges</span></div>
        <div className="chart-card v8-chart-card">
          <select value={chartExerciseId} onChange={e=>setChartExerciseId(e.target.value)}>
            {allTrackableExercises.filter(ex=>ex.unit!=="PDC").map(ex=><option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
          <MiniChart values={chartValues} suffix={chartExercise?.unit==="kg/bras"?" kg/bras":" kg"}/>
          <small>{chartExercise?.name} · meilleure charge par séance</small>
        </div>

        <div className="section-title"><h3>Dernières séances</h3><span>{completedSessions.length}</span></div>
        <div className="session-history v8-session-history">
          {recentSessions.length===0&&<div className="note">La prochaine séance terminée apparaîtra ici.</div>}
          {recentSessions.slice(0,5).map((s,i)=>{
            const w=workouts.find(x=>x.id===s.workoutId);
            const sets=Object.values(s.logs).reduce((n,a)=>n+a.length,0);
            return <div className="session-history-item" key={s.id??s.finishedAt+i}>
              <div><strong>{w?.title??s.workoutId}</strong><span>{dateKey(s.finishedAt)}</span></div>
              <div className="session-stats"><b>{s.cardio?s.cardio.durationMinutes+"m":sets}</b><small>{s.cardio?"cardio":"séries"}</small></div>
            </div>;
          })}
        </div>

        {journeyEvents.length>0&&<details className="v8-history-details">
          <summary>Historique complet</summary>
          <div className="journey-timeline">
            {journeyEvents.slice(0,8).map(event=>{
              const d=new Date(event.event_date+"T12:00:00");
              const date=d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
              return <article className={"journey-event "+event.kind} key={event.id}>
                <div className="journey-rail"><i/></div>
                <div className="journey-content">
                  <div className="journey-meta"><span>{date}</span></div>
                  <h4>{event.title}</h4>
                  <p>{event.summary}</p>
                </div>
              </article>;
            })}
          </div>
        </details>}
      </>}
    </section>}

    {tab==="exercises"&&<section className="v14-exercises-screen">
      <div className="v14-page-title">
        <span>BIBLIOTHÈQUE</span>
        <h2>Tous les exercices</h2>
        <p>Trouve rapidement un mouvement et vois les muscles ciblés.</p>
      </div>

      <label className="v14-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input value={exerciseSearch} onChange={e=>setExerciseSearch(e.target.value)} placeholder="Rechercher un exercice…"/>
      </label>

      <div className="v14-chips">
        {exerciseCategories.map(cat=><button key={cat} className={exerciseFilter===cat?"active":""} onClick={()=>setExerciseFilter(cat)}>{cat}</button>)}
      </div>

      <div className="v14-exercise-library">
        {filteredExerciseLibrary.map(ex=><article key={ex.id} className="v14-exercise-card" onClick={()=>setSelectedExerciseDetailId(ex.id)}>
          <div className="v14-exercise-visual"><ExerciseGlyph exercise={ex}/></div>
          <div className="v14-exercise-copy">
            <strong>{ex.name}</strong>
            <span>{exerciseCategory(ex)} · {ex.target}</span>
            <small>{ex.cue}</small>
          </div>
          <button aria-label={"Voir "+ex.name} onClick={e=>{e.stopPropagation();setSelectedExerciseDetailId(ex.id);}}>›</button>
        </article>)}
      </div>
    </section>}

    {tab==="programs"&&<section className="v14-programs-screen">
      <div className="v14-page-title">
        <span>PROGRAMME ACTUEL</span>
        <h2>Ta semaine</h2>
        <p>Ton plan d’entraînement et ta récupération au même endroit.</p>
      </div>
      <div className="v14-program-week">
        {schedule.map((item,i)=>{
          const done=item.workoutId?doneWorkoutIds.has(item.workoutId):false;
          const active=i===todayIndex;
          const selected=item.workoutId===selectedWorkoutId;
          return <button key={item.label} className={(done?"done ":"")+(active?"active ":"")+(selected?"selected":"")} disabled={!item.workoutId} onClick={()=>item.workoutId&&setSelectedWorkoutId(item.workoutId)}>
            <span>{item.label}</span><strong>{item.name}</strong><small>{done?"Fait":active?"Aujourd’hui":item.workoutId?"À venir":"Repos"}</small>
          </button>;
        })}
      </div>

      <div className="v19-program-detail">
        <div className="v19-program-detail-head">
          <div><span>SÉANCE SÉLECTIONNÉE</span><h3>{selectedWorkout.title}</h3><p>{selectedWorkout.subtitle}</p></div>
          <strong>{selectedWorkout.exercises.length}<small>exos</small></strong>
        </div>
        <div className="v19-program-exercises">
          {selectedWorkout.exercises.slice(0,5).map((ex,i)=><button key={ex.id} onClick={()=>setSelectedExerciseDetailId(ex.id)}>
            <div className="v19-program-glyph"><ExerciseGlyph exercise={ex}/></div>
            <div><span>{String(i+1).padStart(2,"0")}</span><strong>{ex.name}</strong><small>{ex.sets}×{ex.repMin}–{ex.repMax} · {ex.target}</small></div>
            <b>›</b>
          </button>)}
          {selectedWorkout.exercises.length>5&&<div className="v19-more-exercises">+ {selectedWorkout.exercises.length-5} autres exercices</div>}
        </div>
        <button className="primary v19-program-start" onClick={()=>startWorkout(selectedWorkout)}>Démarrer {selectedWorkout.title}</button>
      </div>
      <div className="v14-subsection-title"><span>RÉCUPÉRATION</span><strong>Routine sommeil</strong></div>
      <div className="v8-section-head v8-routine-title">
        <div><span>MA ROUTINE</span><h2>Sommeil</h2></div>
        <strong>{durationLabel(targetSleepMinutes)}</strong>
      </div>

      <div className="v8-settings-list">
        <label>
          <div><strong>Déconnexion</strong><small>Écrans, notifications, travail</small></div>
          <input type="time" value={disconnectTarget} onChange={e=>setDisconnectTarget(e.target.value)}/>
        </label>
        <label>
          <div><strong>Préparation</strong><small>Hygiène, chambre, respiration</small></div>
          <input type="time" value={prepTarget} onChange={e=>setPrepTarget(e.target.value)}/>
        </label>
        <label>
          <div><strong>Au lit</strong><small>Heure cible</small></div>
          <input type="time" value={sleepTarget} onChange={e=>setSleepTarget(e.target.value)}/>
        </label>
        <label>
          <div><strong>Réveil</strong><small>Heure habituelle</small></div>
          <input type="time" value={wakeTarget} onChange={e=>setWakeTarget(e.target.value)}/>
        </label>
        <label>
          <div><strong>Objectif de sommeil</strong><small>Utilisé pour le réveil conseillé</small></div>
          <select value={sleepGoalMinutes} onChange={e=>setSleepGoalMinutes(Number(e.target.value))}>
            <option value={450}>7 h 30</option>
            <option value={480}>8 h 00</option>
            <option value={510}>8 h 30</option>
            <option value={540}>9 h 00</option>
          </select>
        </label>
      </div>

      {!openSleep&&<button className="primary v7-full v8-routine-cta" onClick={()=>beginSleep(false)}>Je vais au lit</button>}
      {openSleep&&!openSleep.lightsOutAt&&<button className="primary v7-full v8-routine-cta" onClick={lightsOutNow}>Lumières éteintes</button>}
      {openSleep?.lightsOutAt&&<div className="v8-night-status"><span>Nuit en cours</span><strong>Réveil {plannedWakeTime}</strong></div>}

      <details className="v8-settings-details">
        <summary>Notifications & rappels</summary>
        <div className="v8-details-body">
          <div className="integration-card connected">
            <div><strong>Notifications</strong><span>Rappels coucher, séance et créatine.</span></div>
            <b>{pushReady?"Cet appareil":notificationsEnabled?"Actif":"Off"}</b>
          </div>
          {!notificationsEnabled&&<button className="primary big" onClick={enableNotifications}>Activer les notifications</button>}
          <div className="recovery-grid">
            <label className="time-card"><span>Rappel séance</span><input type="time" value={workoutReminderTime} onChange={e=>setWorkoutReminderTime(e.target.value)}/></label>
            <label className="time-card"><span>Rappel créatine</span><input type="time" value={creatineReminderTime} onChange={e=>setCreatineReminderTime(e.target.value)}/></label>
          </div>
        </div>
      </details>
    </section>}

    {tab==="more"&&<section className="v7-profile">
      <div className="v14-page-title"><span>PLUS</span><h2>Réglages & santé</h2><p>Compte, apparence, données et intégrations.</p></div>
      <div className="v7-profile-card">
        <div className="v7-avatar">C</div>
        <div><span>PROFIL</span><h2>Charlie</h2><p>{authAnonymous?"Compte local anonyme":"Compte synchronisé"}</p></div>
        <b className={cloudStatus==="ok"?"ok":""}>{cloudStatus==="ok"?"Cloud actif":"Sync…"}</b>
      </div>

      <div className="section-title"><h3>Compte & synchronisation</h3><span>{authAnonymous?"à sécuriser":"sécurisé"}</span></div>
      <div className="account-card">
        <strong>{authAnonymous?"Sécuriser tes données":"Compte sécurisé"}</strong>
        <p>{authAnonymous
          ?"Ajoute ton email pour retrouver tes données sur un nouvel iPhone ou ton Mac."
          :"Tes données sont synchronisées avec "+(authUser?.email??"ton compte")+"."}</p>
        {authAnonymous?<>
          <input type="email" placeholder="ton@email.fr" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)}/>
          <div className="account-actions">
            <button className="primary" onClick={secureAccount}>Sécuriser ce compte</button>
            <button className="secondary" onClick={requestMagicLink}>J’ai déjà un compte</button>
          </div>
        </>:<>
          <div className="v18-secure-email"><span>EMAIL</span><strong>{authUser?.email??"Compte connecté"}</strong><i>✓</i></div>
          <button className="secondary v18-login-link" onClick={requestMagicLink}>Connecter un autre appareil</button>
        </>}
        {accountMessage&&<small>{accountMessage}</small>}
      </div>

      <div className="section-title"><h3>Données corporelles</h3><span>optionnel</span></div>
      <div className="metric-entry">
        <label>Poids<input inputMode="decimal" placeholder="69.0" value={metricWeight} onChange={e=>setMetricWeight(e.target.value)}/><span>kg</span></label>
        <label>Tour de taille<input inputMode="decimal" placeholder="80.0" value={metricWaist} onChange={e=>setMetricWaist(e.target.value)}/><span>cm</span></label>
        <button className="primary" onClick={addMetric}>Enregistrer</button>
      </div>
      <div className="metric-charts">
        <div className="chart-card"><strong>Poids</strong><MiniChart values={weightSeries} suffix=" kg"/></div>
        <div className="chart-card"><strong>Tour de taille</strong><MiniChart values={waistSeries} suffix=" cm"/></div>
      </div>

      <div className="section-title"><h3>Affichage</h3><span>interface</span></div>
      <div className="v11-appearance-control">
        {(["auto","light","dark"] as const).map(mode=><button key={mode} className={appearanceMode===mode?"active":""} onClick={()=>setAppearanceMode(mode)}>
          {mode==="auto"?"Auto":mode==="light"?"Jour":"Nuit"}
        </button>)}
      </div>

      <div className="section-title"><h3>Apple Santé</h3><span>{healthConnected?"connecté":"HealthKit"}</span></div>
      <div className={"v20-health-card "+(healthConnected?"connected ":"")+(healthNativeReady?"native":"web")}>
        <div className="v20-health-head">
          <div className="v20-health-icon">♥</div>
          <div>
            <strong>{healthConnected?"Apple Santé synchronisé":"Connecter Apple Santé"}</strong>
            <span>{healthNativeReady
              ?"Sommeil, poids, pas, fréquence cardiaque, énergie et entraînements."
              :"HealthKit est prêt côté app. La connexion s’active depuis la version iPhone native."}</span>
          </div>
          <b>{healthSyncing?"SYNC…":healthConnected?"ACTIF":healthNativeReady?"PRÊT":"IPHONE"}</b>
        </div>

        {latestHealthDay&&<div className="v20-health-metrics">
          <div><span>Pas</span><strong>{latestHealthDay.steps!=null?Math.round(Number(latestHealthDay.steps)).toLocaleString("fr-FR"):"—"}</strong></div>
          <div><span>Énergie</span><strong>{latestHealthDay.active_energy_kcal!=null?Math.round(Number(latestHealthDay.active_energy_kcal))+" kcal":"—"}</strong></div>
          <div><span>FC repos</span><strong>{latestHealthDay.resting_heart_rate_bpm!=null?Math.round(Number(latestHealthDay.resting_heart_rate_bpm))+" bpm":"—"}</strong></div>
          <div><span>FC moy.</span><strong>{latestHealthDay.avg_heart_rate_bpm!=null?Math.round(Number(latestHealthDay.avg_heart_rate_bpm))+" bpm":"—"}</strong></div>
        </div>}

        <div className="v20-health-types">
          <span>Sommeil</span><span>Poids</span><span>Pas</span><span>Fréquence cardiaque</span><span>Énergie</span><span>Entraînements</span>
        </div>

        <div className="v20-health-actions">
          <button
            className="primary"
            disabled={healthSyncing}
            onClick={()=>syncAppleHealthNow(Boolean(healthNativeReady&&!nativeHealthStatus?.authorizationRequested))}
          >
            {healthSyncing?"Synchronisation…":healthNativeReady
              ?nativeHealthStatus?.authorizationRequested?"Synchroniser maintenant":"Autoriser Apple Santé"
              :"Connecter Apple Santé"}
          </button>
          {healthLastSyncLabel&&<small>Dernière synchronisation · {healthLastSyncLabel}</small>}
          {healthMessage&&<small className="v20-health-message">{healthMessage}</small>}
        </div>
      </div>

      <div className="section-title"><h3>App & données</h3><span>Supabase</span></div>
      <div className={"integration-card "+(isCloudConfigured?"connected":"")}>
        <div><strong>Cloud privé</strong><span>Séances, nuits, mensurations et préférences sont synchronisées à l’ouverture.</span></div>
        <b>{cloudStatus==="ok"?"Actif":"…"}</b>
      </div>
      <div className="integration-card connected">
        <div><strong>Web Push</strong><span>Notifications de routine, entraînement et créatine.</span></div>
        <b>{pushReady?"Cet appareil":notificationsEnabled?"Actif":"Off"}</b>
      </div>

      <div className="section-title"><h3>Nolan</h3><span>adaptation séance</span></div>
      <div className="coach-card v7-profile-coach">
        <h2>{autoCoachMode==="tired"?"On allège aujourd’hui.":"Plan normal."}</h2>
        <p>{autoCoachText}</p>
        <div className="coach-options">
          {([
            ["normal","Normal"],["tired","Mal dormi"],["short","40 min max"],["crowded","Salle blindée"]
          ] as const).map(([id,label])=>
            <button key={id} className={coachMode===id?"selected":""} onClick={()=>setCoachMode(id)}>{label}</button>
          )}
        </div>
      </div>
    </section>}

    {!session&&quickMenuOpen&&<div className="v19-sheet-backdrop" onClick={()=>setQuickMenuOpen(false)}>
      <div className="v19-sheet v19-quick-sheet" onClick={e=>e.stopPropagation()}>
        <div className="v19-sheet-handle"/>
        <div className="v19-sheet-head">
          <div><span>ACTIONS RAPIDES</span><h3>Qu’est-ce qu’on fait ?</h3></div>
          <button onClick={()=>setQuickMenuOpen(false)}>×</button>
        </div>
        <div className="v19-quick-grid">
          {todayWorkout&&<button onClick={()=>{setQuickMenuOpen(false);startWorkout(todayWorkout);}}>
            <i>▶</i><strong>Séance du jour</strong><small>{todayWorkout.title}</small>
          </button>}
          <button onClick={()=>{setQuickMenuOpen(false);setSelectedWorkoutId("cardio");startWorkout(workouts.find(w=>w.id==="cardio")!);}}>
            <i>⌁</i><strong>Course GPS</strong><small>Démarrer un run</small>
          </button>
          <button onClick={()=>{setQuickMenuOpen(false);setTab("programs");}}>
            <i>☷</i><strong>Programme</strong><small>Voir la semaine</small>
          </button>
          <button onClick={()=>{setQuickMenuOpen(false);setTab("more");}}>
            <i>＋</i><strong>Poids & santé</strong><small>Ajouter une mesure</small>
          </button>
        </div>
        <div className="v19-quick-status">
          <span>Récupération</span>
          <strong>{latestSleepMinutes?durationLabel(latestSleepMinutes)+" de sommeil":"À compléter"}</strong>
          <small>{autoCoachText}</small>
        </div>
      </div>
    </div>}

    {!session&&selectedExerciseDetail&&<div className="v19-sheet-backdrop" onClick={()=>setSelectedExerciseDetailId(null)}>
      <div className="v19-sheet v19-exercise-sheet" onClick={e=>e.stopPropagation()}>
        <div className="v19-sheet-handle"/>
        <div className="v19-sheet-head compact">
          <div><span>{exerciseCategory(selectedExerciseDetail)}</span><h3>{selectedExerciseDetail.name}</h3></div>
          <button onClick={()=>setSelectedExerciseDetailId(null)}>×</button>
        </div>

        <div className="v19-exercise-art"><ExerciseArt exercise={selectedExerciseDetail} large/></div>

        <div className="v19-exercise-tags">
          <span>{selectedExerciseDetail.target}</span>
          <span>{selectedExerciseDetail.unit}</span>
          {selectedExerciseDetail.priority&&<span className="priority">Prioritaire</span>}
        </div>

        <p className="v19-exercise-cue">{selectedExerciseDetail.cue}</p>

        <div className="v19-exercise-specs">
          <div><span>Séries</span><strong>{selectedExerciseDetail.sets}</strong></div>
          <div><span>Répétitions</span><strong>{selectedExerciseDetail.repMin}–{selectedExerciseDetail.repMax}</strong></div>
          <div><span>Repos</span><strong>{Math.round(selectedExerciseDetail.restSeconds/60*10)/10} min</strong></div>
          <div><span>Charge</span><strong>{selectedExerciseDetail.suggestedWeight!=null?selectedExerciseDetail.suggestedWeight+" "+selectedExerciseDetail.unit:"Au ressenti"}</strong></div>
        </div>

        {selectedExerciseDetail.alternatives?.length&&<div className="v19-alternatives">
          <span>ALTERNATIVES</span>
          <div>{selectedExerciseDetail.alternatives.map(alt=><b key={alt}>{alt}</b>)}</div>
        </div>}

        {selectedExerciseWorkout&&<button className="primary v19-sheet-cta" onClick={()=>{setSelectedExerciseDetailId(null);setSelectedWorkoutId(selectedExerciseWorkout.id);startWorkout(selectedExerciseWorkout);}}>
          Démarrer {selectedExerciseWorkout.title}
        </button>}
      </div>
    </div>}

    {session&&rest>0&&<div className="gym-rest-dock">
      <div>
        <span>REPOS</span>
        <strong>{formatTimer(rest)}</strong>
        <small>{currentExercise?.name??currentWorkout.title}</small>
      </div>
      <div>
        <button onClick={()=>adjustActiveRest(-15)}>−15</button>
        <button onClick={()=>adjustActiveRest(15)}>+15</button>
        <button className="skip" onClick={stopRestTimer}>Go</button>
      </div>
    </div>}

  </main>;
}
