"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  seedMcpSuite,
  type McpUiCapability,
  type McpUiSuite,
} from "@/lib/mock/governance";
import { useAppStore } from "@/stores/app.store";
import { Cable, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function McpSuitePanel() {
  const employeeId = useAppStore((state) => state.employeeId);
  const employees = useAppStore((state) => state.employees);
  const actor = employees.find((employee) => employee.id === employeeId);
  const [suite, setSuite] = useState<McpUiSuite>(() =>
    structuredClone(seedMcpSuite),
  );
  const [busyCapability, setBusyCapability] = useState<McpUiCapability | null>(
    null,
  );

  const summary = useMemo(() => {
    const enabledCount = suite.connectors.filter((c) => c.enabled).length;
    return {
      ...suite,
      enabledCount,
      connected: enabledCount > 0,
      connectorCount: suite.connectors.length,
    };
  }, [suite]);

  function setEnabled(capability: McpUiCapability, enabled: boolean) {
    setBusyCapability(capability);
    setSuite((prev) => ({
      ...prev,
      connectors: prev.connectors.map((connector) =>
        connector.capability === capability
          ? {
              ...connector,
              enabled,
              status: enabled ? "enabled" : "disabled",
            }
          : connector,
      ),
    }));
    toast.success(
      `${capability}: ${enabled ? "đã bật" : "đã tắt"} (mock runtime)`,
    );
    setBusyCapability(null);
  }

  if (actor?.accessLayer !== "it_admin") return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cable className="size-4" />
              {summary.suite}
            </CardTitle>
            <CardDescription>
              IT quản đường ống API; Planner vẫn tự điều phối agent theo goal.
              Toggle mock in-memory — không cần backend.
            </CardDescription>
          </div>
          <Badge variant="outline">Mock demo</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant={summary.connected ? "default" : "destructive"}>
              {summary.connected ? "Gateway available" : "All disabled"}
            </Badge>
            <Badge variant="outline">
              {summary.enabledCount}/{summary.connectorCount} enabled
            </Badge>
            <Badge variant="outline">{summary.bankCode}</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {summary.connectors.map((connector) => (
              <div
                key={connector.capability}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-4" />
                    <p className="font-medium">{connector.capability}</p>
                    <Badge variant="outline">{connector.implementation}</Badge>
                    <Badge
                      variant={connector.enabled ? "default" : "secondary"}
                    >
                      {connector.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {connector.serverName}
                  </p>
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                    {connector.tools.map((tool) => tool.name).join(" · ")}
                  </p>
                </div>
                <Switch
                  checked={connector.enabled}
                  disabled={busyCapability === connector.capability}
                  onCheckedChange={(enabled) =>
                    setEnabled(connector.capability, enabled)
                  }
                  aria-label={`Toggle ${connector.capability}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
