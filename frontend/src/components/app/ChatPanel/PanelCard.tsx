import React, { type ReactNode } from "react";

/** White rounded card used for detail rows in right panels. */
export function PanelCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-3xl mx-3 mb-3 shadow-sm overflow-hidden py-1">
      {children}
    </div>
  );
}

export function PanelCardRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="px-5 py-3">
      <p className="text-sm text-gray-400 font-normal mb-0.5">{label}</p>
      <div className="text-gray-900 font-medium whitespace-pre-wrap break-words">
        {value}
      </div>
    </div>
  );
}

export function PanelEmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-4 text-sm text-gray-400 text-center">{children}</p>
  );
}
