import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AppV2 from './AppV2'
import InventoryPhase2 from './InventoryPhase2'
import Phase3POS from './Phase3POS'
import Phase4Repairs from './Phase4Repairs'
import Phase5Administration from './Phase5Administration'
import { supabase } from './lib/supabase'

export default function AppRoot(){
  const[overlay,setOverlay]=useState(null)
  const[target,setTarget]=useState(null)
  const[profile,setProfile]=useState(null)

  useEffect(()=>{
    let observer
    const syncTarget=()=>{
      setTarget(document.querySelector('.content'))
      document.querySelectorAll('.sidebar nav button').forEach(btn=>{
        const label=(btn.textContent||'').trim().toLowerCase()
        if(label==='proveedores')btn.style.display='none'
        if(label==='gastos'){
          const text=btn.querySelector('span')
          if(text)text.textContent='Administración'
        }
      })
    }
    const timer=setTimeout(syncTarget,0)
    observer=new MutationObserver(syncTarget)
    observer.observe(document.body,{childList:true,subtree:true})

    const onClick=e=>{
      const btn=e.target.closest('.sidebar nav button')
      if(!btn)return
      const label=(btn.textContent||'').trim().toLowerCase()
      if(label==='inventario')setOverlay('inventario')
      else if(label==='punto de venta')setOverlay('pos')
      else if(label==='caja')setOverlay('caja')
      else if(label==='reparaciones')setOverlay('reparaciones')
      else if(label==='administración')setOverlay('administracion')
      else setOverlay(null)
    }
    document.addEventListener('click',onClick,true)

    supabase.auth.getSession().then(async({data})=>{
      const id=data.session?.user?.id
      if(id){const{data:p}=await supabase.from('perfiles').select('*').eq('id',id).single();setProfile(p)}
    })
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,session)=>{
      if(!session){setProfile(null);setOverlay(null);return}
      const{data:p}=await supabase.from('perfiles').select('*').eq('id',session.user.id).single();setProfile(p)
    })

    return()=>{clearTimeout(timer);observer.disconnect();document.removeEventListener('click',onClick,true);subscription.unsubscribe()}
  },[])

  let portal=null
  if(target&&overlay==='inventario')portal=createPortal(<div className="phase2-portal"><InventoryPhase2 profile={profile}/></div>,target)
  if(target&&overlay==='pos')portal=createPortal(<div className="phase2-portal"><Phase3POS initialTab="pos" profile={profile}/></div>,target)
  if(target&&overlay==='caja')portal=createPortal(<div className="phase2-portal"><Phase3POS initialTab="caja" profile={profile}/></div>,target)
  if(target&&overlay==='reparaciones')portal=createPortal(<div className="phase2-portal"><Phase4Repairs profile={profile}/></div>,target)
  if(target&&overlay==='administracion')portal=createPortal(<div className="phase2-portal"><Phase5Administration profile={profile}/></div>,target)

  return <><AppV2/>{portal}</>
}
