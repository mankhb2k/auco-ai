import dagre from "@dagrejs/dagre";
import { Position, type Edge, type Node } from "@xyflow/react";
import { BLOCK_SIZE } from "@/components/app/Block";

const NODE_WIDTH = BLOCK_SIZE.width;
const NODE_HEIGHT = BLOCK_SIZE.height;

type DagreNodePos = { x: number; y: number };

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 56,
    marginx: 24,
    marginy: 24,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- dagre Graph typings
  dagre.layout(g);

  const isHorizontal = direction === "LR";

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id) as DagreNodePos | undefined;
    if (!pos) return node;
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
