"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OVERVIEW_INTRO, OVERVIEW_POINTS } from "@/lib/content/overview-panel";

type Locale = "it" | "en";

export function OverviewPanel() {
  const [locale, setLocale] = useState<Locale>("en");

  return (
    <Card className="@container h-full flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs pt-0">
      <CardHeader className="p-[clamp(0.75rem,2vw,1.25rem)] border-b border-indigo-700/40 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-xs">
        <div className="flex flex-col @xs:flex-row @xs:items-center justify-between gap-2 @xs:gap-3">
          <CardTitle className="text-base font-semibold font-sans text-white">Project Overview</CardTitle>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[locale]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "it" || next === "en") setLocale(next);
            }}
            className="self-start @xs:self-auto shrink-0 bg-black/25 border border-white/30 rounded-md p-0.5"
          >
            <ToggleGroupItem
              value="it"
              className={`font-mono text-[11px] font-bold px-2.5 py-1 border-none rounded-sm transition-all ${
                locale === "it"
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/20"
              }`}
            >
              IT
            </ToggleGroupItem>
            <ToggleGroupItem
              value="en"
              className={`font-mono text-[11px] font-bold px-2.5 py-1 border-none rounded-sm transition-all ${
                locale === "en"
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-white/80 hover:text-white hover:bg-white/20"
              }`}
            >
              EN
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-[clamp(0.75rem,2vw,1.25rem)] flex flex-col gap-[clamp(0.75rem,2vw,1.25rem)] overflow-y-auto">
        <p className="text-xs text-muted-foreground leading-relaxed font-sans">
          {OVERVIEW_INTRO[locale]}
        </p>

        <ul className="flex flex-col gap-3">
          {OVERVIEW_POINTS.map((point) => (
            <li key={point.id} className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold font-sans text-foreground">
                {point[locale].label}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed font-sans">
                {point[locale].description}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
