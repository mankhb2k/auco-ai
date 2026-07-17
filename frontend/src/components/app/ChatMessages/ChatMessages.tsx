import { GitFork } from "lucide-react";
import React, { useRef, useEffect } from "react";
import { DoubleCheck, SingleCheck } from "@/components/app/icons/icons";
import { Avatar, MESSAGE_AVATAR_SIZE } from "@/components/ui/Avatar/Avatar";
import { isEmojiOnly } from "@/lib/telegramUtils";
import { AgentActivity } from "../AgentActivity/AgentActivity";
import { WorkflowDashboard } from "../WorkflowDashboard/WorkflowDashboard";
import { ChatActionButtons } from "./ChatActionButton/ChatActionButton";
import { ChatProgressCard } from "./ChatProgressCard/ChatProgressCard";
import { ChatTypingIndicator } from "./ChatTypingIndicator/ChatTypingIndicator";
import type {
  AgentActivityState,
  AgentActivityStep,
} from "../AgentActivity/AgentActivity";
import type { ChatAgentAvatar, Message } from "@/types/chat";

export type { ChatAgentAvatar };

export interface ChatMessagesProps {
  messages: Message[];
  activeChatId: string;
  /** Avatar mặc định của agent trong conversation này */
  agentAvatar?: ChatAgentAvatar;
  /** Agent đang chờ / stream token — hiện bubble … */
  isAgentTyping?: boolean;
  /** Live tool-calling progress (API sessions) */
  toolActivity?: {
    state: AgentActivityState;
    steps: AgentActivityStep[];
  } | null;
  workflowViewMode?: "chat" | "diagram";
  setWorkflowViewMode?: (mode: "chat" | "diagram") => void;
  approvedMessages?: Record<string, boolean>;
  onApproveMessage?: (messageId: string) => void;
  onRejectMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void;
  onCompleteWorking?: (messageId: string) => void;
  onCompleteScheduling?: (messageId: string) => void;
}

function AgentSideAvatar({ avatar }: { avatar?: ChatAgentAvatar }) {
  return (
    <Avatar
      size={MESSAGE_AVATAR_SIZE}
      src={avatar?.src}
      text={avatar?.text ?? "AA"}
      bg={avatar?.bg ?? "blue"}
      alt={avatar?.name ?? "Agent"}
      className="mt-0.5"
    />
  );
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  activeChatId,
  agentAvatar,
  isAgentTyping = false,
  toolActivity = null,
  workflowViewMode,
  setWorkflowViewMode,
  approvedMessages = {},
  onApproveMessage,
  onRejectMessage,
  onEditMessage,
  onCompleteWorking,
  onCompleteScheduling,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChatId, messages, isAgentTyping, toolActivity]);

  if (workflowViewMode === "diagram") {
    return (
      <WorkflowDashboard
        workflowId={activeChatId}
        onBackToChat={() => setWorkflowViewMode?.("chat")}
      />
    );
  }

  return (
    <div className="chat-scroll-view flex-1 bg-transparent -mt-[64px] -mb-[68px] pt-[64px] pb-[68px] px-4 mr-[3px] flex flex-col min-h-0 chat-fade-mask scrollbar-thin scrollbar-thumb-black/14 hover:scrollbar-thumb-black/26 active:scrollbar-thumb-black/8 scrollbar-track-transparent">
      <div className="w-full max-w-[720px] mx-auto flex flex-col gap-2 mt-auto">
        {messages.map((message) => {
          const isMe = message.sender === "me";
          const isSingleEmoji = isEmojiOnly(message.text);
          const isWorkflowPreview = message.text.startsWith("[WORKFLOW_PREVIEW]");
          const isProgressWorking = message.text === "[PROGRESS_WORKING]";
          const isProgressScheduling = message.text === "[PROGRESS_SCHEDULING]";

          if (isProgressWorking || isProgressScheduling) {
            return (
              <ChatProgressCard
                key={message.id}
                type={isProgressWorking ? "working" : "scheduling"}
                avatar={agentAvatar}
                onComplete={() =>
                  isProgressWorking
                    ? onCompleteWorking?.(message.id)
                    : onCompleteScheduling?.(message.id)
                }
              />
            );
          }

          if (isSingleEmoji) {
            return (
              <div
                key={message.id}
                className={`flex w-full mb-2 items-start gap-2 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && <AgentSideAvatar avatar={agentAvatar} />}
                <div className="relative group max-w-[70%] select-text">
                  <span className="text-[56px] leading-none select-all filter drop-shadow-sm inline-block tracking-[-0.1em]">
                    {message.text}
                  </span>

                  <span className="absolute -bottom-1 -right-8 bg-black/30 backdrop-blur-xs text-white text-xs px-1.5 py-0.5 rounded-full select-none font-medium flex items-center gap-0.5 opacity-65">
                    {message.time}
                    {isMe &&
                      (message.read ? (
                        <DoubleCheck className="text-white w-3 h-3" />
                      ) : (
                        <SingleCheck className="text-white w-3 h-3" />
                      ))}
                  </span>
                </div>
              </div>
            );
          }

          const displayText = isWorkflowPreview
            ? message.text.replace("[WORKFLOW_PREVIEW]", "").trim()
            : message.text;
          const showApprovalButtons = !isMe && message.text.includes("duyệt giúp em nhé!");
          const showActionButtons = showApprovalButtons || isWorkflowPreview;
          const metaClassName = `absolute bottom-[4px] right-[7px] flex items-center gap-0.5 text-[11px] leading-none select-none pointer-events-none ${
            isMe ? "text-white/60" : "text-gray-400"
          }`;

          return (
            <div
              key={message.id}
              className={`flex w-full mb-1.5 items-start gap-2 ${isMe ? "justify-end" : "justify-start"}`}
            >
              {!isMe && <AgentSideAvatar avatar={agentAvatar} />}
              <div
                className={`flex flex-col ${
                  showActionButtons ? "w-[min(100%,280px)] max-w-[75%]" : "w-fit max-w-[75%]"
                }`}
              >
                <div
                  className={`relative w-full shadow-xs select-text px-[9px] pt-[5px] pb-[5px]
                    ${
                      isMe
                        ? "bg-[#0ea5e9] text-white rounded-2xl rounded-br-[4px]"
                        : "bg-white text-gray-900 rounded-2xl rounded-bl-[4px]"
                    }`}
                >
                  <div className="leading-[1.3125] whitespace-pre-wrap break-words">
                    {displayText}
                    <span
                      aria-hidden
                      className="inline-block w-[48px] h-[1.15em] align-bottom ml-1 pointer-events-none select-none"
                    />
                  </div>

                  <span className={metaClassName}>
                    <span>{message.time}</span>
                    {isMe &&
                      (message.read ? (
                        <DoubleCheck className="text-white/60 w-[13px] h-[13px]" />
                      ) : (
                        <SingleCheck className="text-gray-400 w-[13px] h-[13px]" />
                      ))}
                  </span>
                </div>

                {isWorkflowPreview && (
                  <ChatActionButtons
                    buttons={[
                      {
                        id: "view-diagram",
                        label: "Xem Sơ đồ Chi tiết",
                        icon: <GitFork size={14} />,
                        onClick: () => setWorkflowViewMode?.("diagram"),
                      },
                    ]}
                  />
                )}

                {showApprovalButtons && (
                  <ChatActionButtons
                    statusText={
                      approvedMessages[message.id]
                        ? "Bạn đã duyệt lịch đăng này"
                        : null
                    }
                    buttons={[
                      {
                        id: "approve",
                        label: "Duyệt",
                        onClick: () => onApproveMessage?.(message.id),
                      },
                      {
                        id: "reject",
                        label: "Từ chối",
                        onClick: () => onRejectMessage?.(message.id),
                      },
                      {
                        id: "edit",
                        label: "Sửa",
                        onClick: () => onEditMessage?.(message.id),
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          );
        })}
        {toolActivity && toolActivity.steps.length > 0 ? (
          <AgentActivity
            state={toolActivity.state}
            steps={toolActivity.steps}
            avatar={{
              text: agentAvatar?.text ?? "AA",
              bg: agentAvatar?.bg ?? "blue",
              src: agentAvatar?.src,
            }}
          />
        ) : (
          isAgentTyping && <ChatTypingIndicator avatar={agentAvatar} />
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
