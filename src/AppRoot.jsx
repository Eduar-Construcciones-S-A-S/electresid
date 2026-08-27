import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AppV2 from './AppV2'
import InventoryPhase2 from './InventoryPhase2'
import Phase3POS from './Phase3POS'
import Phase3POSPatched from './Phase3POSPatched'
import Phase4Repairs from './Phase4Repairs'
import Phase5Administration from './Phase5Administration'
import Phase6Reports from './Phase6Reports'
import { supabase } from './lib/supabase'

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

    // IMPORTANTE: no hacer await de consultas Supabase dentro del callback de
    // onAuthStateChange. El cliente de Auth mantiene un lock durante el evento y
    // esperar otra llamada Supabase aquí puede bloquear signInWithPassword y dejar
    // el botón de login eternamente en "Procesando...".
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

  let portal=null
  if(target&&overlay==='inventario')portal=createPortal(<div className="phase2-portal"><InventoryPhase2 profile={profile}/></div>,target)
  if(target&&overlay==='pos')portal=createPortal(<div className="phase2-portal"><Phase3POSPatched initialTab="pos" profile={profile}/></div>,target)
  if(target&&overlay==='caja')portal=createPortal(<div className="phase2-portal"><Phase3POS initialTab="caja" profile={profile}/></div>,target)
  if(target&&overlay==='reparaciones')portal=createPortal(<div className="phase2-portal"><Phase4Repairs profile={profile}/></div>,target)
  if(target&&overlay==='administracion')portal=createPortal(<div className="phase2-portal"><Phase5Administration profile={profile}/></div>,target)
  if(target&&overlay==='reportes')portal=createPortal(<div className="phase2-portal"><Phase6Reports profile={profile}/></div>,target)

  return <><AppV2/>{portal}</>
}
