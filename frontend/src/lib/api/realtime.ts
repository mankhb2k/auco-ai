import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "./config";

export type TaskRealtimeHandlers = {
  onTaskUpdated?: (payload: {
    taskRunId: string;
    status?: string;
  }) => void;
  onStepUpdated?: (payload: {
    taskRunId: string;
    stepId: string;
    status?: string;
  }) => void;
  onApprovalNeeded?: (payload: {
    taskRunId: string;
    stepId: string;
  }) => void;
};

let shared: Socket | null = null;

function getSocket(): Socket | null {
  const base = getApiBaseUrl();
  if (!base) return null;
  if (!shared) {
    shared = io(`${base}/ws`, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      withCredentials: true,
    });
  }
  return shared;
}

export type TaskSubscription = {
  stop: () => void;
};

/** Subscribe to task room; returns stopper. Falls back silently if socket fails. */
export function subscribeTaskRun(
  taskRunId: string,
  handlers: TaskRealtimeHandlers,
): TaskSubscription {
  const socket = getSocket();
  if (!socket) {
    return { stop: () => undefined };
  }

  const onTask = (payload: { taskRunId: string; status?: string }) => {
    if (payload?.taskRunId === taskRunId) handlers.onTaskUpdated?.(payload);
  };
  const onStep = (payload: {
    taskRunId: string;
    stepId: string;
    status?: string;
  }) => {
    if (payload?.taskRunId === taskRunId) handlers.onStepUpdated?.(payload);
  };
  const onApproval = (payload: { taskRunId: string; stepId: string }) => {
    if (payload?.taskRunId === taskRunId) handlers.onApprovalNeeded?.(payload);
  };

  socket.on("task.updated", onTask);
  socket.on("step.updated", onStep);
  socket.on("approval.needed", onApproval);

  const doSubscribe = () => {
    socket.emit("subscribe", { taskRunId });
  };
  if (socket.connected) doSubscribe();
  else socket.once("connect", doSubscribe);

  return {
    stop: () => {
      socket.off("task.updated", onTask);
      socket.off("step.updated", onStep);
      socket.off("approval.needed", onApproval);
    },
  };
}
