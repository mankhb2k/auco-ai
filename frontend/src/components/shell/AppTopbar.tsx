"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ACCESS_LAYER_LABEL } from "@/lib/mock/seed";
import { useAppStore } from "@/stores/app.store";
import { Sparkles, UserRound } from "lucide-react";
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
  const askAiOpen = useAppStore((s) => s.askAiOpen);
  const setAskAiOpen = useAppStore((s) => s.setAskAiOpen);

  const title =
    mainTab === "loans"
      ? currentEmployee?.accessLayer === "manager"
        ? "Hàng đợi yêu cầu vay"
        : "Hồ sơ vay của tôi"
      : "Tri thức chuẩn hóa";

  return (
    <header className="bg-background/95 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur supports-backdrop-filter:bg-background/80">
      <SidebarTrigger className="-ml-0.5" />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          SHB
        </Badge>
      </div>

      {currentEmployee ? (
        <Badge
          variant="secondary"
          className="hidden items-center gap-1 md:inline-flex"
        >
          <UserRound className="size-3" />
          <span className="max-w-44 truncate">{currentEmployee.displayName}</span>
          <span className="text-muted-foreground">
            · {ACCESS_LAYER_LABEL[currentEmployee.accessLayer]}
          </span>
        </Badge>
      ) : null}

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

      <Button
        variant={askAiOpen ? "default" : "outline"}
        size="sm"
        className="h-8"
        onClick={() => setAskAiOpen(!askAiOpen)}
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">Hỏi AI</span>
      </Button>
    </header>
  );
}
