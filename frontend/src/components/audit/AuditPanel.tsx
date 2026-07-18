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
import { seedAuditEvents, type AuditUiEvent } from "@/lib/mock/governance";
import { useAppStore } from "@/stores/app.store";
import { ClipboardList, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AuditPanel() {
  const employees = useAppStore((s) => s.employees);
  const employeeId = useAppStore((s) => s.employeeId);
  const actor = employees.find((e) => e.id === employeeId);
  const [events, setEvents] = useState<AuditUiEvent[]>(() =>
    structuredClone(seedAuditEvents),
  );

  function resetMock() {
    setEvents(structuredClone(seedAuditEvents));
    toast.success("Đã nạp lại audit mock");
  }

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
              Audit log (demo)
            </CardTitle>
            <CardDescription>
              Mock actorId · action · resource · at — đủ kể chuyện governance
              khi test UI không cần backend.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Mock demo</Badge>
            <Button variant="outline" size="sm" onClick={resetMock}>
              <RefreshCw className="size-4" />
              Làm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.map((event) => {
            const actorName =
              employees.find((e) => e.id === event.actorId)?.displayName ??
              event.actorId;
            return (
              <div key={event.id} className="rounded-lg border p-3 text-sm">
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
          })}
        </CardContent>
      </Card>
    </div>
  );
}
