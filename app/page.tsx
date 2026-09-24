"use client";

import { useEffect, useMemo, useState } from "react";
import { history, weekPlan, workouts } from "../lib/workouts";
import type { SetLog, Workout } from "../lib/types";

type SessionState = {
  workoutId:string;
  exerciseIndex:number;
  setIndex:number;
  logs:Record<string, SetLog[]>;
  startedAt:number;
  completedIds:string[];
  deferredIds:string[];
};

type CompletedSession = {
  workoutId:string;
  finishedAt:number;
  startedAt?:number;
  logs:Record<string, SetLog[]>;
};

type CoachMode = "normal"|"tired"|"short"|"crowded";
const STORAGE_KEY = "charlie-training-v1";
const SESSION_KEY = "charlie-training-session-v1";

function formatTimer(s:number){
  const m=Math.floor(s/60).toString().padStart(2,"0");
  const sec=(s%60).toString().padStart(2,"0");
  return `${m}:${sec}`;
}

function workoutForToday(){
  const day = new Date().getDay();
  if(day===1) return "push";
  if(day===2) return "pull";
  if(day===3) return "cardio";
  if(day===4 || day===5) return "legs";
  if(day===6) return "upper";
  return "push";
}

function progressionHint(ex:any, logs:SetLog[]){
  if(!logs?.length) return "";
  const hasFail = logs.some(s=>s.failed || s.reps < ex.repMin);
  const allTop = logs.length >= ex.sets && logs.every(s=>s.reps >= ex.repMax && !s.failed);
  if(allTop) return "Validé haut de fourchette → petite hausse de charge la prochaine fois.";
  if(hasFail) return "Charge à consolider → garde-la la prochaine fois et cherche plus de reps propres.";
  return "Progression en cours → garde la charge et monte progressivement les reps.";
}

export default function Home(){
  const [tab,setTab]=useState<"today"|"week"|"history"|"coach">("today");
  const [selectedWorkoutId,setSelectedWorkoutId]=useState("legs");
  const [session,setSession]=useState<SessionState|null>(null);
  const [completedSessions,setCompletedSessions]=useState<CompletedSession[]>([]);
  const [rest,setRest]=useState(0);
  const [reps,setReps]=useState("8");
  const [weight,setWeight]=useState("");
  const [rir,setRir]=useState("2");
  const [failed,setFailed]=useState(false);
  const [coachMode,setCoachMode]=useState<CoachMode>("normal");
  const [now,setNow]=useState(Date.now());

  const selectedWorkout=useMemo(()=>workouts.find(w=>w.id===selectedWorkoutId)??workouts[0],[selectedWorkoutId]);
  const currentWorkout=session?(workouts.find(w=>w.id===session.workoutId)??selectedWorkout):selectedWorkout;
  const currentExercise=session?currentWorkout.exercises[session.exerciseIndex]:null;

  useEffect(()=>{
    setSelectedWorkoutId(workoutForToday());
    const raw=localStorage.getItem(SESSION_KEY);
    if(raw){
      try{
        const parsed=JSON.parse(raw);
        setSession({
          ...parsed,
          completedIds: parsed.completedIds ?? [],
          deferredIds: parsed.deferredIds ?? []
        });
      }catch{}
    }
    try{
      setCompletedSessions(JSON.parse(localStorage.getItem(STORAGE_KEY)??"[]"));
    }catch{}
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
    if(rest<=0) return;
    const t=setInterval(()=>setRest(v=>Math.max(0,v-1)),1000);
    return()=>clearInterval(t);
  },[rest]);

  useEffect(()=>{
    if(currentExercise?.suggestedWeight!=null) setWeight(String(currentExercise.suggestedWeight));
    else setWeight("");
    setReps(String(currentExercise?.repMin??8));
    setRir("2");
    setFailed(false);
  },[currentExercise?.id]);

  function effectiveTarget(ex=currentExercise){
    if(!ex) return {sets:0,repMin:0,repMax:0};
    if(coachMode==="tired") return {sets:Math.max(2,ex.sets-1),repMin:ex.repMin,repMax:ex.repMax};
    if(coachMode==="short") return {sets:Math.min(2,ex.sets),repMin:ex.repMin,repMax:ex.repMax};
    return {sets:ex.sets,repMin:ex.repMin,repMax:ex.repMax};
  }

  function startWorkout(w:Workout){
    setSelectedWorkoutId(w.id);
    setSession({workoutId:w.id,exerciseIndex:0,setIndex:0,logs:{},startedAt:Date.now(),completedIds:[],deferredIds:[]});
    setTab("today");
  }

  function nextExerciseIndex(s:SessionState, completedIds:string[], deferredIds:string[]){
    for(let offset=1; offset<=currentWorkout.exercises.length; offset++){
      const idx=(s.exerciseIndex+offset)%currentWorkout.exercises.length;
      const id=currentWorkout.exercises[idx].id;
      if(!completedIds.includes(id) && !deferredIds.includes(id)) return idx;
    }
    const deferred = deferredIds.find(id=>!completedIds.includes(id));
    if(deferred) return currentWorkout.exercises.findIndex(ex=>ex.id===deferred);
    return -1;
  }

  function finishWorkout(logs:Record<string,SetLog[]>){
    if(!session) return;
    const item:CompletedSession={workoutId:session.workoutId,startedAt:session.startedAt,finishedAt:Date.now(),logs};
    const next=[...completedSessions,item];
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    setCompletedSessions(next);
    setSession(null);
    setRest(0);
    setTab("history");
  }

  function logSet(){
    if(!session||!currentExercise) return;
    const log:SetLog={
      reps:Number(reps||0),
      weight:weight?Number(weight.replace(",",".")):undefined,
      rir:Number(rir||0),
      failed
    };
    const key=currentExercise.id;
    const nextLogs={...session.logs,[key]:[...(session.logs[key]??[]),log]};
    const target=effectiveTarget();
    const nextSet=session.setIndex+1;
    setRest(currentExercise.restSeconds);
    setFailed(false);

    if(nextSet>=target.sets){
      const completedIds=Array.from(new Set([...session.completedIds,key]));
      const deferredIds=session.deferredIds.filter(id=>id!==key);
      const nextIdx=nextExerciseIndex(session,completedIds,deferredIds);
      if(nextIdx===-1){
        finishWorkout(nextLogs);
        return;
      }
      const nextId=currentWorkout.exercises[nextIdx].id;
      setSession({...session,logs:nextLogs,completedIds,deferredIds,exerciseIndex:nextIdx,setIndex:(nextLogs[nextId]??[]).length});
    }else{
      setSession({...session,logs:nextLogs,setIndex:nextSet});
    }
  }

  function skipMachine(){
    if(!session||!currentExercise) return;
    const deferredIds=Array.from(new Set([...session.deferredIds,currentExercise.id]));
    const nextIdx=nextExerciseIndex(session,session.completedIds,deferredIds);
    if(nextIdx===-1) return;
    const nextId=currentWorkout.exercises[nextIdx].id;
    setSession({...session,deferredIds,exerciseIndex:nextIdx,setIndex:(session.logs[nextId]??[]).length});
    setRest(0);
  }

  const currentHistory=currentExercise?history.find(h=>h.exerciseId===currentExercise.id):null;
  const elapsed=session?Math.max(0,Math.floor((now-session.startedAt)/1000)):0;

  const recent = completedSessions.slice(-5).reverse();

  return <main className="app-shell">
    <header className="topbar">
      <div><div className="eyebrow">CHARLIE TRAINING</div><h1>Performance</h1></div>
      <div className="avatar">CR</div>
    </header>

    <nav className="tabs">
      {([['today','Séance'],['week','Semaine'],['history','Historique'],['coach','Nolan']] as const).map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>

    {tab==='today'&&<section>
      {!session?<>
        <div className="hero-card">
          <div className="hero-kicker">PROCHAINE SÉANCE · V2</div>
          <div className="hero-title-row">
            <div><h2>{selectedWorkout.title}</h2><p>{selectedWorkout.subtitle}</p></div>
            <span className="day-chip">{selectedWorkout.day}</span>
          </div>
          <div className="hero-actions">
            <button className="primary" onClick={()=>startWorkout(selectedWorkout)}>Lancer la séance</button>
            <select value={selectedWorkoutId} onChange={e=>setSelectedWorkoutId(e.target.value)}>
              {workouts.map(w=><option key={w.id} value={w.id}>{w.day} · {w.title}</option>)}
            </select>
          </div>
        </div>

        <div className="section-title"><h3>Aperçu</h3><span>{selectedWorkout.exercises.length} exercices</span></div>
        <div className="exercise-list">
          {selectedWorkout.exercises.map((ex,i)=><div className="exercise-row" key={ex.id}>
            <div className="index">{String(i+1).padStart(2,'0')}</div>
            <div className="grow">
              <div className="row-top"><strong>{ex.name}</strong>{ex.priority&&<span className="priority">P1</span>}</div>
              <div className="muted">{ex.sets}×{ex.repMin}{ex.repMax!==ex.repMin?`–${ex.repMax}`:''} · {ex.target}</div>
            </div>
            <div className="load">{ex.suggestedWeight!=null?`${ex.suggestedWeight} ${ex.unit}`:ex.unit}</div>
          </div>)}
        </div>
      </>:<>
        <div className="session-head">
          <div><div className="eyebrow">{currentWorkout.title}</div><h2>{currentExercise?.name}</h2><p>{currentExercise?.target}</p></div>
          <div className="session-progress">{session.exerciseIndex+1}/{currentWorkout.exercises.length}</div>
        </div>

        <div className="live-strip">
          <div><span>Temps séance</span><strong>{formatTimer(elapsed)}</strong></div>
          <div><span>Exos finis</span><strong>{session.completedIds.length}</strong></div>
          <div><span>En attente</span><strong>{session.deferredIds.length}</strong></div>
        </div>

        <div className="target-card">
          <div className="target-grid">
            <div><span>Série</span><strong>{session.setIndex+1}/{effectiveTarget().sets}</strong></div>
            <div><span>Objectif</span><strong>{effectiveTarget().repMin}–{effectiveTarget().repMax}</strong></div>
            <div><span>Repos</span><strong>{Math.round(((currentExercise?.restSeconds??0)/60)*10)/10} min</strong></div>
          </div>
          <p>{currentExercise?.cue}</p>
        </div>

        {currentHistory&&<div className="history-banner"><span>Dernière réf.</span><strong>{currentHistory.reference}</strong></div>}

        {(session.logs[currentExercise?.id??""]?.length??0)>0&&currentExercise&&
          <div className="progression-banner">{progressionHint(currentExercise,session.logs[currentExercise.id]??[])}</div>
        }

        <div className="rest-box">
          <span>Chrono repos</span><strong className={rest>0?'running':''}>{formatTimer(rest)}</strong>
          <div className="rest-actions"><button onClick={()=>setRest(currentExercise?.restSeconds??0)}>Relancer</button><button onClick={()=>setRest(0)}>Reset</button></div>
        </div>

        <div className="log-card">
          <div className="field"><label>Charge</label><div className="input-wrap"><input value={weight} onChange={e=>setWeight(e.target.value)} inputMode="decimal"/><span>{currentExercise?.unit}</span></div></div>
          <div className="field"><label>Reps</label><div className="stepper"><button onClick={()=>setReps(String(Math.max(0,Number(reps)-1)))}>−</button><strong>{reps}</strong><button onClick={()=>setReps(String(Number(reps)+1))}>+</button></div></div>
          <div className="field"><label>RIR</label><div className="stepper compact"><button onClick={()=>setRir(String(Math.max(0,Number(rir)-1)))}>−</button><strong>{rir}</strong><button onClick={()=>setRir(String(Math.min(5,Number(rir)+1)))}>+</button></div></div>
          <label className="fail-toggle"><input type="checkbox" checked={failed} onChange={e=>setFailed(e.target.checked)}/><span>Échec</span></label>
          <button className="primary big" onClick={logSet}>Valider la série</button>
          <button className="secondary" onClick={skipMachine}>Machine prise → mettre en attente</button>
          <button className="ghost danger" onClick={()=>confirm('Terminer la séance maintenant ?')&&setSession(null)}>Terminer sans enregistrer</button>
        </div>
      </>}
    </section>}

    {tab==='week'&&<section>
      <div className="section-title"><h3>Semaine</h3><span>4 muscu + 1 cardio</span></div>
      <div className="week-grid">{weekPlan.map(item=><div key={item.day} className={`week-card ${item.done?'done':''}`}><div className="week-day">{item.day}</div><strong>{item.title}</strong><span>{item.done?'✓ Fait':'À faire'}</span></div>)}</div>
      <div className="metrics"><div><span>Pas / jour</span><strong>8 000+</strong></div><div><span>Protéines</span><strong>110–130 g</strong></div><div><span>Créatine</span><strong>3–5 g</strong></div><div><span>Sommeil</span><strong>~23h</strong></div></div>
    </section>}

    {tab==='history'&&<section>
      <div className="section-title"><h3>Dernières séances</h3><span>{completedSessions.length} enregistrée(s)</span></div>
      {recent.length===0?<div className="note">Ta première séance enregistrée apparaîtra ici avec durée, séries et volume.</div>:
        <div className="session-history">{recent.map((s,i)=>{
          const w=workouts.find(w=>w.id===s.workoutId);
          const sets=Object.values(s.logs).reduce((n,a)=>n+a.length,0);
          const volume=Math.round(Object.values(s.logs).flat().reduce((n,x)=>n+(x.weight??0)*x.reps,0));
          const duration=s.startedAt?Math.max(0,Math.floor((s.finishedAt-s.startedAt)/1000)):0;
          return <div className="session-history-item" key={s.finishedAt+i}>
            <div><strong>{w?.title??s.workoutId}</strong><span>{new Date(s.finishedAt).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}</span></div>
            <div className="session-stats"><b>{sets}</b><small>séries</small></div>
            <div className="session-stats"><b>{duration?formatTimer(duration):"—"}</b><small>durée</small></div>
            <div className="session-stats"><b>{volume||"—"}</b><small>kg·reps</small></div>
          </div>
        })}</div>
      }

      <div className="section-title"><h3>Références</h3><span>Base actuelle</span></div>
      <div className="history-list">{history.map(h=><div className="history-item" key={h.exerciseId}><strong>{h.label}</strong><span>{h.reference}</span></div>)}</div>
      <div className="note">V2 : historique local enrichi + reprise de séance. La synchro iPhone/Mac viendra avec Supabase.</div>
    </section>}

    {tab==='coach'&&<section>
      <div className="coach-card">
        <div className="eyebrow">NOLAN MODE · V2</div><h2>Comment tu arrives aujourd’hui ?</h2><p>L’app adapte le volume sans changer ton cap.</p>
        <div className="coach-options">
          {([['normal','Normal'],['tired','Mal dormi'],['short','40 min max'],['crowded','Salle blindée']] as const).map(([id,label])=><button key={id} className={coachMode===id?'selected':''} onClick={()=>setCoachMode(id)}>{label}</button>)}
        </div>
        <div className="coach-result">
          {coachMode==='normal'&&<>Plan normal. 1–2 reps en réserve. Progression si haut de fourchette validé.</>}
          {coachMode==='tired'&&<>Retire 1 série aux exercices principaux, zéro échec, garde les charges stables.</>}
          {coachMode==='short'&&<>2 séries par exercice, priorités P1 d’abord, accessoires optionnels.</>}
          {coachMode==='crowded'&&<>“Machine prise” met maintenant l’exercice en attente et te le repropose avant la fin.</>}
        </div>
        <button className="primary big" onClick={()=>{setSelectedWorkoutId(workoutForToday());setTab('today')}}>Préparer la séance du jour</button>
      </div>
    </section>}

    <footer><span>Progression &gt; ego.</span><span>V2 · PWA</span></footer>
  </main>
}
