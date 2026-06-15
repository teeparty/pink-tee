import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // react-draggable (used by react-rnd) references `process.env.DRAGGABLE_DEBUG`
    // in its drag-start path, which throws "process is not defined" in the browser
    // and prevents windows from being dragged. Replace it with a literal so the
    // reference (and its dead `if` branch) is eliminated at build time.
    define: {
      'process.env.DRAGGABLE_DEBUG': 'false',
    },
    optimizeDeps: {
      rolldownOptions: {
        transform: {
          define: {
            'process.env.DRAGGABLE_DEBUG': 'false',
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
