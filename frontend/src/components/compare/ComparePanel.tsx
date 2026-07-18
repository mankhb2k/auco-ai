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
import { MODE_LABEL } from "@/lib/labels";
import { useAppStore } from "@/stores/app.store";
import { GitCompareArrows } from "lucide-react";

export function ComparePanel() {
  const compare = useAppStore((s) => s.compare);
  const mode = useAppStore((s) => s.mode);
  const compareVerdict = useAppStore((s) => s.compareVerdict);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const liveApi = useAppStore((s) => s.liveApi);
  const runCompare = useAppStore((s) => s.runCompare);
  const goalDraft = useAppStore((s) => s.goalDraft);
  const activeRun = useAppStore((s) => s.activeRun);

  const goalHint =
    goalDraft.trim() || activeRun?.goal || "Goal demo (vay mua nhà / …)";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">
              So sánh một vs nhiều chuyên gia
            </CardTitle>
            <CardDescription>
              {liveApi
                ? "Chạy POST /api/compare trên backend (multi rồi single, bỏ HITL)."
                : "Chỉ số mô phỏng — bật NEXT_PUBLIC_API_URL để chạy so sánh thật."}
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={isSimulating}
            onClick={() => void runCompare()}
          >
            <GitCompareArrows className="size-4" />
            {isSimulating ? "Đang chạy…" : "Chạy so sánh"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground line-clamp-2 text-xs">
            Goal: {goalHint}
          </p>
          <Badge>
            {mode === "multi"
              ? "Đang xem chỉ số: Đa chuyên gia"
              : "Đang xem chỉ số: Một chuyên gia"}
          </Badge>
          {compareVerdict ? (
            <p className="bg-muted/50 rounded-lg p-3 text-sm">{compareVerdict}</p>
          ) : null}
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
            Chế độ hiện tại trên thanh công cụ: {MODE_LABEL[mode]} — đổi mode
            để xem lại chỉ số multi/single sau khi chạy so sánh (lần chạy lưu
            verdict; chỉ số panel theo mode đang chọn).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
