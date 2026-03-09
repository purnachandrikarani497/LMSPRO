import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        onError(err, req, res) {
          const msg = (err as NodeJS.ErrnoException)?.code === 'ECONNREFUSED'
            ? 'Backend unreachable. Run: cd backend && npm run dev'
            : (err as Error).message;
          if (!(res as import('http').ServerResponse).headersSent) {
            (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'text/plain' });
            (res as import('http').ServerResponse).end(msg);
          }
        },
      },
    },
  },
  hmr: {
    overlay: false,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
