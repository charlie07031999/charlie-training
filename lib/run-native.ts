import type { CardioRoutePoint } from "./types";

export type NativeRunSnapshot = {
  available:boolean;
  status:"idle"|"locating"|"ready"|"running"|"paused"|"finished";
  authorization:"notDetermined"|"restricted"|"denied"|"authorizedAlways"|"authorizedWhenInUse"|"unknown";
  startedAt?:number|null;
  finishedAt?:number|null;
  pausedMs:number;
  pauseStartedAt?:number|null;
  gpsAccuracy?:number|null;
  points:CardioRoutePoint[];
  distanceMeters:number;
  elevationGainM:number;
  elapsedSeconds:number;
};

type Pending = {
  resolve:(value:any)=>void;
  reject:(error:Error)=>void;
  timeout:number;
};

const pending=new Map<string,Pending>();
let installed=false;

function bridge(){
  if(typeof window==="undefined") return null;
  return (window as any)?.webkit?.messageHandlers?.charlieRun ?? null;
}

function installResolver(){
  if(installed||typeof window==="undefined") return;
  installed=true;
  (window as any).__charlieRunResolve=(response:any)=>{
    const requestId=response?.requestId;
    if(!requestId) return;
    const item=pending.get(requestId);
    if(!item) return;
    window.clearTimeout(item.timeout);
    pending.delete(requestId);

    if(response?.ok) item.resolve(response?.data);
    else item.reject(new Error(response?.error||"Native run bridge error"));
  };
}

function request(action:string):Promise<NativeRunSnapshot>{
  const target=bridge();
  if(!target) return Promise.reject(new Error("native_run_unavailable"));

  installResolver();
  const requestId=globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{
      pending.delete(requestId);
      reject(new Error("native_run_bridge_timeout"));
    },15000);

    pending.set(requestId,{resolve,reject,timeout});
    target.postMessage({requestId,action});
  });
}

export function nativeRunAvailable(){
  return Boolean(bridge());
}

export function getNativeRunStatus(){
  return request("status");
}

export function prepareNativeRun(){
  return request("prepare");
}

export function startNativeRun(){
  return request("start");
}

export function pauseNativeRun(){
  return request("pause");
}

export function resumeNativeRun(){
  return request("resume");
}

export function finishNativeRun(){
  return request("finish");
}

export function resetNativeRun(){
  return request("reset");
}
