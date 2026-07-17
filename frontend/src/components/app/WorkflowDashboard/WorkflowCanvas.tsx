"use client";

import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import React, { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";

import { applyDagreLayout } from "./layout/applyDagreLayout";
import { BlockNode, type BlockNodeData } from "./nodes/BlockNode";
import type { DiagramData } from "@/lib/workflowMockGraphs";

const nodeTypes: NodeTypes = {
  block: BlockNode,
};

function toFlowElements(diagram: DiagramData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: "block",
    position: { x: 0, y: 0 },
    data: {
      blockId: n.blockId,
      group: n.group,
      displayName: n.displayName,
      shortSummary: n.shortSummary,
      icon: n.icon,
      status: n.status,
      enabled: n.enabled !== false,
    } satisfies BlockNodeData,
    draggable: false,
    connectable: false,
  }));

  const edges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    labelStyle: { fill: "#475569", fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "rgba(255,255,255,0.75)", fillOpacity: 1 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 6,
  }));

  return applyDagreLayout(nodes, edges, "TB");
}

function diagramRemountKey(diagram: DiagramData): string {
  return [
    ...diagram.nodes.map((n) => n.id),
    ...diagram.edges.map((e) => e.id),
  ].join("|");
}

function CanvasInner({ diagram }: { diagram: DiagramData }) {
  const { fitView } = useReactFlow();
  const layouted = useMemo(() => toFlowElements(diagram), [diagram]);
  const [nodes, , onNodesChange] = useNodesState(layouted.nodes);
  const [edges, , onEdgesChange] = useEdgesState(layouted.edges);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.22, duration: 0 });
      requestAnimationFrame(() => {
        if (cancelled) return;
        void fitView({ padding: 0.22, duration: 0 });
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [fitView]);

  return (
    <div
      className="h-full w-full"
      style={{
        opacity: ready ? 1 : 0,
        transition: ready ? "opacity 120ms ease-out" : "none",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
        style={{ background: "transparent" }}
      >
        <Controls
          showInteractive={false}
          className="!bg-white/70 !backdrop-blur-md !shadow-sm !border !border-white/80 !rounded-xl !overflow-hidden"
        />
      </ReactFlow>
    </div>
  );
}

export interface WorkflowCanvasProps {
  diagram: DiagramData;
  className?: string;
}

export function WorkflowCanvas({ diagram, className = "" }: WorkflowCanvasProps) {
  const remountKey = diagramRemountKey(diagram);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`.trim()}>
      <ReactFlowProvider>
        <CanvasInner key={remountKey} diagram={diagram} />
      </ReactFlowProvider>
    </div>
  );
}
