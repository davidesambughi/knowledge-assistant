"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isEmptyAssistantResponse, toChatRequestMessages } from "@/lib/chat/messages";
import { extractServerErrorMessage } from "@/lib/chat/ui-helpers";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { ChatMessageItem } from "@/components/chat/chat-message-item";
import { ChatInputForm } from "@/components/chat/chat-input-form";
import { OverviewPanel } from "@/components/overview/overview-panel";

export default function Home() {
  const t = useTranslations("Chat");
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages: toChatRequestMessages(messages) },
      }),
    }),
  });

  const lastMessage = messages[messages.length - 1];
  // error.message di useChat è il body grezzo della risposta non-2xx (JSON stringificato
  // per il formato { error: string } di route.ts) — 03i mostra quel messaggio reale
  // quando riconoscibile, con fallback sul generico esistente altrimenti.
  const serverErrorMessage = extractServerErrorMessage(error?.message);
  const showEmptyResponseError =
    status === "ready" && lastMessage !== undefined && isEmptyAssistantResponse(lastMessage);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (text.length === 0 || status !== "ready") return;
    sendMessage({ text });
    setInput("");
  }

  function handleSelectSampleQuery(query: string) {
    if (status !== "ready") return;
    sendMessage({ text: query });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 flex-1 max-w-6xl mx-auto w-full my-5 items-start">
      <div className="flex flex-col flex-1 w-full max-w-3xl mx-auto lg:mx-0 h-[calc(100vh-2.5rem)] border border-border bg-card rounded-xl shadow-xs overflow-hidden">
        <ChatHeader status={status} />

        <ScrollArea className="flex-1 px-4 py-4">
          {messages.length === 0 ? (
            <ChatEmptyState onSelectSampleQuery={handleSelectSampleQuery} />
          ) : (
            <div className="flex flex-col gap-4 py-2">
              {messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  parts={message.parts}
                  isLastMessage={message === lastMessage}
                  isStreaming={status === "streaming"}
                />
              ))}

              {error && (
                <p className="self-start max-w-[85%] rounded-lg bg-destructive/10 text-destructive px-3.5 py-2 text-xs font-sans">
                  {serverErrorMessage ?? t("streamError")}
                </p>
              )}
              {!error && showEmptyResponseError && (
                <p className="self-start max-w-[85%] rounded-lg bg-destructive/10 text-destructive px-3.5 py-2 text-xs font-sans">
                  {t("emptyResponseError")}
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <ChatInputForm
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isReady={status === "ready"}
        />
      </div>

      <div className="w-full max-w-3xl mx-auto lg:mx-0 lg:w-80 lg:shrink-0">
        <OverviewPanel />
      </div>
    </div>
  );
}
