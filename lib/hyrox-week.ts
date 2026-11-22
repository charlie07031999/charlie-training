export function parisDate(timestamp:number){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp);
}
export function isHyroxWeek(timestamp:number){
  const date=parisDate(timestamp);
  return date>='2026-11-22'&&date<='2026-11-28';
}
export const hyroxWeek=[
  {date:'2026-11-22',day:'Dimanche · 17h30',title:'Familiarisation légère · facultative',duration:'25–35 min · effort 4–5/10',steps:[
    '8–10 min d’échauffement : marche rapide puis footing facile et mobilité.',
    '2 tours : 400 m de course facile (ou 2–3 min course/marche), 250 m de rameur, 40 m de farmer carry léger, 8 squats au poids du corps. Repos 90–120 s entre les tours.',
    'Un seul tour suffit si fatigue. Pas de stations supplémentaires : garder de la fraîcheur pour les pecs/épaules de lundi.',
    '5–8 min de retour au calme. Pas de séance Legs en plus, pas d’échec musculaire.'
  ]},
  {date:'2026-11-23',day:'Lundi',title:'Pecs · épaules',duration:'45–55 min · 3 répétitions en réserve',steps:[
    'Garder les exercices Push habituels : pecs, épaules et triceps. Échauffement progressif avant les séries de travail.',
    'Réduire légèrement le volume : 3 séries au lieu de 4, 2 au lieu de 3. Garder environ 3 répétitions en réserve ; ajuster la charge si nécessaire. Aucun record ni série à l’échec.',
    'Pas de circuit HYROX en supplément. Si dimanche a laissé de la fatigue, alléger davantage.'
  ]},
  {date:'2026-11-24',day:'Mardi',title:'Dos · biceps',duration:'40–50 min · 3 répétitions en réserve',steps:[
    'Garder les exercices Pull habituels : tractions, tirages, rowing et biceps.',
    'Passer de 3 à 2 séries sur les exercices concernés, conserver 3 répétitions en réserve. Garder les variantes connues et une exécution propre.',
    'Pas de farmer carry lourd ni de finisher : préserver le dos et la prise pour samedi.'
  ]},
  {date:'2026-11-25',day:'Mercredi',title:'Running facile',duration:'20–30 min · effort 3–4/10',steps:[
    '5 min de marche et mise en route, puis footing à une allure permettant de parler en phrases complètes. Terminer par 5 min de marche.',
    'Si tu n’as pas couru récemment : 15–20 min de course/marche suffisent. Ne pas chercher à rattraper du kilométrage.',
    'Pas de fractionné dur, de sortie longue ou de simulation HYROX complète.'
  ]},
  {date:'2026-11-26',day:'Jeudi',title:'Jambes · séance allégée',duration:'25–35 min · 4 répétitions en réserve',steps:[
    'Conserver les mouvements habituels et les mêmes machines. Cette séance entretient les sensations à deux jours du HYROX.',
    'Viser seulement 6–8 séries de travail au total, avec 1–2 séries par mouvement au lieu du volume habituel. Réduire les charges d’environ 10–20 % si nécessaire pour garder au moins 4 répétitions en réserve.',
    'Pas d’échec, de répétitions forcées, de tempo excentrique accentué ni de nouvel exercice. Si jambes déjà lourdes ou douloureuses : mobilité et repos plutôt que séance chargée.'
  ]},
  {date:'2026-11-27',day:'Vendredi',title:'Arriver frais',duration:'Repos',steps:['Marche douce facultative 10–15 min. Préparer tenue, chaussures et eau. Repas habituels, sommeil régulier. Aucun rattrapage de séance.']},
  {date:'2026-11-28',day:'Samedi',title:'HYROX · à la place de l’esthétique',duration:'35–50 min · effort 6/10 maximum',steps:[
    'Exception pour le 28 : le HYROX remplace la séance esthétique/Upper, sans cumuler les deux. Le samedi esthétique reste dans le programme habituel après cette semaine.',
    'Hypothèse : séance de découverte, pas une compétition officielle. Si cours encadré, utiliser les adaptations du coach.',
    '10 min d’échauffement puis 4 blocs : 400 m faciles + 250 m SkiErg ; 400 m + 20 m de poussée légère de traîneau ; 400 m + 250 m rameur ; 400 m + 40 m farmer carry léger. Repos 1–2 min entre les blocs.',
    'Sans matériel : rameur à la place du SkiErg, marche rapide à la place du traîneau. Si essoufflement trop fort, alterner course et marche ou réduire à 2–3 blocs.',
    '5–10 min de retour au calme. Noter effort, durée réelle, distance et sensations. Pas de simulation complète 8 km + 8 stations cette semaine.'
  ]}
];
