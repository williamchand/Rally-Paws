import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy target for the FastAPI backend. Override when it runs elsewhere:
//   COACH_API_BASE=http://192.168.1.10:8000 npm run dev
const backend = process.env.COACH_API_BASE || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/health': { target: backend, changeOrigin: true },
    },
  },
});
