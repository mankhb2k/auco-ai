"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppStore } from "@/stores/app.store";

export function ComparePanel() {
  const compare = useAppStore((s) => s.compare);
  const mode = useAppStore((s) => s.mode);
  const mcp = useAppStore((s) => s.mcp);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">So sánh Single vs Multi</CardTitle>
          <CardDescription>
            Metrics theo chế độ đang chọn trên header (mock deliverable #5)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge>{mode === "multi" ? "Multi-agent (khuyến nghị)" : "Single-agent (baseline)"}</Badge>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Latency</dt>
              <dd className="mt-1 text-lg font-semibold">
                {(compare.latencyMs / 1000).toFixed(1)}s
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Tool đúng domain</dt>
              <dd className="mt-1 text-lg font-semibold">
                {Math.round(compare.toolAccuracy * 100)}%
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Citations</dt>
              <dd className="mt-1 text-lg font-semibold">{compare.citationCount}</dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Hành động thật (audit)</dt>
              <dd className="mt-1 text-lg font-semibold">{compare.realActions}</dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Total tokens</dt>
              <dd className="mt-1 text-lg font-semibold">
                {compare.totalTokens.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Cost (USD)</dt>
              <dd className="mt-1 text-lg font-semibold">
                ${compare.costUsd.toFixed(4)}
              </dd>
            </div>
          </dl>
          <ul className="space-y-2">
            {compare.notes.map((n) => (
              <li key={n} className="text-muted-foreground text-sm">
                · {n}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SHB MCP Suite</CardTitle>
          <CardDescription>Trạng thái connector (mock)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {mcp.connectors.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground text-xs">{c.id}</p>
              </div>
              <div className="text-right">
                <Badge variant={c.status === "connected" ? "default" : "secondary"}>
                  {c.status}
                </Badge>
                {c.lastTool ? (
                  <p className="text-muted-foreground mt-1 text-[10px]">{c.lastTool}</p>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
