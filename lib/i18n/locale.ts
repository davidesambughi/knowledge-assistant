// Costanti locale lette da i18n/request.ts (server, legge next/headers) — separate dal file
// server-only per convenzione (vedi 03b-chat-ui.md, bug scoperto in build). Da 03h-remove-locale-switch.md
// in poi la UI è fissa in inglese: nessun componente scrive più il cookie NEXT_LOCALE, quindi
// isSupportedLocale/il fallback su DEFAULT_LOCALE restano solo come guardia difensiva.
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}
