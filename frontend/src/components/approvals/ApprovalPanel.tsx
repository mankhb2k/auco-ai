"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AGENT_LABEL, APPROVAL_REASON_LABEL, labelOf } from "@/lib/labels";
import { useAppStore } from "@/stores/app.store";
import { Check, X } from "lucide-react";

export function ApprovalPanel() {
  const activeRun = useAppStore((s) => s.activeRun);
  const approveStep = useAppStore((s) => s.approveStep);
  const rejectStep = useAppStore((s) => s.rejectStep);

  const pending =
    activeRun?.steps.filter((s) => s.status === "waiting_approval") ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Duyệt yêu cầu</CardTitle>
        <CardDescription>
          Người thật duyệt hành động có tác động hệ thống — không tự duyệt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Không có bước nào đang chờ duyệt.
          </p>
        ) : (
          pending.map((step) => (
            <div key={step.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{AGENT_LABEL[step.agentRole]}</Badge>
                <Badge variant="outline">
                  {labelOf(
                    APPROVAL_REASON_LABEL,
                    step.approvalReason ?? "mutates",
                  )}
                </Badge>
              </div>
              <p className="text-sm">{step.approvalPreview ?? step.label}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    approveStep(step.id);
                    toast.success("Đã duyệt — công cụ đã thực thi (mô phỏng)");
                  }}
                >
                  <Check className="size-4" />
                  Duyệt
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    rejectStep(step.id);
                    toast.error("Đã từ chối — tác vụ dừng");
                  }}
                >
                  <X className="size-4" />
                  Từ chối
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
