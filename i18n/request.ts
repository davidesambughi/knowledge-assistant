// Configurazione next-intl senza i18n routing (nessun [locale] nell'URL, nessun middleware —
// vedi 03b-chat-ui.md §Implementation punto 1): la lingua è letta da un cookie, non dal path.
// Server-only (next/headers) — le costanti condivise col client vivono in lib/i18n/locale.ts.
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE_NAME } from "@/lib/i18n/locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
