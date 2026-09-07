import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AppV2 from './AppV2'

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
  if(l==='administración'||l==='gastos')return 'administracion'
  if(l==='reportes')return 'reportes'
  return null
}

function ModuleLoader(){
  return <section className="panel"><div className="notice">Cargando módulo…</div></section>
}

export default function AppRoot(){
  const[overlay,setOverlay]=useState(null)
  const[target,setTarget]=useState(null)
  const[profile,setProfile]=useState(null)
  const[refreshKey,setRefreshKey]=useState(0)
  const redirected=useRef(false)

  useEffect(()=>{
    let disposed=false

    const syncShell=()=>{
      if(disposed)return
      const shell=document.querySelector('.app-shell')
      const content=document.querySelector('.content')

      setTarget(prev=>prev===content?prev:content)

      if(!shell){
        redirected.current=false
        setProfile(prev=>prev===null?prev:null)
        setOverlay(prev=>prev===null?prev:null)
        return
      }

      let productBtn=null
      let inventoryBtn=null

      document.querySelectorAll('.sidebar nav button').forEach(btn=>{
        const label=(btn.textContent||'').trim().toLowerCase()

        if(label==='proveedores' && btn.style.display!=='none')btn.style.display='none'

        if(label==='productos'){
          productBtn=btn
          if(btn.style.display!=='none')btn.style.display='none'
        }

        if(label==='inventario'||label==='productos e inventario'){
          inventoryBtn=btn
          const span=btn.querySelector('span')
          if(span && span.textContent!=='Productos e inventario')span.textContent='Productos e inventario'
        }

        if(label==='gastos'||label==='administración'){
          const span=btn.querySelector('span')
          if(span && span.textContent!=='Administración')span.textContent='Administración'
        }
      })

      const role=document.querySelector('.userbox span')?.textContent?.trim().toLowerCase()
      if(role)setProfile(prev=>prev?.rol===role?prev:{rol:role})

      const active=document.querySelector('.sidebar nav button.active')
      if(active===productBtn && inventoryBtn && !redirected.current){
        redirected.current=true
        inventoryBtn.click()
        return
      }

      if(active){
        const next=overlayFromLabel(active.textContent)
        setOverlay(prev=>prev===next?prev:next)
      }
    }

    const onClick=e=>{
      const btn=e.target.closest('.sidebar nav button')
      if(btn){
        const next=overlayFromLabel(btn.textContent)
        setOverlay(next)
        setRefreshKey(k=>k+1)
        setTimeout(syncShell,0)
        return
      }
      if(e.target.closest('.logout')){
        redirected.current=false
        setOverlay(null)
        setTarget(null)
        setProfile(null)
      }
    }

    const refreshVisibleModule=()=>{
      if(document.visibilityState==='visible'){
        syncShell()
        setRefreshKey(k=>k+1)
        window.dispatchEvent(new Event('electresid:refresh'))
      }
    }

    document.addEventListener('click',onClick,true)
    document.addEventListener('visibilitychange',refreshVisibleModule)
    window.addEventListener('focus',refreshVisibleModule)

    // Comprobación ligera y estable. Sustituye el MutationObserver que generaba
    // carreras entre el DOM de AppV2 y los módulos nuevos.
    syncShell()
    const timer=setInterval(syncShell,500)

    return()=>{
      disposed=true
      clearInterval(timer)
      document.removeEventListener('click',onClick,true)
      document.removeEventListener('visibilitychange',refreshVisibleModule)
      window.removeEventListener('focus',refreshVisibleModule)
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
    ?createPortal(
      <Suspense fallback={<ModuleLoader/>}>
        <div className="phase2-portal" key={`${overlay}-${refreshKey}`}>{module}</div>
      </Suspense>,
      target
    )
    :null

  return <><AppV2/>{portal}</>
}
