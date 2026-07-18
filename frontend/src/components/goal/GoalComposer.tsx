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
import { SCENARIO_PRESETS } from "@/lib/mock/scenarios";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app.store";
import { Loader2, Send } from "lucide-react";

export function GoalComposer() {
  const goalDraft = useAppStore((s) => s.goalDraft);
  const setGoalDraft = useAppStore((s) => s.setGoalDraft);
  const submitGoal = useAppStore((s) => s.submitGoal);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const mode = useAppStore((s) => s.mode);
  const scenarioId = useAppStore((s) => s.scenarioId);
  const applyScenarioPreset = useAppStore((s) => s.applyScenarioPreset);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gửi yêu cầu tới bộ điều phối</CardTitle>
        <CardDescription>
          Không chọn chuyên gia — hệ thống tự điều phối
          {mode === "single" ? " (chế độ một chuyên gia đang bật)" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {SCENARIO_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={scenarioId === p.id ? "default" : "outline"}
              className={cn("h-auto py-1.5 text-left text-xs")}
              disabled={isSimulating}
              onClick={() => applyScenarioPreset(p.id, p.goal)}
              title={p.description}
            >
              {p.shortLabel}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {SCENARIO_PRESETS.find((p) => p.id === scenarioId)?.description}
        </p>
        <Textarea
          value={goalDraft}
          onChange={(e) => setGoalDraft(e.target.value)}
          rows={7}
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
