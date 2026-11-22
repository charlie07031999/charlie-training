export function parisDate(timestamp:number){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp);
}
export function isHyroxWeek(timestamp:number){
  const date=parisDate(timestamp);
  return date>='2026-11-22'&&date<='2026-11-28';
}
export const hyroxWeek=[
  {date:'2026-11-22',day:'Dimanche · 17h30',title:'Découverte des enchaînements',duration:'35–45 min · effort 5/10',steps:[
    '8–10 min d’échauffement : marche rapide puis footing facile et mobilité.',
    '2 tours : 400 m de course facile (ou 2–3 min course/marche), 250 m de rameur, 40 m de farmer carry léger, 8 squats au poids du corps. Repos 90–120 s entre les tours.',
    'Si tout reste facile : 2 × 5 wall balls légers et 2 × 10 m de poussée de traîneau légère, avec démonstration si nécessaire. Sinon, marche et mobilité.',
    '5–8 min de retour au calme. Pas de séance Legs en plus, pas d’échec musculaire.'
  ]},
  {date:'2026-11-23',day:'Lundi',title:'Récupération',duration:'20–30 min · effort 2/10',steps:['Marche confortable, puis 5–10 min de mobilité douce. Repos complet si courbatures.']},
  {date:'2026-11-24',day:'Mardi',title:'Dernier rappel spécifique',duration:'30–40 min · effort 5–6/10 maximum',steps:[
    '8–10 min d’échauffement. Si dimanche a laissé des courbatures importantes, remplacer cette séance par une marche.',
    '3 blocs, avec 2 min de repos : 400 m faciles + 250 m SkiErg ; 400 m faciles + 250 m rameur ; 400 m faciles + 40 m farmer carry léger.',
    'Sans SkiErg : rameur facile. Sans farmer carry : marche rapide. Les substitutions servent à préparer l’effort, elles ne reproduisent pas une station officielle.',
    'Seulement si déjà familiers : 2 × 10 m de tirage léger de traîneau et 2 × 5 wall balls. 5 min de retour au calme. Aucun test maximal.'
  ]},
  {date:'2026-11-25',day:'Mercredi',title:'Repos et mobilité',duration:'Repos ou 20 min de marche',steps:['Pas de musculation lourde. Mobilité douce 5–10 min si agréable.']},
  {date:'2026-11-26',day:'Jeudi',title:'Activation courte',duration:'15–20 min · effort 3/10',steps:['Course/marche ou vélo facile, conversation aisée. Si les jambes sont fraîches et la course habituelle : 3 × 20 s légèrement plus rapides, récupération 60–90 s. Pas de sprint, pas de stations lourdes.']},
  {date:'2026-11-27',day:'Vendredi',title:'Arriver frais',duration:'Repos',steps:['Marche douce facultative 10–15 min. Préparer tenue, chaussures et eau. Repas habituels, sommeil régulier. Aucun rattrapage de séance.']},
  {date:'2026-11-28',day:'Samedi',title:'Séance HYROX adaptée',duration:'35–50 min · effort 6/10 maximum',steps:[
    'Hypothèse : séance de découverte, pas une compétition officielle. Si cours encadré, utiliser les adaptations du coach.',
    '10 min d’échauffement puis 4 blocs : 400 m faciles + 250 m SkiErg ; 400 m + 20 m de poussée légère de traîneau ; 400 m + 250 m rameur ; 400 m + 40 m farmer carry léger. Repos 1–2 min entre les blocs.',
    'Sans matériel : rameur à la place du SkiErg, marche rapide à la place du traîneau. Si essoufflement trop fort, alterner course et marche ou réduire à 2–3 blocs.',
    '5–10 min de retour au calme. Noter effort, durée réelle, distance et sensations. Pas de simulation complète 8 km + 8 stations cette semaine.'
  ]}
];
