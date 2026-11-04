import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://adam-mautz.github.io/hot-seat/
export default defineConfig({
  base: '/hot-seat/',
  plugins: [react()],
});
