"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/app.store";
import { Network, Plus } from "lucide-react";

export function AppHeader() {
  const employees = useAppStore((s) => s.employees);
  const employeeId = useAppStore((s) => s.employeeId);
  const setEmployeeId = useAppStore((s) => s.setEmployeeId);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const mcp = useAppStore((s) => s.mcp);
  const newRequest = useAppStore((s) => s.newRequest);
  const outOfPortfolioDemo = useAppStore((s) => s.outOfPortfolioDemo);
  const setOutOfPortfolioDemo = useAppStore((s) => s.setOutOfPortfolioDemo);

  const employee = employees.find((e) => e.id === employeeId);

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Network className="size-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight">
                Digital Expert Agents
              </h1>
              <Badge variant="secondary">SHB</Badge>
              <Badge variant={mcp.connected ? "default" : "destructive"}>
                {mcp.suite}: {mcp.connected ? "Connected" : "Offline"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Một điểm vào Planner · Dashboard multi-agent (mock)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="text-muted-foreground text-xs">Chế độ</span>
            <Switch
              checked={mode === "multi"}
              onCheckedChange={(checked) => setMode(checked ? "multi" : "single")}
            />
            <span className="text-sm font-medium">
              {mode === "multi" ? "Multi-agent" : "Single-agent"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="text-muted-foreground text-xs">Ngoài danh mục</span>
            <Switch
              checked={outOfPortfolioDemo}
              onCheckedChange={setOutOfPortfolioDemo}
            />
          </div>

          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Chọn nhân viên" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={newRequest}>
            <Plus className="size-4" />
            Yêu cầu mới
          </Button>
        </div>
      </div>
      {employee ? (
        <>
          <Separator />
          <div className="text-muted-foreground mx-auto max-w-[1600px] px-4 py-2 text-xs">
            Đang dùng với vai trò: {employee.displayName} — {employee.branchCode}
          </div>
        </>
      ) : null}
    </header>
  );
}
