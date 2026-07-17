import { Smile, Paperclip, Send, Mic, MessageSquare } from "lucide-react";
import React, { useRef, useState } from "react";
import { EmojiPicker } from "@/components/app/EmojiPicker/EmojiPicker";

export interface ChatComposerProps {
  onSendMessage: (text: string) => void;
  onAttachFile?: (file: File) => void | Promise<void>;
  attachHint?: string | null;
  workflowViewMode?: "chat" | "diagram";
  setWorkflowViewMode?: (mode: "chat" | "diagram") => void;
  disabled?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  onAttachFile,
  attachHint = null,
  workflowViewMode,
  setWorkflowViewMode,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = () => {
    if (disabled || !inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue("");
    setIsEmojiPickerOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  if (workflowViewMode === "diagram") {
    return (
      <div className="w-full max-w-[720px] mx-auto px-4 pb-4 pt-1.5 flex flex-col items-center gap-2 flex-shrink-0 z-10 bg-transparent relative">
        <button
          onClick={() => setWorkflowViewMode?.("chat")}
          className="w-full h-[48px] bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] hover:from-[#0284c7] hover:to-[#1d4ed8] text-white rounded-2xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer select-none border-none"
        >
          <MessageSquare size={18} />
          Trò chuyện với Trợ lý để chỉnh sửa Sơ đồ này
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 pb-4 pt-1.5 flex flex-col gap-1.5 flex-shrink-0 z-10 bg-transparent relative">
      {attachHint && (
        <div className="text-xs text-emerald-700 bg-white/90 border border-emerald-100 rounded-full px-3 py-1 w-fit shadow-sm">
          {attachHint}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white rounded-2xl flex items-center px-3 py-1 shadow-sm border border-gray-200/10 relative">
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            className={`text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-50 transition-colors ${
              isEmojiPickerOpen ? "text-[#3390ec] bg-[#e4efff]" : ""
            }`}
          >
            <Smile size={24} className="stroke-[1.8]" />
          </button>

          {isEmojiPickerOpen && (
            <EmojiPicker
              onSelectEmoji={(emoji) => setInputValue((prev) => prev + emoji)}
              onClose={() => setIsEmojiPickerOpen(false)}
            />
          )}

          <input
            type="text"
            placeholder="Message"
            value={inputValue}
            disabled={disabled}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 bg-transparent border-none focus:outline-none px-2 py-2.5 text-gray-800 placeholder-gray-400 disabled:opacity-60"
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              input.value = "";
              if (file) void onAttachFile?.(file);
            }}
          />
          <button
            type="button"
            disabled={disabled || !onAttachFile}
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-50 transition-colors transform -rotate-45 disabled:opacity-40 disabled:pointer-events-none"
            title="Đính kèm tài liệu"
          >
            <Paperclip size={21} className="stroke-[1.8]" />
          </button>
        </div>

        {inputValue.trim() ? (
          <button
            onClick={handleSendMessage}
            disabled={disabled}
            className="w-[48px] h-[48px] rounded-full bg-white flex items-center justify-center shadow-sm text-[#3390ec] hover:text-blue-600 flex-shrink-0 transition-all hover:scale-105 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Send size={22} className="stroke-[2.2]" />
          </button>
        ) : (
          <button className="w-[48px] h-[48px] rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400 hover:text-gray-600 flex-shrink-0 transition-all">
            <Mic size={24} className="stroke-[1.8]" />
          </button>
        )}
      </div>
    </div>
  );
};
