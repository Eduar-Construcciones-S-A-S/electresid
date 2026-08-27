import { useEffect, useMemo, useState } from 'react'
import { Plus, Printer, ReceiptText, RotateCcw, Search, ShoppingCart, Wallet, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import Phase3POS from './Phase3POS'
import './phase3-pos.css'

const money=(n=0)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n)||0)
const methods=['efectivo','tarjeta','transferencia','nequi','daviplata','otro']

export default function Phase3POSPatched({initialTab='pos'}){
  const[tab,setTab]=useState(initialTab)
  useEffect(()=>setTab(initialTab),[initialTab])
  if(tab!=='pos') return <Phase3POS initialTab={tab}/>
  return <div className="p3"><section className="panel p3-shell"><div className="p3-head"><div><h2>Fase 3 · POS</h2><p>Carrito, ventas, facturación, pagos, devoluciones, caja y cierre.</p></div></div><div className="p3-tabs"><button className="active" onClick={()=>setTab('pos')}><ShoppingCart size={16}/>Punto de venta</button><button onClick={()=>setTab('ventas')}><ReceiptText size={16}/>Ventas</button><button onClick={()=>setTab('devoluciones')}><RotateCcw size={16}/>Devoluciones</button><button onClick={()=>setTab('caja')}><Wallet size={16}/>Caja</button></div><FixedPOS/></section></div>
}

function FixedPOS(){
  const[items,setItems]=useState([]),[clients,setClients]=useState([]),[q,setQ]=useState(''),[cart,setCart]=useState([]),[discount,setDiscount]=useState(0),[payments,setPayments]=useState([{metodo:'efectivo',valor:'',recibido:'',referencia:''}]),[cash,setCash]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[last,setLast]=useState(null),[loading,setLoading]=useState(true)
  const[buyerMode,setBuyerMode]=useState('final'),[client,setClient]=useState(''),[buyerName,setBuyerName]=useState(''),[buyerDoc,setBuyerDoc]=useState(''),[buyerDocType,setBuyerDocType]=useState('cc')

  const load=async()=>{
    setLoading(true);setMsg('')
    const [v,s,c,ca]=await Promise.all([
      supabase.from('variantes').select('id,sku,codigo_barras,nombre,precio_venta,activo,producto:productos(nombre)').eq('activo',true).limit(800),
      supabase.from('stock_actual').select('variante_id,stock'),
      supabase.from('clientes').select('id,nombre,documento').order('nombre'),
      supabase.rpc('caja_abierta_usuario')
    ])
    const err=[v,s,c,ca].find(x=>x.error)?.error
    if(err){setMsg(`No se pudieron cargar los productos: ${err.message}`);setItems([])}
    else{
      const stockMap=Object.fromEntries((s.data||[]).map(x=>[x.variante_id,Number(x.stock||0)]))
      setItems((v.data||[]).map(x=>({...x,stock_actual:stockMap[x.id]||0})))
      setClients(c.data||[]);setCash(ca.data||null)
    }
    setLoading(false)
  }
  useEffect(()=>{load()},[])

  const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return items.filter(x=>!s||(x.sku||'').toLowerCase().includes(s)||(x.codigo_barras||'').toLowerCase().includes(s)||(x.producto?.nombre||'').toLowerCase().includes(s)||(x.nombre||'').toLowerCase().includes(s)).slice(0,100)},[items,q])
  const subtotal=cart.reduce((a,x)=>a+Number(x.precio_venta)*x.qty,0),total=Math.max(subtotal-Number(discount||0),0),paid=payments.reduce((a,p)=>a+Number(p.valor||0),0)
  useEffect(()=>{if(payments.length===1)setPayments(p=>[{...p[0],valor:String(total||'')}])},[total])

  const add=x=>{const stock=Number(x.stock_actual||0);if(stock<=0){setMsg('Este producto está agotado. Resúrtelo antes de vender.');return}setCart(c=>{const old=c.find(y=>y.id===x.id),next=(old?.qty||0)+1;if(next>stock){setMsg('No hay más unidades disponibles de este producto.');return c}setMsg('');return old?c.map(y=>y.id===x.id?{...y,qty:next}:y):[...c,{...x,qty:1}]})}
  const updateQty=(id,n)=>setCart(c=>c.map(x=>x.id===id?{...x,qty:Math.max(1,Math.min(Number(x.stock_actual||0),n||1))}:x))
  const setPay=(idx,key,val)=>setPayments(p=>p.map((x,i)=>i===idx?{...x,[key]:val}:x))
  const addPayment=()=>setPayments(p=>[...p,{metodo:'transferencia',valor:'',recibido:'',referencia:''}])
  const resetBuyer=()=>{setBuyerMode('final');setClient('');setBuyerName('');setBuyerDoc('');setBuyerDocType('cc')}

  const sell=async()=>{
    setMsg('')
    if(!cash)return setMsg('Debes abrir caja antes de vender.')
    if(!cart.length)return setMsg('El carrito está vacío.')
    if(total<=0)return setMsg('El total de la venta debe ser mayor a cero.')
    if(buyerMode==='registered'&&!client)return setMsg('Selecciona el cliente registrado.')
    if(buyerMode==='manual'&&!buyerName.trim()&&!buyerDoc.trim())return setMsg('Escribe al menos el nombre/razón social o el documento del comprador.')
    if(Math.round(paid)!==Math.round(total))return setMsg('Los métodos de pago deben sumar exactamente el total.')
    for(const p of payments){if(Number(p.valor||0)<=0)continue;if(p.metodo==='efectivo'&&Number(p.recibido||p.valor)<Number(p.valor))return setMsg('El efectivo recibido no puede ser menor al valor aplicado.')}
    setBusy(true)
    const payload=payments.filter(p=>Number(p.valor)>0).map(p=>({metodo:p.metodo,valor:Number(p.valor),recibido:p.metodo==='efectivo'?Number(p.recibido||p.valor):Number(p.valor),referencia:p.referencia||null}))
    const{data,error}=await supabase.rpc('registrar_venta_con_comprador',{
      p_items:cart.map(x=>({variante_id:x.id,cantidad:x.qty})),p_pagos:payload,
      p_cliente_id:buyerMode==='registered'?client:null,p_caja_id:cash,p_descuento:Number(discount||0),p_observacion:null,
      p_comprador_nombre:buyerMode==='manual'?(buyerName.trim()||null):null,
      p_comprador_documento:buyerMode==='manual'?(buyerDoc.trim()||null):null,
      p_comprador_tipo_documento:buyerMode==='manual'&&buyerDoc.trim()?buyerDocType:null
    })
    if(error)setMsg(error.message)
    else{
      const{data:v,error:ve}=await supabase.from('ventas').select('*,cliente:clientes(*),detalle_ventas(*),pagos_venta(*)').eq('id',data).single()
      if(ve)setMsg(`Venta registrada, pero no se pudo cargar el comprobante: ${ve.message}`)
      else{setLast(v);setMsg(`Venta #${v.numero} registrada correctamente.`)}
      setCart([]);setDiscount(0);setPayments([{metodo:'efectivo',valor:'',recibido:'',referencia:''}]);resetBuyer();await load()
    }
    setBusy(false)
  }

  return <div className="p3-pos"><div className="p3-status"><span className={cash?'ok':'bad'}>{cash?'Caja abierta':'Caja cerrada'}</span><span>Subtotal {money(subtotal)}</span><span>Descuento {money(discount)}</span><strong>Total {money(total)}</strong></div>{msg&&<div className="notice">{msg}</div>}<div className="p3-pos-grid"><section><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre, SKU o código de barras..." autoFocus/></div>{loading&&<div className="notice">Cargando productos…</div>}<div className="p3-products">{filtered.map(x=><button key={x.id} className="p3-product" onClick={()=>add(x)} disabled={Number(x.stock_actual)<=0}><ShoppingCart size={17}/><b>{x.producto?.nombre}</b><span>{x.nombre||'Sin variante'}</span><small>{x.sku} · Stock {x.stock_actual}</small><strong>{money(x.precio_venta)}</strong></button>)}</div>{!loading&&q&&filtered.length===0&&<div className="notice">No se encontró ningún producto con ese nombre, SKU o código de barras.</div>}</section><aside className="p3-cart"><h3>Carrito</h3>
    <label className="p3-field"><span>Comprador</span><select value={buyerMode} onChange={e=>{setBuyerMode(e.target.value);setClient('');setBuyerName('');setBuyerDoc('')}}><option value="final">Consumidor final</option><option value="registered">Cliente registrado</option><option value="manual">Datos solo para esta venta</option></select></label>
    {buyerMode==='registered'&&<label className="p3-field"><span>Cliente registrado</span><select value={client} onChange={e=>setClient(e.target.value)}><option value="">Selecciona cliente...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.documento?` · ${c.documento}`:''}</option>)}</select></label>}
    {buyerMode==='manual'&&<div className="p3-buyer-manual"><label className="p3-field"><span>Nombre / razón social</span><input value={buyerName} onChange={e=>setBuyerName(e.target.value)} placeholder="Persona o empresa (opcional)"/></label><div className="p3-payment"><select value={buyerDocType} onChange={e=>setBuyerDocType(e.target.value)}><option value="cc">Cédula</option><option value="nit">NIT</option><option value="ce">Cédula extranjería</option><option value="pasaporte">Pasaporte</option><option value="otro">Otro</option></select><input value={buyerDoc} onChange={e=>setBuyerDoc(e.target.value)} placeholder={buyerDocType==='nit'?'NIT':'Número de documento'}/></div><small>Estos datos se guardan únicamente en la venta; no crean un cliente.</small></div>}
    <div className="p3-cart-list">{cart.map(x=><div className="p3-cart-row" key={x.id}><div><b>{x.producto?.nombre}</b><span>{x.nombre||x.sku}</span></div><input type="number" min="1" max={x.stock_actual} value={x.qty} onChange={e=>updateQty(x.id,Number(e.target.value))}/><strong>{money(x.qty*x.precio_venta)}</strong><button onClick={()=>setCart(c=>c.filter(y=>y.id!==x.id))}><X size={15}/></button></div>)}</div><label className="p3-field"><span>Descuento general</span><input type="number" min="0" max={subtotal} value={discount} onChange={e=>setDiscount(e.target.value)}/></label><div className="p3-total"><span>Total</span><b>{money(total)}</b></div><h4>Métodos de pago</h4>{payments.map((p,i)=><div className="p3-payment" key={i}><select value={p.metodo} onChange={e=>setPay(i,'metodo',e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select><input type="number" min="0" value={p.valor} onChange={e=>setPay(i,'valor',e.target.value)} placeholder="Valor aplicado"/>{p.metodo==='efectivo'&&<input type="number" min="0" value={p.recibido} onChange={e=>setPay(i,'recibido',e.target.value)} placeholder="Efectivo recibido"/>}<input value={p.referencia} onChange={e=>setPay(i,'referencia',e.target.value)} placeholder="Referencia opcional"/>{payments.length>1&&<button onClick={()=>setPayments(ps=>ps.filter((_,j)=>j!==i))}><X size={15}/></button>}</div>)}<button className="secondary compact" onClick={addPayment}><Plus size={15}/>Dividir pago</button><div className="p3-pay-summary"><span>Pagado: <b>{money(paid)}</b></span><span>Falta: <b>{money(Math.max(total-paid,0))}</b></span>{payments.filter(p=>p.metodo==='efectivo').map((p,i)=><span key={i}>Cambio: <b>{money(Math.max(Number(p.recibido||0)-Number(p.valor||0),0))}</b></span>)}</div><button className="primary full" disabled={busy||!cart.length||!cash} onClick={sell}>{busy?'Procesando...':'Cobrar venta'}</button>{last&&<button className="secondary full" onClick={()=>printTicket(last)}><Printer size={16}/>Imprimir factura 80 mm</button>}</aside></div></div>
}

function buyerText(sale){if(sale.cliente)return `${sale.cliente.nombre||'Cliente'}${sale.cliente.documento?` · ${sale.cliente.documento}`:''}`;if(sale.comprador_nombre||sale.comprador_documento){const type=sale.comprador_tipo_documento?String(sale.comprador_tipo_documento).toUpperCase():'';return `${sale.comprador_nombre||''}${sale.comprador_nombre&&sale.comprador_documento?' · ':''}${sale.comprador_documento?`${type} ${sale.comprador_documento}`:''}`.trim()}return 'Consumidor final'}
function printTicket(sale){const win=window.open('','ticket','width=430,height=720');if(!win)return;const rows=(sale.detalle_ventas||[]).map(i=>`<tr><td>${i.descripcion}<br><small>${i.cantidad} x ${money(i.precio_unitario)}</small></td><td>${money(i.subtotal)}</td></tr>`).join('');win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Factura ${sale.numero}</title><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;font-family:Arial,sans-serif;font-size:11px;color:#000}header{text-align:center;border-bottom:1px dashed #000;padding-bottom:7px}h1{font-family:Georgia,serif;font-style:italic;font-size:24px;margin:0}table{width:100%;border-collapse:collapse;margin:8px 0}td{padding:5px 0;border-bottom:1px dotted #bbb;vertical-align:top}td:last-child{text-align:right}.tot{text-align:right;font-size:16px;font-weight:800;border-top:2px solid #000;padding-top:8px}.foot{text-align:center;border-top:1px dashed #000;margin-top:10px;padding-top:8px}</style></head><body><header><h1>Electresid</h1><b>SERVICIO TÉCNICO</b><div>CELULARES · COMPUTADORES · CONSOLAS</div></header><p><b>Factura interna #${sale.numero}</b><br>${new Date(sale.created_at).toLocaleString('es-CO')}<br><b>Cliente:</b> ${buyerText(sale)}</p><table>${rows}</table><div class="tot">TOTAL: ${money(sale.total)}</div><p>Pago: ${(sale.pagos_venta||[]).map(p=>`${p.metodo}: ${money(p.valor)}`).join(' + ')}</p><div class="foot">Gracias por confiar en Electresid.<br>Documento interno de venta · No es factura electrónica.</div><script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close()}
