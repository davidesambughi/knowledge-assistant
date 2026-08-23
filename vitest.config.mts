import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// Allinea l'alias "@/*" a tsconfig.json §paths — Vitest non lo risolve di default.
// Carica .env.local (Vitest, a differenza di Next.js, non lo fa automaticamente) —
// serve perché lib/env.ts valida process.env a import-time (Invariant #5).
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
  };
});
