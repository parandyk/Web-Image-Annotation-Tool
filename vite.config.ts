import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // base: '/Web-Image-Annotation-Tool/',
  base: process.env.VITE_BASE_PATH || '/Web-Image-Annotation-Tool/',
  plugins: [react()],
});
