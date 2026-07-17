/** Nền avatar tài khoản đã xóa (Telegram-style, không gradient). */
export const avatarDeletedBackground = "bg-[#a8b4c3]";

/** Gradient presets — đủ đậm để chữ trắng đọc rõ (Telegram-style). */
export const avatarGradients = {
  blue: "bg-gradient-to-br from-sky-600 to-blue-700",
  purple: "bg-gradient-to-br from-violet-600 to-purple-700",
  pink: "bg-gradient-to-br from-rose-600 to-pink-600",
  green: "bg-gradient-to-br from-emerald-600 to-green-700",
  orange: "bg-gradient-to-br from-orange-600 to-amber-600",
  red: "bg-gradient-to-br from-red-600 to-rose-700",
  cyan: "bg-gradient-to-br from-cyan-600 to-teal-700",
  gray: "bg-gradient-to-br from-slate-600 to-slate-500",
  indigo: "bg-gradient-to-br from-indigo-600 to-indigo-500",
  teal: "bg-gradient-to-br from-teal-700 to-emerald-600",
  fuchsia: "bg-gradient-to-br from-fuchsia-600 to-purple-600",
  lime: "bg-gradient-to-br from-lime-700 to-green-600",
} as const;

export type AvatarGradient = keyof typeof avatarGradients;

export const AVATAR_GRADIENT_KEYS = Object.keys(
  avatarGradients,
) as AvatarGradient[];

/** Map token cũ trong mockData → gradient class. */
const legacyAvatarBackgrounds: Record<string, string> = {
  "bg-avatar-blue": avatarGradients.blue,
  "bg-avatar-purple": avatarGradients.purple,
  "bg-avatar-pink": avatarGradients.pink,
  "bg-avatar-green": avatarGradients.green,
  "bg-avatar-orange": avatarGradients.orange,
  "bg-avatar-red": avatarGradients.red,
  "bg-avatar-cyan": avatarGradients.cyan,
  "bg-avatar-gray": avatarGradients.gray,
  "bg-avatar-indigo": avatarGradients.indigo,
  "bg-avatar-teal": avatarGradients.teal,
  "bg-avatar-deleted": avatarDeletedBackground,
};

export function isDeletedAvatarBg(bg: string): boolean {
  return bg === "deleted" || bg === "bg-avatar-deleted";
}

export function resolveAvatarBackground(bg: string): string {
  if (isDeletedAvatarBg(bg)) {
    return avatarDeletedBackground;
  }

  if (bg in avatarGradients) {
    return avatarGradients[bg as AvatarGradient];
  }

  if (bg in legacyAvatarBackgrounds) {
    return legacyAvatarBackgrounds[bg];
  }

  return bg;
}

export function avatarGradientByIndex(index: number): string {
  const key = AVATAR_GRADIENT_KEYS[Math.abs(index) % AVATAR_GRADIENT_KEYS.length];
  return avatarGradients[key];
}
