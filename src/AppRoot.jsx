import { lazy, Suspense, useEffect, useState } from 'react'
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
  if(l==='administración')return 'administracion'
  if(l==='reportes')return 'reportes'
  // Usuarios, Categorías, Clientes, Resumen y Configuración son pantallas
  // nativas de AppV2. null significa que NO debe existir un portal encima.
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
    let disposed=false
    let rafId=0

    const setOverlaySafe=next=>{
      // IMPORTANTE: también aceptamos null. Antes se ignoraba null y el último
      // portal (POS, inventario, reportes, etc.) quedaba montado encima de
      // Usuarios/Categorías/Clientes/Resumen/Configuración.
      setOverlay(prev=>prev===next?prev:next)
    }

    const syncUi=()=>{
      if(disposed)return

      const content=document.querySelector('.content')
      setTarget(prev=>prev===content?prev:content)

      const appShell=document.querySelector('.app-shell')
      if(!appShell){
        setProfile(prev=>prev===null?prev:null)
        setOverlaySafe(null)
        return
      }

      let inventoryBtn=null
      let productBtn=null

      document.querySelectorAll('.sidebar nav button').forEach(btn=>{
        const raw=(btn.textContent||'').trim().toLowerCase()

        if(raw==='proveedores' && btn.style.display!=='none'){
          btn.style.display='none'
        }

        if(raw==='productos'){
          productBtn=btn
          if(btn.style.display!=='none')btn.style.display='none'
        }

        if(raw==='inventario'||raw==='productos e inventario'){
          inventoryBtn=btn
          const text=btn.querySelector('span')
          if(text && text.textContent!=='Productos e inventario'){
            text.textContent='Productos e inventario'
          }
        }

        if(raw==='gastos'||raw==='administración'){
          const text=btn.querySelector('span')
          if(text && text.textContent!=='Administración'){
            text.textContent='Administración'
          }
        }
      })

      const roleText=document.querySelector('.userbox span')?.textContent?.trim().toLowerCase()
      if(roleText && ['admin','cajero','tecnico','usuario'].includes(roleText)){
        setProfile(prev=>prev?.rol===roleText?prev:{rol:roleText})
      }

      const active=document.querySelector('.sidebar nav button.active')

      // AppV2 inicia históricamente en "productos". Esa opción está oculta
      // porque ahora Productos + Inventario son una sola pantalla. Redirigimos
      // una única vez hacia el botón visible de Productos e inventario.
      if(active===productBtn && inventoryBtn){
        inventoryBtn.click()
        return
      }

      if(active){
        setOverlaySafe(overlayFromLabel(active.textContent))
      }
    }

    const scheduleSync=()=>{
      if(disposed||rafId)return
      rafId=requestAnimationFrame(()=>{
        rafId=0
        syncUi()
      })
    }

    scheduleSync()

    const observer=new MutationObserver(scheduleSync)
    observer.observe(document.body,{childList:true,subtree:true})

    const onClick=e=>{
      const navBtn=e.target.closest('.sidebar nav button')
      if(navBtn){
        // Se actualiza inmediatamente en el mismo clic. Para las pantallas
        // nativas de AppV2 esto desmonta el portal anterior al instante.
        setOverlaySafe(overlayFromLabel(navBtn.textContent))
        scheduleSync()
        return
      }

      if(e.target.closest('.logout')){
        setTarget(null)
        setProfile(null)
        setOverlaySafe(null)
        scheduleSync()
      }
    }

    document.addEventListener('click',onClick,true)

    return()=>{
      disposed=true
      if(rafId)cancelAnimationFrame(rafId)
      observer.disconnect()
      document.removeEventListener('click',onClick,true)
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