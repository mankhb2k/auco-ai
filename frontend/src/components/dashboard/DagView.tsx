"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AGENT_LABEL, statusLabel, statusVariant } from "@/lib/labels";
import type { TaskStep } from "@/lib/types/domain";
import { useAppStore } from "@/stores/app.store";
import { cn } from "@/lib/utils";

const NODE_W = 220;
const NODE_H = 88;

function layout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

function StepNode({ data }: NodeProps) {
  const step = data.step as TaskStep;
  return (
    <div
      className={cn(
        "bg-card rounded-lg border px-3 py-2 shadow-sm",
        step.status === "waiting_approval" && "border-amber-500",
        step.status === "running" && "border-primary",
        step.status === "done" && "border-emerald-500/60",
        step.status === "failed" && "border-destructive",
      )}
      style={{ width: NODE_W, minHeight: NODE_H }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{AGENT_LABEL[step.agentRole]}</span>
        <Badge variant={statusVariant(step.status)} className="text-[10px]">
          {statusLabel(step.status)}
        </Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-snug">{step.label}</p>
      {step.mode === "spawn_workers" && step.workers ? (
        <p className="text-muted-foreground mt-1 text-[10px]">
          Worker: {step.workers.filter((w) => w.status === "done").length}/
          {step.workers.length}
        </p>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { step: StepNode };

export function DagView() {
  const activeRun = useAppStore((s) => s.activeRun);

  const { nodes, edges } = useMemo(() => {
    if (!activeRun) return { nodes: [] as Node[], edges: [] as Edge[] };

    const rawNodes: Node[] = activeRun.steps.map((step) => ({
      id: step.id,
      type: "step",
      position: { x: 0, y: 0 },
      data: { step },
    }));

    const rawEdges: Edge[] = activeRun.steps.flatMap((step) =>
      step.dependsOn.map((dep) => ({
        id: `${dep}->${step.id}`,
        source: dep,
        target: step.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "var(--border)" },
      })),
    );

    // Parallel siblings (no depends): connect planner phantom? skip — just layout
    return {
      nodes: layout(rawNodes, rawEdges),
      edges: rawEdges,
    };
  }, [activeRun]);

  useEffect(() => {
    // force reflow when run updates
  }, [activeRun?.steps]);

  if (!activeRun) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Sơ đồ bước</CardTitle>
          <CardDescription>
            Sơ đồ bước sẽ hiện sau khi bộ điều phối lập kế hoạch.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sơ đồ · Các bước</CardTitle>
        <CardDescription>
          {activeRun.mode === "multi"
            ? activeRun.scenario === "corporate"
              ? "Tín dụng ‖ Pháp lý → Sản phẩm · DN / TT39"
              : activeRun.scenario === "fx"
                ? "Tín dụng ‖ Pháp lý → Sản phẩm · FX / IMF"
                : "Tín dụng ‖ Pháp lý → Sản phẩm (Tín dụng tạo ≤3 worker)"
            : "Đối chứng một chuyên gia — 1 bước"}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[360px] flex-1 p-0">
        <div className="h-[360px] w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}
