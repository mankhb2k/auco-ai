/** Chữ cái đầu từ tên — dùng ở feature layer cho Avatar primitive. */
export function avatarInitials(name: string, emptyFallback = "?"): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return emptyFallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
