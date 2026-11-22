"use client";
import {useState} from 'react';
import {connectFromEmailLink} from '../lib/cloud';
export function ReconnectLink({onConnected}:{onConnected:()=>Promise<void>}){
  const [link,setLink]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function connect(){
    if(busy) return;
    setBusy(true);
    try{
      await connectFromEmailLink(link);
      setLink('');
      setMessage('Compte connecté dans cette app.');
      await onConnected();
    }catch{
      setMessage('Lien non valide, expiré ou connexion indisponible. Copie le lien original du dernier email, sans l’ouvrir, puis réessaie.');
    }finally{setBusy(false);}
  }
  return <details style={{margin:'14px 0'}}><summary>Rester connecté dans cette app iPhone</summary>
    <p>Safari, l’app installée et l’app native peuvent avoir des sessions distinctes. Après avoir demandé un email, copie son lien de connexion sans l’ouvrir, puis colle-le ici. Il est utilisé uniquement pour te connecter.</p>
    <label>Lien reçu par email<input type="password" autoComplete="off" value={link} onChange={e=>setLink(e.target.value)} placeholder="Coller le lien de connexion"/></label>
    <button className="secondary" disabled={busy||!link.trim()} onClick={connect}>{busy?'Connexion…':'Connecter cette app'}</button>
    <p role="status">{message}</p>
  </details>;
}
