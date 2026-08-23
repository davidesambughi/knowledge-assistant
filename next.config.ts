import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Nessun path esplicito: risolve al default `./i18n/request.ts` (progetto senza `src/`,
// verificato in node_modules/next-intl/dist/esm/*/plugin/getNextConfig.js).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
