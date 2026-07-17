"use client";

import { useEffect } from "react";

import {
  resolveDocumentTheme,
  type ThemeAppearance,
} from "@/utils/theme/resolve-document-theme";

export function useDocumentTheme(appearance: ThemeAppearance) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const theme = resolveDocumentTheme(appearance, media.matches);
      document.documentElement.dataset.theme = theme;
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
}
