import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'firebase-messaging-sw': resolve(__dirname, 'src/firebase-messaging-sw.js')
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'firebase-messaging-sw'
            ? 'firebase-messaging-sw.js'
            : 'assets/[name]-[hash].js'
      }
    }
  }
});
