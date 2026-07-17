import { avatarInitials } from "./avatar-initials";
import { resolveAvatarColor } from "./resolve-avatar-color";

import type { AvatarSize } from "@/utils/avatar/types";

interface BuildAvatarPropsOptions {
  size?: AvatarSize;
  src?: string;
  decorative?: boolean;
  imageFallbackDelayMs?: number;
  emptyInitials?: string;
}

/** Gom logic initials + màu — dùng ở feature layer, không trong Avatar primitive. */
export function buildAvatarProps(
  name: string,
  seed: string,
  options?: BuildAvatarPropsOptions,
) {
  const {
    emptyInitials,
    size,
    src,
    decorative,
    imageFallbackDelayMs,
  } = options ?? {};

  return {
    fallbackText: avatarInitials(name, emptyInitials),
    backgroundColor: resolveAvatarColor(seed),
    alt: name,
    size,
    src,
    decorative,
    imageFallbackDelayMs,
  };
}
