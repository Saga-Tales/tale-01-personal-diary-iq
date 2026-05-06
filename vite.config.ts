import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// repo 이름과 정확히 일치해야 함 (앞뒤 슬래시 필수)
const REPO_NAME = 'tale-01-personal-diary-iq'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: `/${REPO_NAME}/`,
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
