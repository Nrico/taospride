import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // PHP_SERVER: set this env var to route /api calls to a local PHP server
  // instead of the built-in Node.js dev server.
  //   PHP_SERVER=http://localhost:8888  npm run dev:php
  // Leave unset to use the default Node.js server (npm run dev).
  const phpServer = env.PHP_SERVER;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          board: path.resolve(__dirname, 'board/index.html'),
          gallery: path.resolve(__dirname, 'gallery/index.html'),
        },
      },
    },
    server: {
      // HMR config — disabled in AI Studio to avoid flickering during edits.
      hmr: process.env.DISABLE_HMR !== 'true',

      // Proxy /api to a local PHP server when PHP_SERVER is set.
      // Example MAMP:    PHP_SERVER=http://localhost:8888
      // Example XAMPP:   PHP_SERVER=http://localhost:80
      // Example Laragon: PHP_SERVER=http://taospride.test
      ...(phpServer ? {
        proxy: {
          '/api': {
            target: phpServer,
            changeOrigin: true,
            secure: false,
          },
        },
      } : {}),
    },
  };
});
