"use client";
import {useEffect,useState} from 'react';
import {HyroxWeek} from '../hyrox-week';
export default function HyroxPage(){
  const [now,setNow]=useState(Date.parse('2026-11-22T12:00:00+01:00'));
  useEffect(()=>{setNow(Date.now());const id=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(id);},[]);
  return <main style={{maxWidth:720,margin:'0 auto',padding:18}}><a href="/">← Retour à Charlie Training</a><HyroxWeek now={now} archive/></main>;
}
