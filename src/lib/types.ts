export type PackageManager = "bun" | "npm";
export type TitlebarStyle = "system" | "unified" | "compact" | "minimal";
export type BrowserEngine = "native" | "cef";
export type BrowserEngineOption = BrowserEngine | "auto";

export type IconFormat = "png" | "svg" | "ico";

export interface CreateCommandOptions {
  name?: string;
  outDir?: string;
  title?: string;
  description?: string;
  identifier?: string;
  themeColor?: string;
  titlebar?: TitlebarStyle;
  width: number;
  height: number;
  packageManager: PackageManager;
  browserEngine?: BrowserEngineOption;
  compatibilityNotes?: string[];
  install: boolean;
  dmg: boolean;
  icon?: boolean;
  yes: boolean;
  showConfig: boolean;
  quiet: boolean;
}

export interface SiteMetadata {
  title?: string;
  description?: string;
  themeColor?: string;
  sourceUrl: string;
  iconCandidates: IconCandidate[];
}

export interface IconCandidate {
  url: string;
  rel: string;
  format?: IconFormat;
  sizes: number[];
  purpose?: string;
  mimeType?: string;
}

export interface PreparedIconAssets {
  png?: string;
  ico?: string;
  macIconset?: string;
  sourceUrl?: string;
}

export interface SigningOptions {
  identityEnv: "APPLE_SIGN_IDENTITY";
  requireEnv: "APPBUN_DMG_SIGN";
}

export interface ResolvedAppConfig {
  name: string;
  title: string;
  description: string;
  identifier: string;
  packageName: string;
  slug: string;
  themeColor: string;
  titlebar: TitlebarStyle;
  url: string;
  origin: string;
  outDir: string;
  width: number;
  height: number;
  packageManager: PackageManager;
  browserEngine: BrowserEngine;
  compatibilityNotes: string[];
}

export interface GeneratedFile {
  path: string;
  content: string | Uint8Array;
}
