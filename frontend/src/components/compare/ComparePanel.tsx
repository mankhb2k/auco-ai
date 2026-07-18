"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MODE_LABEL } from "@/lib/labels";
import { useAppStore } from "@/stores/app.store";

export function ComparePanel() {
  const compare = useAppStore((s) => s.compare);
  const mode = useAppStore((s) => s.mode);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            So sánh một vs nhiều chuyên gia
          </CardTitle>
          <CardDescription>
            Chỉ số theo chế độ đang chọn trên thanh công cụ (mô phỏng)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge>
            {mode === "multi"
              ? "Đa chuyên gia (khuyến nghị)"
              : "Một chuyên gia (đối chứng)"}
          </Badge>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Độ trễ</dt>
              <dd className="mt-1 text-lg font-semibold">
                {(compare.latencyMs / 1000).toFixed(1)}s
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">
                Công cụ đúng lĩnh vực
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {Math.round(compare.toolAccuracy * 100)}%
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Trích dẫn</dt>
              <dd className="mt-1 text-lg font-semibold">
                {compare.citationCount}
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">
                Hành động thật (kiểm soát)
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {compare.realActions}
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Tổng token</dt>
              <dd className="mt-1 text-lg font-semibold">
                {compare.totalTokens.toLocaleString("vi-VN")}
              </dd>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">Chi phí (USD)</dt>
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
          <p className="text-muted-foreground text-xs">
            Chế độ hiện tại: {MODE_LABEL[mode]}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
