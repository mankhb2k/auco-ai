"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import React from "react";
import { Block } from "@/components/app/Block";
import type { BlockGroup, BlockStatus } from "@/lib/workflowMockGraphs";

export interface BlockNodeData {
  blockId: string;
  group: BlockGroup;
  displayName: string;
  shortSummary: string;
  icon?: string;
  status?: BlockStatus;
  enabled?: boolean;
  [key: string]: unknown;
}

const HANDLE_CLASS =
  "!h-2.5 !w-2.5 !border-2 !border-white !bg-white !shadow-[0_0_0_1.5px_rgba(148,163,184,0.9)]";

/** React Flow node — bọc Block + ports trên/dưới (layout TB) */
export function BlockNode({ data, selected }: NodeProps) {
  const nodeData = data as BlockNodeData;
  const isBranch = nodeData.group === "control";

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className={HANDLE_CLASS}
      />

      <Block
        title={nodeData.displayName}
        group={nodeData.group}
        icon={nodeData.icon}
        status={nodeData.status}
        enabled={nodeData.enabled !== false}
        selected={selected}
        showStatus={false}
      />

      {isBranch ? (
        <>
          <Handle
            type="source"
            id="yes"
            position={Position.Bottom}
            className={HANDLE_CLASS}
            style={{ left: "30%" }}
          />
          <Handle
            type="source"
            id="no"
            position={Position.Bottom}
            className={HANDLE_CLASS}
            style={{ left: "70%" }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className={HANDLE_CLASS}
        />
      )}
    </div>
  );
}
