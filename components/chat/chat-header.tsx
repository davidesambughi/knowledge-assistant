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
    <header className="@container flex flex-col @sm:flex-row @sm:items-center justify-between gap-[clamp(0.5rem,1.5vw,0.75rem)] p-[clamp(0.75rem,2vw,1rem)] border-b border-indigo-700/40 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-xs">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold font-sans tracking-tight text-white">
            {t("title")}
          </h1>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-white/15 text-white border border-white/20 backdrop-blur-xs">
            <span
              className={`size-1.5 rounded-full ${
                status === "streaming" ? "bg-amber-300 animate-pulse" : "bg-emerald-400"
              }`}
            />
            {status === "streaming" ? "Streaming..." : "Ready"}
          </span>
        </div>
        <p className="text-xs text-white/80 font-mono">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[11px] font-mono gap-1 text-white border-white/25 bg-white/10 backdrop-blur-xs hover:bg-white/20">
          <Cpu className="size-3 text-white/90" />
          {t("badgeArchitecture")}
        </Badge>
        <Badge variant="secondary" className="text-[11px] font-mono gap-1 text-white bg-white/20 border border-white/30 backdrop-blur-xs hover:bg-white/30">
          <ShieldCheck className="size-3 text-emerald-300" />
          {t("badgeGrounding")}
        </Badge>
      </div>
    </header>
  );
}
