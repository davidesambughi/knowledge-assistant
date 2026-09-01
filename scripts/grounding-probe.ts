// Sonda di grounding per /api/chat — SOLO per testare in locale.
//
// Costruisce conversazioni multi-turno esatte e le manda all'endpoint, stampando la risposta
// in streaming. Serve a testare i casi che nella chat UI sono scomodi o impossibili:
//  - conversazioni molto profonde (test "il grounding regge in profondità?")
//  - context poisoning (turni assistant FABBRICATI che affermano fatti falsi)
//  - prompt injection multi-turno
//  - leak del system prompt
//
// Due formati di file scenario (JSON):
//  1. { "messages": [ { "role": "user"|"assistant", "content": "..." }, ... ] }
//     → inviato in un colpo solo. Usalo per il poisoning: puoi inserire risposte assistant
//       finte nella history.
//  2. { "turns": [ "domanda 1", "domanda 2", ... ] }
//     → conversazione reale: ogni domanda è inviata con la history dei turni precedenti +
//       le risposte VERE del modello accumulate. Usalo per i test di profondità.
//
// Uso:
//   npm run probe -- scripts/scenarios/<file>.json
//   npm run probe -- scripts/scenarios/<file>.json --json   (output grezzo, per confronto)

import { readFileSync } from "node:fs";

const API_URL = process.env.PROBE_API_URL ?? "http://localhost:3000/api/chat";

type Msg = { role: "user" | "assistant"; content: string };

// Manda una lista di messaggi all'endpoint e ritorna il testo completo della risposta.
// Il protocollo è text-stream puro (createTextStreamResponse) — il body è già il testo.
async function send(messages: Msg[]): Promise<{ status: number; text: string }> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const text = await res.text();
  return { status: res.status, text };
}

function printExchange(label: string, userText: string, status: number, answer: string) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`▶ ${label}: ${userText}`);
  console.log(`  [HTTP ${status}]`);
  console.log(`${"─".repeat(70)}`);
  console.log(answer.trim());
}

async function runMessages(messages: Msg[], raw: boolean) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const { status, text } = await send(messages);
  if (raw) {
    console.log(JSON.stringify({ status, text }, null, 2));
    return;
  }
  printExchange("single-shot", lastUser?.content ?? "(nessun messaggio utente)", status, text);
}

async function runTurns(turns: string[], raw: boolean) {
  const history: Msg[] = [];
  for (let i = 0; i < turns.length; i++) {
    history.push({ role: "user", content: turns[i] });
    const { status, text } = await send(history);
    if (raw) {
      console.log(JSON.stringify({ turn: i + 1, status, text }, null, 2));
    } else {
      printExchange(`turno ${i + 1}/${turns.length}`, turns[i], status, text);
    }
    // Accumula la risposta VERA come contesto per il turno successivo (conversazione reale).
    history.push({ role: "assistant", content: text.trim() || "(risposta vuota)" });

    if (status === 429) {
      console.error("\n⚠ Rate limit colpito — esegui `npm run ratelimit:reset` e riprova.");
      process.exit(1);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const raw = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error("Uso: npm run probe -- scripts/scenarios/<file>.json [--json]");
    process.exit(1);
  }

  const scenario = JSON.parse(readFileSync(file, "utf8"));

  if (Array.isArray(scenario.turns)) {
    await runTurns(scenario.turns, raw);
  } else if (Array.isArray(scenario.messages)) {
    await runMessages(scenario.messages, raw);
  } else {
    console.error('Scenario non valido: serve una chiave "turns" (string[]) o "messages" (Msg[]).');
    process.exit(1);
  }
}

main();
