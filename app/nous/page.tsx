"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addNousEvent,
  addNousItem,
  createNousSpace,
  deleteNousEvent,
  deleteNousItem,
  isNousCloudConfigured,
  joinNousSpace,
  loadNousData,
  loadNousSpace,
  nousSupabase,
  sendNousMagicLink,
  subscribeNous,
  updateNousItem,
  type NousAssignee,
  type NousEvent,
  type NousItem,
  type NousItemKind,
  type NousSpace
} from "../../lib/nous-cloud";

type Tab="today"|"lists"|"calendar"|"ideas";
type ComposerMode="item"|"event";
type LocalState={items:NousItem[];events:NousEvent[]};

const LOCAL_KEY="nous-local-v1";
const KIND_LABELS:Record<NousItemKind,string>={
  shopping:"Courses",
  task:"À faire",
  idea:"Idées",
  trip:"Voyages",
  note:"Pense-bête"
};
const KIND_ICON:Record<NousItemKind,string>={
  shopping:"🛒",
  task:"✓",
  idea:"✦",
  trip:"↗",
  note:"•"
};

function uid(){
  return typeof crypto!=="undefined"&&"randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function isoNow(){return new Date().toISOString();}

function guessKind(input:string):NousItemKind{
  const t=input.toLowerCase();
  if(/(acheter|courses?|lait|pain|oeuf|œuf|papier|lessive|supermarché|carrefour|leclerc)/.test(t)) return "shopping";
  if(/(voyage|week-?end|destination|vacances|hôtel|hotel|avion|train|city trip)/.test(t)) return "trip";
  if(/(idée|envie|restaurant|resto|film|série|activité|date|tester|visiter)/.test(t)) return "idea";
  if(/(penser|rappeler|appeler|réparer|faire|prendre rendez|rdv|payer|résilier)/.test(t)) return "task";
  return "note";
}

function dayLabel(date:string){
  const d=new Date(date);
  const today=new Date();
  const tomorrow=new Date();
  tomorrow.setDate(today.getDate()+1);
  const same=(a:Date,b:Date)=>a.toDateString()===b.toDateString();
  if(same(d,today)) return "Aujourd’hui";
  if(same(d,tomorrow)) return "Demain";
  return d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
}

function timeLabel(date:string){
  return new Date(date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
}

function toDateTimeLocal(iso?:string|null){
  if(!iso) return "";
  const d=new Date(iso);
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}

export default function NousPage(){
  const [tab,setTab]=useState<Tab>("today");
  const [items,setItems]=useState<NousItem[]>([]);
  const [events,setEvents]=useState<NousEvent[]>([]);
  const [space,setSpace]=useState<NousSpace|null>(null);
  const [cloudReady,setCloudReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [syncLabel,setSyncLabel]=useState("Local");

  const [composerOpen,setComposerOpen]=useState(false);
  const [composerMode,setComposerMode]=useState<ComposerMode>("item");
  const [draftTitle,setDraftTitle]=useState("");
  const [draftDetails,setDraftDetails]=useState("");
  const [draftKind,setDraftKind]=useState<NousItemKind>("task");
  const [draftAssignee,setDraftAssignee]=useState<NousAssignee>("both");
  const [draftDue,setDraftDue]=useState("");
  const [eventStart,setEventStart]=useState("");
  const [eventEnd,setEventEnd]=useState("");
  const [eventLocation,setEventLocation]=useState("");

  const [listFilter,setListFilter]=useState<NousItemKind>("shopping");
  const [showDone,setShowDone]=useState(false);

  const [email,setEmail]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [spaceName,setSpaceName]=useState("Notre espace");
  const [inviteCode,setInviteCode]=useState("");
  const [onboardingMessage,setOnboardingMessage]=useState("");
  const [authEmail,setAuthEmail]=useState<string|null>(null);

  function persistLocal(nextItems:NousItem[],nextEvents:NousEvent[]){
    localStorage.setItem(LOCAL_KEY,JSON.stringify({items:nextItems,events:nextEvents}));
  }

  async function refreshCloud(currentSpace=space){
    if(!currentSpace) return;
    setSyncLabel("Synchro…");
    const data=await loadNousData(currentSpace.householdId);
    setItems(data.items);
    setEvents(data.events);
    setSyncLabel("À jour");
  }

  useEffect(()=>{
    try{
      const raw=JSON.parse(localStorage.getItem(LOCAL_KEY)??"{}") as Partial<LocalState>;
      setItems(Array.isArray(raw.items)?raw.items:[]);
      setEvents(Array.isArray(raw.events)?raw.events:[]);
    }catch{}

    void (async()=>{
      if(!isNousCloudConfigured||!nousSupabase){
        setLoading(false);
        return;
      }
      const {data}=await nousSupabase.auth.getSession();
      setAuthEmail(data.session?.user?.email??null);

      const {data:{subscription}}=nousSupabase.auth.onAuthStateChange((_event,session)=>{
        setAuthEmail(session?.user?.email??null);
        if(session?.user?.email){
          window.setTimeout(async()=>{
            const nextSpace=await loadNousSpace();
            if(nextSpace){
              setSpace(nextSpace);
              setCloudReady(true);
              await refreshCloud(nextSpace);
            }
          },0);
        }
      });

      const s=await loadNousSpace();
      if(s){
        setSpace(s);
        setCloudReady(true);
        await refreshCloud(s);
      }
      setLoading(false);
    })();
  },[]);

  useEffect(()=>{
    if(!space||!cloudReady) return;
    return subscribeNous(space.householdId,()=>{
      void (async()=>{
        const nextSpace=await loadNousSpace();
        if(nextSpace) setSpace(nextSpace);
        await refreshCloud(nextSpace??space);
      })();
    });
  },[space?.householdId,cloudReady]);

  useEffect(()=>{
    if(!cloudReady) persistLocal(items,events);
  },[items,events,cloudReady]);

  function openComposer(mode:ComposerMode,kind?:NousItemKind){
    setComposerMode(mode);
    setDraftTitle("");
    setDraftDetails("");
    setDraftAssignee("both");
    setDraftDue("");
    setEventStart("");
    setEventEnd("");
    setEventLocation("");
    if(kind) setDraftKind(kind);
    setComposerOpen(true);
  }

  async function submitItem(){
    const title=draftTitle.trim();
    if(!title) return;
    const kind=draftKind;
    const input={
      kind,
      title,
      details:draftDetails.trim()||null,
      due_at:draftDue?new Date(draftDue).toISOString():null,
      assignee:draftAssignee,
      done:false,
      pinned:kind==="note"
    };

    if(cloudReady&&space){
      setSyncLabel("Synchro…");
      const r=await addNousItem(space.householdId,input);
      setSyncLabel(r.ok?"À jour":"Erreur");
      if(r.ok) await refreshCloud();
    }else{
      setItems(prev=>[{
        id:uid(),
        ...input,
        created_at:isoNow(),
        updated_at:isoNow()
      },...prev]);
    }
    setComposerOpen(false);
  }

  async function submitEvent(){
    const title=draftTitle.trim();
    if(!title||!eventStart) return;
    const input={
      title,
      starts_at:new Date(eventStart).toISOString(),
      ends_at:eventEnd?new Date(eventEnd).toISOString():null,
      location:eventLocation.trim()||null,
      details:draftDetails.trim()||null,
      assignee:draftAssignee
    };

    if(cloudReady&&space){
      setSyncLabel("Synchro…");
      const r=await addNousEvent(space.householdId,input);
      setSyncLabel(r.ok?"À jour":"Erreur");
      if(r.ok) await refreshCloud();
    }else{
      setEvents(prev=>[{
        id:uid(),
        ...input,
        created_at:isoNow()
      },...prev]);
    }
    setComposerOpen(false);
  }

  async function toggleItem(item:NousItem){
    const done=!item.done;
    if(cloudReady){
      await updateNousItem(item.id,{done});
      await refreshCloud();
    }else{
      setItems(prev=>prev.map(x=>x.id===item.id?{...x,done,updated_at:isoNow()}:x));
    }
  }

  async function removeItem(item:NousItem){
    if(!confirm("Supprimer cet élément ?")) return;
    if(cloudReady){
      await deleteNousItem(item.id);
      await refreshCloud();
    }else{
      setItems(prev=>prev.filter(x=>x.id!==item.id));
    }
  }

  async function removeEvent(event:NousEvent){
    if(!confirm("Supprimer cet événement ?")) return;
    if(cloudReady){
      await deleteNousEvent(event.id);
      await refreshCloud();
    }else{
      setEvents(prev=>prev.filter(x=>x.id!==event.id));
    }
  }

  async function promoteIdea(item:NousItem){
    const when=prompt("Date et heure ? Exemple : 2026-10-10 19:30");
    if(!when) return;
    const parsed=new Date(when.replace(" ","T"));
    if(Number.isNaN(parsed.getTime())) return;
    const input={
      title:item.title,
      starts_at:parsed.toISOString(),
      ends_at:null,
      location:null,
      details:item.details??null,
      assignee:item.assignee
    };
    if(cloudReady&&space){
      const r=await addNousEvent(space.householdId,input);
      if(r.ok){
        await updateNousItem(item.id,{done:true});
        await refreshCloud();
      }
    }else{
      setEvents(prev=>[{
        id:uid(),
        ...input,
        created_at:isoNow()
      },...prev]);
      setItems(prev=>prev.map(x=>x.id===item.id?{...x,done:true}:x));
    }
  }

  async function sendLogin(){
    if(!email.trim()) return;
    setOnboardingMessage("Envoi…");
    const r=await sendNousMagicLink(email.trim());
    setOnboardingMessage(r.ok?"Lien envoyé par email.":"Erreur : "+r.reason);
  }

  async function createSpace(){
    if(!displayName.trim()) return;
    setOnboardingMessage("Création…");
    const r=await createNousSpace(spaceName,displayName);
    if(!r.ok){
      setOnboardingMessage("Erreur : "+r.reason);
      return;
    }
    const s=await loadNousSpace();
    if(s){
      setSpace(s);
      setCloudReady(true);
      await refreshCloud(s);
    }
  }

  async function joinSpace(){
    if(!displayName.trim()||!inviteCode.trim()) return;
    setOnboardingMessage("Connexion à votre espace…");
    const r=await joinNousSpace(inviteCode,displayName);
    if(!r.ok){
      setOnboardingMessage("Erreur : "+r.reason);
      return;
    }
    const s=await loadNousSpace();
    if(s){
      setSpace(s);
      setCloudReady(true);
      await refreshCloud(s);
    }
  }

  const now=Date.now();
  const upcoming=useMemo(
    ()=>events
      .filter(e=>new Date(e.starts_at).getTime()>=now-2*60*60*1000)
      .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()),
    [events,now]
  );

  const dueTasks=useMemo(
    ()=>items.filter(i=>i.kind==="task"&&!i.done).sort((a,b)=>{
      if(!a.due_at&&!b.due_at) return 0;
      if(!a.due_at) return 1;
      if(!b.due_at) return -1;
      return new Date(a.due_at).getTime()-new Date(b.due_at).getTime();
    }),
    [items]
  );
  const shopping=items.filter(i=>i.kind==="shopping"&&!i.done);
  const pinned=items.filter(i=>i.kind==="note"&&!i.done&&i.pinned);
  const ideas=items.filter(i=>(i.kind==="idea"||i.kind==="trip")&&!i.done);
  const filteredItems=items.filter(i=>i.kind===listFilter&&(showDone||!i.done));

  const next14=upcoming.filter(e=>new Date(e.starts_at).getTime()<now+14*86400000);
  const freeIdeaCount=ideas.length;

  function assigneeLabel(assignee:NousAssignee){
    if(assignee==="both") return "Nous deux";
    if(!space) return assignee==="owner"?"Moi":"Partenaire";
    const member=space.members.find(m=>m.role===assignee);
    if(assignee===space.role) return "Moi";
    return member?.displayName??"Partenaire";
  }

  return <main className="nous-app">
    <header className="nous-topbar">
      <div>
        <span className="nous-kicker">NOUS</span>
        <h1>Notre vie à deux.</h1>
      </div>
      <div className="nous-status">
        <span className={cloudReady?"dot online":"dot"}/>
        {cloudReady?syncLabel:"Mode local"}
      </div>
    </header>

    {loading?<div className="nous-loading">Chargement…</div>:<>
      {!cloudReady&&isNousCloudConfigured&&<section className="cloud-setup">
        <div className="setup-copy">
          <span>ESPACE PARTAGÉ</span>
          <h2>{authEmail?"Créez votre espace à deux.":"Connecte-toi pour partager."}</h2>
          <p>{authEmail
            ?"Une fois créé, tu auras un code à envoyer à ta copine. Tout se synchronisera en temps réel."
            :"Un lien magique suffit. Pas de mot de passe à retenir."}</p>
        </div>

        {!authEmail?<div className="setup-form">
          <input type="email" placeholder="Ton email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <button onClick={sendLogin}>Recevoir le lien</button>
        </div>:<div className="setup-grid">
          <div className="setup-card">
            <strong>Créer notre espace</strong>
            <input placeholder="Ton prénom" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>
            <input placeholder="Nom de l’espace" value={spaceName} onChange={e=>setSpaceName(e.target.value)}/>
            <button onClick={createSpace}>Créer</button>
          </div>
          <div className="setup-card">
            <strong>Rejoindre</strong>
            <input placeholder="Ton prénom" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>
            <input placeholder="Code d’invitation" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())}/>
            <button onClick={joinSpace}>Rejoindre</button>
          </div>
        </div>}
        {onboardingMessage&&<small className="setup-message">{onboardingMessage}</small>}
      </section>}

      {space&&<div className="space-banner">
        <div>
          <strong>{space.householdName}</strong>
          <span>Connecté en tant que {space.memberName}</span>
        </div>
        {space.inviteCode&&<button onClick={()=>navigator.clipboard?.writeText(space.inviteCode??"")}>
          Code {space.inviteCode}
        </button>}
      </div>}

      {tab==="today"&&<section className="nous-section">
        <div className="today-hero">
          <div>
            <span>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</span>
            <h2>{shopping.length||dueTasks.length||next14.length?"On garde tout au même endroit.":"Rien d’urgent. Profitez."}</h2>
          </div>
          <button className="quick-add" onClick={()=>openComposer("item")}>＋</button>
        </div>

        <div className="quick-grid">
          <button onClick={()=>{setDraftKind("shopping");openComposer("item","shopping")}}>
            <b>🛒</b><strong>{shopping.length}</strong><span>Courses</span>
          </button>
          <button onClick={()=>{setTab("lists");setListFilter("task")}}>
            <b>✓</b><strong>{dueTasks.length}</strong><span>À faire</span>
          </button>
          <button onClick={()=>setTab("calendar")}>
            <b>▦</b><strong>{next14.length}</strong><span>14 jours</span>
          </button>
          <button onClick={()=>setTab("ideas")}>
            <b>✦</b><strong>{freeIdeaCount}</strong><span>Envies</span>
          </button>
        </div>

        <div className="section-head"><h3>À ne pas oublier</h3><button onClick={()=>openComposer("item","note")}>Ajouter</button></div>
        {pinned.length?<div className="memo-stack">
          {pinned.slice(0,3).map(item=><article className="memo-card" key={item.id}>
            <p>{item.title}</p>
            {item.details&&<small>{item.details}</small>}
            <div><button onClick={()=>toggleItem(item)}>C’est fait</button><button onClick={()=>removeItem(item)}>×</button></div>
          </article>)}
        </div>:<div className="empty-card">Un code de porte, un truc à acheter, un détail à ne pas perdre : mets-le ici.</div>}

        <div className="section-head"><h3>Cette semaine</h3><button onClick={()=>setTab("calendar")}>Tout voir</button></div>
        <div className="timeline">
          {upcoming.slice(0,4).map(event=><article className="timeline-row" key={event.id}>
            <div className="date-block"><strong>{dayLabel(event.starts_at)}</strong><span>{timeLabel(event.starts_at)}</span></div>
            <div className="timeline-content"><strong>{event.title}</strong>{event.location&&<span>{event.location}</span>}</div>
            <button onClick={()=>removeEvent(event)}>×</button>
          </article>)}
          {!upcoming.length&&<div className="empty-card">Aucun événement à venir. Ajoutez vos week-ends, restos, rendez-vous ou départs.</div>}
        </div>

        <div className="section-head"><h3>À faire bientôt</h3><button onClick={()=>{setTab("lists");setListFilter("task")}}>Liste</button></div>
        <div className="compact-list">
          {dueTasks.slice(0,4).map(item=><button className="check-row" key={item.id} onClick={()=>toggleItem(item)}>
            <i/><span>{item.title}</span><small>{item.due_at?dayLabel(item.due_at):"Quand vous pouvez"}</small>
          </button>)}
          {!dueTasks.length&&<div className="empty-card">Rien à faire en attente.</div>}
        </div>
      </section>}

      {tab==="lists"&&<section className="nous-section">
        <div className="section-title-large">
          <span>LISTES PARTAGÉES</span>
          <h2>Tout ce qu’on doit gérer.</h2>
        </div>

        <div className="kind-tabs">
          {(["shopping","task","note"] as NousItemKind[]).map(k=><button key={k} className={listFilter===k?"active":""} onClick={()=>setListFilter(k)}>
            {KIND_ICON[k]} {KIND_LABELS[k]}
          </button>)}
        </div>

        <div className="list-toolbar">
          <span>{filteredItems.length} élément{filteredItems.length>1?"s":""}</span>
          <label><input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/> Afficher faits</label>
        </div>

        <div className="shared-list">
          {filteredItems.map(item=><article className={item.done?"shared-item done":"shared-item"} key={item.id}>
            <button className="round-check" onClick={()=>toggleItem(item)}>{item.done?"✓":""}</button>
            <div>
              <strong>{item.title}</strong>
              <span>{assigneeLabel(item.assignee)}{item.due_at?` · ${dayLabel(item.due_at)}`:""}</span>
            </div>
            <button className="item-more" onClick={()=>removeItem(item)}>×</button>
          </article>)}
          {!filteredItems.length&&<div className="empty-card">La liste est vide.</div>}
        </div>
        <button className="full-add" onClick={()=>openComposer("item",listFilter)}>＋ Ajouter à {KIND_LABELS[listFilter].toLowerCase()}</button>
      </section>}

      {tab==="calendar"&&<section className="nous-section">
        <div className="section-title-large">
          <span>AGENDA À DEUX</span>
          <h2>Les prochaines semaines.</h2>
        </div>

        <div className="calendar-strip">
          {Array.from({length:14},(_,i)=>{
            const d=new Date();
            d.setDate(d.getDate()+i);
            const count=events.filter(e=>new Date(e.starts_at).toDateString()===d.toDateString()).length;
            return <div className={i===0?"cal-day today":"cal-day"} key={i}>
              <span>{d.toLocaleDateString("fr-FR",{weekday:"short"}).slice(0,2)}</span>
              <strong>{d.getDate()}</strong>
              <i className={count?"has-event":""}/>
            </div>;
          })}
        </div>

        <button className="full-add" onClick={()=>openComposer("event")}>＋ Ajouter un événement</button>

        <div className="agenda-list">
          {upcoming.map(event=><article className="agenda-card" key={event.id}>
            <div className="agenda-date">
              <strong>{new Date(event.starts_at).getDate()}</strong>
              <span>{new Date(event.starts_at).toLocaleDateString("fr-FR",{month:"short"})}</span>
            </div>
            <div className="agenda-main">
              <strong>{event.title}</strong>
              <span>{timeLabel(event.starts_at)}{event.location?` · ${event.location}`:""}</span>
              {event.details&&<small>{event.details}</small>}
            </div>
            <button onClick={()=>removeEvent(event)}>×</button>
          </article>)}
          {!upcoming.length&&<div className="empty-card">Votre agenda commun est vide.</div>}
        </div>
      </section>}

      {tab==="ideas"&&<section className="nous-section">
        <div className="section-title-large">
          <span>ENVIES & PROJETS</span>
          <h2>Ne plus dire “faudrait qu’on…”.</h2>
        </div>

        <div className="idea-intro">
          <p>Une idée reste ici tant qu’elle n’a pas de date. Quand vous êtes chauds, vous la transformez en plan.</p>
          <div>
            <button onClick={()=>openComposer("item","idea")}>＋ Une idée</button>
            <button onClick={()=>openComposer("item","trip")}>↗ Une destination</button>
          </div>
        </div>

        <div className="idea-grid">
          {ideas.map(item=><article className={item.kind==="trip"?"idea-card trip":"idea-card"} key={item.id}>
            <span>{item.kind==="trip"?"DESTINATION":"ENVIE"}</span>
            <h3>{item.title}</h3>
            {item.details&&<p>{item.details}</p>}
            <div className="idea-actions">
              <button onClick={()=>promoteIdea(item)}>Planifier</button>
              <button onClick={()=>toggleItem(item)}>Fait</button>
              <button onClick={()=>removeItem(item)}>×</button>
            </div>
          </article>)}
          {!ideas.length&&<div className="empty-card">Ajoutez vos restos, activités, destinations, films, week-ends ou gros projets.</div>}
        </div>
      </section>}

      <nav className="bottom-nav">
        {([
          ["today","⌂","Aujourd’hui"],
          ["lists","☷","Listes"],
          ["calendar","▦","Agenda"],
          ["ideas","✦","Envies"]
        ] as const).map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>
          <b>{icon}</b><span>{label}</span>
        </button>)}
      </nav>

      <button className="fab" onClick={()=>openComposer("item")}>＋</button>

      {composerOpen&&<div className="sheet-backdrop" onMouseDown={()=>setComposerOpen(false)}>
        <div className="composer-sheet" onMouseDown={e=>e.stopPropagation()}>
          <div className="sheet-handle"/>
          <div className="composer-head">
            <div><span>AJOUT RAPIDE</span><h3>{composerMode==="event"?"Nouvel événement":"On note quoi ?"}</h3></div>
            <button onClick={()=>setComposerOpen(false)}>×</button>
          </div>

          {composerMode==="item"&&<>
            <input className="composer-title" autoFocus placeholder="Ex. acheter du lait, appeler le plombier, Lisbonne…" value={draftTitle} onChange={e=>{
              const value=e.target.value;
              setDraftTitle(value);
              if(value.length>2) setDraftKind(guessKind(value));
            }}/>
            <div className="composer-kinds">
              {(["shopping","task","idea","trip","note"] as NousItemKind[]).map(k=><button key={k} className={draftKind===k?"active":""} onClick={()=>setDraftKind(k)}>
                {KIND_ICON[k]} {KIND_LABELS[k]}
              </button>)}
            </div>
          </>}

          {composerMode==="event"&&<input className="composer-title" autoFocus placeholder="Ex. dîner avec les parents" value={draftTitle} onChange={e=>setDraftTitle(e.target.value)}/>}

          <textarea placeholder="Détails (optionnel)" value={draftDetails} onChange={e=>setDraftDetails(e.target.value)}/>

          <div className="assignee-row">
            {(["both","owner","member"] as NousAssignee[]).map(a=><button key={a} className={draftAssignee===a?"active":""} onClick={()=>setDraftAssignee(a)}>
              {assigneeLabel(a)}
            </button>)}
          </div>

          {composerMode==="item"&&draftKind==="task"&&<label className="sheet-field">
            <span>Pour quand ?</span>
            <input type="datetime-local" value={draftDue} onChange={e=>setDraftDue(e.target.value)}/>
          </label>}

          {composerMode==="event"&&<>
            <div className="sheet-grid">
              <label className="sheet-field"><span>Début</span><input type="datetime-local" value={eventStart} onChange={e=>setEventStart(e.target.value)}/></label>
              <label className="sheet-field"><span>Fin</span><input type="datetime-local" value={eventEnd} onChange={e=>setEventEnd(e.target.value)}/></label>
            </div>
            <label className="sheet-field"><span>Lieu</span><input placeholder="Optionnel" value={eventLocation} onChange={e=>setEventLocation(e.target.value)}/></label>
          </>}

          <button className="submit-composer" onClick={composerMode==="event"?submitEvent:submitItem}>
            Ajouter à NOUS
          </button>
        </div>
      </div>}
    </>}
  </main>;
}
