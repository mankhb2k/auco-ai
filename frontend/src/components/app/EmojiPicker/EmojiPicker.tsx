import {
  Clock,
  Smile,
  User,
  Cat,
  Apple,
  Trophy,
  Car,
  Lightbulb,
  Hash,
  Flag,
  Search,
} from "lucide-react";
import React, { useState, useMemo, useEffect, useRef } from "react";
import emojiDataRaw from "./picker-emojis.json";

interface EmojiItem {
  emoji: string;
  name: string;
  codePoint: string;
  relativePath: string;
}

interface EmojiData {
  Smileys: EmojiItem[];
  People: EmojiItem[];
  "Animal-Natural": EmojiItem[];
  "Food-Drink": EmojiItem[];
  Activity: EmojiItem[];
  "Travel-Places": EmojiItem[];
  Objects: EmojiItem[];
  Symbols: EmojiItem[];
  Flags: EmojiItem[];
}

const emojiData: EmojiData = emojiDataRaw;

const TABS = [
  { id: "Recent", icon: Clock, label: "Gần đây" },
  { id: "Smileys", icon: Smile, label: "Biểu cảm" },
  { id: "People", icon: User, label: "Con người" },
  { id: "Animal-Natural", icon: Cat, label: "Động vật" },
  { id: "Food-Drink", icon: Apple, label: "Ẩm thực" },
  { id: "Activity", icon: Trophy, label: "Giải trí" },
  { id: "Travel-Places", icon: Car, label: "Du lịch" },
  { id: "Objects", icon: Lightbulb, label: "Đồ vật" },
  { id: "Symbols", icon: Hash, label: "Ký hiệu" },
  { id: "Flags", icon: Flag, label: "Lá cờ" },
];

export interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelectEmoji,
  onClose,
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Recent"); // Start with Recent tab active
  const [recentEmojis, setRecentEmojis] = useState<EmojiItem[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const isScrollingProgrammaticRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Load recent emojis from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("telegram-clone-recent-emojis");
      if (saved) {
        // eslint-disable-next-line
        setRecentEmojis(JSON.parse(saved) as EmojiItem[]);
      } else {
        // Default popular emojis
        const defaults: EmojiItem[] = [
          { emoji: "😂", name: "face with tears of joy", codePoint: "1f602", relativePath: "Smileys/1f602.webp" },
          { emoji: "👍", name: "thumbs up", codePoint: "1f44d", relativePath: "People/1f44d.webp" },
          { emoji: "❤️", name: "red heart", codePoint: "2764", relativePath: "Symbols/2764.webp" },
          { emoji: "🔥", name: "fire", codePoint: "1f525", relativePath: "Animal-Natural/1f525.webp" },
          { emoji: "🎉", name: "party popper", codePoint: "1f389", relativePath: "Activity/1f389.webp" },
          { emoji: "😆", name: "grinning squinting face", codePoint: "1f606", relativePath: "Smileys/1f606.webp" },
          { emoji: "🤣", name: "rolling on the floor laughing", codePoint: "1f923", relativePath: "Smileys/1f923.webp" },
          { emoji: "😊", name: "smiling face with smiling eyes", codePoint: "1f60a", relativePath: "Smileys/1f60a.webp" },
        ];
        setRecentEmojis(defaults);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to load recent emojis", e);
    }
  }, []);

  // Handle click outside to close the picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectEmoji = (item: EmojiItem) => {
    // Call parent select
    onSelectEmoji(item.emoji);
    
    // Update recents
    const updated = [item, ...recentEmojis.filter((x) => x.emoji !== item.emoji)].slice(0, 32);
    setRecentEmojis(updated);
    localStorage.setItem("telegram-clone-recent-emojis", JSON.stringify(updated));
  };

  // Perform search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const results: EmojiItem[] = [];
    
    const categories: (keyof EmojiData)[] = [
      "Smileys",
      "People",
      "Animal-Natural",
      "Food-Drink",
      "Activity",
      "Travel-Places",
      "Objects",
      "Symbols",
      "Flags",
    ];

    for (const cat of categories) {
      const list = emojiData[cat];
      for (const item of list) {
        if (item.name.toLowerCase().includes(query)) {
          results.push(item);
          if (results.length >= 120) break; // cap search results for performance
        }
      }
      if (results.length >= 120) break;
    }
    return results;
  }, [searchQuery]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    
    const scrollContainer = scrollContainerRef.current;
    const targetEl = categoryRefs.current[tabId];
    
    if (scrollContainer && targetEl) {
      isScrollingProgrammaticRef.current = true;
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      
      const top = targetEl.offsetTop - scrollContainer.offsetTop;
      scrollContainer.scrollTo({ top, behavior: "smooth" });
      
      scrollTimeoutRef.current = window.setTimeout(() => {
        isScrollingProgrammaticRef.current = false;
      }, 500);
    }
  };

  const handleScroll = () => {
    if (isScrollingProgrammaticRef.current) return;
    
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    const scrollTop = scrollContainer.scrollTop;
    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    
    // Bottom edge case: if scrolled to the end, activate the last tab (Flags)
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      if (!searchQuery) {
        setActiveTab("Flags");
      }
      return;
    }

    let currentActiveTab = activeTab;
    const categoryIds = searchQuery ? [] : TABS.map((t) => t.id);
    
    for (const id of categoryIds) {
      const el = categoryRefs.current[id];
      if (el) {
        const top = el.offsetTop - scrollContainer.offsetTop;
        if (scrollTop >= top - 20) {
          currentActiveTab = id;
        }
      }
    }
    
    if (currentActiveTab !== activeTab) {
      setActiveTab(currentActiveTab);
    }
  };

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-[calc(100%+12px)] left-0 w-[390px] h-[400px] bg-white rounded-2xl shadow-xl border border-gray-200/50 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Input */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm biểu tượng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.label}
                onClick={() => handleTabClick(tab.id)}
                className={`p-1.5 rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#e4efff] text-[#3390ec]"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                }`}
              >
                <Icon size={18} className="stroke-[2]" />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 custom-scrollbar"
      >
        {searchQuery ? (
          // Search view
          <>
            <div className="text-xs font-semibold text-gray-400 px-4 py-2.5 uppercase tracking-wider">
              Kết quả tìm kiếm ({searchResults?.length || 0})
            </div>
            {!searchResults || searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-sm text-gray-400 pt-8">
                Không tìm thấy biểu tượng nào
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-2.5 px-4 pb-3">
                {searchResults.map((item) => (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={() => handleSelectEmoji(item)}
                    className="aspect-square flex items-center justify-center p-1 rounded-lg hover:bg-gray-100 transition-all active:scale-90 cursor-pointer"
                    title={item.name}
                  >
                    <span className="text-2xl leading-none select-none">
                      {item.emoji}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          // Multi-category vertically stacked list view
          TABS.map((tab) => {
            const items = tab.id === "Recent" ? recentEmojis : (emojiData[tab.id as keyof EmojiData] || []);
            if (items.length === 0) return null;
            
            return (
              <div
                key={tab.id}
                ref={(el) => {
                  categoryRefs.current[tab.id] = el;
                }}
                className="mb-5"
              >
                <div className="text-xs font-semibold text-gray-400 px-4 py-2.5 uppercase tracking-wider">
                  {tab.label}
                </div>
                <div className="grid grid-cols-8 gap-2.5 px-4 pt-1">
                  {items.map((item) => (
                    <button
                      key={item.emoji}
                      type="button"
                      onClick={() => handleSelectEmoji(item)}
                      className="aspect-square flex items-center justify-center p-1 rounded-lg hover:bg-gray-100 transition-all active:scale-90 cursor-pointer"
                      title={item.name}
                    >
                      <span className="text-2xl leading-none select-none">
                        {item.emoji}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
