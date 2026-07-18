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
import { AGENT_LABEL, formatTime, statusLabel, statusVariant } from "@/lib/labels";
import { formatTokens, formatUsd } from "@/lib/mock/usage";
import { useAppStore } from "@/stores/app.store";

export function TraceTimeline() {
  const activeRun = useAppStore((s) => s.activeRun);

  if (!activeRun) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Dòng thời gian / Truy vết</CardTitle>
          <CardDescription>
            Gọi công cụ, trích dẫn, token/độ trễ — gửi yêu cầu để xem.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const events = activeRun.steps.flatMap((step) => {
    const rows: {
      key: string;
      title: string;
      detail: string;
      time?: string;
      kind: "step" | "tool" | "citation" | "usage";
    }[] = [
      {
        key: `${step.id}-status`,
        title: `${AGENT_LABEL[step.agentRole]} · ${statusLabel(step.status)}`,
        detail: step.label,
        time: step.startedAt ?? step.finishedAt,
        kind: "step",
      },
    ];
    if (step.usage) {
      rows.push({
        key: `${step.id}-usage`,
        title: `Token · ${formatTokens(step.usage.totalTokens)}`,
        detail: `${formatUsd(step.usage.costUsd)} · ${step.usage.latencyMs}ms · ${step.usage.model}`,
        kind: "usage",
      });
    }
    for (const tc of step.toolCalls) {
      rows.push({
        key: tc.id,
        title: `${tc.tool} (${tc.mcp})`,
        detail: `${tc.mutates ? "có tác động hệ thống · " : ""}${tc.latencyMs ?? "—"} ms`,
        kind: "tool",
      });
    }
    for (const c of step.citations) {
      rows.push({
        key: `${step.id}-${c.sourceDoc}-${c.section}`,
        title: c.sourceDoc,
        detail: `${c.section} · điểm ${c.score.toFixed(2)}`,
        kind: "citation",
      });
    }
    return rows;
  });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Dòng thời gian / Truy vết</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{activeRun.scenario}</Badge>
            <Badge variant={statusVariant(activeRun.status)}>
              {statusLabel(activeRun.status)}
            </Badge>
          </div>
        </div>
        <CardDescription className="line-clamp-2">
          {activeRun.planJson.summary}
          {activeRun.usage.totalTokens > 0
            ? ` · ${formatTokens(activeRun.usage.totalTokens)} token · ${formatUsd(activeRun.usage.costUsd)}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-[320px] pr-3">
          <ol className="space-y-3">
            {events.map((ev) => (
              <li key={ev.key} className="border-l-2 border-border pl-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {ev.kind === "step"
                      ? "Bước"
                      : ev.kind === "tool"
                        ? "Công cụ"
                        : ev.kind === "citation"
                          ? "Trích dẫn"
                          : "Sử dụng"}
                  </Badge>
                  {ev.time ? (
                    <span className="text-muted-foreground text-xs">
                      {formatTime(ev.time)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium">{ev.title}</p>
                <p className="text-muted-foreground text-xs">{ev.detail}</p>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
