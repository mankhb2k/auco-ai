export type ThemeAppearance = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export function resolveDocumentTheme(
  appearance: ThemeAppearance,
  prefersDark: boolean,
): ResolvedTheme {
  if (appearance === "system") {
    return prefersDark ? "dark" : "light";
  }

  return appearance;
}
