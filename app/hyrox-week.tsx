"use client";
import { hyroxWeek, isHyroxWeek, parisDate } from '../lib/hyrox-week';
export function HyroxWeek({now,archive=false}:{now:number;archive?:boolean}){
  if(!archive&&!isHyroxWeek(now)) return null;
  const today=parisDate(now);
  return <section aria-label="Semaine HYROX" style={{padding:22,margin:'12px 0 24px',border:'1px solid #b9ce85',borderRadius:22,background:'var(--card, #18221c)',color:'#f6f8ef'}}>
    <small>22–28 NOVEMBRE 2026 · PRÉPARATION HYROX</small>
    <h2 style={{margin:'10px 0'}}>L’objectif : arriver frais samedi.</h2>
    <p>Cette semaine remplace le cycle habituel. Aucun rattrapage Push/Pull/Legs : suis le jour indiqué ci-dessous. Les anciennes séances restent accessibles.</p>
    <p>Effort sur 10 : 3 = facile, 5 = modéré, 6 = soutenu mais maîtrisé. Charges permettant une technique propre et plusieurs répétitions en réserve. Si fatigue ou courbatures : réduire de moitié ou marcher. Arrêter en cas de douleur.</p>
    {hyroxWeek.map(day=><details key={day.date} open={day.date===today} style={{padding:'14px 0',borderTop:'1px solid #61705a'}}>
      <summary style={{cursor:'pointer',fontWeight:700}}>{day.day} — {day.title}{day.date===today?' · Aujourd’hui':''}</summary>
      <p>{day.duration}</p>
      <ol style={{paddingLeft:20}}>{day.steps.map(step=><li key={step} style={{marginBottom:10,lineHeight:1.5}}>{step}</li>)}</ol>
    </details>)}
    <p style={{fontSize:13}}>Le format officiel alterne 8 × 1 km et 8 stations : SkiErg, sled push, sled pull, burpee broad jumps, rameur, farmer carry, fentes avec sac et wall balls. Ce plan réduit les distances et les charges : c’est une familiarisation, pas un protocole officiel.</p>
    <p style={{fontSize:13}}>Après samedi : réévaluer la récupération, puis organiser un nouveau cycle selon l’objectif choisi. Garder les mouvements utiles et suivre les progrès par variante ; changer tous les exercices n’est pas nécessaire.</p>
    <a style={{color:'#d5f4a1'}} href="https://hyroxevents.zendesk.com/hc/en-gb/articles/38624619510941-Which-exercises-are-in-HYROX">Format HYROX</a>{' · '}<a style={{color:'#d5f4a1'}} href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0282838">Recherche sur la réduction de volume avant une épreuve</a>
    <p style={{fontSize:12}}>La recherche porte sur l’endurance, pas spécifiquement cette semaine HYROX. Le choix d’un volume modéré ici tient compte de l’absence de repères cardio récents fiables.</p>
  </section>;
}
