import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AppV2 from './AppV2'
import { supabase } from './lib/supabase'

const InventoryPhase2=lazy(()=>import('./InventoryPhase2'))
const Phase3POS=lazy(()=>import('./Phase3POS'))
const Phase3POSPatched=lazy(()=>import('./Phase3POSPatched'))
const Phase4Repairs=lazy(()=>import('./Phase4Repairs'))
const Phase5Administration=lazy(()=>import('./Phase5Administration'))
const Phase6Reports=lazy(()=>import('./Phase6Reports'))

function overlayFromLabel(label){
  const l=(label||'').trim().toLowerCase()
  if(l==='productos'||l==='inventario'||l==='productos e inventario')return 'inventario'
  if(l==='punto de venta')return 'pos'
  if(l==='caja')return 'caja'
  if(l==='reparaciones')return 'reparaciones'
  if(l==='administración')return 'administracion'
  if(l==='reportes')return 'reportes'
  return null
}

function ModuleLoader(){
  return <div className="phase2-portal"><section className="panel"><div className="notice">Cargando módulo…</div></section></div>
}

export default function AppRoot(){
  const[overlay,setOverlay]=useState('inventario')
  const[target,setTarget]=useState(null)
  const[profile,setProfile]=useState(null)

  useEffect(()=>{
    let observer
    let redirecting=false
    let disposed=false

    const syncTarget=()=>{
      if(disposed)return
      setTarget(document.querySelector('.content'))
      let inventoryBtn=null
      let productBtn=null

      document.querySelectorAll('.sidebar nav button').forEach(btn=>{
        const label=(btn.textContent||'').trim().toLowerCase()
        if(label==='proveedores')btn.style.display='none'
        if(label==='productos'){
          productBtn=btn
          btn.style.display='none'
        }
        if(label==='inventario'||label==='productos e inventario'){
          inventoryBtn=btn
          const text=btn.querySelector('span')
          if(text)text.textContent='Productos e inventario'
        }
        if(label==='gastos'){
          const text=btn.querySelector('span')
          if(text)text.textContent='Administración'
        }
      })

      const active=document.querySelector('.sidebar nav button.active')
      const activeLabel=(active?.textContent||'').trim().toLowerCase()

      if(active===productBtn && inventoryBtn && !redirecting){
        redirecting=true
        setTimeout(()=>{
          if(disposed)return
          inventoryBtn.click()
          redirecting=false
        },0)
        return
      }

      if(active)setOverlay(overlayFromLabel(activeLabel))
    }

    const loadProfile=async userId=>{
      if(!userId||disposed){setProfile(null);return}
      const{data:p}=await supabase.from('perfiles').select('*').eq('id',userId).single()
      if(!disposed)setProfile(p||null)
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

    supabase.auth.getSession().then(({data})=>{
      if(disposed)return
      const id=data.session?.user?.id
      if(id)loadProfile(id)
      else setProfile(null)
      setTimeout(syncTarget,0)
    })

    const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(disposed)return
      const id=session?.user?.id
      setTimeout(()=>{
        if(disposed)return
        if(id)loadProfile(id)
        else setProfile(null)
        syncTarget()
      },0)
    })

    return()=>{
      disposed=true
      clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('click',onClick,true)
      subscription.unsubscribe()
    }
  },[])

  let module=null
  if(overlay==='inventario')module=<InventoryPhase2 profile={profile}/>
  if(overlay==='pos')module=<Phase3POSPatched initialTab="pos" profile={profile}/>
  if(overlay==='caja')module=<Phase3POS initialTab="caja" profile={profile}/>
  if(overlay==='reparaciones')module=<Phase4Repairs profile={profile}/>
  if(overlay==='administracion')module=<Phase5Administration profile={profile}/>
  if(overlay==='reportes')module=<Phase6Reports profile={profile}/>

  const portal=target&&module
    ?createPortal(<Suspense fallback={<ModuleLoader/>}><div className="phase2-portal">{module}</div></Suspense>,target)
    :null

  return <><AppV2/>{portal}</>
}
