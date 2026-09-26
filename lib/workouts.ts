import type { Workout, ExerciseHistory } from "./types";

export const workouts: Workout[] = [
  {
    id:"push", day:"Lundi", title:"PUSH", subtitle:"Haut de pecs · épaules · triceps", accent:"#ff6b2c",
    exercises:[
      {id:"incline-bench",name:"Développé incliné barre",target:"Haut de pecs",unit:"kg",suggestedWeight:55,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Banc ~30°. Descente contrôlée. 1–2 reps en réserve.",priority:true},
      {id:"supine",name:"Supine Press",target:"Pecs",unit:"kg/bras",suggestedWeight:40,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Omoplates stables. Pas d’échec avant la dernière série."},
      {id:"pec-fly",name:"Pec Fly",target:"Pecs",unit:"kg",suggestedWeight:79,sets:3,repMin:10,repMax:10,restSeconds:105,cue:"Amplitude contrôlée, pas de claquement."},
      {id:"lateral",name:"Élévations latérales",target:"Deltoïdes latéraux",unit:"kg/bras",suggestedWeight:14,sets:3,repMin:10,repMax:12,restSeconds:75,cue:"Zéro balancier. Monte avec les coudes.",priority:true},
      {id:"shoulder-press",name:"Shoulder Press haltères",target:"Épaules",unit:"kg/bras",suggestedWeight:18,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Buste stable. Pas de sur-cambrure."},
      {id:"triceps-rope",name:"Triceps corde",target:"Triceps",unit:"kg",suggestedWeight:20.3,sets:3,repMin:8,repMax:12,restSeconds:90,cue:"Coudes fixes, ouvre la corde en bas."},
      {id:"crunch",name:"Crunch machine",target:"Abdos",unit:"kg",suggestedWeight:50,sets:3,repMin:10,repMax:15,restSeconds:75,cue:"Enroule le buste et souffle sur la contraction."}
    ]
  },
  {
    id:"pull", day:"Mardi", title:"PULL", subtitle:"Dorsaux · dos · biceps", accent:"#6cb7ff",
    exercises:[
      {id:"pullups",name:"Tractions lestées",target:"Dorsaux",unit:"+kg",suggestedWeight:10,sets:3,repMin:6,repMax:8,restSeconds:150,cue:"Tire les coudes vers le bas. Gainage serré.",priority:true},
      {id:"lat-pulldown",name:"Lat Pulldown",target:"Largeur du dos",unit:"kg",suggestedWeight:59,sets:3,repMin:10,repMax:10,restSeconds:105,cue:"Poitrine sortie, retour contrôlé.",priority:true},
      {id:"row",name:"Rowing poulie",target:"Épaisseur du dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Tire vers le nombril. Torse stable."},
      {id:"straight-arm",name:"Straight-arm Pulldown",target:"Dorsaux",unit:"kg",suggestedWeight:29.3,sets:3,repMin:8,repMax:10,restSeconds:90,cue:"Bras quasi tendus. Ramène vers les cuisses."},
      {id:"face-pull",name:"Face Pull",target:"Arrière d’épaule",unit:"kg",suggestedWeight:27,sets:2,repMin:12,repMax:15,restSeconds:75,cue:"Tire vers le visage. Épaules basses."},
      {id:"ez-curl",name:"Curl EZ poulie",target:"Biceps",unit:"kg",suggestedWeight:20.3,sets:3,repMin:8,repMax:10,restSeconds:90,cue:"Coudes fixes. Pas de balancier."},
      {id:"incline-curl",name:"Curl incliné haltères",target:"Biceps",unit:"kg/bras",suggestedWeight:12,sets:2,repMin:8,repMax:10,restSeconds:90,cue:"Étirement complet, descente lente."}
    ]
  },
  {
    id:"cardio", day:"Mercredi", title:"CARDIO FACILE", subtitle:"Base aérobie · récupération", accent:"#58d68d",
    exercises:[{id:"easy-run",name:"Footing facile",target:"Cardio",unit:"PDC",sets:1,repMin:25,repMax:35,restSeconds:0,cue:"25–35 min. Conversation facile. Run/walk si nécessaire.",priority:true}]
  },
  {
    id:"legs", day:"Jeudi", title:"LEGS", subtitle:"Force · chaîne postérieure · entretien quadri", accent:"#f7c948",
    exercises:[
      {id:"smith-squat",name:"Smith Squat",target:"Quadriceps · fessiers",unit:"kg",suggestedWeight:51.3,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Genoux dans l’axe. Amplitude stable.",priority:true},
      {id:"rdl",name:"RDL Smith",target:"Ischios · fessiers",unit:"kg",suggestedWeight:61.3,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Hanches en arrière, dos neutre.",priority:true},
      {id:"leg-press",name:"Leg Press",target:"Jambes",unit:"kg",suggestedWeight:93,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Bassin collé au dossier."},
      {id:"leg-curl",name:"Leg Curl",target:"Ischios",unit:"kg",suggestedWeight:39,sets:3,repMin:8,repMax:10,restSeconds:90,cue:"Contracte fort, retour lent."},
      {id:"leg-extension",name:"Leg Extension",target:"Quadriceps",unit:"kg",suggestedWeight:73,sets:2,repMin:10,repMax:10,restSeconds:90,cue:"Pause en haut, pas d’à-coup."},
      {id:"calves",name:"Mollets",target:"Mollets",unit:"kg",suggestedWeight:60,sets:3,repMin:12,repMax:15,restSeconds:75,cue:"Amplitude complète, pause en haut."}
    ]
  },
  {
    id:"upper", day:"Samedi", title:"UPPER ESTHÉTIQUE", subtitle:"V-shape · haut de pecs · épaules", accent:"#b88cff",
    exercises:[
      {id:"pullups-upper",name:"Tractions",target:"Dorsaux",unit:"PDC",sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Amplitude propre, aucune rep arrachée.",priority:true},
      {id:"incline-upper",name:"Développé incliné barre",target:"Haut de pecs",unit:"kg",suggestedWeight:50,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Deuxième rappel haut de pecs.",priority:true},
      {id:"row-upper",name:"Rowing poulie",target:"Dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Torse stable, contrôle du retour."},
      {id:"lat-upper",name:"Lat Pulldown / tirage unilatéral",target:"Dorsaux",unit:"kg",suggestedWeight:59,sets:2,repMin:10,repMax:12,restSeconds:90,cue:"Étirement + largeur."},
      {id:"shoulder-upper",name:"Shoulder Press",target:"Épaules",unit:"kg/bras",suggestedWeight:18,sets:2,repMin:8,repMax:10,restSeconds:120,cue:"1–2 reps en réserve."},
      {id:"lateral-upper",name:"Élévations latérales",target:"Deltoïdes latéraux",unit:"kg/bras",suggestedWeight:12,sets:3,repMin:12,repMax:15,restSeconds:75,cue:"Volume prioritaire pour élargir la silhouette.",priority:true},
      {id:"reverse-fly",name:"Reverse Fly",target:"Arrière d’épaule",unit:"kg",sets:2,repMin:12,repMax:15,restSeconds:75,cue:"Tempo lent, contrôle complet."},
      {id:"arms-upper",name:"Biceps + Triceps",target:"Bras · superset",unit:"kg",sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Enchaîne biceps puis triceps. Le repos démarre après les deux exercices.",superset:[
        {id:"arms-upper-biceps",name:"Curl EZ poulie",target:"Biceps",unit:"kg",suggestedWeight:20.3,repMin:8,repMax:12,cue:"Coudes fixes, amplitude propre."},
        {id:"arms-upper-triceps",name:"Extension triceps corde",target:"Triceps",unit:"kg",suggestedWeight:20.3,repMin:8,repMax:12,cue:"Coudes fixes, ouvre la corde en bas."}
      ]},
      {id:"abs-upper",name:"Abdos",target:"Core",unit:"kg",sets:3,repMin:10,repMax:15,restSeconds:60,cue:"Crunch, relevés ou Pallof Press."}
    ]
  }
];

export const history: ExerciseHistory[] = [
  {exerciseId:"incline-bench",label:"Développé incliné",reference:"50 kg × 10/10/10 → prochaine cible 55 kg"},
  {exerciseId:"supine",label:"Supine Press",reference:"+40 kg/bras × 8/8/6"},
  {exerciseId:"pec-fly",label:"Pec Fly",reference:"79 kg × 10/10/10"},
  {exerciseId:"lateral",label:"Élévations latérales",reference:"14 kg/bras × 10/10/10"},
  {exerciseId:"shoulder-press",label:"Shoulder Press",reference:"18 kg/bras × 8/8/6"},
  {exerciseId:"pullups",label:"Tractions lestées",reference:"+10 kg × 6/6/6 (+2 bonus)"},
  {exerciseId:"lat-pulldown",label:"Lat Pulldown",reference:"59 kg × 10/10/10"},
  {exerciseId:"row",label:"Rowing poulie",reference:"66 kg × 8/8/8, dernière à l’échec"},
  {exerciseId:"straight-arm",label:"Straight-arm",reference:"29,3 kg × 9/9/7"},
  {exerciseId:"face-pull",label:"Face Pull",reference:"27 kg × 12/12"},
  {exerciseId:"ez-curl",label:"Curl EZ poulie",reference:"22,5 × 8 puis 20,3 × 10/8"},
  {exerciseId:"incline-curl",label:"Curl incliné",reference:"14 kg/bras × 5/5 (12 kg indisponibles)"},
  {exerciseId:"smith-squat",label:"Smith Squat",reference:"Ancienne réf. 61,3 kg × 8/8/8"},
  {exerciseId:"rdl",label:"RDL Smith",reference:"Ancienne réf. 71,3 kg × 8/8/8"},
  {exerciseId:"leg-press",label:"Leg Press",reference:"Ancienne réf. 100 kg × 8/8/8"}
];

export const weekPlan = [
  {day:"Lun",title:"Push",done:true},
  {day:"Mar",title:"Pull",done:true},
  {day:"Mer",title:"Run",done:true},
  {day:"Jeu",title:"Décalé",done:true},
  {day:"Ven",title:"Legs",done:false},
  {day:"Sam",title:"Upper",done:false},
  {day:"Dim",title:"Repos",done:false}
];
