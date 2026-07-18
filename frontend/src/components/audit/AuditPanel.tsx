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
import { useAppStore } from "@/stores/app.store";
import { ClipboardList, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AuditEvent = {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  detailJson?: Record<string, unknown> | null;
  createdAt: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8387";

export function AuditPanel() {
  const employeeId = useAppStore((s) => s.employeeId);
  const employees = useAppStore((s) => s.employees);
  const actor = employees.find((e) => e.id === employeeId);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (
      actor?.accessLayer !== "manager" &&
      actor?.accessLayer !== "it_admin"
    ) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/audit?limit=40`, {
        headers: {
          "X-Demo-Employee-Id": employeeId,
        },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setEvents((await response.json()) as AuditEvent[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không tải được audit log",
      );
    } finally {
      setLoading(false);
    }
  }, [actor?.accessLayer, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4" />
              Audit log (demo)
            </CardTitle>
            <CardDescription>
              Ghi actorId · action · resource · at cho TaskRun, Approval,
              Knowledge publish và MCP connector — đủ kể chuyện governance.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {loading
                ? "Đang tải…"
                : "Chưa có sự kiện. Tạo task, duyệt, publish KB hoặc bật/tắt MCP để sinh log."}
            </p>
          ) : (
            events.map((event) => {
              const actorName =
                employees.find((e) => e.id === event.actorId)?.displayName ??
                event.actorId;
              return (
                <div
                  key={event.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{event.action}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(event.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{actorName}</p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {event.resource}
                  </p>
                  {event.detailJson ? (
                    <pre className="bg-muted mt-2 overflow-x-auto rounded-md p-2 text-[11px] leading-relaxed">
                      {JSON.stringify(event.detailJson, null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
