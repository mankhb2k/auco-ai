import { Menu, Search, Plus, User, Bookmark, Users, Settings, MoreVertical, SquarePen, Moon, HelpCircle, Palette, Zap } from "lucide-react";
import React, { useState } from "react";
import { ChatItem } from "@/components/app/ChatItem/ChatItem";
import { CreateAgentDialog } from "@/components/app/CreateAgentDialog/CreateAgentDialog";
import { CreateConversationDialog } from "@/components/app/CreateConversationDialog/CreateConversationDialog";
import { DropdownContent, DropdownItem, DropdownSeparator, DropdownSub, DropdownSubTrigger, DropdownSubContent } from "@/components/ui/Dropdown/Dropdown";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs/Tabs";
import { useDocumentTheme } from "@/hooks/theme/use-document-theme";

import { initialWorkflows } from "@/lib/mockData";
import type { Chat } from "@/types/chat";
import type { ThemeAppearance } from "@/utils/theme/resolve-document-theme";
import type { CreateAgentInput, CreateConversationInput } from "@auco-ai/shared";

export interface ChatListProps {
  chats: Chat[];
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  /** Gọi API tạo session/room từ shell */
  onCreateConversation?: (input: CreateConversationInput) => Promise<void>;
  /** Gọi API tạo user agent từ shell */
  onCreateAgent?: (input: CreateAgentInput) => Promise<void>;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  setActiveChatId,
  onCreateConversation,
  onCreateAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("Tin nhắn");
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);
  const [isPenMenuOpen, setIsPenMenuOpen] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [appearance, setAppearance] = useState<ThemeAppearance>("system");
  /** Chỉ New Group mở form; New Chat tạo session ngay (kiểu ChatGPT/Gemini). */
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [creatingQuickChat, setCreatingQuickChat] = useState(false);

  useDocumentTheme(appearance);

  async function handleNewChat() {
    setIsPenMenuOpen(false);
    setActiveTab("Tin nhắn");
    if (!onCreateConversation || creatingQuickChat) return;
    setCreatingQuickChat(true);
    try {
      await onCreateConversation({
        type: "session",
        title: "Chat mới",
      });
    } catch {
      // Surface via shell listError; keep menu closed
    } finally {
      setCreatingQuickChat(false);
    }
  }

  function setThemeAppearance(next: ThemeAppearance) {
    setAppearance(next);
    if (next === "dark") {
      setIsNightMode(true);
      return;
    }
    if (next === "light") {
      setIsNightMode(false);
    }
  }

  function toggleNightMode() {
    const nextNightMode = !isNightMode;
    setIsNightMode(nextNightMode);
    setAppearance(nextNightMode ? "dark" : "light");
  }

  const filteredChats = chats
    .filter((chat) => {
      const nameMatches = chat.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const messageMatches = chat.messages.some((m) =>
        m.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const matchesQuery = nameMatches || messageMatches;

      if (activeTab === "Tin nhắn") {
        return matchesQuery && chat.category === "chat";
      }
      if (activeTab === "Agent") {
        return matchesQuery && chat.category === "agent";
      }

      return matchesQuery;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

  return (
    <div
      className={`relative z-20 w-[22.5rem] md:w-[23.75rem] bg-white rounded-2xl shadow-xl flex flex-col flex-shrink-0 ${
        createGroupOpen || createAgentOpen
          ? "overflow-hidden"
          : "overflow-visible"
      }`}
    >
      <div className="relative z-30 p-3 pb-2 flex flex-col gap-2.5 overflow-visible">
        <div className="flex items-center gap-3">
          <div className="relative z-40">
            <button
              onClick={() => setIsSidebarMenuOpen(!isSidebarMenuOpen)}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${isSidebarMenuOpen ? "bg-gray-100 text-[#08060d]" : "text-gray-500 hover:bg-gray-100 hover:text-[#08060d]"}`}
            >
              <Menu size={20} className="stroke-[2.2]" />
            </button>
            <DropdownContent
              isOpen={isSidebarMenuOpen}
              onClose={() => setIsSidebarMenuOpen(false)}
              align="left"
            >
              <div className="px-3 py-2 flex items-center gap-3 mb-1 cursor-pointer hover:bg-black/5 rounded-xl transition-all">
                <div className="w-[34px] h-[34px] rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  M
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-semibold text-gray-900 truncate leading-none">
                    mantv02
                  </span>
                </div>
              </div>
              <DropdownSeparator />
              <DropdownItem icon={<Plus size={18} />} label="Add Account" />
              <DropdownSeparator />
              <DropdownItem icon={<User size={18} />} label="My Profile" />
              <DropdownItem icon={<Bookmark size={18} />} label="Saved Messages" />
              <DropdownItem icon={<Users size={18} />} label="Contacts" />
              <DropdownSub>
                <DropdownSubTrigger icon={<Palette size={18} />} label="Theme" />
                <DropdownSubContent>
                  <DropdownItem
                    label="System"
                    checked={appearance === "system"}
                    onClick={() => setThemeAppearance("system")}
                  />
                  <DropdownItem
                    label="Light"
                    checked={appearance === "light"}
                    onClick={() => setThemeAppearance("light")}
                  />
                  <DropdownItem
                    label="Dark"
                    checked={appearance === "dark"}
                    onClick={() => setThemeAppearance("dark")}
                  />
                </DropdownSubContent>
              </DropdownSub>
              <DropdownItem icon={<Settings size={18} />} label="Settings" />
              <DropdownSub>
                <DropdownSubTrigger icon={<MoreVertical size={18} />} label="More" />
                <DropdownSubContent>
                  <DropdownItem
                    icon={<Moon size={18} />}
                    label="Night Mode"
                    checked={isNightMode}
                    onClick={toggleNightMode}
                  />
                  <DropdownItem icon={<HelpCircle size={18} />} label="Help" />
                </DropdownSubContent>
              </DropdownSub>
            </DropdownContent>
          </div>

          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 stroke-[2.5]"
            />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 hover:bg-gray-200/70 focus:bg-white border border-transparent focus:border-blue-light text-gray-900 text-sm rounded-full py-2 pl-10 pr-4 outline-none transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="relative z-40">
            <button
              onClick={() => setIsPenMenuOpen(!isPenMenuOpen)}
              className={`p-2.5 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                isPenMenuOpen
                  ? "bg-gray-100 text-[#08060d]"
                  : "text-gray-500 hover:bg-gray-100 hover:text-[#08060d]"
              }`}
              title="New"
            >
              <SquarePen size={20} className="stroke-[2.2]" />
            </button>
            <DropdownContent
              isOpen={isPenMenuOpen}
              onClose={() => setIsPenMenuOpen(false)}
              align="right"
            >
              <DropdownItem
                label={creatingQuickChat ? "Đang tạo chat…" : "New Chat"}
                onClick={() => {
                  void handleNewChat();
                }}
              />
              <DropdownItem
                label="New Group"
                onClick={() => {
                  setIsPenMenuOpen(false);
                  setCreateGroupOpen(true);
                  setActiveTab("Tin nhắn");
                }}
              />
              <DropdownItem
                label="New Agent"
                onClick={() => {
                  setIsPenMenuOpen(false);
                  setCreateAgentOpen(true);
                  setActiveTab("Agent");
                }}
              />
            </DropdownContent>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} variant="pills">
          <TabsList>
            <TabsTrigger value="Tin nhắn">Tin nhắn</TabsTrigger>
            <TabsTrigger value="Agent">Agent</TabsTrigger>
            <TabsTrigger value="Workflow">Workflow</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="chat-scroll-view relative z-0 min-h-0 flex-1 thin-scrollbar overflow-y-auto pt-1.5 pb-3 mb-3 flex flex-col gap-0.5 mr-[3px] scrollbar-thin scrollbar-thumb-black/14 hover:scrollbar-thumb-black/26 active:scrollbar-thumb-black/8 scrollbar-track-transparent rounded-b-2xl">
        {activeTab === "Workflow" ? (
          initialWorkflows
            .filter((wf) => wf.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((wf) => {
              const isSelected = wf.id === activeChatId;
              return (
                <div
                  key={wf.id}
                  onClick={() => setActiveChatId(wf.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition-all relative ${
                    isSelected
                      ? "bg-blue-light text-gray-900"
                      : "hover:bg-gray-100/70 bg-white text-gray-900"
                  }`}
                >
                  <div className="w-[38px] h-[38px] rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#0ea5e9] to-[#2563eb] text-white shadow-sm select-none">
                    <Zap size={18} className="fill-current text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-gray-900 truncate pr-1">
                        {wf.name}
                      </h3>
                      <span
                        className={`text-sm whitespace-nowrap ${isSelected ? "text-blue font-medium" : "text-gray-400"}`}
                      >
                        {wf.lastRun}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-gray-500 truncate pr-2 text-xs">
                        {wf.description}
                      </p>

                      <div className="flex items-center flex-shrink-0 pl-1">
                        {wf.status === "running" ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-gray-300" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        ) : (
          filteredChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === activeChatId}
              onClick={() => setActiveChatId(chat.id)}
            />
          ))
        )}
        {activeTab !== "Workflow" && filteredChats.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Không tìm thấy cuộc trò chuyện nào
          </div>
        )}
        {activeTab === "Workflow" &&
          initialWorkflows.filter((wf) =>
            wf.name.toLowerCase().includes(searchQuery.toLowerCase()),
          ).length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Không tìm thấy workflow nào
            </div>
          )}
      </div>

      {onCreateConversation && createGroupOpen && (
        <CreateConversationDialog
          key="create-group"
          open
          type="room"
          onClose={() => setCreateGroupOpen(false)}
          onSubmit={onCreateConversation}
        />
      )}

      {onCreateAgent && createAgentOpen && (
        <CreateAgentDialog
          key="create-agent"
          open
          onClose={() => setCreateAgentOpen(false)}
          onSubmit={onCreateAgent}
        />
      )}
    </div>
  );
};
