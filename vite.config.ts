import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize production builds
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console statements in production
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        // Remove unused code
        dead_code: true,
        // Remove unreachable code
        conditionals: true,
      },
    },
    // Enable source maps for debugging in development
    sourcemap: mode === 'development',
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-toast'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
}));
