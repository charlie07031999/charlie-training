export type NativeHealthStatus = {
  available:boolean;
  authorizationRequested:boolean;
  writeAuthorization:{
    sleep:"notDetermined"|"sharingDenied"|"sharingAuthorized";
    weight:"notDetermined"|"sharingDenied"|"sharingAuthorized";
    activeEnergy:"notDetermined"|"sharingDenied"|"sharingAuthorized";
    workouts:"notDetermined"|"sharingDenied"|"sharingAuthorized";
  };
  deviceId:string;
};

export type NativeHealthWeight = {
  externalId:string;
  recordedAt:string;
  kilograms:number;
};

export type NativeHealthSleep = {
  externalId:string;
  start:string;
  end:string;
};

export type NativeHealthWorkout = {
  externalId:string;
  start:string;
  end:string;
  activityType:number;
  activityName:string;
  durationSeconds:number;
  activeEnergyKcal?:number|null;
  distanceMeters?:number|null;
  clientSessionId?:string|null;
};

export type NativeHealthDailyMetric = {
  date:string;
  steps?:number|null;
  activeEnergyKcal?:number|null;
  averageHeartRateBpm?:number|null;
  restingHeartRateBpm?:number|null;
};

export type NativeHealthSnapshot = {
  generatedAt:string;
  weights:NativeHealthWeight[];
  sleepSessions:NativeHealthSleep[];
  workouts:NativeHealthWorkout[];
  daily:NativeHealthDailyMetric[];
};

type BridgeRequest = {
  requestId:string;
  action:string;
  payload?:Record<string,unknown>;
};

type PendingRequest = {
  resolve:(value:any)=>void;
  reject:(error:Error)=>void;
  timeout:number;
};

const pending=new Map<string,PendingRequest>();
let installed=false;

function bridge(){
  if(typeof window==="undefined") return null;
  return (window as any)?.webkit?.messageHandlers?.charlieHealth ?? null;
}

function installResolver(){
  if(installed||typeof window==="undefined") return;
  installed=true;
  (window as any).__charlieHealthResolve=(response:any)=>{
    const requestId=response?.requestId;
    if(!requestId) return;
    const item=pending.get(requestId);
    if(!item) return;
    window.clearTimeout(item.timeout);
    pending.delete(requestId);
    if(response?.ok) item.resolve(response?.data);
    else item.reject(new Error(response?.error||"Apple Health bridge error"));
  };
}

function request<T>(action:string,payload?:Record<string,unknown>):Promise<T>{
  const target=bridge();
  if(!target) return Promise.reject(new Error("native_health_unavailable"));
  installResolver();
  const requestId=globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<T>((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{
      pending.delete(requestId);
      reject(new Error("health_bridge_timeout"));
    },30000);

    pending.set(requestId,{resolve,reject,timeout});
    const message:BridgeRequest={requestId,action,payload};
    target.postMessage(message);
  });
}

export function nativeHealthAvailable(){
  return Boolean(bridge());
}

export async function getNativeHealthStatus(){
  return request<NativeHealthStatus>("status");
}

export async function requestNativeHealthAuthorization(){
  return request<NativeHealthStatus>("authorize");
}

export async function pullNativeHealthSnapshot(days=30){
  return request<NativeHealthSnapshot>("snapshot",{days});
}

export async function writeNativeHealthWeight(input:{
  kilograms:number;
  recordedAt:string;
  sourceId?:string;
}){
  return request<{externalId:string}>("writeWeight",input);
}

export async function writeNativeHealthSleep(input:{
  start:string;
  end:string;
  sourceId?:string;
}){
  return request<{externalId:string}>("writeSleep",input);
}

export async function writeNativeHealthWorkout(input:{
  start:string;
  end:string;
  workoutKind:"running"|"walking"|"strength"|"cycling"|"other";
  clientSessionId:string;
  activeEnergyKcal?:number|null;
  distanceMeters?:number|null;
}){
  return request<{externalId:string}>("writeWorkout",input);
}
