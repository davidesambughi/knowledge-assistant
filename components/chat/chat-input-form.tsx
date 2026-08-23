"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SendHorizontal } from "lucide-react";

interface ChatInputFormProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  isReady: boolean;
}

export function ChatInputForm({
  input,
  setInput,
  onSubmit,
  isReady,
}: ChatInputFormProps) {
  const t = useTranslations("Chat");

  return (
    <div className="flex flex-col gap-2 p-[clamp(0.75rem,2vw,1rem)] border-t border-indigo-700/40 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-xs">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={!isReady}
          className="flex-1 min-h-11 font-sans text-sm font-medium bg-indigo-400/30 text-white placeholder:text-white/80 border border-white/40 shadow-inner focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:bg-indigo-400/45 backdrop-blur-md disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={!isReady || input.trim().length === 0}
          size="icon"
          className="shrink-0 min-h-11 min-w-11 bg-indigo-400/40 hover:bg-indigo-400/65 text-white border border-white/50 shadow-md backdrop-blur-md transition-all active:scale-95 disabled:opacity-35 disabled:border-white/20 disabled:shadow-none disabled:scale-100"
        >
          <SendHorizontal className="size-4 stroke-[2.2]" />
          <span className="sr-only">{t("send")}</span>
        </Button>
      </form>
      <div className="flex items-center justify-between text-[11px] text-white/80 font-mono px-1">
        <span>{t("footerCaption")}</span>
      </div>
    </div>
  );
}
