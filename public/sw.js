self.addEventListener("install",event=>{
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push",event=>{
  let data={title:"Charlie Training",body:"Tu as un rappel."};
  try{
    if(event.data) data={...data,...event.data.json()};
  }catch{}
  event.waitUntil(
    self.registration.showNotification(data.title,{
      body:data.body,
      icon:"/icon.svg",
      badge:"/icon.svg",
      data:data.url?{url:data.url}:{}
    })
  );
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=event.notification.data?.url||"/";
  event.waitUntil(
    self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
      for(const client of clients){
        if("focus" in client) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});


const restTimers=new Map();

self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type==="CANCEL_REST"){
    for(const timeout of restTimers.values()) clearTimeout(timeout);
    restTimers.clear();
    return;
  }
  if(data.type!=="SCHEDULE_REST"||!Number.isFinite(data.dueAt)) return;

  for(const timeout of restTimers.values()) clearTimeout(timeout);
  restTimers.clear();

  const delay=Math.max(0,data.dueAt-Date.now());
  const timeout=setTimeout(async()=>{
    try{
      const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
      const visible=windows.some(client=>client.visibilityState==="visible");
      if(!visible){
        await self.registration.showNotification("Repos terminé",{
          body:"Prochaine série. Repars proprement.",
          icon:"/icon.svg",
          badge:"/icon.svg",
          tag:"rest-finished",
          data:{url:"/"}
        });
      }
    }catch{}
    restTimers.clear();
  },delay);

  restTimers.set("rest",timeout);
});
