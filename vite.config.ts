import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://adam-mautz.github.io/cx-cloud-calendar/
export default defineConfig({
  base: '/cx-cloud-calendar/',
  plugins: [react()],
});
