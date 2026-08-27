import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Los módulos funcionales ya se cargan con import() dinámico. Este límite
    // evita falsos positivos para vendors legítimos sin volver a unir la app.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // React separado del resto del ecosistema.
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
          if (id.includes('lucide-react')) return 'vendor-icons'

          // Supabase se divide por paquete para no generar un único vendor grande.
          if (id.includes('@supabase/auth-js')) return 'supabase-auth'
          if (id.includes('@supabase/postgrest-js')) return 'supabase-postgrest'
          if (id.includes('@supabase/realtime-js')) return 'supabase-realtime'
          if (id.includes('@supabase/storage-js')) return 'supabase-storage'
          if (id.includes('@supabase/functions-js')) return 'supabase-functions'
          if (id.includes('@supabase/supabase-js')) return 'supabase-core'
          if (id.includes('@supabase/node-fetch')) return 'supabase-fetch'

          return 'vendor'
        },
      },
    },
  },
})
