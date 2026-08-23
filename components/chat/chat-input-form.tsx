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
    <div className="flex flex-col gap-2 p-4 border-t border-border bg-card/50">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={!isReady}
          className="flex-1 font-sans text-sm bg-background border-border focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          type="submit"
          disabled={!isReady || input.trim().length === 0}
          size="icon"
          className="shrink-0"
        >
          <SendHorizontal className="size-4" />
          <span className="sr-only">{t("send")}</span>
        </Button>
      </form>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono px-1">
        <span>{t("footerCaption")}</span>
      </div>
    </div>
  );
}
