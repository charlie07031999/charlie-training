"use client";

import { useEffect, useMemo, useState } from "react";
import { history, workouts } from "../lib/workouts";
import type { CardioLog, Exercise, SetLog, SupersetPart, Workout } from "../lib/types";
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
  startSleepSession,
  syncLiveWorkout,
  syncWorkoutSession,
  updateSleepPlan,
  VAPID_PUBLIC_KEY
} from "../lib/cloud";

type CoachMode = "normal"|"tired"|"short"|"crowded";

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
};

type BodyMetric = {
  id:string;
  recordedAt:number;
  weightKg?:number|null;
  waistCm?:number|null;
};

const STORAGE_KEY="charlie-training-v4-cache";
const SESSION_KEY="charlie-training-live-v4";

const schedule=[
  {label:"Lun",name:"Push",workoutId:"push"},
  {label:"Mar",name:"Pull",workoutId:"pull"},
  {label:"Mer",name:"Cardio",workoutId:"cardio"},
  {label:"Jeu",name:"Legs",workoutId:"legs"},
  {label:"Ven",name:"Récup",workoutId:null},
  {label:"Sam",name:"Upper",workoutId:"upper"},
  {label:"Dim",name:"Repos",workoutId:null}
] as const;

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

function urlBase64ToUint8Array(base64String:string){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=window.atob(base64);
  return Uint8Array.from([...rawData].map(ch=>ch.charCodeAt(0)));
}

function incrementFor(ex:Exercise){
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

export default function Home(){
  const [tab,setTab]=useState<"today"|"week"|"history"|"recovery"|"coach">("today");
  const [selectedWorkoutId,setSelectedWorkoutId]=useState("legs");
  const [session,setSession]=useState<SessionState|null>(null);
  const [completedSessions,setCompletedSessions]=useState<CompletedSession[]>([]);
  const [sleepSessions,setSleepSessions]=useState<SleepSession[]>([]);
  const [bodyMetrics,setBodyMetrics]=useState<BodyMetric[]>([]);
  const [authUser,setAuthUser]=useState<any>(null);
  const [cloudLoading,setCloudLoading]=useState(true);
  const [cloudStatus,setCloudStatus]=useState<"idle"|"syncing"|"ok"|"error">("idle");

  const [rest,setRest]=useState(0);
  const [restNotificationArmed,setRestNotificationArmed]=useState(false);
  const [reps,setReps]=useState("8");
  const [weight,setWeight]=useState("");
  const [rir,setRir]=useState("2");
  const [failed,setFailed]=useState(false);
  const [supersetDrafts,setSupersetDrafts]=useState<Record<string,SupersetDraft>>({});
  const [coachMode,setCoachMode]=useState<CoachMode>("normal");
  const [now,setNow]=useState(Date.now());

  const [cardioDuration,setCardioDuration]=useState("30");
  const [cardioDistance,setCardioDistance]=useState("");
  const [cardioHr,setCardioHr]=useState("");
  const [cardioRpe,setCardioRpe]=useState("4");

  const [sleepTarget,setSleepTarget]=useState("23:00");
  const [prepTarget,setPrepTarget]=useState("22:15");
  const [wakeTarget,setWakeTarget]=useState("07:00");
  const [plannedWakeTime,setPlannedWakeTime]=useState("07:00");
  const [notificationsEnabled,setNotificationsEnabled]=useState(false);
  const [pushReady,setPushReady]=useState(false);
  const [workoutReminderTime,setWorkoutReminderTime]=useState("08:00");
  const [creatineReminderTime,setCreatineReminderTime]=useState("12:00");
  const [prefsLoaded,setPrefsLoaded]=useState(false);

  const [metricWeight,setMetricWeight]=useState("");
  const [metricWaist,setMetricWaist]=useState("");
  const [accountEmail,setAccountEmail]=useState("");
  const [accountMessage,setAccountMessage]=useState("");
  const [chartExerciseId,setChartExerciseId]=useState("incline-bench");

  const selectedWorkout=useMemo(
    ()=>workouts.find(w=>w.id===selectedWorkoutId)??workouts[0],
    [selectedWorkoutId]
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
      quality:s.quality??null
    })));

    setBodyMetrics(state.metrics.map(m=>({
      id:m.id,
      recordedAt:new Date(m.recorded_at).getTime(),
      weightKg:m.weight_kg==null?null:Number(m.weight_kg),
      waistCm:m.waist_cm==null?null:Number(m.waist_cm)
    })));

    if(state.preferences){
      setSleepTarget(state.preferences.sleep_target.slice(0,5));
      setWakeTarget(state.preferences.wake_target.slice(0,5));
      setPrepTarget(state.preferences.prep_target.slice(0,5));
      setNotificationsEnabled(Boolean(state.preferences.notifications_enabled));
      setWorkoutReminderTime(state.preferences.workout_reminder_time.slice(0,5));
      setCreatineReminderTime(state.preferences.creatine_reminder_time.slice(0,5));
    }
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
    if(session) localStorage.setItem(SESSION_KEY,JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  },[session]);

  useEffect(()=>{
    if(!prefsLoaded) return;
    const t=setTimeout(()=>{
      setCloudStatus("syncing");
      void savePreferences({
        sleep_target:sleepTarget,
        wake_target:wakeTarget,
        prep_target:prepTarget,
        notifications_enabled:notificationsEnabled,
        workout_reminder_time:workoutReminderTime,
        creatine_reminder_time:creatineReminderTime
      }).then(r=>setCloudStatus(r.ok?"ok":"error"));
    },500);
    return()=>clearTimeout(t);
  },[
    prefsLoaded,sleepTarget,wakeTarget,prepTarget,notificationsEnabled,
    workoutReminderTime,creatineReminderTime
  ]);

  useEffect(()=>{
    if(rest<=0) return;
    const t=setInterval(()=>setRest(v=>Math.max(0,v-1)),1000);
    return()=>clearInterval(t);
  },[rest]);

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

  const autoCoachMode:CoachMode=latestSleepMinutes>0&&latestSleepHours<6.5?"tired":"normal";
  const autoCoachText=latestSleepMinutes===0
    ?"Pas encore assez de sommeil enregistré : plan normal par défaut."
    : latestSleepHours<6.5
      ? `Dernière nuit ${durationLabel(latestSleepMinutes)} : volume réduit, pas d’échec.`
      : latestSleepHours<7.25
        ? `Dernière nuit ${durationLabel(latestSleepMinutes)} : séance normale, garde 2 RIR sur les gros mouvements.`
        : `Dernière nuit ${durationLabel(latestSleepMinutes)} : récupération compatible avec le plan normal.`;

  function recentExerciseLogs(exerciseId:string,limit=3){
    return [...completedSessions]
      .sort((a,b)=>b.finishedAt-a.finishedAt)
      .map(session=>({session,logs:session.logs?.[exerciseId]??[]}))
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
    const allTop=logs.length>=ex.sets&&logs.every(x=>
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

  function startWorkout(w:Workout){
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
    setTab("today");
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
    setRest(0);
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
        setCloudStatus("ok");
        await refreshCloud();
      }else{
        setCloudStatus("error");
      }
    })();
  }

  function logSet(){
    if(!session||!currentExercise) return;
    const log:SetLog={
      reps:Number(reps||0),
      weight:currentExercise.unit==="PDC"?undefined:(weight?Number(weight.replace(",",".")):undefined),
      rir:Number(rir||0),
      failed,
      loggedAt:Date.now()
    };
    const key=currentExercise.id;
    const nextLogs={...session.logs,[key]:[...(session.logs[key]??[]),log]};
    const target=effectiveTarget();
    const nextSet=session.setIndex+1;
    const lastSet=lastSetPayload(currentExercise,log,nextLogs[key].length);

    if(currentExercise.restSeconds>0){
      setRest(currentExercise.restSeconds);
      setRestNotificationArmed(true);
    }
    setFailed(false);

    if(nextSet>=target.sets){
      const completedIds=Array.from(new Set([...session.completedIds,key]));
      const deferredIds=session.deferredIds.filter(id=>id!==key);
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
        setIndex:(nextLogs[nextId]??[]).length
      };
      setSession(nextSession);
      pushLiveSession(nextSession,"set_logged",lastSet);
    }else{
      const nextSession:SessionState={...session,logs:nextLogs,setIndex:nextSet};
      setSession(nextSession);
      pushLiveSession(nextSession,"set_logged",lastSet);
    }
  }

  function adjustSet(exerciseId:string,index:number,delta:number){
    if(!session) return;
    const arr=[...(session.logs[exerciseId]??[])];
    if(!arr[index]) return;
    arr[index]={...arr[index],reps:Math.max(0,arr[index].reps+delta)};
    const nextSession:SessionState={...session,logs:{...session.logs,[exerciseId]:arr}};
    setSession(nextSession);
    const exercise=currentWorkout.exercises.find(ex=>ex.id===exerciseId);
    pushLiveSession(
      nextSession,
      "set_edited",
      exercise?lastSetPayload(exercise,arr[index],index+1):null
    );
  }

  function deleteSet(exerciseId:string,index:number){
    if(!session) return;
    const arr=[...(session.logs[exerciseId]??[])];
    arr.splice(index,1);
    const exIndex=currentWorkout.exercises.findIndex(ex=>ex.id===exerciseId);
    const nextSession:SessionState={
      ...session,
      logs:{...session.logs,[exerciseId]:arr},
      exerciseIndex:exIndex>=0?exIndex:session.exerciseIndex,
      setIndex:arr.length,
      completedIds:session.completedIds.filter(id=>id!==exerciseId)
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
    deleteSet(latest.exId,latest.index);
    setRest(0);
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
      setIndex:(session.logs[nextId]??[]).length
    };
    setSession(nextSession);
    pushLiveSession(nextSession,"exercise_deferred");
    setRest(0);
  }

  function abandonWorkout(){
    if(!session) return;
    const id=session.clientSessionId;
    setSession(null);
    setRest(0);
    void clearLiveWorkout(id).then(result=>setCloudStatus(result.ok?"ok":"error"));
  }

  function saveCardio(){
    const duration=Number(cardioDuration);
    if(!session||!Number.isFinite(duration)||duration<=0) return;
    const cardio:CardioLog={
      durationMinutes:duration,
      distanceKm:cardioDistance?Number(cardioDistance.replace(",",".")):undefined,
      avgHr:cardioHr?Number(cardioHr):undefined,
      rpe:cardioRpe?Number(cardioRpe):undefined
    };
    finishWorkout({},cardio);
  }

  const targetSleepMinutes=sleepWindowMinutes(sleepTarget,wakeTarget);

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
    setCloudStatus("syncing");
    const res=await finishSleepSession(openSleep.id,new Date().toISOString());
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok) await refreshCloud();
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

  async function addMetric(){
    const weightKg=metricWeight?Number(metricWeight.replace(",",".")):null;
    const waistCm=metricWaist?Number(metricWaist.replace(",",".")):null;
    if(weightKg==null&&waistCm==null) return;
    setCloudStatus("syncing");
    const res=await saveBodyMetric({weightKg,waistCm});
    setCloudStatus(res.ok?"ok":"error");
    if(res.ok){
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
    const email=accountEmail.trim();
    if(!email) return;
    setAccountMessage("Envoi…");
    const res=await sendMagicLink(email);
    setAccountMessage(res.ok
      ?"Lien de connexion envoyé. Ouvre-le sur l’appareil à connecter."
      : `Impossible : ${res.reason}`);
  }

  const currentSetLogs=currentExercise&&session?session.logs[currentExercise.id]??[]:[];
  const elapsed=session?Math.max(0,Math.floor((now-session.startedAt)/1000)):0;

  const todayWorkout=dueWorkoutId?workouts.find(w=>w.id===dueWorkoutId)??null:null;
  const weekDoneCount=doneWorkoutIds.size;
  const weekTrainingCount=schedule.filter(x=>x.workoutId).length;

  const plannedWakeAt=openSleep
    ? wakeDateForClock(openSleep.lightsOutAt??openSleep.bedAt,plannedWakeTime).getTime()
    : null;
  const plannedSleepMinutes=openSleep&&openSleep.lightsOutAt&&plannedWakeAt
    ? Math.max(0,Math.round((plannedWakeAt-openSleep.lightsOutAt)/60000))
    : 0;
  const suggestedWakeAt=openSleep?.lightsOutAt
    ? openSleep.lightsOutAt+targetSleepMinutes*60000
    : null;

  const chartExercise=workouts.flatMap(w=>w.exercises).find(ex=>ex.id===chartExerciseId);
  const chartValues=completedSessions
    .filter(s=>s.logs?.[chartExerciseId]?.some(x=>x.weight!=null))
    .map(s=>Math.max(...s.logs[chartExerciseId].filter(x=>x.weight!=null).map(x=>Number(x.weight))))
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
  const authAnonymous=Boolean(authUser?.is_anonymous);
  const cloudLabel=cloudLoading?"Chargement":cloudStatus==="ok"?"Synchronisé":cloudStatus==="syncing"?"Synchro…":"À vérifier";

  return <main className="app-shell">
    <header className="topbar">
      <div>
        <div className="eyebrow">CHARLIE TRAINING · V4</div>
        <h1>Performance</h1>
      </div>
      <div className={`sync-pill ${cloudStatus}`}>{cloudLabel}</div>
    </header>

    <nav className="tabs">
      {([
        ["today","Aujourd’hui"],["week","Semaine"],["history","Historique"],
        ["recovery","Récup"],["coach","Nolan"]
      ] as const).map(([id,label])=>
        <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>
      )}
    </nav>

    {tab==="today"&&<section>
      {!session?<>
        <div className="dashboard-hero">
          <div>
            <div className="eyebrow">PLAN DU JOUR</div>
            <h2>{todayWorkout?todayWorkout.title:"Récupération"}</h2>
            <p>{todayWorkout
              ? todayWorkout.subtitle
              : "Aucune séance obligatoire restante aujourd’hui."}</p>
          </div>
          <div className="day-score">
            <span>Semaine</span>
            <strong>{weekDoneCount}/{weekTrainingCount}</strong>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-stat">
            <span>Sommeil</span>
            <strong>{latestSleepMinutes?durationLabel(latestSleepMinutes):"—"}</strong>
            <small>{latestSleep?.quality?`Qualité ${latestSleep.quality}/5`:"Dernière nuit enregistrée"}</small>
          </div>
          <div className="dashboard-stat">
            <span>Nolan</span>
            <strong>{autoCoachMode==="tired"?"Allégé":"Normal"}</strong>
            <small>{autoCoachMode==="tired"?"Volume réduit":"1–2 RIR"}</small>
          </div>
          <div className="dashboard-stat">
            <span>Cloud</span>
            <strong>{cloudStatus==="ok"?"OK":"…"}</strong>
            <small>iPhone ↔ Supabase</small>
          </div>
        </div>

        <div className="coach-inline">
          <strong>Conseil du jour</strong>
          <p>{autoCoachText}</p>
        </div>

        {todayWorkout&&<div className="hero-card compact-hero">
          <div className="hero-title-row">
            <div>
              <div className="hero-kicker">{schedule[todayIndex].workoutId===todayWorkout.id?"SÉANCE PRÉVUE":"RATTRAPAGE INTELLIGENT"}</div>
              <h2>{todayWorkout.title}</h2>
              <p>{todayWorkout.exercises.length} exercices · mode {autoCoachMode==="tired"?"allégé":"normal"}</p>
            </div>
            <span className="day-chip">{todayWorkout.day}</span>
          </div>
          <div className="hero-actions">
            <button className="primary" onClick={()=>startWorkout(todayWorkout)}>Lancer</button>
            <select value={selectedWorkoutId} onChange={e=>setSelectedWorkoutId(e.target.value)}>
              {workouts.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}
            </select>
            <button className="secondary" onClick={()=>startWorkout(selectedWorkout)}>Lancer la sélection</button>
          </div>
        </div>}

        <div className="section-title"><h3>Prochaine cible</h3><span>basée sur tes données</span></div>
        <div className="exercise-list">
          {(todayWorkout??selectedWorkout).exercises.slice(0,4).map((ex,i)=>{
            const rec=recommendationFor(ex);
            return <div className="exercise-row" key={ex.id}>
              <div className="index">{String(i+1).padStart(2,"0")}</div>
              <div className="grow">
                <div className="row-top"><strong>{ex.name}</strong>{ex.priority&&<span className="priority">P1</span>}</div>
                <div className="muted">{rec.label}</div>
              </div>
              <div className="load">{rec.weight!=null?`${rec.weight} ${ex.unit}`:ex.unit}</div>
            </div>;
          })}
        </div>
      </>:currentWorkout.id==="cardio"?<>
        <div className="session-head">
          <div><div className="eyebrow">CARDIO FACILE</div><h2>Footing</h2><p>Conversation facile. Pas de chasse au chrono.</p></div>
          <div className="session-progress">{formatTimer(elapsed)}</div>
        </div>

        <div className="cardio-card">
          <label>Durée (min)<input inputMode="numeric" value={cardioDuration} onChange={e=>setCardioDuration(e.target.value)}/></label>
          <label>Distance (km)<input inputMode="decimal" placeholder="3.7" value={cardioDistance} onChange={e=>setCardioDistance(e.target.value)}/></label>
          <label>FC moyenne<input inputMode="numeric" placeholder="150" value={cardioHr} onChange={e=>setCardioHr(e.target.value)}/></label>
          <label>RPE /10<input inputMode="numeric" value={cardioRpe} onChange={e=>setCardioRpe(e.target.value)}/></label>
          <button className="primary big" onClick={saveCardio}>Enregistrer le cardio</button>
          <button className="ghost danger" onClick={()=>confirm("Annuler cette séance ?")&&abandonWorkout()}>Annuler</button>
        </div>
      </>:<>
        <div className="session-head">
          <div>
            <div className="eyebrow">{currentWorkout.title} · {session.coachMode.toUpperCase()}</div>
            <h2>{currentExercise?.name}</h2>
            <p>{currentExercise?.target}</p>
          </div>
          <div className="session-progress">{session.exerciseIndex+1}/{currentWorkout.exercises.length}</div>
        </div>

        <div className="live-strip">
          <div><span>Temps</span><strong>{formatTimer(elapsed)}</strong></div>
          <div><span>Finis</span><strong>{session.completedIds.length}</strong></div>
          <div><span>En attente</span><strong>{session.deferredIds.length}</strong></div>
        </div>
        <div className="live-cloud-note">LIVE · chaque série validée est envoyée à Supabase pour Nolan.</div>

        {currentExercise&&<div className="target-card">
          <div className="target-grid">
            <div><span>Série</span><strong>{session.setIndex+1}/{effectiveTarget().sets}</strong></div>
            <div><span>Objectif</span><strong>{effectiveTarget().repMin}–{effectiveTarget().repMax}</strong></div>
            <div><span>Repos</span><strong>{Math.round(currentExercise.restSeconds/6)/10} min</strong></div>
          </div>
          <p>{currentExercise.cue}</p>
        </div>}

        {currentExercise&&<div className="progression-banner">{recommendationFor(currentExercise).label}</div>}

        {currentSetLogs.length>0&&<div className="set-history-card">
          <div className="set-history-head"><strong>Séries validées</strong><button onClick={undoLastSet}>Annuler dernière</button></div>
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
        </div>}

        <div className="rest-box">
          <span>Chrono repos</span>
          <strong className={rest>0?"running":""}>{formatTimer(rest)}</strong>
          <div className="rest-actions">
            <button onClick={()=>{setRest(currentExercise?.restSeconds??0);setRestNotificationArmed(true)}}>Relancer</button>
            <button onClick={()=>setRest(0)}>Reset</button>
          </div>
        </div>

        <div className="log-card">
          <div className="field">
            <label>Charge</label>
            <div className="input-wrap">
              <input value={weight} onChange={e=>setWeight(e.target.value)} inputMode="decimal" disabled={currentExercise?.unit==="PDC"}/>
              <span>{currentExercise?.unit}</span>
            </div>
          </div>
          <div className="field"><label>Reps</label><div className="stepper"><button onClick={()=>setReps(String(Math.max(0,Number(reps)-1)))}>−</button><strong>{reps}</strong><button onClick={()=>setReps(String(Number(reps)+1))}>+</button></div></div>
          <div className="field"><label>RIR</label><div className="stepper compact"><button onClick={()=>setRir(String(Math.max(0,Number(rir)-1)))}>−</button><strong>{rir}</strong><button onClick={()=>setRir(String(Math.min(5,Number(rir)+1)))}>+</button></div></div>
          <label className="fail-toggle"><input type="checkbox" checked={failed} onChange={e=>setFailed(e.target.checked)}/><span>Échec</span></label>
          <button className="primary big" onClick={logSet}>Valider la série</button>
          <button className="secondary" onClick={skipMachine}>Machine prise → plus tard</button>
          <button className="ghost" onClick={undoLastSet}>Annuler ma dernière validation</button>
          <button className="ghost danger" onClick={()=>confirm("Terminer sans enregistrer ?")&&abandonWorkout()}>Abandonner la séance</button>
        </div>
      </>}
    </section>}

    {tab==="week"&&<section>
      <div className="section-title"><h3>Semaine réelle</h3><span>{weekDoneCount}/{weekTrainingCount} séances</span></div>
      <div className="week-grid">
        {schedule.map((item,i)=>{
          const done=item.workoutId?doneWorkoutIds.has(item.workoutId):false;
          const missed=Boolean(item.workoutId)&&i<todayIndex&&!done;
          return <div key={item.label} className={`week-card ${done?"done":missed?"missed":""}`}>
            <div className="week-day">{item.label}</div>
            <strong>{item.name}</strong>
            <span>{done?"✓ Fait":missed?"À rattraper":item.workoutId?"À faire":"Repos"}</span>
          </div>;
        })}
      </div>

      {dueWorkoutId&&schedule[todayIndex].workoutId!==dueWorkoutId&&
        <div className="coach-inline"><strong>Rattrapage intelligent</strong><p>La séance {workouts.find(w=>w.id===dueWorkoutId)?.title} n’est pas encore faite cette semaine : elle devient prioritaire aujourd’hui.</p></div>
      }

      <div className="section-title"><h3>6 dernières semaines</h3><span>régularité</span></div>
      <div className="bar-list">
        {sixWeeks.map(w=><div className="bar-row" key={w.label}>
          <span>{w.label}</span>
          <div className="bar-track"><i style={{width:`${Math.max(5,(w.count/maxWeekCount)*100)}%`}}/></div>
          <strong>{w.count}</strong>
        </div>)}
      </div>
    </section>}

    {tab==="history"&&<section>
      <div className="section-title"><h3>Progression</h3><span>cloud</span></div>
      <div className="chart-card">
        <select value={chartExerciseId} onChange={e=>setChartExerciseId(e.target.value)}>
          {workouts.flatMap(w=>w.exercises).filter(ex=>ex.unit!=="PDC").map(ex=><option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        <MiniChart values={chartValues} suffix={chartExercise?.unit==="kg/bras"?" kg/bras":" kg"}/>
        <small>{chartExercise?.name} · meilleure charge de chaque séance</small>
      </div>

      <div className="section-title"><h3>Dernières séances</h3><span>{completedSessions.length} enregistrée(s)</span></div>
      <div className="session-history">
        {recentSessions.length===0&&<div className="note">La prochaine séance terminée apparaîtra ici.</div>}
        {recentSessions.map((s,i)=>{
          const w=workouts.find(x=>x.id===s.workoutId);
          const sets=Object.values(s.logs).reduce((n,a)=>n+a.length,0);
          const volume=Math.round(Object.values(s.logs).flat().reduce((n,x)=>n+(x.weight??0)*x.reps,0));
          const duration=s.startedAt?Math.max(0,Math.floor((s.finishedAt-s.startedAt)/1000)):0;
          return <div className="session-history-item" key={s.id??s.finishedAt+i}>
            <div><strong>{w?.title??s.workoutId}</strong><span>{dateKey(s.finishedAt)}</span></div>
            <div className="session-stats"><b>{s.cardio?`${s.cardio.durationMinutes}m`:sets}</b><small>{s.cardio?"cardio":"séries"}</small></div>
            <div className="session-stats"><b>{duration?formatTimer(duration):"—"}</b><small>durée</small></div>
            <div className="session-stats"><b>{(s.cardio?.distanceKm ?? volume)||"—"}</b><small>{s.cardio?.distanceKm?"km":"kg·reps"}</small></div>
          </div>;
        })}
      </div>

      <div className="section-title"><h3>Références de départ</h3><span>avant V4</span></div>
      <div className="history-list">{history.map(h=><div className="history-item" key={h.exerciseId}><strong>{h.label}</strong><span>{h.reference}</span></div>)}</div>
    </section>}

    {tab==="recovery"&&<section>
      <div className="recovery-hero">
        <div>
          <div className="eyebrow">RÉCUPÉRATION</div>
          <h2>{openSleep?"Nuit en cours":"Sommeil & corps"}</h2>
          <p>{openSleep
            ?"L’app suit cette nuit dans le cloud."
            :"Tes données de récupération restent liées à ton compte Supabase."}</p>
        </div>
        <div className="sleep-score"><span>Dernière nuit</span><strong>{latestSleepMinutes?durationLabel(latestSleepMinutes):"—"}</strong></div>
      </div>

      {!openSleep&&<div className="bedtime-action">
        <div><span className="eyebrow">CE SOIR</span><strong>Deux façons de lancer la nuit</strong><small>“Au lit” enregistre l’arrivée au lit. “Je dors maintenant” enregistre directement l’extinction.</small></div>
        <div className="sleep-action-stack">
          <button className="secondary bedtime-button" onClick={()=>beginSleep(false)}>Je vais au lit</button>
          <button className="primary bedtime-button" onClick={()=>beginSleep(true)}>Je dors maintenant</button>
        </div>
      </div>}

      {openSleep&&!openSleep.lightsOutAt&&<div className="bedtime-action">
        <div><span className="eyebrow">AU LIT DEPUIS {clock(openSleep.bedAt)}</span><strong>Quand tu poses la télécommande…</strong><small>Appuie au moment où tu arrêtes vraiment tout.</small></div>
        <button className="primary bedtime-button" onClick={lightsOutNow}>Je dors maintenant</button>
      </div>}

      {openSleep&&openSleep.lightsOutAt&&<div className="sleep-plan">
        <div className="wake-recommendation">
          <div><span>RÉVEIL CONSEILLÉ</span><strong>{suggestedWakeAt?clock(suggestedWakeAt):"—"}</strong></div>
          <p>Extinction à {clock(openSleep.lightsOutAt)}. Cette heure conserve ta cible de <b>{durationLabel(targetSleepMinutes)}</b>.</p>
        </div>
        <label className="time-card">
          <span>TON RÉVEIL PRÉVU</span>
          <input type="time" value={plannedWakeTime} onChange={e=>changeWakePlan(e.target.value)}/>
          <small>{plannedSleepMinutes?durationLabel(plannedSleepMinutes):"—"} entre extinction et réveil prévu.</small>
          {suggestedWakeAt&&<button className="secondary" type="button" onClick={()=>changeWakePlan(clock(suggestedWakeAt))}>Prendre le conseillé</button>}
        </label>
        <button className="primary big wake" onClick={wakeNow}>Je suis réveillé</button>
      </div>}

      {latestSleep?.wakeAt&&<div className="quality-card">
        <div><strong>Comment tu te sens au réveil ?</strong><span>Une note rapide aide Nolan à contextualiser la séance.</span></div>
        <div>{[1,2,3,4,5].map(q=><button key={q} className={latestSleep.quality===q?"active":""} onClick={()=>rateSleep(q)}>{q}</button>)}</div>
      </div>}

      <div className="section-title"><h3>Routine</h3><span>synchronisée</span></div>
      <div className="recovery-grid">
        <label className="time-card"><span>Préparation coucher</span><input type="time" value={prepTarget} onChange={e=>setPrepTarget(e.target.value)}/><small>Fin boulot, lumière basse.</small></label>
        <label className="time-card"><span>Sommeil cible</span><input type="time" value={sleepTarget} onChange={e=>setSleepTarget(e.target.value)}/><small>Heure idéale d’endormissement.</small></label>
        <label className="time-card"><span>Réveil cible</span><input type="time" value={wakeTarget} onChange={e=>setWakeTarget(e.target.value)}/><small>Base utilisée pour calculer la durée cible.</small></label>
        <label className="time-card"><span>Durée cible</span><div className="big-value">{durationLabel(targetSleepMinutes)}</div><small>Calculée automatiquement.</small></label>
      </div>

      <div className="section-title"><h3>Mensurations</h3><span>optionnel</span></div>
      <div className="metric-entry">
        <label>Poids<input inputMode="decimal" placeholder="69.0" value={metricWeight} onChange={e=>setMetricWeight(e.target.value)}/><span>kg</span></label>
        <label>Tour de taille<input inputMode="decimal" placeholder="80.0" value={metricWaist} onChange={e=>setMetricWaist(e.target.value)}/><span>cm</span></label>
        <button className="primary" onClick={addMetric}>Enregistrer</button>
      </div>
      <div className="metric-charts">
        <div className="chart-card"><strong>Poids</strong><MiniChart values={weightSeries} suffix=" kg"/></div>
        <div className="chart-card"><strong>Tour de taille</strong><MiniChart values={waistSeries} suffix=" cm"/></div>
      </div>

      <div className="section-title"><h3>Notifications</h3><span>PWA</span></div>
      <div className="integration-card connected">
        <div><strong>Web Push</strong><span>Repos local + rappels serveur pour coucher, séance et créatine. Les rappels serveur fonctionnent même lorsque la PWA est fermée.</span></div>
        <b>{pushReady?"Cet appareil":notificationsEnabled?"Autre appareil":"Off"}</b>
      </div>
      {!notificationsEnabled&&<button className="primary big" onClick={enableNotifications}>Activer les notifications</button>}
      <div className="recovery-grid">
        <label className="time-card"><span>Rappel séance</span><input type="time" value={workoutReminderTime} onChange={e=>setWorkoutReminderTime(e.target.value)}/></label>
        <label className="time-card"><span>Rappel créatine</span><input type="time" value={creatineReminderTime} onChange={e=>setCreatineReminderTime(e.target.value)}/></label>
      </div>

      <div className="section-title"><h3>Compte & sync</h3><span>{authAnonymous?"anonyme":"sécurisé"}</span></div>
      <div className="account-card">
        <strong>{authAnonymous?"Sécuriser tes données":"Compte sécurisé"}</strong>
        <p>{authAnonymous
          ?"Ajoute ton email pour retrouver tes données sur un nouvel iPhone ou ton Mac."
          : `Connecté avec ${authUser?.email??"ton compte"}.`}</p>
        <input type="email" placeholder="ton@email.fr" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)}/>
        <div className="account-actions">
          {authAnonymous&&<button className="primary" onClick={secureAccount}>Sécuriser ce compte</button>}
          <button className="secondary" onClick={requestMagicLink}>Recevoir un lien de connexion</button>
        </div>
        {accountMessage&&<small>{accountMessage}</small>}
      </div>

      <div className={`integration-card ${isCloudConfigured?"connected":""}`}>
        <div><strong>Cloud privé</strong><span>Les séances, nuits, mensurations et préférences sont chargées depuis Supabase à l’ouverture.</span></div>
        <b>{cloudStatus==="ok"?"Actif":"…"}</b>
      </div>
    </section>}

    {tab==="coach"&&<section>
      <div className="coach-card">
        <div className="eyebrow">NOLAN · CONNECTÉ AUX DONNÉES</div>
        <h2>{autoCoachMode==="tired"?"On allège aujourd’hui.":"Plan normal."}</h2>
        <p>{autoCoachText}</p>

        <div className="coach-options">
          {([
            ["normal","Normal"],["tired","Mal dormi"],["short","40 min max"],["crowded","Salle blindée"]
          ] as const).map(([id,label])=>
            <button key={id} className={coachMode===id?"selected":""} onClick={()=>setCoachMode(id)}>{label}</button>
          )}
        </div>

        <div className="coach-result">
          {coachMode==="normal"&&<>1–2 RIR. Progression si le haut de fourchette est validé proprement.</>}
          {coachMode==="tired"&&<>Une série de moins sur les mouvements concernés, zéro échec forcé.</>}
          {coachMode==="short"&&<>Deux séries par exercice, priorités P1 d’abord.</>}
          {coachMode==="crowded"&&<>“Machine prise” reporte l’exercice et le repropose avant la fin.</>}
        </div>

        {todayWorkout&&<>
          <div className="section-title"><h3>{todayWorkout.title}</h3><span>cibles Nolan</span></div>
          <div className="exercise-list">
            {todayWorkout.exercises.slice(0,5).map(ex=>{
              const rec=recommendationFor(ex);
              return <div className="exercise-row" key={ex.id}>
                <div className="grow"><strong>{ex.name}</strong><div className="muted">{rec.label}</div></div>
                <div className="load">{rec.weight!=null?`${rec.weight} ${ex.unit}`:"—"}</div>
              </div>;
            })}
          </div>
          <button className="primary big" onClick={()=>{setSelectedWorkoutId(todayWorkout.id);startWorkout(todayWorkout)}}>Lancer avec ce plan</button>
        </>}
      </div>
    </section>}

    <footer><span>Cloud → données → décision.</span><span>V4</span></footer>
  </main>;
}
