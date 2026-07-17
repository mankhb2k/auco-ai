export interface ChatSimulatorController {
  isFinished?: () => boolean;
  isPaused?: () => boolean;
  resetSimulation?: () => void;
  pauseSimulation?: () => void;
  resumeSimulation?: () => void;
}

export interface ChatSimulatorHostWindow {
  onSimulationFinished?: () => void;
  onSimulationReset?: () => void;
  onSimulationPaused?: () => void;
  onSimulationResumed?: () => void;
}

export function getSimulatorFromIframe(
  iframe: HTMLIFrameElement | null,
): ChatSimulatorController | null {
  const contentWindow = iframe?.contentWindow;
  if (!contentWindow) {
    return null;
  }

  return contentWindow as unknown as ChatSimulatorController;
}

export function getChatSimulatorHostWindow(): ChatSimulatorHostWindow {
  return window as unknown as ChatSimulatorHostWindow;
}
