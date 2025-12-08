import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        open: true
    },
    publicDir: 'public',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        chunkSizeWarningLimit: 1000,
        copyPublicDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                album: path.resolve(__dirname, 'album.html')
            },
            output: {
                manualChunks: {
                    'three': ['three'],
                    'react-three': ['@react-three/fiber', '@react-three/drei'],
                    'react-vendor': ['react', 'react-dom']
                }
            }
        }
    }
})
