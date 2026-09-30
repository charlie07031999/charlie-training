import type { Workout, ExerciseHistory, ExerciseVariant } from "./types";


export const exerciseVariants: Record<string, ExerciseVariant[]> = {
  "ez-curl":[
    {id:"ez-curl-cable",name:"Curl EZ poulie",equipment:"Poulie",unit:"kg",suggestedWeight:20.3,loadStep:2.5,cue:"Coudes fixes. Garde les épaules immobiles et contrôle le retour."},
    {id:"ez-curl-bar",name:"Curl barre EZ",equipment:"Barre EZ",unit:"kg",suggestedWeight:20,loadStep:2.5,cue:"Buste fixe. Monte sans lancer les coudes vers l’avant."},
    {id:"dumbbell-curl",name:"Curl biceps haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:10,loadStep:1,cue:"Supination progressive, coude fixe et amplitude complète."},
    {id:"machine-curl",name:"Curl biceps machine",equipment:"Machine",unit:"kg",suggestedWeight:20,loadStep:2.5,cue:"Garde les bras calés et contrôle complètement la phase négative."}
  ],
  "incline-curl":[
    {id:"incline-curl-db",name:"Curl incliné haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:12,loadStep:1,cue:"Étirement complet, bras derrière le buste et descente lente."},
    {id:"cable-curl",name:"Curl biceps poulie",equipment:"Poulie",unit:"kg",suggestedWeight:20,loadStep:2.5,cue:"Tension continue, coudes fixes et zéro balancier."},
    {id:"hammer-curl",name:"Curl marteau",equipment:"Haltères",unit:"kg/bras",suggestedWeight:12,loadStep:1,cue:"Poignets neutres, coudes près du corps, contrôle la descente."}
  ],
  "row":[
    {id:"row-cable",name:"Rowing poulie",equipment:"Poulie",unit:"kg",suggestedWeight:66,loadStep:2.5,cue:"Tire vers le nombril. Torse stable, retour contrôlé."},
    {id:"row-chest",name:"Rowing poitrine appuyée",equipment:"Machine",unit:"kg",suggestedWeight:45,loadStep:2.5,cue:"Poitrine collée au support, tire les coudes en arrière."},
    {id:"row-dumbbell",name:"Rowing haltère unilatéral",equipment:"Haltère",unit:"kg/bras",suggestedWeight:24,loadStep:2,cue:"Bassin stable, coude vers la hanche, amplitude complète."}
  ],
  "row-upper":[
    {id:"row-cable",name:"Rowing poulie",equipment:"Poulie",unit:"kg",suggestedWeight:66,loadStep:2.5,cue:"Tire vers le nombril. Torse stable, retour contrôlé."},
    {id:"row-chest",name:"Rowing poitrine appuyée",equipment:"Machine",unit:"kg",suggestedWeight:45,loadStep:2.5,cue:"Poitrine collée au support, tire les coudes en arrière."},
    {id:"row-dumbbell",name:"Rowing haltère unilatéral",equipment:"Haltère",unit:"kg/bras",suggestedWeight:24,loadStep:2,cue:"Bassin stable, coude vers la hanche, amplitude complète."}
  ],
  "lateral":[
    {id:"lateral-db",name:"Élévations latérales haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:8,loadStep:1,cue:"Monte avec les coudes, sans balancer le buste."},
    {id:"lateral-cable",name:"Élévations latérales poulie",equipment:"Poulie",unit:"kg/bras",suggestedWeight:5,loadStep:1,cue:"Tension continue. Garde l’épaule basse et contrôle le retour."},
    {id:"lateral-machine",name:"Élévations latérales machine",equipment:"Machine",unit:"kg",suggestedWeight:25,loadStep:2.5,cue:"Épaules basses, amplitude confortable, tempo constant."}
  ],
  "lateral-upper":[
    {id:"lateral-db",name:"Élévations latérales haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:8,loadStep:1,cue:"Monte avec les coudes, sans balancer le buste."},
    {id:"lateral-cable",name:"Élévations latérales poulie",equipment:"Poulie",unit:"kg/bras",suggestedWeight:5,loadStep:1,cue:"Tension continue. Garde l’épaule basse et contrôle le retour."},
    {id:"lateral-machine",name:"Élévations latérales machine",equipment:"Machine",unit:"kg",suggestedWeight:25,loadStep:2.5,cue:"Épaules basses, amplitude confortable, tempo constant."}
  ],
  "triceps-rope":[
    {id:"triceps-rope-cable",name:"Extension triceps corde",equipment:"Poulie",unit:"kg",suggestedWeight:20.3,loadStep:2.5,cue:"Coudes fixes, ouvre la corde en bas."},
    {id:"triceps-bar-cable",name:"Extension triceps barre",equipment:"Poulie",unit:"kg",suggestedWeight:22.5,loadStep:2.5,cue:"Coudes serrés. Verrouille sans projeter les épaules."},
    {id:"triceps-db",name:"Extension triceps haltère",equipment:"Haltère",unit:"kg",suggestedWeight:16,loadStep:2,cue:"Bras stables, amplitude confortable et retour lent."}
  ],
  "pec-fly":[
    {id:"pec-fly-machine",name:"Pec Fly machine",equipment:"Machine",unit:"kg",suggestedWeight:79,loadStep:4,cue:"Amplitude contrôlée, épaules basses, pas de claquement."},
    {id:"pec-fly-cable",name:"Écartés poulie",equipment:"Poulie",unit:"kg/bras",suggestedWeight:10,loadStep:1,cue:"Légère flexion du coude et tension continue."},
    {id:"pec-fly-db",name:"Écartés haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:10,loadStep:1,cue:"Amplitude maîtrisée, ne descends pas au-delà de ton confort."}
  ],
  "shoulder-press":[
    {id:"shoulder-db",name:"Shoulder Press haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:18,loadStep:2,cue:"Buste stable. Pas de sur-cambrure."},
    {id:"shoulder-machine",name:"Shoulder Press machine",equipment:"Machine",unit:"kg",suggestedWeight:35,loadStep:2.5,cue:"Dos calé, pousse dans l’axe et contrôle la descente."},
    {id:"shoulder-smith",name:"Développé épaules guidé",equipment:"Smith",unit:"kg",suggestedWeight:30,loadStep:5,cue:"Trajectoire verticale, buste stable, amplitude confortable."}
  ],
  "shoulder-upper":[
    {id:"shoulder-db",name:"Shoulder Press haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:18,loadStep:2,cue:"Buste stable. Pas de sur-cambrure."},
    {id:"shoulder-machine",name:"Shoulder Press machine",equipment:"Machine",unit:"kg",suggestedWeight:35,loadStep:2.5,cue:"Dos calé, pousse dans l’axe et contrôle la descente."}
  ],
  "lat-pulldown":[
    {id:"lat-pulldown-wide",name:"Lat Pulldown",equipment:"Poulie",unit:"kg",suggestedWeight:59,loadStep:2.5,cue:"Poitrine sortie, tire les coudes vers les côtes."},
    {id:"lat-pulldown-one",name:"Tirage vertical unilatéral",equipment:"Poulie",unit:"kg/bras",suggestedWeight:25,loadStep:2.5,cue:"Épaule basse, tire le coude vers la hanche."},
    {id:"pullups-assisted",name:"Tractions assistées",equipment:"Machine",unit:"kg",suggestedWeight:30,loadStep:5,cue:"Garde le tronc gainé et contrôle la descente."}
  ],
  "lat-upper":[
    {id:"lat-pulldown-wide",name:"Lat Pulldown",equipment:"Poulie",unit:"kg",suggestedWeight:59,loadStep:2.5,cue:"Poitrine sortie, tire les coudes vers les côtes."},
    {id:"lat-pulldown-one",name:"Tirage vertical unilatéral",equipment:"Poulie",unit:"kg/bras",suggestedWeight:25,loadStep:2.5,cue:"Épaule basse, tire le coude vers la hanche."}
  ],
  "incline-bench":[
    {id:"incline-bar",name:"Développé incliné barre",equipment:"Barre",unit:"kg",suggestedWeight:55,loadStep:5,cue:"Banc ~30°. Descente contrôlée, 1–2 reps en réserve."},
    {id:"incline-db",name:"Développé incliné haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:22,loadStep:2,cue:"Omoplates serrées. Descente contrôlée et amplitude stable."},
    {id:"incline-machine",name:"Chest Press inclinée",equipment:"Machine",unit:"kg",suggestedWeight:45,loadStep:2.5,cue:"Poitrine haute, trajectoire stable et contrôle du retour."}
  ],
  "incline-upper":[
    {id:"incline-bar",name:"Développé incliné barre",equipment:"Barre",unit:"kg",suggestedWeight:50,loadStep:5,cue:"Banc ~30°. Descente contrôlée, 1–2 reps en réserve."},
    {id:"incline-db",name:"Développé incliné haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:20,loadStep:2,cue:"Omoplates serrées. Descente contrôlée et amplitude stable."},
    {id:"incline-machine",name:"Chest Press inclinée",equipment:"Machine",unit:"kg",suggestedWeight:42.5,loadStep:2.5,cue:"Poitrine haute, trajectoire stable et contrôle du retour."}
  ],
  "rdl":[
    {id:"rdl-smith",name:"RDL Smith",equipment:"Smith",unit:"kg",suggestedWeight:61.3,loadStep:5,cue:"Hanches en arrière, dos neutre, barre proche des jambes."},
    {id:"rdl-db",name:"RDL haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:24,loadStep:2,cue:"Hanches en arrière, haltères près des jambes, étirement des ischios."},
    {id:"rdl-bar",name:"Soulevé de terre roumain",equipment:"Barre",unit:"kg",suggestedWeight:60,loadStep:5,cue:"Dos neutre, tension des ischios, verrouille avec les fessiers."}
  ],
  "smith-squat":[
    {id:"squat-smith",name:"Smith Squat",equipment:"Smith",unit:"kg",suggestedWeight:51.3,loadStep:5,cue:"Genoux dans l’axe. Amplitude stable."},
    {id:"hack-squat",name:"Hack Squat",equipment:"Machine",unit:"kg",suggestedWeight:50,loadStep:5,cue:"Dos collé au dossier, genoux dans l’axe et profondeur contrôlée."},
    {id:"goblet-squat",name:"Goblet Squat",equipment:"Haltère",unit:"kg",suggestedWeight:24,loadStep:2,cue:"Charge près du buste, genoux ouverts et tronc gainé."}
  ],
  "pullups":[
    {id:"pullups-weighted",name:"Tractions lestées",equipment:"Poids du corps",unit:"+kg",suggestedWeight:10,loadStep:2.5,cue:"Gainage serré. Tire les coudes vers le bas."},
    {id:"pullups-bodyweight",name:"Tractions au poids du corps",equipment:"Poids du corps",unit:"PDC",loadStep:0,cue:"Amplitude propre, menton au-dessus de la barre sans casser le gainage."},
    {id:"pullups-assisted",name:"Tractions assistées",equipment:"Machine",unit:"kg",suggestedWeight:30,loadStep:5,cue:"Choisis une assistance qui permet des reps propres et contrôlées."}
  ],
  "pullups-upper":[
    {id:"pullups-bodyweight",name:"Tractions",equipment:"Poids du corps",unit:"PDC",loadStep:0,cue:"Amplitude propre, aucune rep arrachée."},
    {id:"pullups-assisted",name:"Tractions assistées",equipment:"Machine",unit:"kg",suggestedWeight:25,loadStep:5,cue:"Assistance juste suffisante pour garder une technique propre."},
    {id:"lat-neutral",name:"Lat Pulldown prise neutre",equipment:"Poulie",unit:"kg",suggestedWeight:55,loadStep:2.5,cue:"Poitrine haute et coudes vers les côtes."}
  ],
  "straight-arm":[
    {id:"straight-arm-cable",name:"Straight-arm Pulldown",equipment:"Poulie",unit:"kg",suggestedWeight:29.3,loadStep:2.5,cue:"Bras quasi tendus, ramène vers les cuisses."},
    {id:"pullover-rope",name:"Pullover corde",equipment:"Poulie",unit:"kg",suggestedWeight:25,loadStep:2.5,cue:"Garde le torse stable et termine avec les mains vers les cuisses."},
    {id:"pullover-machine",name:"Pullover machine",equipment:"Machine",unit:"kg",suggestedWeight:35,loadStep:2.5,cue:"Contrôle l’étirement en haut et serre les dorsaux en bas."}
  ],
  "face-pull":[
    {id:"face-pull-rope",name:"Face Pull corde",equipment:"Poulie",unit:"kg",suggestedWeight:27,loadStep:2.5,cue:"Tire vers le visage, épaules basses et rotation externe."},
    {id:"reverse-cable",name:"Reverse Fly poulie",equipment:"Poulie",unit:"kg/bras",suggestedWeight:7.5,loadStep:1,cue:"Bras légèrement fléchis, ouvre sans hausser les épaules."},
    {id:"reverse-machine",name:"Reverse Fly machine",equipment:"Machine",unit:"kg",suggestedWeight:30,loadStep:2.5,cue:"Poitrine calée, contrôle la fermeture et l’ouverture."}
  ],
  "supine":[
    {id:"supine-machine",name:"Supine Press",equipment:"Machine",unit:"kg/bras",suggestedWeight:40,loadStep:2,cue:"Omoplates stables et descente contrôlée."},
    {id:"chest-machine",name:"Chest Press convergente",equipment:"Machine",unit:"kg",suggestedWeight:50,loadStep:2.5,cue:"Poitrine haute, pousse sans décoller les épaules."},
    {id:"flat-db",name:"Développé haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:22,loadStep:2,cue:"Omoplates serrées et amplitude stable."}
  ],
  "leg-press":[
    {id:"leg-press-machine",name:"Leg Press",equipment:"Machine",unit:"kg",suggestedWeight:93,loadStep:7,cue:"Bassin collé au dossier, genoux dans l’axe."},
    {id:"hack-squat",name:"Hack Squat",equipment:"Machine",unit:"kg",suggestedWeight:50,loadStep:5,cue:"Dos calé et profondeur contrôlée."},
    {id:"split-squat-db",name:"Fente bulgare",equipment:"Haltères",unit:"kg/bras",suggestedWeight:14,loadStep:2,cue:"Pied avant stable, descends verticalement et pousse dans le sol."}
  ],
  "leg-curl":[
    {id:"leg-curl-seated",name:"Leg Curl assis",equipment:"Machine",unit:"kg",suggestedWeight:39,loadStep:2.5,cue:"Bassin calé, contracte fort et contrôle le retour."},
    {id:"leg-curl-lying",name:"Leg Curl allongé",equipment:"Machine",unit:"kg",suggestedWeight:35,loadStep:2.5,cue:"Hanches plaquées au banc et retour lent."},
    {id:"leg-curl-ball",name:"Leg Curl swiss ball",equipment:"Poids du corps",unit:"PDC",loadStep:0,cue:"Hanches hautes, ramène les talons sans casser le bassin."}
  ],
  "leg-extension":[
    {id:"leg-extension-machine",name:"Leg Extension",equipment:"Machine",unit:"kg",suggestedWeight:73,loadStep:2.5,cue:"Pause en haut, pas d’à-coup."},
    {id:"sissy-squat",name:"Sissy Squat assisté",equipment:"Poids du corps",unit:"PDC",loadStep:0,cue:"Genoux avancent, tronc gainé et amplitude maîtrisée."}
  ],
  "calves":[
    {id:"calves-machine",name:"Mollets machine",equipment:"Machine",unit:"kg",suggestedWeight:60,loadStep:5,cue:"Amplitude complète et pause en haut."},
    {id:"calves-smith",name:"Mollets Smith",equipment:"Smith",unit:"kg",suggestedWeight:50,loadStep:5,cue:"Talons bas en bas, monte haut sans rebond."},
    {id:"calves-db",name:"Mollets unilatéraux haltère",equipment:"Haltère",unit:"kg",suggestedWeight:16,loadStep:2,cue:"Amplitude complète et contrôle du tempo."}
  ],
  "crunch":[
    {id:"crunch-machine",name:"Crunch machine",equipment:"Machine",unit:"kg",suggestedWeight:50,loadStep:4,cue:"Enroule le buste et souffle sur la contraction."},
    {id:"crunch-cable",name:"Crunch poulie",equipment:"Poulie",unit:"kg",suggestedWeight:30,loadStep:2.5,cue:"Fléchis le tronc sans tirer avec les bras."},
    {id:"crunch-body",name:"Crunch au sol",equipment:"Poids du corps",unit:"PDC",loadStep:0,cue:"Expire fort et rapproche les côtes du bassin."}
  ],
  "reverse-fly":[
    {id:"reverse-machine",name:"Reverse Fly machine",equipment:"Machine",unit:"kg",suggestedWeight:30,loadStep:2.5,cue:"Tempo lent et contrôle complet."},
    {id:"reverse-cable",name:"Reverse Fly poulie",equipment:"Poulie",unit:"kg/bras",suggestedWeight:7.5,loadStep:1,cue:"Tension continue et épaules basses."},
    {id:"reverse-db",name:"Oiseau haltères",equipment:"Haltères",unit:"kg/bras",suggestedWeight:7,loadStep:1,cue:"Buste penché, ouvre les bras sans élan."}
  ],
  "abs-upper":[
    {id:"crunch-machine",name:"Crunch machine",equipment:"Machine",unit:"kg",suggestedWeight:50,loadStep:4,cue:"Enroule le buste et expire fort."},
    {id:"crunch-cable",name:"Crunch poulie",equipment:"Poulie",unit:"kg",suggestedWeight:30,loadStep:2.5,cue:"Fléchis le tronc, les bras restent fixes."},
    {id:"core-body",name:"Gainage / relevés",equipment:"Poids du corps",unit:"PDC",loadStep:0,cue:"Garde le bassin neutre et contrôle chaque répétition."}
  ]
};

export const workouts: Workout[] = [
  {
    id:"push", day:"Lundi", title:"PUSH", subtitle:"Haut de pecs · épaules · triceps", accent:"#ff6b2c",
    exercises:[
      {id:"incline-bench",name:"Développé incliné barre",target:"Haut de pecs",unit:"kg",suggestedWeight:55,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Banc ~30°. Descente contrôlée. 1–2 reps en réserve.",priority:true,alternatives:["Développé incliné haltères","Chest Press inclinée convergente"]},
      {id:"supine",name:"Supine Press",target:"Pecs",unit:"kg/bras",suggestedWeight:40,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Omoplates stables. Pas d’échec avant la dernière série.",alternatives:["Chest Press convergente","Développé haltères"]},
      {id:"pec-fly",name:"Pec Fly",target:"Pecs",unit:"kg",suggestedWeight:79,sets:3,repMin:10,repMax:10,restSeconds:105,cue:"Amplitude contrôlée, pas de claquement.",alternatives:["Écartés poulie","Pec Deck unilatéral"]},
      {id:"lateral",name:"Élévations latérales",target:"Deltoïdes latéraux",unit:"kg/bras",suggestedWeight:14,sets:3,repMin:10,repMax:12,restSeconds:75,cue:"Zéro balancier. Monte avec les coudes.",priority:true,alternatives:["Élévations latérales poulie","Machine élévations latérales"]},
      {id:"shoulder-press",name:"Shoulder Press haltères",target:"Épaules",unit:"kg/bras",suggestedWeight:18,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Buste stable. Pas de sur-cambrure.",alternatives:["Shoulder Press machine","Développé épaules guidé"]},
      {id:"triceps-rope",name:"Triceps corde",target:"Triceps",unit:"kg",suggestedWeight:20.3,sets:3,repMin:8,repMax:12,restSeconds:90,cue:"Coudes fixes, ouvre la corde en bas."},
      {id:"crunch",name:"Crunch machine",target:"Abdos",unit:"kg",suggestedWeight:50,sets:3,repMin:10,repMax:15,restSeconds:75,cue:"Enroule le buste et souffle sur la contraction."}
    ]
  },
  {
    id:"pull", day:"Mardi", title:"PULL", subtitle:"Dorsaux · dos · biceps", accent:"#6cb7ff",
    exercises:[
      {id:"pullups",name:"Tractions lestées",target:"Dorsaux",unit:"+kg",suggestedWeight:10,sets:3,repMin:6,repMax:8,restSeconds:150,cue:"Tire les coudes vers le bas. Gainage serré.",priority:true,alternatives:["Lat Pulldown prise neutre","Tractions assistées"]},
      {id:"lat-pulldown",name:"Lat Pulldown",target:"Largeur du dos",unit:"kg",suggestedWeight:59,sets:3,repMin:10,repMax:10,restSeconds:105,cue:"Poitrine sortie, retour contrôlé.",priority:true,alternatives:["Tirage vertical unilatéral","Tractions prise neutre"]},
      {id:"row",name:"Rowing poulie",target:"Épaisseur du dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Tire vers le nombril. Torse stable.",alternatives:["Rowing poitrine appuyée","Row machine convergente"]},
      {id:"straight-arm",name:"Straight-arm Pulldown",target:"Dorsaux",unit:"kg",suggestedWeight:29.3,sets:3,repMin:8,repMax:10,restSeconds:90,cue:"Bras quasi tendus. Ramène vers les cuisses.",alternatives:["Pullover machine","Pullover poulie corde"]},
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
      {id:"smith-squat",name:"Smith Squat",target:"Quadriceps · fessiers",unit:"kg",suggestedWeight:51.3,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Genoux dans l’axe. Amplitude stable.",priority:true,alternatives:["Hack Squat","Belt Squat"]},
      {id:"rdl",name:"RDL Smith",target:"Ischios · fessiers",unit:"kg",suggestedWeight:61.3,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Hanches en arrière, dos neutre.",priority:true,alternatives:["RDL haltères","Hip Hinge guidé"]},
      {id:"leg-press",name:"Leg Press",target:"Jambes",unit:"kg",suggestedWeight:93,sets:3,repMin:8,repMax:8,restSeconds:150,cue:"Bassin collé au dossier.",alternatives:["Hack Squat","Presse unilatérale"]},
      {id:"leg-curl",name:"Leg Curl",target:"Ischios",unit:"kg",suggestedWeight:39,sets:3,repMin:8,repMax:10,restSeconds:90,cue:"Contracte fort, retour lent."},
      {id:"leg-extension",name:"Leg Extension",target:"Quadriceps",unit:"kg",suggestedWeight:73,sets:2,repMin:10,repMax:10,restSeconds:90,cue:"Pause en haut, pas d’à-coup."},
      {id:"calves",name:"Mollets",target:"Mollets",unit:"kg",suggestedWeight:60,sets:3,repMin:12,repMax:15,restSeconds:75,cue:"Amplitude complète, pause en haut."}
    ]
  },
  {
    id:"upper", day:"Samedi", title:"UPPER ESTHÉTIQUE", subtitle:"V-shape · haut de pecs · épaules", accent:"#b88cff",
    exercises:[
      {id:"pullups-upper",name:"Tractions",target:"Dorsaux",unit:"PDC",sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Amplitude propre, aucune rep arrachée.",priority:true},
      {id:"incline-upper",name:"Développé incliné barre",target:"Haut de pecs",unit:"kg",suggestedWeight:50,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Deuxième rappel haut de pecs.",priority:true,alternatives:["Développé incliné haltères","Chest Press inclinée convergente"]},
      {id:"row-upper",name:"Rowing poulie",target:"Dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Torse stable, contrôle du retour.",alternatives:["Rowing poitrine appuyée","Row machine convergente"]},
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
  },
  {
    id:"full-a", day:"Lundi", title:"FULL BODY A", subtitle:"Pousser · tirer · jambes", accent:"#2f7bf6",
    exercises:[
      {id:"incline-bench",name:"Développé incliné barre",target:"Haut de pecs",unit:"kg",suggestedWeight:55,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Banc ~30°. Descente contrôlée. Garde 1–2 reps en réserve.",priority:true,alternatives:["Développé incliné haltères","Chest Press inclinée convergente"]},
      {id:"lat-pulldown",name:"Lat Pulldown",target:"Dorsaux",unit:"kg",suggestedWeight:59,sets:3,repMin:8,repMax:12,restSeconds:105,cue:"Poitrine sortie, retour contrôlé.",priority:true,alternatives:["Tirage vertical unilatéral","Tractions assistées"]},
      {id:"smith-squat",name:"Smith Squat",target:"Quadriceps · fessiers",unit:"kg",suggestedWeight:51.3,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Genoux dans l’axe. Amplitude stable.",priority:true,alternatives:["Hack Squat","Belt Squat"]},
      {id:"lateral",name:"Élévations latérales",target:"Deltoïdes latéraux",unit:"kg/bras",suggestedWeight:14,sets:2,repMin:12,repMax:15,restSeconds:75,cue:"Zéro balancier. Monte avec les coudes."},
      {id:"ez-curl",name:"Curl EZ poulie",target:"Biceps",unit:"kg",suggestedWeight:20.3,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Coudes fixes. Pas de balancier."},
      {id:"triceps-rope",name:"Triceps corde",target:"Triceps",unit:"kg",suggestedWeight:20.3,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Coudes fixes, ouvre la corde en bas."}
    ]
  },
  {
    id:"full-b", day:"Mercredi", title:"FULL BODY B", subtitle:"Chaîne postérieure · dos · poussée", accent:"#20b8a8",
    exercises:[
      {id:"rdl",name:"RDL Smith",target:"Ischios · fessiers",unit:"kg",suggestedWeight:61.3,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Hanches en arrière, dos neutre.",priority:true,alternatives:["RDL haltères","Hip Hinge guidé"]},
      {id:"supine",name:"Supine Press",target:"Pecs",unit:"kg/bras",suggestedWeight:40,sets:3,repMin:8,repMax:10,restSeconds:135,cue:"Omoplates stables. Contrôle la descente.",priority:true,alternatives:["Chest Press convergente","Développé haltères"]},
      {id:"row",name:"Rowing poulie",target:"Épaisseur du dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:12,restSeconds:120,cue:"Tire vers le nombril. Torse stable.",priority:true,alternatives:["Rowing poitrine appuyée","Row machine convergente"]},
      {id:"leg-press",name:"Leg Press",target:"Quadriceps · fessiers",unit:"kg",suggestedWeight:93,sets:2,repMin:10,repMax:12,restSeconds:120,cue:"Bassin collé au dossier."},
      {id:"face-pull",name:"Face Pull",target:"Arrière d’épaule",unit:"kg",suggestedWeight:27,sets:2,repMin:12,repMax:15,restSeconds:75,cue:"Tire vers le visage. Épaules basses."},
      {id:"crunch",name:"Crunch machine",target:"Abdos",unit:"kg",suggestedWeight:50,sets:2,repMin:10,repMax:15,restSeconds:60,cue:"Enroule le buste et souffle sur la contraction."}
    ]
  },
  {
    id:"full-c", day:"Samedi", title:"FULL BODY C", subtitle:"Dorsaux · épaules · jambes", accent:"#8c67f7",
    exercises:[
      {id:"pullups",name:"Tractions",target:"Dorsaux",unit:"PDC",sets:3,repMin:6,repMax:10,restSeconds:135,cue:"Amplitude propre. Tire les coudes vers le bas.",priority:true,alternatives:["Lat Pulldown prise neutre","Tractions assistées"]},
      {id:"shoulder-press",name:"Shoulder Press haltères",target:"Épaules",unit:"kg/bras",suggestedWeight:18,sets:3,repMin:8,repMax:10,restSeconds:120,cue:"Buste stable. Pas de sur-cambrure.",priority:true,alternatives:["Shoulder Press machine","Développé épaules guidé"]},
      {id:"leg-curl",name:"Leg Curl",target:"Ischios",unit:"kg",suggestedWeight:39,sets:3,repMin:8,repMax:12,restSeconds:90,cue:"Contracte fort, retour lent."},
      {id:"pec-fly",name:"Pec Fly",target:"Pecs",unit:"kg",suggestedWeight:79,sets:2,repMin:10,repMax:15,restSeconds:90,cue:"Amplitude contrôlée, pas de claquement."},
      {id:"straight-arm",name:"Straight-arm Pulldown",target:"Dorsaux",unit:"kg",suggestedWeight:29.3,sets:2,repMin:10,repMax:12,restSeconds:75,cue:"Bras quasi tendus. Ramène vers les cuisses."},
      {id:"incline-curl",name:"Curl incliné haltères",target:"Biceps",unit:"kg/bras",suggestedWeight:12,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Étirement complet, descente lente."}
    ]
  },
  {
    id:"upper-a", day:"Lundi", title:"UPPER A", subtitle:"Pecs · dos · épaules · bras", accent:"#2f7bf6",
    exercises:[
      {id:"incline-bench",name:"Développé incliné barre",target:"Haut de pecs",unit:"kg",suggestedWeight:55,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Descente contrôlée. Garde 1–2 reps en réserve.",priority:true},
      {id:"lat-pulldown",name:"Lat Pulldown",target:"Dorsaux",unit:"kg",suggestedWeight:59,sets:3,repMin:8,repMax:12,restSeconds:105,cue:"Poitrine sortie, retour contrôlé.",priority:true},
      {id:"row",name:"Rowing poulie",target:"Dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:12,restSeconds:120,cue:"Tire vers le nombril. Torse stable."},
      {id:"shoulder-press",name:"Shoulder Press haltères",target:"Épaules",unit:"kg/bras",suggestedWeight:18,sets:2,repMin:8,repMax:10,restSeconds:105,cue:"Buste stable."},
      {id:"lateral",name:"Élévations latérales",target:"Deltoïdes latéraux",unit:"kg/bras",suggestedWeight:14,sets:2,repMin:12,repMax:15,restSeconds:75,cue:"Monte avec les coudes."},
      {id:"ez-curl",name:"Curl EZ poulie",target:"Biceps",unit:"kg",suggestedWeight:20.3,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Coudes fixes."},
      {id:"triceps-rope",name:"Triceps corde",target:"Triceps",unit:"kg",suggestedWeight:20.3,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Ouvre la corde en bas."}
    ]
  },
  {
    id:"lower-a", day:"Mardi", title:"LOWER A", subtitle:"Quadriceps · ischios · mollets", accent:"#f2b744",
    exercises:[
      {id:"smith-squat",name:"Smith Squat",target:"Quadriceps · fessiers",unit:"kg",suggestedWeight:51.3,sets:3,repMin:6,repMax:10,restSeconds:150,cue:"Genoux dans l’axe. Amplitude stable.",priority:true},
      {id:"rdl",name:"RDL Smith",target:"Ischios · fessiers",unit:"kg",suggestedWeight:61.3,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Hanches en arrière, dos neutre.",priority:true},
      {id:"leg-extension",name:"Leg Extension",target:"Quadriceps",unit:"kg",suggestedWeight:73,sets:2,repMin:10,repMax:15,restSeconds:90,cue:"Pause en haut, pas d’à-coup."},
      {id:"leg-curl",name:"Leg Curl",target:"Ischios",unit:"kg",suggestedWeight:39,sets:2,repMin:10,repMax:15,restSeconds:90,cue:"Contracte fort, retour lent."},
      {id:"calves",name:"Mollets",target:"Mollets",unit:"kg",suggestedWeight:60,sets:3,repMin:12,repMax:15,restSeconds:75,cue:"Amplitude complète, pause en haut."},
      {id:"crunch",name:"Crunch machine",target:"Abdos",unit:"kg",suggestedWeight:50,sets:2,repMin:10,repMax:15,restSeconds:60,cue:"Enroule le buste et souffle."}
    ]
  },
  {
    id:"upper-b", day:"Jeudi", title:"UPPER B", subtitle:"Dos · pecs · épaules · bras", accent:"#7e67ef",
    exercises:[
      {id:"pullups",name:"Tractions",target:"Dorsaux",unit:"PDC",sets:3,repMin:6,repMax:10,restSeconds:135,cue:"Amplitude propre.",priority:true},
      {id:"supine",name:"Supine Press",target:"Pecs",unit:"kg/bras",suggestedWeight:40,sets:3,repMin:8,repMax:10,restSeconds:135,cue:"Omoplates stables.",priority:true},
      {id:"row",name:"Rowing poulie",target:"Dos",unit:"kg",suggestedWeight:66,sets:3,repMin:8,repMax:12,restSeconds:120,cue:"Torse stable."},
      {id:"pec-fly",name:"Pec Fly",target:"Pecs",unit:"kg",suggestedWeight:79,sets:2,repMin:10,repMax:15,restSeconds:90,cue:"Amplitude contrôlée."},
      {id:"lateral",name:"Élévations latérales",target:"Deltoïdes latéraux",unit:"kg/bras",suggestedWeight:14,sets:3,repMin:12,repMax:15,restSeconds:75,cue:"Zéro balancier."},
      {id:"incline-curl",name:"Curl incliné haltères",target:"Biceps",unit:"kg/bras",suggestedWeight:12,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Étirement complet."},
      {id:"triceps-rope",name:"Triceps corde",target:"Triceps",unit:"kg",suggestedWeight:20.3,sets:2,repMin:8,repMax:12,restSeconds:75,cue:"Coudes fixes."}
    ]
  },
  {
    id:"lower-b", day:"Samedi", title:"LOWER B", subtitle:"Jambes · chaîne postérieure · core", accent:"#ef885d",
    exercises:[
      {id:"leg-press",name:"Leg Press",target:"Quadriceps · fessiers",unit:"kg",suggestedWeight:93,sets:3,repMin:8,repMax:12,restSeconds:150,cue:"Bassin collé au dossier.",priority:true},
      {id:"rdl",name:"RDL Smith",target:"Ischios · fessiers",unit:"kg",suggestedWeight:61.3,sets:3,repMin:8,repMax:10,restSeconds:150,cue:"Hanches en arrière, dos neutre.",priority:true},
      {id:"leg-curl",name:"Leg Curl",target:"Ischios",unit:"kg",suggestedWeight:39,sets:3,repMin:8,repMax:12,restSeconds:90,cue:"Contracte fort, retour lent."},
      {id:"leg-extension",name:"Leg Extension",target:"Quadriceps",unit:"kg",suggestedWeight:73,sets:2,repMin:10,repMax:15,restSeconds:90,cue:"Pause en haut."},
      {id:"calves",name:"Mollets",target:"Mollets",unit:"kg",suggestedWeight:60,sets:3,repMin:12,repMax:15,restSeconds:75,cue:"Amplitude complète."},
      {id:"abs-upper",name:"Core",target:"Abdos",unit:"kg",sets:3,repMin:10,repMax:15,restSeconds:60,cue:"Crunch, relevés ou Pallof Press."}
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
