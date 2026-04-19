import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; 
import tailwindcss from '@tailwindcss/vite'
// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        react(), 
        tailwindcss(), 
      ], 
      server: {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      },
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
        },
      },
      build: {
        rollupOptions: {
          external: ['better-sqlite3']
        }
      },
});
