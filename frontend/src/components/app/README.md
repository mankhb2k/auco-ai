# `components/app/`

UI cho **app.aucobot.com** — shell Telegram, sidebar, chat thread, composer, panel phải.

## Layout

```text
app/
  TelegramAppShell/     # 3 cột: list + chat + panel
  ChatList/             # Sidebar trái
  ChatHeader/           # Header cuộc trò chuyện
  ChatMessages/         # Danh sách tin nhắn
  ChatComposer/         # Ô nhập + emoji picker
  ChatPanel/
    ChatPanel/          # Right panel: Session / Room / Agent / Workflow
  EmojiPicker/
  AnimatedEmoji/
  icons/                # Icon phụ trợ app (check marks, phone, …)
```

## Quy ước

- Mỗi component = folder `Name/Name.tsx`.
- **Cấm** gọi `lib/api` trực tiếp — parent/hook lo data.
- Primitives dùng từ `components/ui/`.
