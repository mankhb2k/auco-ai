"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

export type SwitchProps = SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
};

export function Switch({
  className,
  size = "default",
  ...props
}: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={(state) =>
        cn(
          "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none",
          "after:absolute after:-inset-x-3 after:-inset-y-2",
          "focus-visible:border-blue focus-visible:ring-2 focus-visible:ring-blue/30",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50",
          "data-[size=default]:h-5 data-[size=default]:w-11",
          "data-[size=sm]:h-4 data-[size=sm]:w-7",
          "data-checked:border-blue data-checked:bg-blue",
          "data-unchecked:border-transparent data-unchecked:bg-gray-200",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform",
          "group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-6",
          "group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-4",
          "data-checked:translate-x-[calc(100%-8px)] data-unchecked:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
