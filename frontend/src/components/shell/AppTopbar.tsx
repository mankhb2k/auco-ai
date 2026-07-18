"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ACCESS_LAYER_LABEL } from "@/lib/mock/seed";
import { useAppStore } from "@/stores/app.store";
import { Plus, UserRound } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppTopbar() {
  const mainTab = useAppStore((s) => s.mainTab);
  const employees = useAppStore((s) => s.employees);
  const employeeId = useAppStore((s) => s.employeeId);
  const setEmployeeId = useAppStore((s) => s.setEmployeeId);
  const currentEmployee =
    employees.find((e) => e.id === employeeId) ?? employees[0];
  const newRequest = useAppStore((s) => s.newRequest);

  const title =
    mainTab === "workspace"
      ? "Trò chuyện"
      : mainTab === "automations"
        ? "Tự động hóa"
        : mainTab === "history"
          ? "Lịch sử"
          : mainTab === "knowledge"
            ? "Quản lý tri thức"
            : mainTab === "mcp"
              ? "Quản lý kết nối MCP"
              : mainTab === "audit"
                ? "Nhật ký kiểm soát"
                : "So sánh một vs nhiều chuyên gia";

  return (
    <header className="bg-background/95 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur supports-backdrop-filter:bg-background/80">
      <SidebarTrigger className="-ml-0.5" />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
        {mainTab === "workspace" ? (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            SHB
          </Badge>
        ) : null}
      </div>

      <Badge variant="secondary" className="hidden items-center gap-1 md:inline-flex">
        <UserRound className="size-3" />
        <span className="max-w-44 truncate">{currentEmployee.displayName}</span>
        <span className="text-muted-foreground">
          · {ACCESS_LAYER_LABEL[currentEmployee.accessLayer]}
        </span>
      </Badge>

      <Select value={employeeId} onValueChange={setEmployeeId}>
        <SelectTrigger className="h-8 w-[9.5rem] sm:w-[13rem]">
          <SelectValue placeholder="Đổi vai demo" />
        </SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              <span className="flex flex-col text-left">
                <span>{e.displayName}</span>
                <span className="text-muted-foreground text-xs">
                  {ACCESS_LAYER_LABEL[e.accessLayer]}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mainTab === "workspace" ? (
        <Button variant="outline" size="sm" className="h-8" onClick={newRequest}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Mới</span>
        </Button>
      ) : null}
    </header>
  );
}
