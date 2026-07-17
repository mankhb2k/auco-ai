export interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  read: boolean;
}

/** Agent identity beside every them-side row (message / typing / tool). */
export type ChatAgentAvatar = {
  text?: string;
  bg?: string;
  src?: string;
  name?: string;
};

export interface Chat {
  id: string;
  name: string;
  status: string;
  avatarText?: string;
  avatarBg?: string;
  avatarUrl?: string;
  isChannel?: boolean;
  /** Telegram-style verified badge (system agents như AucoMother). */
  verified?: boolean;
  phone?: string;
  notifications: boolean;
  messages: Message[];
  sharedMedia: string[];
  category?: "chat" | "agent" | "workflow";
  /** API conversation kind — có khi lấy từ /api/conversations hoặc agent/Mother DM */
  conversationType?: "room" | "session";
  /** Agent entity id — khi sidebar chat là DM của agent */
  agentId?: string;
  pinned?: boolean;
  description?: string;
  trigger?: string;
  lastRun?: string;
}
