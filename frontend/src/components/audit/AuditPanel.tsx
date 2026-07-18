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
import { isLiveApi } from "@/lib/api";
import { listAuditEvents } from "@/lib/api/audit";
import { ApiError } from "@/lib/api/client";
import { AUDIT_ACTION_LABEL, labelOf } from "@/lib/labels";
import { seedAuditEvents, type AuditUiEvent } from "@/lib/mock/governance";
import { useAppStore } from "@/stores/app.store";
import { ClipboardList, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function AuditPanel() {
  const employees = useAppStore((s) => s.employees);
  const employeeId = useAppStore((s) => s.employeeId);
  const actor = employees.find((e) => e.id === employeeId);
  const [events, setEvents] = useState<AuditUiEvent[]>(() =>
    structuredClone(seedAuditEvents),
  );
  const [loading, setLoading] = useState(false);
  const live = isLiveApi();

  const refresh = useCallback(async () => {
    if (!live) {
      setEvents(structuredClone(seedAuditEvents));
      toast.success("Đã nạp lại nhật ký mô phỏng");
      return;
    }
    setLoading(true);
    try {
      const rows = await listAuditEvents(employeeId, 50);
      setEvents(rows);
      toast.success("Đã làm mới nhật ký từ API");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? `Không tải audit: ${err.message}`
          : "Không tải audit",
      );
    } finally {
      setLoading(false);
    }
  }, [live, employeeId]);

  useEffect(() => {
    if (
      !live ||
      (actor?.accessLayer !== "manager" && actor?.accessLayer !== "it_admin")
    ) {
      return;
    }
    void refresh();
  }, [live, actor?.accessLayer, refresh]);

  if (actor?.accessLayer !== "manager" && actor?.accessLayer !== "it_admin") {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4" />
              Nhật ký kiểm soát
            </CardTitle>
            <CardDescription>
              {live
                ? "GET /api/audit — actor · hành động · tài nguyên · thời điểm."
                : "Mô phỏng — đủ kể chuyện kiểm soát khi test giao diện không cần backend."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{live ? "API" : "Mô phỏng"}</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw className="size-4" />
              Làm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có sự kiện.</p>
          ) : null}
          {events.map((event) => {
            const actorName =
              employees.find((e) => e.id === event.actorId)?.displayName ??
              event.actorId;
            return (
              <div key={event.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {labelOf(AUDIT_ACTION_LABEL, event.action)}
                  </Badge>
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
          })}
        </CardContent>
      </Card>
    </div>
  );
}
