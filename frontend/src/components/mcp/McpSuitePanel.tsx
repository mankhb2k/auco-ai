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
import { isLiveApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { getMcpSuite, setMcpConnectorEnabled } from "@/lib/api/mcp";
import {
  labelOf,
  MCP_CAPABILITY_LABEL,
  MCP_IMPL_LABEL,
  ON_OFF_LABEL,
} from "@/lib/labels";
import {
  seedMcpSuite,
  type McpUiCapability,
  type McpUiSuite,
} from "@/lib/mock/governance";
import { useAppStore } from "@/stores/app.store";
import { Cable, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const live = isLiveApi();

  useEffect(() => {
    if (!live || actor?.accessLayer !== "it_admin") return;
    let cancelled = false;
    setLoading(true);
    void getMcpSuite(employeeId)
      .then((next) => {
        if (!cancelled) setSuite(next);
      })
      .catch((err) => {
        toast.error(
          err instanceof ApiError
            ? `Không tải MCP suite: ${err.message}`
            : "Không tải MCP suite",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, employeeId, actor?.accessLayer]);

  const summary = useMemo(() => {
    const enabledCount = suite.connectors.filter((c) => c.enabled).length;
    return {
      ...suite,
      enabledCount,
      connected: enabledCount > 0,
      connectorCount: suite.connectors.length,
    };
  }, [suite]);

  async function setEnabled(capability: McpUiCapability, enabled: boolean) {
    setBusyCapability(capability);
    const prev = suite;
    setSuite((s) => ({
      ...s,
      connectors: s.connectors.map((connector) =>
        connector.capability === capability
          ? {
              ...connector,
              enabled,
              status: enabled ? "enabled" : "disabled",
            }
          : connector,
      ),
    }));
    const name = labelOf(MCP_CAPABILITY_LABEL, capability);
    try {
      if (live) {
        await setMcpConnectorEnabled(capability, enabled, employeeId);
      }
      toast.success(
        `${name}: ${enabled ? "đã bật" : "đã tắt"}${live ? "" : " (mô phỏng)"}`,
      );
    } catch (err) {
      setSuite(prev);
      toast.error(
        err instanceof ApiError
          ? `Đổi connector thất bại: ${err.message}`
          : "Đổi connector thất bại",
      );
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
              {summary.suite}
            </CardTitle>
            <CardDescription>
              IT quản đường ống API; bộ điều phối vẫn tự chọn chuyên gia theo
              mục tiêu.
              {live
                ? " Đang đọc GET /api/mcp/suite — toggle PATCH (in-memory trên BE)."
                : " Công tắc mô phỏng trong bộ nhớ — không cần backend."}
            </CardDescription>
          </div>
          <Badge variant="outline">{live ? (loading ? "Đang tải…" : "API") : "Mô phỏng"}</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant={summary.connected ? "default" : "destructive"}>
              {summary.connected
                ? "Cổng kết nối sẵn sàng"
                : "Tất cả đã tắt"}
            </Badge>
            <Badge variant="outline">
              {summary.enabledCount}/{summary.connectorCount} đang bật
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
                    <p className="font-medium">
                      {labelOf(MCP_CAPABILITY_LABEL, connector.capability)}
                    </p>
                    <Badge variant="outline">
                      {labelOf(MCP_IMPL_LABEL, connector.implementation)}
                    </Badge>
                    <Badge
                      variant={connector.enabled ? "default" : "secondary"}
                    >
                      {labelOf(ON_OFF_LABEL, connector.status)}
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
                  aria-label={`Bật tắt ${labelOf(MCP_CAPABILITY_LABEL, connector.capability)}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
