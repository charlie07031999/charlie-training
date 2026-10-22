export type NativeNotificationStatus = {
  available:boolean;
  authorization:"default"|"denied"|"granted";
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
  return (window as any)?.webkit?.messageHandlers?.charlieNotifications ?? null;
}

function installResolver(){
  if(installed||typeof window==="undefined") return;
  installed=true;
  (window as any).__charlieNotificationsResolve=(response:any)=>{
    const requestId=response?.requestId;
    if(!requestId) return;
    const item=pending.get(requestId);
    if(!item) return;

    window.clearTimeout(item.timeout);
    pending.delete(requestId);

    if(response?.ok) item.resolve(response?.data);
    else item.reject(new Error(response?.error||"Native notification bridge error"));
  };
}

function request<T>(action:string,payload?:Record<string,unknown>):Promise<T>{
  const target=bridge();
  if(!target) return Promise.reject(new Error("native_notifications_unavailable"));

  installResolver();
  const requestId=globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<T>((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{
      pending.delete(requestId);
      reject(new Error("native_notifications_bridge_timeout"));
    },15000);

    pending.set(requestId,{resolve,reject,timeout});
    target.postMessage({requestId,action,payload});
  });
}

export function nativeNotificationsAvailable(){
  return Boolean(bridge());
}

export function getNativeNotificationStatus(){
  return request<NativeNotificationStatus>("status");
}

export function requestNativeNotificationAuthorization(){
  return request<NativeNotificationStatus>("authorize");
}

export function scheduleNativeRestNotification(dueAt:number){
  return request<NativeNotificationStatus>("scheduleRest",{dueAt});
}

export function cancelNativeRestNotification(){
  return request<NativeNotificationStatus>("cancelRest");
}
