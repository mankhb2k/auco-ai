"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/stores/app.store";
import { Loader2, Send } from "lucide-react";

export function GoalComposer() {
  const goalDraft = useAppStore((s) => s.goalDraft);
  const setGoalDraft = useAppStore((s) => s.setGoalDraft);
  const submitGoal = useAppStore((s) => s.submitGoal);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const mode = useAppStore((s) => s.mode);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gửi yêu cầu tới Planner</CardTitle>
        <CardDescription>
          Không chọn chuyên gia — hệ thống tự điều phối
          {mode === "single" ? " (baseline single-agent đang bật)" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          rows={6}
          placeholder="Nhập mục tiêu nghiệp vụ…"
          disabled={isSimulating}
        />
        <Button
          className="w-full"
          onClick={submitGoal}
          disabled={isSimulating || !goalDraft.trim()}
        >
          {isSimulating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {isSimulating ? "Đang chạy…" : "Gửi yêu cầu"}
        </Button>
      </CardContent>
    </Card>
  );
}
