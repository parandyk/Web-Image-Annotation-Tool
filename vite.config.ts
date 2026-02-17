import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // base: '/Web-Image-Annotation-Tool/',
  base: '/Web-Image-Annotation-Tool/neural',
  // base: process.env.VITE_BASE_PATH || '/Web-Image-Annotation-Tool/neural',
  plugins: [react()],
});
