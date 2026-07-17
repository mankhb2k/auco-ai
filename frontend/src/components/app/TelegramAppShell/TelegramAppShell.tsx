"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChatComposer } from "@/components/app/ChatComposer/ChatComposer";
import { ChatHeader } from "@/components/app/ChatHeader/ChatHeader";
import { ChatList } from "@/components/app/ChatList/ChatList";
import { ChatMessages } from "@/components/app/ChatMessages/ChatMessages";
import { ChatPanel } from "@/components/app/ChatPanel/ChatPanel";
import { useConversationMessages } from "@/hooks/chat/use-conversation-messages";
import { useMessageStream } from "@/hooks/chat/use-message-stream";
import { useSendMessage } from "@/hooks/chat/use-send-message";
import { mapAgentDmToChat, mapMotherDmToChat } from "@/lib/agents/map-agent";
import { agentsApi } from "@/lib/api/agents";
import { conversationsApi } from "@/lib/api/conversations";
import { documentsApi } from "@/lib/api/documents";
import { mapConversationToChat } from "@/lib/conversations/map-conversation";
import { initialChats } from "@/lib/mockData";
import {
  EMPTY_MESSAGES,
  mergeDisplayMessages,
  useMessageStore,
} from "@/stores/message/message.store";
import { useToolRunStore } from "@/stores/tool-run/tool-run.store";
import type { Chat, Message } from "@/types/chat";
import type { CreateAgentInput, CreateConversationInput } from "@auco-ai/shared";

/** Fallback Mother UI nếu API mother/dm chưa sẵn sàng; Workflow vẫn mock */
const MOTHER_FALLBACK: Chat =
  initialChats.find((c) => c.id === "mother") ?? {
    id: "mother",
    name: "AucoMother",
    status: "online",
    avatarText: "AM",
    avatarBg: "bg-avatar-purple",
    notifications: true,
    category: "agent",
    pinned: true,
    verified: true,
    description: "Hệ thống điều phối các chuyên gia nghiệp vụ ngân hàng SHB.",
    messages: [],
    sharedMedia: [],
  };
const WORKFLOW_MOCKS = initialChats.filter((c) => c.category === "workflow");

const EMPTY_CHAT: Chat = {
  id: "",
  name: "Aucobot",
  status: "",
  notifications: true,
  messages: [],
  sharedMedia: [],
  category: "chat",
};

export function TelegramAppShell() {
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [chats, setChats] = useState<Chat[]>([MOTHER_FALLBACK, ...WORKFLOW_MOCKS]);
  const [workflowViewMode, setWorkflowViewMode] = useState<"chat" | "diagram">("chat");
  const [listError, setListError] = useState<string | null>(null);
  const [motherConversationId, setMotherConversationId] = useState<string | null>(null);

  const [approvedMessages, setApprovedMessages] = useState<Record<string, boolean>>({
    rm3: true,
  });
  const [attachHint, setAttachHint] = useState<string | null>(null);

  const activeChat =
    chats.find((c) => c.id === activeChatId) ?? chats[0] ?? EMPTY_CHAT;

  /** Session Tin nhắn + Mother DM + user-agent DM → Together Qwen */
  const isApiSession =
    activeChat.conversationType === "session" && Boolean(activeChat.id);

  useConversationMessages(activeChatId || null, isApiSession);
  useMessageStream(activeChatId || null, isApiSession);
  const { send: sendSessionMessage, sending } = useSendMessage(
    isApiSession ? activeChatId : null,
  );

  const persistedMessages = useMessageStore(
    (state) => state.byConversationId[activeChatId] ?? EMPTY_MESSAGES,
  );
  const streaming = useMessageStore(
    (state) => state.streamingByConversationId[activeChatId] ?? null,
  );
  const toolRun = useToolRunStore(
    (state) => state.byConversationId[activeChatId] ?? null,
  );
  const toolActivity =
    isApiSession && toolRun && toolRun.steps.length > 0
      ? { state: toolRun.state, steps: toolRun.steps }
      : null;
  const isAgentTyping =
    isApiSession && streaming !== null && toolActivity === null;

  const storeMessages = useMemo(
    () => mergeDisplayMessages(persistedMessages),
    [persistedMessages],
  );

  const displayMessages = isApiSession ? storeMessages : activeChat.messages;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [conversations, agents, motherDm] = await Promise.all([
          conversationsApi.list(),
          agentsApi.list().catch(() => ({ items: [] })),
          agentsApi.ensureMotherDm().catch(() => null),
        ]);
        if (cancelled) return;

        const motherChat = motherDm ? mapMotherDmToChat(motherDm) : MOTHER_FALLBACK;
        const motherId = motherDm?.conversation.id ?? null;
        setMotherConversationId(motherId);

        const agentDms = await Promise.all(
          agents.items.map((agent) =>
            agentsApi.ensureDm(agent.id).catch(() => null),
          ),
        );
        if (cancelled) return;

        const apiAgents = agentDms
          .filter((dm): dm is NonNullable<typeof dm> => dm !== null)
          .map(mapAgentDmToChat);
        const agentDmIds = new Set(apiAgents.map((c) => c.id));
        if (motherId) agentDmIds.add(motherId);

        const apiChats = conversations.items
          .filter((c) => !agentDmIds.has(c.id))
          .map(mapConversationToChat);
        const agentTab = [motherChat, ...apiAgents];
        setChats([...apiChats, ...agentTab, ...WORKFLOW_MOCKS]);
        setListError(null);
        setActiveChatId((prev) => {
          if (
            prev &&
            (apiChats.some((c) => c.id === prev) ||
              agentTab.some((c) => c.id === prev) ||
              WORKFLOW_MOCKS.some((c) => c.id === prev))
          ) {
            return prev;
          }
          return apiChats[0]?.id ?? agentTab[0]?.id ?? "";
        });
      } catch (err) {
        if (cancelled) return;
        const mockChats = initialChats.filter((c) => c.category === "chat");
        const mockAgents = initialChats.filter((c) => c.category === "agent");
        setChats([...mockChats, ...mockAgents, ...WORKFLOW_MOCKS]);
        setActiveChatId(mockChats[0]?.id ?? mockAgents[0]?.id ?? "");
        setListError(
          err instanceof Error
            ? err.message
            : "Không tải được danh sách hội thoại",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setWorkflowViewMode("chat");
  }, []);

  const handleCreateConversation = useCallback(
    async (input: CreateConversationInput) => {
      try {
        const created = await conversationsApi.create(input);
        const chat = mapConversationToChat(created);
        setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
        setActiveChatId(chat.id);
        setWorkflowViewMode("chat");
        setListError(null);
      } catch (err) {
        setListError(
          err instanceof Error ? err.message : "Không tạo được hội thoại",
        );
        throw err;
      }
    },
    [],
  );

  const handleCreateAgent = useCallback(async (input: CreateAgentInput) => {
    const created = await agentsApi.create(input);
    const dm = await agentsApi.ensureDm(created.id);
    const chat = mapAgentDmToChat(dm);
    setChats((prev) => {
      const without = prev.filter(
        (c) => c.id !== chat.id && c.agentId !== created.id,
      );
      const motherIdx = without.findIndex(
        (c) =>
          c.id === motherConversationId ||
          c.id === MOTHER_FALLBACK.id ||
          (c.category === "agent" && c.verified && c.pinned),
      );
      if (motherIdx === -1) {
        return [chat, ...without];
      }
      return [
        ...without.slice(0, motherIdx + 1),
        chat,
        ...without.slice(motherIdx + 1),
      ];
    });
    setActiveChatId(chat.id);
    setWorkflowViewMode("chat");
    setListError(null);
  }, [motherConversationId]);

  const handleToggleNotifications = () => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === activeChat.id) {
          return { ...c, notifications: !c.notifications };
        }
        return c;
      }),
    );
  };

  const handleRenameChat = () => {
    const newName = prompt(
      "Enter new name for the conversation:",
      activeChat.name,
    );
    if (newName && newName.trim()) {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === activeChat.id) {
            return { ...c, name: newName.trim() };
          }
          return c;
        }),
      );
    }
  };

  const handleArchiveChat = () => {
    alert(`Moved conversation "${activeChat.name}" to Archive.`);
    const remainingChats = chats.filter((c) => c.id !== activeChat.id);
    setChats(remainingChats);
    if (remainingChats.length > 0) {
      setActiveChatId(remainingChats[0].id);
    }
  };

  const handleDeleteChat = () => {
    if (
      confirm(
        `Are you sure you want to delete the conversation "${activeChat.name}"?`,
      )
    ) {
      const remainingChats = chats.filter((c) => c.id !== activeChat.id);
      setChats(remainingChats);
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0].id);
      }
    }
  };

  const handleCompleteWorking = (msgId: string) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id === msgId) {
                return {
                  ...m,
                  text: "Trợ Lý:\n\nTờ trình phê duyệt:\n\nĐề xuất cấp hạn mức 50 tỷ đồng – Lãi suất 6.5%/năm – Thời hạn 12 tháng… 🧧\n\nXem chi tiết tờ trình tại bảng bên phải sau khi bạn duyệt giúp em nhé!",
                };
              }
              return m;
            }),
          };
        }
        return chat;
      }),
    );
  };

  const handleApproveMessage = (msgId: string) => {
    setApprovedMessages((prev) => ({ ...prev, [msgId]: true }));

    setTimeout(() => {
      const scheduleMsgId = `sched_${  Date.now()}`;
      const progressMsg: Message = {
        id: scheduleMsgId,
        sender: "them",
        text: "[PROGRESS_SCHEDULING]",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        read: true,
      };

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id === activeChatId) {
            return {
              ...chat,
              messages: [...chat.messages, progressMsg],
            };
          }
          return chat;
        }),
      );
    }, 800);
  };

  const handleCompleteScheduling = (msgId: string) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id === msgId) {
                return {
                  ...m,
                  text: "Trợ Lý: Tuyệt vời! Tôi đã trình phê duyệt thành công tờ trình tín dụng này lên Ban kiểm soát. 🚀",
                };
              }
              return m;
            }),
          };
        }
        return chat;
      }),
    );
  };

  const handleAttachFile = useCallback(
    async (file: File) => {
      if (!isApiSession || !activeChatId) return;
      setAttachHint(`Đang tải lên ${file.name}…`);
      try {
        const doc = await documentsApi.upload(activeChatId, file);
        setAttachHint(`Đã thêm ${doc.title}`);
        window.setTimeout(() => setAttachHint(null), 4000);
      } catch {
        setAttachHint(`Upload thất bại: ${file.name}`);
        window.setTimeout(() => setAttachHint(null), 4000);
      }
    },
    [activeChatId, isApiSession],
  );

  const handleSendMessage = (text: string) => {
    if (!activeChat.id) return;

    if (isApiSession) {
      void sendSessionMessage(text).catch(() => {
        // error surface via hook state; keep UI quiet for now
      });
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "me",
      text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      read: true,
    };

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === activeChatId) {
          return {
            ...chat,
            messages: [...chat.messages, newMessage],
          };
        }
        return chat;
      }),
    );

    if (text.includes("@Trợ Lý")) {
      setTimeout(() => {
        const workingMsgId = `work_${  Date.now()}`;
        const workingMsg: Message = {
          id: workingMsgId,
          sender: "them",
          text: "[PROGRESS_WORKING]",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          read: true,
        };

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id === activeChatId) {
              return {
                ...chat,
                messages: [...chat.messages, workingMsg],
              };
            }
            return chat;
          }),
        );
      }, 1000);
    }
  };

  const chatsForList = useMemo(() => {
    if (!isApiSession) return chats;
    return chats.map((chat) => {
      if (chat.id !== activeChatId) return chat;
      return {
        ...chat,
        messages: storeMessages,
      };
    });
  }, [activeChatId, chats, isApiSession, storeMessages]);

  return (
    <div
      className="flex h-screen w-screen bg-[#e7ebf0] p-3 gap-3 overflow-hidden font-sans select-none"
      data-chat-shell
    >
      <ChatList
        chats={chatsForList}
        activeChatId={activeChatId}
        setActiveChatId={selectChat}
        onCreateConversation={handleCreateConversation}
        onCreateAgent={handleCreateAgent}
      />

      <div className="min-w-0 flex-1 chat-wallpaper rounded-2xl shadow-xl flex flex-col overflow-hidden relative">
        {listError && (
          <div className="absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-xs text-amber-700 shadow-sm border border-amber-100">
            {listError} — đang dùng dữ liệu demo
          </div>
        )}
        <ChatHeader
          activeChat={activeChat}
          isRightPanelOpen={isRightPanelOpen}
          setIsRightPanelOpen={setIsRightPanelOpen}
          onRenameChat={handleRenameChat}
          onArchiveChat={handleArchiveChat}
          onDeleteChat={handleDeleteChat}
          workflowViewMode={workflowViewMode}
          setWorkflowViewMode={setWorkflowViewMode}
          isAgentTyping={isAgentTyping}
        />
        <ChatMessages
          messages={displayMessages}
          activeChatId={activeChatId}
          agentAvatar={{
            text: activeChat.avatarText,
            bg: activeChat.avatarBg,
            src: activeChat.avatarUrl,
            name: activeChat.name,
          }}
          isAgentTyping={isAgentTyping}
          toolActivity={toolActivity}
          workflowViewMode={workflowViewMode}
          setWorkflowViewMode={setWorkflowViewMode}
          approvedMessages={approvedMessages}
          onApproveMessage={handleApproveMessage}
          onRejectMessage={() => alert("Đã từ chối đề xuất.")}
          onEditMessage={() => alert("Mở trình chỉnh sửa nội dung.")}
          onCompleteWorking={handleCompleteWorking}
          onCompleteScheduling={handleCompleteScheduling}
        />
        <ChatComposer
          onSendMessage={handleSendMessage}
          onAttachFile={isApiSession ? handleAttachFile : undefined}
          attachHint={attachHint}
          workflowViewMode={workflowViewMode}
          setWorkflowViewMode={setWorkflowViewMode}
          disabled={sending && isApiSession}
        />
      </div>

      <div
        className={`flex-shrink-0 overflow-hidden rounded-2xl shadow-xl shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.08)] transition-[width] duration-500 ease-in-out ${
          isRightPanelOpen
            ? "w-[22.5rem] lg:w-[28.125rem]"
            : "w-0 pointer-events-none"
        }`}
      >
        <div className="h-full w-[22.5rem] lg:w-[28.125rem]">
          <ChatPanel
            activeChat={activeChat}
            setIsRightPanelOpen={setIsRightPanelOpen}
            onToggleNotifications={handleToggleNotifications}
            onOpenWorkflowDiagram={() => setWorkflowViewMode("diagram")}
          />
        </div>
      </div>
    </div>
  );
}
