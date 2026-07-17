/** Gradient Tailwind classes — keep in utils so hooks/lib don't import components. */
const AVATAR_COLORS = [
  "bg-gradient-to-br from-sky-600 to-blue-700",
  "bg-gradient-to-br from-violet-600 to-purple-700",
  "bg-gradient-to-br from-rose-600 to-pink-600",
  "bg-gradient-to-br from-emerald-600 to-green-700",
  "bg-gradient-to-br from-orange-600 to-amber-600",
  "bg-gradient-to-br from-red-600 to-rose-700",
  "bg-gradient-to-br from-cyan-600 to-teal-700",
  "bg-gradient-to-br from-slate-600 to-slate-500",
  "bg-gradient-to-br from-indigo-600 to-indigo-500",
  "bg-gradient-to-br from-teal-700 to-emerald-600",
  "bg-gradient-to-br from-fuchsia-600 to-purple-600",
  "bg-gradient-to-br from-lime-700 to-green-600",
] as const;

export const AVATAR_GRADIENT_KEYS = [
  "blue",
  "purple",
  "pink",
  "green",
  "orange",
  "red",
  "cyan",
  "gray",
  "indigo",
  "teal",
  "fuchsia",
  "lime",
] as const;

/** Gradient avatar ổn định theo seed — dùng ở feature/lib layer. */
export function resolveAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
