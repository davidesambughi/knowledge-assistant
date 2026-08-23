"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Cpu } from "lucide-react";

interface ChatHeaderProps {
  status: "submitted" | "streaming" | "ready" | "error";
}

export function ChatHeader({ status }: ChatHeaderProps) {
  const t = useTranslations("Chat");

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-card/50">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold font-sans tracking-tight text-foreground">
            {t("title")}
          </h1>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted text-muted-foreground border border-border">
            <span
              className={`size-1.5 rounded-full ${
                status === "streaming" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
            {status === "streaming" ? "Streaming..." : "Ready"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[11px] font-mono gap-1 text-muted-foreground">
          <Cpu className="size-3 text-muted-foreground" />
          {t("badgeArchitecture")}
        </Badge>
        <Badge variant="secondary" className="text-[11px] font-mono gap-1 bg-muted text-foreground border border-border">
          <ShieldCheck className="size-3 text-emerald-500" />
          {t("badgeGrounding")}
        </Badge>
      </div>
    </header>
  );
}
