import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Phase1Products from './Phase1Products'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, History, PackagePlus, Pencil, RefreshCcw, Search } from 'lucide-react'
import './inventory-phase2.css'

const money=(n=0)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n)||0)
const num=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:3}).format(Number(n)||0)
const date=d=>new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short'}).format(new Date(d))

const tabs=[
  ['productos','Productos',PackagePlus],
  ['actual','Inventario actual',Boxes],
  ['entrada','Entradas',ArrowDownToLine],
  ['salida','Salidas',ArrowUpFromLine],
  ['ajuste','Ajustes',ClipboardCheck],
  ['kardex','Kardex',History],
  ['alertas','Alertas',AlertTriangle],
]

export default function InventoryPhase2({profile}){
  const[tab,setTab]=useState('productos')
  const[stock,setStock]=useState([])
  const[kardex,setKardex]=useState([])
  const[alerts,setAlerts]=useState([])
  const[loading,setLoading]=useState(true)
  const[query,setQuery]=useState('')
  const[product,setProduct]=useState('')
  const[qty,setQty]=useState('')
  const[cost,setCost]=useState('')
  const[note,setNote]=useState('')
  const[msg,setMsg]=useState('')

  const load=async()=>{
    setLoading(true);setMsg('')
    const [{data:s,error:se},{data:k,error:ke},{data:a,error:ae}]=await Promise.all([
      supabase.from('inventario_actual').select('*').order('producto'),
      supabase.from('kardex_inventario').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('alertas_stock').select('*').order('stock_actual',{ascending:true}),
    ])
    const err=se||ke||ae
    if(err)setMsg(err.message)
    setStock(s||[]);setKardex(k||[]);setAlerts(a||[]);setLoading(false)
  }
  useEffect(()=>{load()},[])

  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return stock;return stock.filter(x=>[x.producto,x.variante,x.sku,x.categoria,x.marca].some(v=>(v||'').toLowerCase().includes(q)))},[stock,query])
  const selected=stock.find(x=>x.variante_id===product)
  const low=stock.filter(x=>x.estado_stock!=='normal').length
  const totalUnits=stock.reduce((a,x)=>a+Number(x.stock_actual||0),0)
  const inventoryValue=stock.reduce((a,x)=>a+Number(x.valor_costo||0),0)
  const canAdjust=profile?.rol==='admin'

  const reset=()=>{setQty('');setCost('');setNote('');setMsg('')}
  const selectProduct=id=>{setProduct(id);const row=stock.find(x=>x.variante_id===id);setCost(row?String(row.costo??''):'')}
  const run=async(type)=>{
    if(!canAdjust)return setMsg('Solo un administrador puede modificar inventario.')
    if(!product)return setMsg('Selecciona un producto.')
    const n=Number(qty)
    if(!Number.isFinite(n)||n<0)return setMsg('Ingresa una cantidad válida.')
    let res
    if(type==='entrada'){
      if(n<=0)return setMsg('La entrada debe ser mayor que cero.')
      res=await supabase.rpc('registrar_entrada_inventario',{p_variante_id:product,p_cantidad:n,p_observacion:note||null,p_costo_unitario:cost===''?null:Number(cost)})
    }else if(type==='salida'){
      if(n<=0)return setMsg('La salida debe ser mayor que cero.')
      if(selected && n>Number(selected.stock_actual))return setMsg('No puedes retirar más unidades de las disponibles.')
      res=await supabase.rpc('registrar_salida_inventario',{p_variante_id:product,p_cantidad:n,p_observacion:note||null})
    }else{
      res=await supabase.rpc('ajustar_stock_fisico',{p_variante_id:product,p_stock_fisico:n,p_observacion:note||null})
    }
    if(res.error)return setMsg(res.error.message)
    setMsg(type==='ajuste'?'Inventario ajustado al conteo físico.':'Movimiento registrado correctamente.')
    setQty('');setCost('');setNote('');await load()
  }

  return <div className="inv2">
    <div className="inv2-summary">
      <article><span>Referencias</span><b>{stock.length}</b></article>
      <article><span>Unidades actuales</span><b>{num(totalUnits)}</b></article>
      <article><span>Valor a costo</span><b>{money(inventoryValue)}</b></article>
      <article className={low?'warn':''}><span>Stock mínimo / agotado</span><b>{low}</b></article>
    </div>

    <section className="panel inv2-shell">
      <div className="inv2-head"><div><h2>Productos e inventario</h2><p>Catálogo, precios, resurtido, existencias, entradas, salidas, Kardex y alertas en un solo módulo.</p></div><button className="secondary compact" onClick={load}><RefreshCcw size={15}/>Actualizar</button></div>
      <div className="inv2-tabs">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>{setTab(id);setMsg('')}} className={tab===id?'active':''}><Icon size={16}/>{label}{id==='alertas'&&alerts.length>0?<em>{alerts.length}</em>:null}</button>)}</div>
      {msg&&<div className="notice">{msg}</div>}

      {tab==='productos'&&<Phase1Products profile={profile}/>} 
      {tab==='actual'&&<InventoryCurrent rows={filtered} loading={loading} query={query} setQuery={setQuery} canAdjust={canAdjust} reload={load} setMsg={setMsg}/>} 
      {tab==='entrada'&&<MovementForm type="entrada" stock={stock} product={product} setProduct={selectProduct} qty={qty} setQty={setQty} cost={cost} setCost={setCost} note={note} setNote={setNote} selected={selected} canAdjust={canAdjust} run={run} reset={reset}/>} 
      {tab==='salida'&&<MovementForm type="salida" stock={stock} product={product} setProduct={setProduct} qty={qty} setQty={setQty} note={note} setNote={setNote} selected={selected} canAdjust={canAdjust} run={run} reset={reset}/>} 
      {tab==='ajuste'&&<AdjustmentForm stock={stock} product={product} setProduct={setProduct} qty={qty} setQty={setQty} note={note} setNote={setNote} selected={selected} canAdjust={canAdjust} run={run} reset={reset}/>} 
      {tab==='kardex'&&<Kardex rows={kardex}/>} 
      {tab==='alertas'&&<Alerts rows={alerts}/>} 
    </section>
  </div>
}

function InventoryCurrent({rows,loading,query,setQuery,canAdjust,reload,setMsg}){
  const[editing,setEditing]=useState(null)
  const[price,setPrice]=useState('')
  const savePrice=async()=>{
    const value=Number(price)
    if(!editing||!Number.isFinite(value)||value<0)return setMsg('Ingresa un precio de venta válido.')
    const{error}=await supabase.rpc('actualizar_precio_venta',{p_variante_id:editing.variante_id,p_precio_venta:value})
    if(error)return setMsg(error.message)
    setEditing(null);setPrice('');setMsg('Precio de venta actualizado correctamente.');await reload()
  }
  return <div><div className="inv2-toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto, SKU, categoría o marca..."/></div></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Categoría</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th><th>Costo compra</th><th>Precio venta</th><th>Margen unitario</th><th>Valor inventario</th><th>Acción</th></tr></thead><tbody>{loading?<tr><td colSpan="11" className="empty">Cargando inventario...</td></tr>:rows.length?rows.map(x=><tr key={x.variante_id}><td><b>{x.producto}</b><small className="cell-sub">{x.variante||'Sin variante'}</small></td><td>{x.sku}</td><td>{x.categoria}</td><td><strong>{num(x.stock_actual)}</strong></td><td>{num(x.stock_minimo)}</td><td><StockBadge state={x.estado_stock}/></td><td>{money(x.costo)}</td><td>{money(x.precio_venta)}</td><td>{money(Number(x.precio_venta||0)-Number(x.costo||0))}</td><td>{money(x.valor_costo)}</td><td><button className="mini-btn" disabled={!canAdjust} onClick={()=>{setEditing(x);setPrice(String(x.precio_venta??0))}}><Pencil size={14}/> Precio</button></td></tr>):<tr><td colSpan="11" className="empty">No hay productos con inventario.</td></tr>}</tbody></table></div>{editing&&<div className="p1p-modal-back"><section className="panel p1p-modal"><div className="panel-head"><div><h3>Modificar precio de venta</h3><p>{editing.producto} · {editing.sku}</p></div></div><div className="movement-preview"><span>Costo actual <b>{money(editing.costo)}</b></span><span>Precio actual <b>{money(editing.precio_venta)}</b></span><span>Nuevo margen <b>{money(Number(price||0)-Number(editing.costo||0))}</b></span></div><label className="field"><span>Nuevo precio de venta</span><input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} autoFocus/></label><div className="wizard-footer"><button className="secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary" onClick={savePrice}>Guardar nuevo precio</button></div></section></div>}</div>
}

function ProductSelect({stock,value,onChange}){return <select value={value} onChange={e=>onChange(e.target.value)}><option value="">Selecciona producto...</option>{stock.map(x=><option key={x.variante_id} value={x.variante_id}>{x.sku} · {x.producto}{x.variante?` · ${x.variante}`:''} · Stock ${num(x.stock_actual)}</option>)}</select>}

function MovementForm({type,stock,product,setProduct,qty,setQty,cost,setCost,note,setNote,selected,canAdjust,run,reset}){
  const entry=type==='entrada'
  return <div className="inv2-form"><div className="inv2-explain"><b>{entry?'Registrar entrada':'Registrar salida'}</b><p>{entry?'Úsalo cuando llega mercancía o incorporas unidades al inventario. Si escribes un costo nuevo, se actualizará el costo de compra de esa referencia.':'Úsalo para daños, pérdidas, consumo interno u otras salidas que no sean una venta.'}</p></div>{!canAdjust&&<div className="notice">Tu rol puede consultar inventario, pero solo el administrador puede registrar movimientos manuales.</div>}<div className="form-grid"><label className="field"><span>Producto</span><ProductSelect stock={stock} value={product} onChange={setProduct}/></label><label className="field"><span>Cantidad</span><input type="number" min="0.001" step="0.001" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/></label>{entry&&<label className="field"><span>Precio al que se compró / costo unitario</span><input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)} placeholder={selected?String(selected.costo):'Opcional'}/></label>}<label className="field"><span>Motivo / observación</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder={entry?'Ej. Ingreso de mercancía':'Ej. Producto dañado'}/></label></div>{selected&&<div className="movement-preview"><span>Stock actual <b>{num(selected.stock_actual)}</b></span>{entry&&<span>Costo compra <b>{money(cost===''?selected.costo:cost)}</b></span>}<span>Precio venta <b>{money(selected.precio_venta)}</b></span><span>Movimiento <b>{entry?'+':'-'}{num(qty)}</b></span><span>Stock resultante <b>{num(Number(selected.stock_actual)+(entry?1:-1)*(Number(qty)||0))}</b></span></div>}<div className="wizard-footer"><button className="secondary" onClick={reset}>Limpiar</button><button className="primary" disabled={!canAdjust} onClick={()=>run(type)}>{entry?'Registrar entrada':'Registrar salida'}</button></div></div>
}

function AdjustmentForm({stock,product,setProduct,qty,setQty,note,setNote,selected,canAdjust,run,reset}){
  return <div className="inv2-form"><div className="inv2-explain"><b>Ajuste por conteo físico</b><p>No indicas cuánto sumar o restar: escribes cuánto contaste realmente y el sistema genera automáticamente la diferencia en el Kardex.</p></div>{!canAdjust&&<div className="notice">Solo el administrador puede efectuar ajustes físicos.</div>}<div className="form-grid"><label className="field"><span>Producto</span><ProductSelect stock={stock} value={product} onChange={setProduct}/></label><label className="field"><span>Stock físico contado</span><input type="number" min="0" step="0.001" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/></label><label className="field"><span>Motivo del ajuste</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej. Conteo de cierre mensual"/></label></div>{selected&&<div className="movement-preview"><span>Stock sistema <b>{num(selected.stock_actual)}</b></span><span>Conteo físico <b>{num(qty)}</b></span><span>Diferencia <b>{num((Number(qty)||0)-Number(selected.stock_actual))}</b></span><span>Costo compra <b>{money(selected.costo)}</b></span><span>Precio venta <b>{money(selected.precio_venta)}</b></span></div>}<div className="wizard-footer"><button className="secondary" onClick={reset}>Limpiar</button><button className="primary" disabled={!canAdjust} onClick={()=>run('ajuste')}>Aplicar ajuste</button></div></div>
}

function Kardex({rows}){
  const[q,setQ]=useState('')
  const filtered=useMemo(()=>{const s=q.toLowerCase();return rows.filter(x=>!s||(x.sku||'').toLowerCase().includes(s)||(x.producto||'').toLowerCase().includes(s)||(x.observacion||'').toLowerCase().includes(s))},[rows,q])
  return <div><div className="inv2-toolbar"><div className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar en Kardex..."/></div></div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>SKU</th><th>Tipo</th><th>Entrada</th><th>Salida</th><th>Saldo</th><th>Observación</th></tr></thead><tbody>{filtered.length?filtered.map(x=><tr key={x.id}><td>{date(x.created_at)}</td><td>{x.producto}<small className="cell-sub">{x.variante||''}</small></td><td>{x.sku}</td><td>{humanType(x)}</td><td className="positive">{Number(x.entrada)>0?`+${num(x.entrada)}`:'—'}</td><td className="negative">{Number(x.salida)>0?`-${num(x.salida)}`:'—'}</td><td><b>{num(x.saldo)}</b></td><td>{x.observacion||'—'}</td></tr>):<tr><td colSpan="8" className="empty">No hay movimientos registrados.</td></tr>}</tbody></table></div></div>
}

function humanType(x){if(x.referencia_tipo==='entrada_manual')return 'Entrada';if(x.referencia_tipo==='salida_manual')return 'Salida';if(x.referencia_tipo==='ajuste_fisico')return 'Ajuste físico';if(x.tipo==='venta')return 'Venta';if(x.tipo==='reparacion')return 'Reparación';if(x.tipo==='devolucion_venta')return 'Devolución';return String(x.tipo||'').replaceAll('_',' ')}

function Alerts({rows}){return <div><div className="inv2-explain"><b>Alertas de stock</b><p>Se generan automáticamente cuando el inventario actual llega o baja del mínimo definido en la variante.</p></div><div className="alert-grid">{rows.length?rows.map(x=><article key={x.variante_id} className={`stock-alert ${x.nivel_alerta==='CRITICA'?'critical':''}`}><AlertTriangle/><div><b>{x.producto}</b><span>{x.sku} · {x.variante||'Sin variante'}</span><small>Actual: {num(x.stock_actual)} · Mínimo: {num(x.stock_minimo)}</small></div><strong>{x.nivel_alerta==='CRITICA'?'Agotado':'Stock bajo'}</strong></article>):<div className="empty good-empty">Todo el inventario está por encima del mínimo.</div>}</div></div>}

function StockBadge({state}){return <span className={`stock-badge ${state}`}>{state==='agotado'?'Agotado':state==='bajo'?'Stock bajo':'Normal'}</span>}
