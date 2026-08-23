"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OVERVIEW_INTRO, OVERVIEW_POINTS } from "@/lib/content/overview-panel";

type Locale = "it" | "en";

export function OverviewPanel() {
  const [locale, setLocale] = useState<Locale>("en");

  return (
    <Card className="lg:sticky lg:top-5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Project Overview</CardTitle>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[locale]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "it" || next === "en") setLocale(next);
            }}
          >
            <ToggleGroupItem value="it" className="font-mono text-[11px]">
              IT
            </ToggleGroupItem>
            <ToggleGroupItem value="en" className="font-mono text-[11px]">
              EN
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
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
