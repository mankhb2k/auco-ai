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
import {
  formatTime,
  MODE_LABEL,
  statusLabel,
  statusVariant,
} from "@/lib/labels";
import { useAppStore } from "@/stores/app.store";

export function HistoryPanel() {
  const history = useAppStore((s) => s.history);
  const selectHistory = useAppStore((s) => s.selectHistory);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lịch sử tác vụ</CardTitle>
        <CardDescription>
          Chỉ đọc — không đổi tên / lưu trữ / ghim
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có lần chạy nào.</p>
        ) : (
          history.map((run) => (
            <div
              key={run.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{run.goal}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(run.status)}>
                    {statusLabel(run.status)}
                  </Badge>
                  <Badge variant="outline">{MODE_LABEL[run.mode]}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatTime(run.createdAt)}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => selectHistory(run.id)}>
                Xem lại
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
