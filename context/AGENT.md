# AGENTS.md

## Regola fondamentale: non fidarti del training, verifica la doc ufficiale (agosto 2026)

Vercel AI SDK, Supabase pgvector, le API OpenAI embeddings e next-intl possono aver ricevuto aggiornamenti (API, convenzioni, default) successivi al training data dell'agente. **Non affidarti alla sola memoria per queste librerie.** Prima di implementare pattern di streaming, retrieval, chiamate embedding o setup i18n, verifica sempre la documentazione ufficiale **aggiornata ad agosto 2026** — non la prima versione che trovi, e non fidarti di una data implicita:

- Vercel AI SDK → sdk.vercel.ai
- Supabase / pgvector → supabase.com/docs
- OpenAI embeddings → platform.openai.com/docs
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
