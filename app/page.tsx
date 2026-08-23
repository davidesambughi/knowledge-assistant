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
  const [mobileTab, setMobileTab] = useState<"chat" | "overview">("chat");

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
    <div className="flex flex-col lg:flex-row gap-[clamp(0.75rem,2vw,1.5rem)] flex-1 max-w-7xl mx-auto w-full p-[clamp(0.625rem,2vw,1.25rem)] min-h-dvh items-stretch">
      {/* Segmented Control per schermi mobile (< lg) */}
      <div className="flex lg:hidden w-full p-1 bg-muted/80 rounded-lg border border-border shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-medium transition-colors ${
            mobileTab === "chat"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Assistant Chat
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("overview")}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-medium transition-colors ${
            mobileTab === "overview"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview Panel
        </button>
      </div>

      {/* Colonna Chat */}
      <div
        className={`flex flex-col flex-1 w-full max-w-4xl mx-auto lg:mx-0 h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-2.5rem)] border border-border bg-card rounded-xl shadow-xs overflow-hidden ${
          mobileTab === "chat" ? "flex" : "hidden lg:flex"
        }`}
      >
        <ChatHeader status={status} />

        <ScrollArea className="flex-1 px-[clamp(0.75rem,2vw,1.25rem)] py-[clamp(0.75rem,2vw,1.25rem)]">
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

      {/* Colonna Overview Panel */}
      <div
        className={`w-full max-w-4xl mx-auto lg:mx-0 lg:w-80 xl:w-90 lg:shrink-0 h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-2.5rem)] overflow-y-auto rounded-xl ${
          mobileTab === "overview" ? "block" : "hidden lg:block"
        }`}
      >
        <OverviewPanel />
      </div>
    </div>
  );
}
