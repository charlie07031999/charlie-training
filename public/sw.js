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
