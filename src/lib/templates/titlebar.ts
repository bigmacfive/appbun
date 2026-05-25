import type { TitlebarStyle } from "../types.js";

export function getTitlebarPreset(style: TitlebarStyle) {
  switch (style) {
    case "system":
      return {
        id: "system",
        macTitleBarStyle: "default",
        macUsesUnifiedChrome: false,
        showCustomToolbar: false,
        toolbarHeight: 0,
        toolbarLeft: 0,
        showOrigin: false,
        showBorder: false,
        readmeDescription: "the default system title bar on macOS and standard native chrome on other platforms",
      } as const;
    case "compact":
      return {
        id: "compact",
        macTitleBarStyle: "hiddenInset",
        macUsesUnifiedChrome: true,
        showCustomToolbar: true,
        toolbarHeight: 36,
        toolbarLeft: 74,
        showOrigin: true,
        showBorder: true,
        readmeDescription: "a tighter hidden inset macOS toolbar with connected content and standard native chrome on other platforms",
      } as const;
    case "minimal":
      return {
        id: "minimal",
        macTitleBarStyle: "hiddenInset",
        macUsesUnifiedChrome: true,
        showCustomToolbar: true,
        toolbarHeight: 34,
        toolbarLeft: 74,
        showOrigin: false,
        showBorder: false,
        readmeDescription: "a lighter hidden inset macOS toolbar with minimal metadata and standard native chrome on other platforms",
      } as const;
    case "unified":
    default:
      return {
        id: "unified",
        macTitleBarStyle: "hiddenInset",
        macUsesUnifiedChrome: true,
        showCustomToolbar: true,
        toolbarHeight: 40,
        toolbarLeft: 78,
        showOrigin: true,
        showBorder: true,
        readmeDescription: "a hidden inset macOS toolbar with a connected local header and standard native chrome on other platforms",
      } as const;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
