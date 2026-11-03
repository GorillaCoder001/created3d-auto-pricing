import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:'/created3d-auto-pricing/',plugins:[react(),tailwindcss()],worker:{format:'es'},server:{allowedHosts:['terminal.local']},build:{target:'es2022',chunkSizeWarningLimit:800}});
