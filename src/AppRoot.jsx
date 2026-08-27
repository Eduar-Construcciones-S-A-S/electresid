import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AppV2 from './AppV2'
import Phase1Products from './Phase1Products'
import InventoryPhase2 from './InventoryPhase2'
import Phase3POS from './Phase3POS'
import Phase3POSPatched from './Phase3POSPatched'
import Phase4Repairs from './Phase4Repairs'
import Phase5Administration from './Phase5Administration'
import Phase6Reports from './Phase6Reports'
import { supabase } from './lib/supabase'

function overlayFromLabel(label){
  const l=(label||'').trim().toLowerCase()
  if(l==='productos')return 'productos'
  if(l==='inventario')return 'inventario'
  if(l==='punto de venta')return 'pos'
  if(l==='caja')return 'caja'
  if(l==='reparaciones')return 'reparaciones'
  if(l==='administración')return 'administracion'
  if(l==='reportes')return 'reportes'
  return null
}

export default function AppRoot(){
  const[overlay,setOverlay]=useState('productos')
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

      // La sección activa de AppV2 es la fuente de verdad. Así evitamos que
      // el portal quede mostrando Productos cuando el menú ya está en otra página.
      const active=document.querySelector('.sidebar nav button.active')
      if(active){
        const next=overlayFromLabel(active.textContent)
        setOverlay(next)
      }
    }

    const timer=setTimeout(syncTarget,0)
    observer=new MutationObserver(syncTarget)
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})

    const onClick=e=>{
      const btn=e.target.closest('.sidebar nav button')
      if(!btn)return
      setOverlay(overlayFromLabel(btn.textContent))
    }
    document.addEventListener('click',onClick,true)

    supabase.auth.getSession().then(async({data})=>{
      const id=data.session?.user?.id
      if(id){
        const{data:p}=await supabase.from('perfiles').select('*').eq('id',id).single()
        setProfile(p)
      }
      setTimeout(syncTarget,0)
    })

    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,session)=>{
      if(!session){setProfile(null);return}
      const{data:p}=await supabase.from('perfiles').select('*').eq('id',session.user.id).single()
      setProfile(p)
      // No reiniciar overlay a Productos: eventos como TOKEN_REFRESHED ocurren
      // mientras el usuario está navegando y antes provocaban el bug visual.
      setTimeout(syncTarget,0)
    })

    return()=>{
      clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('click',onClick,true)
      subscription.unsubscribe()
    }
  },[])

  let portal=null
  if(target&&overlay==='productos')portal=createPortal(<div className="phase2-portal"><Phase1Products profile={profile}/></div>,target)
  if(target&&overlay==='inventario')portal=createPortal(<div className="phase2-portal"><InventoryPhase2 profile={profile}/></div>,target)
  if(target&&overlay==='pos')portal=createPortal(<div className="phase2-portal"><Phase3POSPatched initialTab="pos" profile={profile}/></div>,target)
  if(target&&overlay==='caja')portal=createPortal(<div className="phase2-portal"><Phase3POS initialTab="caja" profile={profile}/></div>,target)
  if(target&&overlay==='reparaciones')portal=createPortal(<div className="phase2-portal"><Phase4Repairs profile={profile}/></div>,target)
  if(target&&overlay==='administracion')portal=createPortal(<div className="phase2-portal"><Phase5Administration profile={profile}/></div>,target)
  if(target&&overlay==='reportes')portal=createPortal(<div className="phase2-portal"><Phase6Reports profile={profile}/></div>,target)

  return <><AppV2/>{portal}</>
}
