# AGENTS.md

## Regola fondamentale: non fidarti del training, verifica la doc ufficiale (agosto 2026)

Vercel AI SDK, Supabase pgvector, le API Gemini (embeddings e generazione) e next-intl possono aver ricevuto aggiornamenti (API, convenzioni, default) successivi al training data dell'agente. **Non affidarti alla sola memoria per queste librerie.** Prima di implementare pattern di streaming, retrieval, chiamate embedding/generazione o setup i18n, verifica sempre la documentazione ufficiale **aggiornata ad agosto 2026** — non la prima versione che trovi, e non fidarti di una data implicita:

- Vercel AI SDK → sdk.vercel.ai
- Vercel AI SDK, provider Google → ai.google.dev/gemini-api/docs/vercel-ai-sdk-example (usato in `03a`, non ancora verificato — vedi `progress-tracker.md`)
- Supabase / pgvector → supabase.com/docs
- Gemini embeddings/generazione → ai.google.dev/api (**provider cambiato da OpenAI dopo `01b`** — vedi `progress-tracker.md` §Architecture Decisions; i rate limit del free tier vanno verificati su AI Studio, non sui doc pubblici, che Google stessa segnala come non garantiti)
- next-intl → next-intl.dev

Questa regola vale per ogni step di implementazione, non solo per il setup iniziale.

## Reading Order

Leggi in ordine ora e prima di implementare o prendere decisioni architetturali:

1. `context/project-overview.md` — problema, scope, cosa costruiamo/non costruiamo, constraints
2. `context/architecture-context.md` — stack, storage model, invariants
3. `context/tech-spec.md` — data models, feature specs, env vars
4. `context/progress-tracker.md` — stato attuale, prossimi step, domande aperte

## Rules

- Il modello risponde SOLO dal contesto recuperato — mai da conoscenza propria. Nessuna eccezione.
- Aggiorna `progress-tracker.md` dopo ogni modifica implementativa significativa.
- Se un requisito è ambiguo o mancante, loggalo come open question in `progress-tracker.md` — non inventare comportamento.
- Non modificare `components/ui/*` (shadcn/ui) a meno che un task lo richieda esplicitamente.
