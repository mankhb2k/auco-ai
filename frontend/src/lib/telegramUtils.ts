// Helper function to check if a message is emoji-only
export const isEmojiOnly = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // If the message contains any normal alphanumeric letters, it's not emoji-only.
  // We match English, Vietnamese, Cyrillic, and numbers.
  const hasLettersOrNumbers = /[a-zA-Z0-9\u00C0-\u1EF9\u0400-\u04FF]/u.test(
    trimmed,
  );
  if (hasLettersOrNumbers) return false;

  // Check if it contains at least one emoji or symbol.
  // Emojis are generally represented by surrogate pairs in D800-DFFF, or symbols in miscellaneous symbol/pictograph ranges.
  const emojiRegex =
    /[\uD800-\uDBFF][\uDC00-\uDFFF]|\u2600-\u27BF|[\u3000-\u303F]|[\u00ae\u00a9]|\u20e3/;
  return emojiRegex.test(trimmed);
};

const webpDurationCache = new Map<string, number>();

export async function getWebpDuration(url: string): Promise<number> {
  if (webpDurationCache.has(url)) {
    return webpDurationCache.get(url)!;
  }

  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    
    // Check RIFF and WEBP signature
    if (buffer.byteLength < 12) return 0;
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const webp = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    
    if (riff !== "RIFF" || webp !== "WEBP") {
      return 0;
    }

    let offset = 12;
    let totalDuration = 0;

    while (offset < buffer.byteLength) {
      if (offset + 8 > buffer.byteLength) break;
      
      const chunkType = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);
      
      if (chunkType === "ANMF") {
        const durOffset = offset + 8 + 12;
        if (durOffset + 3 <= buffer.byteLength) {
          const frameDuration = view.getUint8(durOffset) |
                                (view.getUint8(durOffset + 1) << 8) |
                                (view.getUint8(durOffset + 2) << 16);
          totalDuration += frameDuration;
        }
      }
      
      const paddedSize = chunkSize + (chunkSize % 2 === 0 ? 0 : 1);
      offset += 8 + paddedSize;
    }

    webpDurationCache.set(url, totalDuration);
    return totalDuration;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error parsing WebP duration:", error);
    return 0;
  }
}

