"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatTime } from "@/lib/labels";
import { formatTokens, formatUsd } from "@/lib/mock/usage";
import { useAppStore } from "@/stores/app.store";

export function UsagePanel() {
  const activeRun = useAppStore((s) => s.activeRun);
  const usage = activeRun?.usage;

  if (!usage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token & chi phí</CardTitle>
          <CardDescription>
            Log mock theo README §9.2 — token + wall-clock sau mỗi TaskRun.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Token & chi phí</CardTitle>
        <CardDescription>
          Model mock · structured usage log (prompt / completion / USD / latency)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-muted/50 rounded-lg p-2.5">
            <p className="text-muted-foreground text-xs">Total tokens</p>
            <p className="font-semibold">{formatTokens(usage.totalTokens)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5">
            <p className="text-muted-foreground text-xs">Cost (USD)</p>
            <p className="font-semibold">{formatUsd(usage.costUsd)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5">
            <p className="text-muted-foreground text-xs">Prompt / Completion</p>
            <p className="font-semibold text-xs">
              {formatTokens(usage.promptTokens)} /{" "}
              {formatTokens(usage.completionTokens)}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5">
            <p className="text-muted-foreground text-xs">Wall-clock</p>
            <p className="font-semibold">
              {(usage.wallClockMs / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[180px] pr-2">
          <ul className="space-y-2">
            {usage.events.map((ev) => (
              <li key={ev.id} className="rounded-md border px-2.5 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {ev.kind}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {ev.agentRole}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatTime(ev.at)}
                  </span>
                </div>
                <p className="mt-1 font-medium">{ev.label}</p>
                <p className="text-muted-foreground mt-0.5">
                  {formatTokens(ev.usage.totalTokens)} tok ·{" "}
                  {formatUsd(ev.usage.costUsd)} · {ev.usage.latencyMs}ms ·{" "}
                  {ev.usage.model}
                </p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
