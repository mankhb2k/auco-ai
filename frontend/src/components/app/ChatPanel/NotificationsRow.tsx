"use client";

import { Bell } from "lucide-react";
import React from "react";
import { Switch } from "@/components/ui/Switch/Switch";

export interface NotificationsRowProps {
  checked: boolean;
  onToggle: () => void;
}

export function NotificationsRow({ checked, onToggle }: NotificationsRowProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-5 flex-1">
        <div className="flex-shrink-0 text-gray-400">
          <Bell size={20} className="stroke-[2]" />
        </div>
        <span className="text-gray-800 font-medium">Notifications</span>
      </div>
      <Switch
        className="self-center"
        checked={checked}
        onCheckedChange={onToggle}
        aria-label="Notifications"
      />
    </div>
  );
}
