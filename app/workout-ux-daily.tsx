"use client";

import { useEffect, useRef } from "react";

function parseTimer(text:string){
  const match=text.trim().match(/^(\d+):(\d{2})$/);
  if(!match) return null;
  return Number(match[1])*60+Number(match[2]);
}

export default function WorkoutUxDaily(){
  const lastRestSecond=useRef<number|null>(null);
  const hadActiveRest=useRef(false);

  useEffect(()=>{
    if(typeof window==="undefined") return;

    let focusTimeout:number|undefined;
    let restEndTimeout:number|undefined;

    const syncRestUi=()=>{
      const dock=document.querySelector<HTMLElement>(".v31-rest-dock");

      if(dock){
        hadActiveRest.current=true;
        document.documentElement.classList.add("workout-rest-active");

        const timer=dock.querySelector<HTMLElement>(".v31-rest-copy strong");
        const seconds=timer?.textContent?parseTimer(timer.textContent):null;

        if(seconds!=null&&seconds>0&&seconds<=3&&lastRestSecond.current!==seconds){
          lastRestSecond.current=seconds;
          try{
            navigator.vibrate?.(seconds===1?[35,35,75]:30);
          }catch{}
        }
        return;
      }

      document.documentElement.classList.remove("workout-rest-active");
      lastRestSecond.current=null;

      if(hadActiveRest.current){
        hadActiveRest.current=false;
        window.clearTimeout(restEndTimeout);
        restEndTimeout=window.setTimeout(()=>{
          const activeForm=document.querySelector<HTMLElement>(".gym-mode .log-card, .gym-mode .superset-log-card");
          activeForm?.scrollIntoView({behavior:"smooth",block:"center"});
        },180);
      }
    };

    const handleFocus=(event:FocusEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target?.matches(".gym-mode input, .gym-mode textarea, .gym-mode select")) return;
      window.clearTimeout(focusTimeout);
      focusTimeout=window.setTimeout(()=>{
        target.scrollIntoView({behavior:"smooth",block:"center"});
      },220);
    };

    const observer=new MutationObserver(syncRestUi);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    document.addEventListener("focusin",handleFocus);
    const interval=window.setInterval(syncRestUi,350);
    syncRestUi();

    return()=>{
      observer.disconnect();
      document.removeEventListener("focusin",handleFocus);
      window.clearInterval(interval);
      window.clearTimeout(focusTimeout);
      window.clearTimeout(restEndTimeout);
      document.documentElement.classList.remove("workout-rest-active");
    };
  },[]);

  return null;
}
