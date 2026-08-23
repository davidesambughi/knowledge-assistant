"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, ShieldQuestion, FileText, ArrowUpRight } from "lucide-react";

interface ChatEmptyStateProps {
  onSelectSampleQuery: (query: string) => void;
}

export function ChatEmptyState({ onSelectSampleQuery }: ChatEmptyStateProps) {
  const t = useTranslations("Chat");

  const sampleQueries = [
    {
      text: t("sampleQuery1"),
      isGuardrail: false,
      icon: FlaskConical,
    },
    {
      text: t("sampleQuery2"),
      isGuardrail: false,
      icon: FlaskConical,
    },
    {
      text: t("sampleQuery3"),
      isGuardrail: true,
      icon: ShieldQuestion,
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-[clamp(1rem,3vw,2rem)] px-[clamp(0.75rem,2vw,1.5rem)] text-center max-w-xl mx-auto my-auto gap-[clamp(1rem,2.5vw,1.5rem)]">
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 rounded-xl bg-muted border border-border text-foreground">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold font-sans text-foreground">
          {t("welcomeTitle")}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed font-sans">
          {t("welcomeDescription")}
        </p>
      </div>

      <div className="w-full flex flex-col gap-2.5 text-left">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
          {t("sampleQueriesHeader")}
        </span>
        <div className="grid gap-2">
          {sampleQueries.map((query, index) => {
            const Icon = query.icon;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelectSampleQuery(query.text)}
                className="group flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors text-left text-xs font-sans text-foreground"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`size-4 shrink-0 ${
                      query.isGuardrail ? "text-amber-500" : "text-primary"
                    }`}
                  />
                  <span className="truncate">{query.text}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {query.isGuardrail && (
                    <Badge variant="outline" className="text-[10px] font-mono py-0 text-amber-500 border-amber-500/30">
                      {t("guardrailTestBadge")}
                    </Badge>
                  )}
                  <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
