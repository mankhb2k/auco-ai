"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/app.store";
import { Cable, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Capability =
  | "los"
  | "compliance"
  | "core-banking"
  | "product"
  | "ops";

type Connector = {
  capability: Capability;
  serverName: string;
  implementation: "real" | "stub";
  enabled: boolean;
  status: "enabled" | "disabled";
  tools: Array<{ name: string; mutates: boolean }>;
};

type SuiteStatus = {
  suite: string;
  bankCode: string;
  connected: boolean;
  connectorCount: number;
  enabledCount: number;
  connectors: Connector[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8387";

export function McpSuitePanel() {
  const employeeId = useAppStore((state) => state.employeeId);
  const employees = useAppStore((state) => state.employees);
  const actor = employees.find((employee) => employee.id === employeeId);
  const [suite, setSuite] = useState<SuiteStatus | null>(null);
  const [busyCapability, setBusyCapability] = useState<Capability | null>(null);

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Employee-Id": employeeId,
          ...init?.headers,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? `HTTP ${response.status}`);
      }
      return response.json();
    },
    [employeeId],
  );

  const load = useCallback(async () => {
    try {
      setSuite((await request("/api/mcp/suite")) as SuiteStatus);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không tải được MCP Suite",
      );
    }
  }, [request]);

  useEffect(() => {
    if (actor?.accessLayer === "it_admin") void load();
  }, [actor?.accessLayer, load]);

  async function setEnabled(capability: Capability, enabled: boolean) {
    setBusyCapability(capability);
    try {
      await request(`/api/mcp/connectors/${capability}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      toast.success(
        `${capability}: ${enabled ? "đã bật" : "đã tắt"} (runtime demo)`,
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cập nhật thất bại");
    } finally {
      setBusyCapability(null);
    }
  }

  if (actor?.accessLayer !== "it_admin") return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cable className="size-4" />
              {suite?.suite ?? "MCP Suite"}
            </CardTitle>
            <CardDescription>
              IT quản đường ống API; Planner vẫn tự điều phối agent theo goal.
              Trạng thái toggle hiện lưu in-memory cho demo.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw />
            Tải lại
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant={suite?.connected ? "default" : "destructive"}>
              {suite?.connected ? "Gateway available" : "All disabled"}
            </Badge>
            <Badge variant="outline">
              {suite?.enabledCount ?? 0}/{suite?.connectorCount ?? 0} enabled
            </Badge>
            <Badge variant="outline">{suite?.bankCode ?? "SHB"}</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {suite?.connectors.map((connector) => (
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
                    void setEnabled(connector.capability, enabled)
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
