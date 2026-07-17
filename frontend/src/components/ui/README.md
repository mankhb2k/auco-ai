# `components/ui/`

Design system nội bộ — **primitives nguyên tử**: không hardcode copy, độ dài, palette, logic domain.  
Feature layer (`components/chat`, `components/auth`, …) truyền props + dùng `utils/` khi cần.

**Radix UI** cho primitives có sẵn (a11y, focus, portal…).

## Implemented

| Component | Radix | Props bắt buộc / ghi chú |
|-----------|-------|--------------------------|
| `Avatar/` | `react-avatar` | `fallbackText`, `backgroundColor`; dùng `buildAvatarProps()` ở feature |
| `Dropdown/` | `react-dropdown-menu` | Wrapper primitive — nội dung qua children |
| `FloatingBar/` | — | `children` |
| `OtpInput/` | `label`, `visually-hidden` | `length`, `label`, `getDigitAriaLabel` |
| `Search/` | `label`, `visually-hidden` | `label`, `placeholder`, `clearAriaLabel` |
| `StatusBadge/` | — | `ok`, `label` |
| `ToggleGroup/` | `react-toggle-group` | `aria-label` trên root; `scrollable` để cuộn ngang trong khung cha |

## Utils (không thuộc `ui/`)

- `utils/avatar/build-avatar-props.ts` — initials + màu từ seed
- `utils/avatar/avatar-initials.ts`
- `utils/avatar/resolve-avatar-color.ts`

## Planned components

- `Button/`
- `Input/`
- `Spinner/`
- `Badge/`
- `Toast/` (hoặc infra context)

## Mỗi component

```text
Button/
  Button.tsx
  Button.module.css
  Button.stories.tsx
```

Props typed rõ; không fetch; không Zustand.
