import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY')

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Electresid usa acceso por correo/contraseña, no OAuth ni magic links.
    // Desactivarlo evita trabajo innecesario de detección de sesión en la URL.
    detectSessionInUrl: false,
    // Nueva clave de almacenamiento para ignorar sesiones locales viejas/corruptas
    // que podían dejar un navegador concreto bloqueado en "esperando el sitio".
    storageKey: 'electresid-auth-v2',
  },
})
