export type SetLog = {
  reps:number;
  weight?:number;
  rir?:number;
  failed?:boolean;
  loggedAt?:number;
};

export type CardioLog = {
  durationMinutes:number;
  distanceKm?:number;
  avgHr?:number;
  rpe?:number;
};

export type SupersetPart = {
  id:string;
  name:string;
  target:string;
  unit:"kg"|"kg/bras"|"PDC"|"+kg";
  suggestedWeight?:number;
  repMin:number;
  repMax:number;
  cue:string;
};

export type Exercise = {
  id:string;
  name:string;
  target:string;
  unit:"kg"|"kg/bras"|"PDC"|"+kg";
  suggestedWeight?:number;
  sets:number;
  repMin:number;
  repMax:number;
  restSeconds:number;
  cue:string;
  priority?:boolean;
  superset?:SupersetPart[];
  alternatives?:string[];
};

export type Workout = {
  id:string;
  day:string;
  title:string;
  subtitle:string;
  accent:string;
  exercises:Exercise[];
};

export type ExerciseHistory = {
  exerciseId:string;
  label:string;
  reference:string;
};
