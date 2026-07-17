# App ChatPanel

Right panel metadata — route theo loại hội thoại:

| Panel | Khi nào |
|-------|---------|
| `PanelSession` | Tin nhắn · `conversationType: session` |
| `PanelRoom` | Tin nhắn · `conversationType: room` |
| `PanelAgent` | Tab Agent (Mother + user DM) |
| `PanelWorkflow` | Tab Workflow |

Shared: `PanelChrome`, `EntityHeader`, `NotificationsRow`, `PanelCard`.

Router: [`ChatPanel.tsx`](./ChatPanel.tsx) — shell chỉ gọi `<ChatPanel />`.
