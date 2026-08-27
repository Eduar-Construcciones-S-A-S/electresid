import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { Boxes, PackagePlus, Plus, RefreshCcw, Search, ShoppingCart, X } from 'lucide-react'
import './phase1-products.css'

const money=(n=0)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n)||0)
const methods=['efectivo','tarjeta','transferencia','nequi','daviplata','otro']
const emptyProduct={nombre:'',descripcion:'',categoria_id:'',marca_id:'',marca_nueva:'',variante:'',codigo_barras:'',costo:'',precio_venta:'',stock_minimo:1,stock_inicial:0}

function goSidebar(label){
  const target=[...document.querySelectorAll('.sidebar nav button')].find(b=>(b.textContent||'').trim().toLowerCase()===label.toLowerCase())
  target?.click()
}

export default function Phase1Products({profile}){
  const[rows,setRows]=useState([]),[cats,setCats]=useState([]),[brands,setBrands]=useState([]),[q,setQ]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const[showNew,setShowNew]=useState(false),[form,setForm]=useState(emptyProduct)
  const[restock,setRestock]=useState(null),[rQty,setRQty]=useState(1),[rCost,setRCost]=useState(''),[rSeller,setRSeller]=useState(''),[rDoc,setRDoc]=useState(''),[rPaid,setRPaid]=useState(0),[rMethod,setRMethod]=useState('efectivo'),[rDue,setRDue]=useState('')
  const admin=profile?.rol==='admin'

  const load=async()=>{
    setLoading(true);setError('')
    const [i,c,m]=await Promise.all([
      supabase.from('inventario_actual').select('*').order('producto'),
      supabase.from('categorias').select('*').eq('activo',true).order('nombre'),
      supabase.from('marcas').select('*').eq('activo',true).order('nombre')
    ])
    const e=i.error||c.error||m.error
    if(e)setError(e.message)
    setRows(i.data||[]);setCats(c.data||[]);setBrands(m.data||[]);setLoading(false)
  }
  useEffect(()=>{load()},[])

  const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return rows.filter(x=>!s||[x.producto,x.variante,x.sku,x.categoria,x.marca].some(v=>(v||'').toLowerCase().includes(s)))},[rows,q])

  const createProduct=async()=>{
    if(!admin)return
    if(!form.nombre.trim()||!form.categoria_id||Number(form.precio_venta)<0||form.precio_venta==='')return setError('Completa nombre, categoría y precio de venta.')
    setError('')
    let marcaId=form.marca_id||null
    if(form.marca_nueva.trim()){
      const {data:m,error}=await supabase.from('marcas').insert({nombre:form.marca_nueva.trim()}).select().single()
      if(error)return setError(error.message)
      marcaId=m.id
    }
    const {data:p,error:pe}=await supabase.from('productos').insert({nombre:form.nombre.trim(),descripcion:form.descripcion||null,categoria_id:form.categoria_id,marca_id:marcaId}).select().single()
    if(pe)return setError(pe.message)
    const {data:v,error:ve}=await supabase.from('variantes').insert({producto_id:p.id,sku:null,nombre:form.variante||null,codigo_barras:form.codigo_barras||null,costo:Number(form.costo||0),precio_venta:Number(form.precio_venta||0),stock_minimo:Number(form.stock_minimo||0)}).select().single()
    if(ve)return setError(ve.message)
    if(Number(form.stock_inicial)>0){
      const {error:ie}=await supabase.rpc('ajustar_inventario',{p_variante_id:v.id,p_cantidad:Number(form.stock_inicial),p_es_entrada:true,p_observacion:'Stock inicial al crear producto',p_costo_unitario:Number(form.costo||0)||null})
      if(ie)setError('Producto creado, pero falló el stock inicial: '+ie.message)
    }
    setForm(emptyProduct);setShowNew(false);await load()
  }

  const openRestock=row=>{setRestock(row);setRQty(1);setRCost(String(row.costo||0));setRSeller('');setRDoc('');setRPaid(0);setRMethod('efectivo');setRDue('');setError('')}
  const saveRestock=async()=>{
    if(!admin||!restock)return
    const qty=Number(rQty),cost=Number(rCost),total=qty*cost,paid=Number(rPaid||0)
    if(qty<=0||cost<0)return setError('Cantidad o costo inválido.')
    if(paid<0||paid>total)return setError('El pago no puede superar el total de la compra.')
    const {error}=await supabase.rpc('registrar_compra',{
      p_items:[{variante_id:restock.variante_id,cantidad:qty,costo_unitario:cost}],
      p_vendedor:rSeller||null,p_documento:rDoc||null,p_descuento:0,p_pagado:paid,
      p_metodo:paid>0?rMethod:null,p_vencimiento:rDue?new Date(rDue).toISOString():null,
      p_observacion:`Resurtido desde Productos · ${restock.producto} · ${restock.sku}`
    })
    if(error)return setError(error.message)
    setRestock(null);await load()
  }

  return <div className="p1p">
    <section className="panel p1p-head"><div><h2>Productos y variantes</h2><p>Nuevo producto se crea una sola vez. Cuando vuelve a llegar mercancía del mismo SKU, usa <b>Resurtir</b>: se registra como compra y aumenta inventario.</p></div><div className="p1p-actions"><button className="secondary compact" onClick={()=>goSidebar('Punto de venta')}><ShoppingCart size={16}/>Vender</button><button className="secondary compact" onClick={load}><RefreshCcw size={16}/>Actualizar</button><button className="primary compact" disabled={!admin} onClick={()=>setShowNew(v=>!v)}><Plus size={16}/>Nuevo producto</button></div></section>

    <section className="p1p-guide"><article><span>1</span><div><b>Producto nuevo</b><small>Créalo aquí solo si ese SKU/variante todavía no existe.</small></div></article><article><span>2</span><div><b>Producto existente</b><small>No lo vuelvas a crear. Pulsa Resurtir.</small></div></article><article><span>3</span><div><b>Compra / resurtido</b><small>Aumenta stock, actualiza costo y queda en Administración → Compras.</small></div></article><article><span>4</span><div><b>Entrada manual</b><small>Usa Inventario → Entradas solo para correcciones, stock inicial o movimientos que no sean una compra.</small></div></article></section>

    {error&&<div className="notice">{error}</div>}

    {showNew&&<section className="panel p1p-form"><div className="panel-head"><div><h3>Crear producto nuevo</h3><p>El SKU se genera automáticamente al guardar.</p></div><button className="mini-btn" onClick={()=>setShowNew(false)}><X size={15}/>Cerrar</button></div><div className="p1p-grid">
      <label>Nombre<input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej. Forro iPhone 15"/></label>
      <label>Categoría<select value={form.categoria_id} onChange={e=>setForm({...form,categoria_id:e.target.value})}><option value="">Selecciona...</option>{cats.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <label>Marca existente<select value={form.marca_id} onChange={e=>setForm({...form,marca_id:e.target.value})}><option value="">Sin marca</option>{brands.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
      <label>O nueva marca<input value={form.marca_nueva} onChange={e=>setForm({...form,marca_nueva:e.target.value})}/></label>
      <label>Variante<input value={form.variante} onChange={e=>setForm({...form,variante:e.target.value})} placeholder="Ej. Negro / MagSafe"/></label>
      <label>Código de barras<input value={form.codigo_barras} onChange={e=>setForm({...form,codigo_barras:e.target.value})}/></label>
      <label>Costo<input type="number" min="0" value={form.costo} onChange={e=>setForm({...form,costo:e.target.value})}/></label>
      <label>Precio venta<input type="number" min="0" value={form.precio_venta} onChange={e=>setForm({...form,precio_venta:e.target.value})}/></label>
      <label>Stock inicial<input type="number" min="0" value={form.stock_inicial} onChange={e=>setForm({...form,stock_inicial:e.target.value})}/></label>
      <label>Stock mínimo<input type="number" min="0" value={form.stock_minimo} onChange={e=>setForm({...form,stock_minimo:e.target.value})}/></label>
      <label className="wide">Descripción<input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></label>
    </div><div className="p1p-footer"><button className="primary" onClick={createProduct}>Crear producto y generar SKU</button></div></section>}

    <section className="panel"><div className="panel-head"><div><h3>Catálogo actual</h3><p>{rows.length} variantes registradas en la base.</p></div><div className="search p1p-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar producto, SKU, categoría..."/></div></div><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Marca</th><th>Variante</th><th>SKU</th><th>Costo</th><th>Precio</th><th>Stock</th><th>Mínimo</th><th>Acción</th></tr></thead><tbody>{filtered.length?filtered.map(x=><tr key={x.variante_id}><td><b>{x.producto}</b></td><td>{x.categoria}</td><td>{x.marca||'—'}</td><td>{x.variante||'—'}</td><td><strong>{x.sku}</strong></td><td>{money(x.costo)}</td><td>{money(x.precio_venta)}</td><td><span className={`p1p-stock ${Number(x.stock_actual)<=0?'zero':Number(x.stock_actual)<=Number(x.stock_minimo)?'low':''}`}>{Number(x.stock_actual)}</span></td><td>{Number(x.stock_minimo)}</td><td><button className="mini-btn restock" disabled={!admin} onClick={()=>openRestock(x)}><PackagePlus size={14}/>Resurtir</button></td></tr>):<tr><td colSpan="10" className="empty">{loading?'Cargando productos…':'No hay productos que coincidan.'}</td></tr>}</tbody></table></div></section>

    {restock&&<div className="p1p-modal-back"><section className="panel p1p-modal"><div className="panel-head"><div><h3>Resurtir producto existente</h3><p>{restock.producto} · {restock.sku}</p></div><button className="mini-btn" onClick={()=>setRestock(null)}><X size={15}/></button></div><div className="p1p-restock-info"><div><span>Stock actual</span><b>{Number(restock.stock_actual)}</b></div><div><span>Costo actual</span><b>{money(restock.costo)}</b></div><div><span>Nuevo stock</span><b>{Number(restock.stock_actual)+Number(rQty||0)}</b></div></div><div className="p1p-grid">
      <label>Cantidad comprada<input type="number" min="0.001" step="0.001" value={rQty} onChange={e=>setRQty(e.target.value)}/></label>
      <label>Costo unitario<input type="number" min="0" value={rCost} onChange={e=>setRCost(e.target.value)}/></label>
      <label>Origen / vendedor (opcional)<input value={rSeller} onChange={e=>setRSeller(e.target.value)} placeholder="Ej. San Andresito"/></label>
      <label>Documento (opcional)<input value={rDoc} onChange={e=>setRDoc(e.target.value)} placeholder="Factura / remisión"/></label>
      <label>Pagado ahora<input type="number" min="0" max={Number(rQty||0)*Number(rCost||0)} value={rPaid} onChange={e=>setRPaid(e.target.value)}/></label>
      {Number(rPaid)>0&&<label>Método<select value={rMethod} onChange={e=>setRMethod(e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select></label>}
      {Number(rPaid)<Number(rQty||0)*Number(rCost||0)&&<label>Vencimiento saldo<input type="datetime-local" value={rDue} onChange={e=>setRDue(e.target.value)}/></label>}
    </div><div className="p1p-total"><span>Total compra</span><b>{money(Number(rQty||0)*Number(rCost||0))}</b><span>Saldo por pagar</span><b>{money(Math.max(Number(rQty||0)*Number(rCost||0)-Number(rPaid||0),0))}</b></div><div className="p1p-footer"><button className="secondary" onClick={()=>setRestock(null)}>Cancelar</button><button className="primary" onClick={saveRestock}>Registrar compra y aumentar stock</button></div></section></div>}
  </div>
}
