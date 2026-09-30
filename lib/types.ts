export type SetLog = {
  reps:number;
  weight?:number;
  rir?:number;
  failed?:boolean;
  loggedAt?:number;
};

export type CardioRoutePoint = {
  lat:number;
  lng:number;
  altitude?:number|null;
  accuracy?:number|null;
  speedMps?:number|null;
  timestamp:number;
  elapsedSeconds?:number;
};

export type CardioSplit = {
  km:number;
  elapsedSeconds:number;
  splitSeconds:number;
  paceSecondsPerKm:number;
};

export type CardioLog = {
  durationMinutes:number;
  durationSeconds?:number;
  distanceKm?:number;
  avgHr?:number;
  rpe?:number;
  avgSpeedKmh?:number;
  avgPaceSecondsPerKm?:number;
  elevationGainM?:number;
  route?:CardioRoutePoint[];
  splits?:CardioSplit[];
  source?:"gps"|"manual";
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
