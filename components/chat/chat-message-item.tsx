"use client";

import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { isGuardrailRefusal } from "@/lib/chat/ui-helpers";
import { ShieldCheck, User, Bot } from "lucide-react";

interface UIMessagePart {
  type: string;
  text?: string;
}

interface UIMessageProps {
  role: "user" | "assistant" | "system";
  parts: UIMessagePart[];
  isLastMessage: boolean;
  isStreaming: boolean;
}

export function ChatMessageItem({
  role,
  parts,
  isLastMessage,
  isStreaming,
}: UIMessageProps) {
  const t = useTranslations("Chat");

  const text = parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");

  const isRefusal = role === "assistant" && isGuardrailRefusal(text);

  if (role === "user") {
    return (
      <div className="flex items-start gap-2.5 self-end max-w-[92%] sm:max-w-[85%]">
        <div className="flex flex-col gap-1 items-end">
          <div className="rounded-2xl rounded-tr-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-[clamp(0.75rem,2vw,1rem)] py-[clamp(0.5rem,1.5vw,0.625rem)] text-sm font-sans whitespace-pre-wrap shadow-xs">
            {text}
          </div>
        </div>
        <div className="size-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
          <User className="size-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 self-start max-w-[95%] sm:max-w-[88%]">
      <div className="size-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
        <Bot className="size-4" />
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {isRefusal ? (
          <div className="rounded-xl bg-muted/80 border border-border text-muted-foreground p-[clamp(0.75rem,2vw,0.875rem)] text-xs font-sans leading-relaxed space-y-1.5 shadow-xs">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-foreground">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>{t("guardrailCalloutTitle")}</span>
            </div>
            <p className="text-muted-foreground">{text}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-xs bg-muted/80 border border-border text-foreground p-[clamp(0.75rem,2vw,1rem)] text-sm font-sans shadow-xs [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-2 [&_h2]:mt-2 [&_h3]:mt-2 [&_code]:font-mono [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:font-mono [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:my-2">
            <ReactMarkdown>{text}</ReactMarkdown>
            {isLastMessage && isStreaming && (
              <span aria-hidden className="ml-1 text-primary animate-pulse inline-block font-mono">
                ▋
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
