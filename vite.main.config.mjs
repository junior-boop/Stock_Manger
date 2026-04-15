import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    server: {
        cors: true,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      },
         build: {
        rollupOptions: {
          external: ['sqlite3', 'better-sqlite3']
        }
      }
});
