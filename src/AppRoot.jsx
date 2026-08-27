import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AppV2 from './AppV2'
import InventoryPhase2 from './InventoryPhase2'
import { supabase } from './lib/supabase'

export default function AppRoot(){
  const[showInventory,setShowInventory]=useState(false)
  const[target,setTarget]=useState(null)
  const[profile,setProfile]=useState(null)

  useEffect(()=>{
    let observer
    const syncTarget=()=>setTarget(document.querySelector('.content'))
    const timer=setTimeout(syncTarget,0)
    observer=new MutationObserver(syncTarget)
    observer.observe(document.body,{childList:true,subtree:true})

    const onClick=e=>{
      const btn=e.target.closest('.sidebar nav button')
      if(!btn)return
      const label=(btn.textContent||'').trim().toLowerCase()
      setShowInventory(label==='inventario')
    }
    document.addEventListener('click',onClick,true)

    supabase.auth.getSession().then(async({data})=>{
      const id=data.session?.user?.id
      if(id){const{data:p}=await supabase.from('perfiles').select('*').eq('id',id).single();setProfile(p)}
    })
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,session)=>{
      if(!session){setProfile(null);return}
      const{data:p}=await supabase.from('perfiles').select('*').eq('id',session.user.id).single();setProfile(p)
    })

    return()=>{clearTimeout(timer);observer.disconnect();document.removeEventListener('click',onClick,true);subscription.unsubscribe()}
  },[])

  return <><AppV2/>{showInventory&&target&&createPortal(<div className="phase2-portal"><InventoryPhase2 profile={profile}/></div>,target)}</>
}
