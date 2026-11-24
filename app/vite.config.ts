import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Várias páginas (multi-page): a landing em React e as duas páginas legais, que são HTML puro
// e continuam nos mesmos endereços (/politica-de-privacidade.html e /termos-de-uso.html).
// As versões antigas (versao-anterior.html e versao-2.html) ficam em public/ e são copiadas como estão.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        privacidade: resolve(import.meta.dirname, 'politica-de-privacidade.html'),
        termos: resolve(import.meta.dirname, 'termos-de-uso.html'),
      },
    },
  },
  server: {
    // só para comparar lado a lado no desenvolvimento: /estatico/ mostra a versão de referência (site/),
    // servida em localhost:5510, na mesma origem que a versão React
    proxy: { '/estatico': { target: 'http://localhost:5510', rewrite: p => p.replace(/^\/estatico/, '') } },
  },
  preview: {
    proxy: { '/estatico': { target: 'http://localhost:5510', rewrite: p => p.replace(/^\/estatico/, '') } },
  },
})
