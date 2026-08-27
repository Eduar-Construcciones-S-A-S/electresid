# Electresid POS

Sistema web para Electresid: punto de venta, inventario, clientes, caja, gastos, reparaciones y reportes.

## Stack
- React + Vite
- Supabase Auth + PostgreSQL + RLS
- Impresión web optimizada para ticket térmico POS de 80 mm

## Configuración local
1. Copia `.env.example` como `.env`.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. Registra el primer usuario desde la pantalla inicial. El primer usuario queda como administrador.

## Supabase
Proyecto dedicado: `electresid` (`zcigcirmoskcuvnjdwuk`). La base de datos es independiente de los otros proyectos de la organización.

La aplicación usa la clave `publishable` de Supabase en el frontend. No se utiliza `service_role` en el navegador.

## Facturas / tickets
El módulo POS imprime un comprobante interno con CSS físico de `80mm`, compatible con impresoras térmicas POS estándar controladas por el navegador y el sistema operativo. Para el corte automático, instala el driver de la impresora y activa el corte de papel al final del trabajo.

> Este comprobante es un recibo/factura interna de venta y no implementa facturación electrónica DIAN.

## Módulos incluidos
- Dashboard
- Punto de venta
- Productos y SKU
- Inventario y movimientos
- Reparaciones
- Clientes
- Caja
- Gastos
- Reportes
- Configuración del negocio
