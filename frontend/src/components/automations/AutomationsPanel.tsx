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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AGENT_LABEL, formatTime } from "@/lib/labels";
import { useAppStore } from "@/stores/app.store";
import { Play } from "lucide-react";
import { toast } from "sonner";

export function AutomationsPanel() {
  const automations = useAppStore((s) => s.automations);
  const automationRuns = useAppStore((s) => s.automationRuns);
  const toggleAutomation = useAppStore((s) => s.toggleAutomation);
  const runAutomationNow = useAppStore((s) => s.runAutomationNow);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automations</CardTitle>
          <CardDescription>
            Agent đề xuất · user duyệt · user bật/tắt — không tự bật
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {automations.map((a) => (
            <div key={a.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{a.description}</p>
                </div>
                <Badge variant="secondary">{AGENT_LABEL[a.createdByAgentRole]}</Badge>
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                <span>cron: {a.cronExpr ?? "—"}</span>
                <span>{a.timezone}</span>
                <span>next: {formatTime(a.nextRunAt)}</span>
                <span>last: {formatTime(a.lastRunAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(checked) => {
                      toggleAutomation(a.id, checked);
                      toast.message(checked ? "Automation đã bật" : "Automation đã tắt");
                    }}
                  />
                  <span className="text-sm">{a.enabled ? "enabled" : "disabled"}</span>
                </div>
                <Badge variant="outline">{a.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    runAutomationNow(a.id);
                    toast.success("Đang chạy thử (mock)");
                  }}
                >
                  <Play className="size-4" />
                  Chạy thử ngay
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử AutomationRun</CardTitle>
          <CardDescription>Trace riêng từng lần chạy lịch</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bắt đầu</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Kết quả</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automationRuns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatTime(r.startedAt)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs">
                    {r.resultSummary ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
