export interface AppRecipe {
  slug: string;
  name: string;
  url: string;
  description: string;
  themeColor: string;
  titlebar?: "system" | "unified" | "compact" | "minimal";
  width?: number;
  height?: number;
  aliases?: string[];
  concepts: string[];
  /**
   * When true, this app is safe to pre-build and redistribute as a downloadable
   * binary in the gallery (open-source / tool sites with low trademark + ToS
   * exposure). Trademarked or auth-gated apps are left to the on-demand builder
   * and only show their `npx appbun <slug>` command in the gallery.
   */
  prebuild?: boolean;
}

export const appRecipes: AppRecipe[] = [
  {
    slug: "chatgpt",
    name: "ChatGPT",
    url: "https://chat.openai.com/",
    description: "AI assistant workspace",
    themeColor: "#10a37f",
    titlebar: "compact",
    aliases: ["openai", "gpt"],
    concepts: ["ai", "chat", "productivity", "writing"],
  },
  {
    slug: "github",
    name: "GitHub",
    url: "https://github.com/",
    description: "Code hosting and public repository browsing",
    themeColor: "#111827",
    titlebar: "compact",
    concepts: ["developer", "code", "git", "open-source"],
  },
  {
    slug: "linear",
    name: "Linear",
    url: "https://linear.app/",
    description: "Issue tracking and product planning",
    themeColor: "#5e6ad2",
    titlebar: "compact",
    concepts: ["productivity", "project-management", "work"],
  },
  {
    slug: "notion",
    name: "Notion",
    url: "https://www.notion.so/",
    description: "Docs, notes, and team workspace",
    themeColor: "#111827",
    concepts: ["docs", "notes", "productivity", "work"],
  },
  {
    slug: "gmail",
    name: "Gmail",
    url: "https://mail.google.com/",
    description: "Email and inbox workspace",
    themeColor: "#ea4335",
    titlebar: "compact",
    concepts: ["email", "google", "productivity", "work"],
  },
  {
    slug: "google-calendar",
    name: "Google Calendar",
    url: "https://calendar.google.com/",
    description: "Calendar and scheduling",
    themeColor: "#1a73e8",
    titlebar: "compact",
    aliases: ["calendar", "gcal"],
    concepts: ["calendar", "google", "productivity", "work"],
  },
  {
    slug: "google-drive",
    name: "Google Drive",
    url: "https://drive.google.com/",
    description: "Cloud files and document storage",
    themeColor: "#188038",
    aliases: ["drive", "gdrive"],
    concepts: ["files", "google", "docs", "productivity", "work"],
  },
  {
    slug: "figma",
    name: "Figma",
    url: "https://www.figma.com/",
    description: "Collaborative interface design",
    themeColor: "#a259ff",
    width: 1600,
    height: 1000,
    concepts: ["design", "collaboration", "work"],
  },
  {
    slug: "canva",
    name: "Canva",
    url: "https://www.canva.com/",
    description: "Visual design and publishing",
    themeColor: "#00c4cc",
    width: 1600,
    height: 1000,
    concepts: ["design", "marketing", "presentation", "work"],
  },
  {
    slug: "slack",
    name: "Slack",
    url: "https://app.slack.com/",
    description: "Team chat and collaboration",
    themeColor: "#4a154b",
    titlebar: "compact",
    concepts: ["chat", "collaboration", "work"],
  },
  {
    slug: "discord",
    name: "Discord",
    url: "https://discord.com/app",
    description: "Communities, voice, and chat",
    themeColor: "#5865f2",
    titlebar: "compact",
    concepts: ["chat", "community", "voice"],
  },
  {
    slug: "trello",
    name: "Trello",
    url: "https://trello.com/",
    description: "Kanban boards and lightweight planning",
    themeColor: "#0c66e4",
    concepts: ["project-management", "productivity", "work"],
  },
  {
    slug: "todoist",
    name: "Todoist",
    url: "https://todoist.com/app",
    description: "Personal tasks and planning",
    themeColor: "#e44332",
    titlebar: "compact",
    concepts: ["tasks", "productivity", "planning"],
  },
  {
    slug: "spotify",
    name: "Spotify",
    url: "https://open.spotify.com/",
    description: "Music and podcast streaming",
    themeColor: "#1db954",
    titlebar: "minimal",
    concepts: ["music", "audio", "entertainment"],
  },
  {
    slug: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/",
    description: "Video streaming and subscriptions",
    themeColor: "#dc2626",
    titlebar: "minimal",
    concepts: ["video", "entertainment", "learning"],
  },
  {
    slug: "youtube-music",
    name: "YouTube Music",
    url: "https://music.youtube.com/",
    description: "Streaming music from the web",
    themeColor: "#ef4444",
    titlebar: "minimal",
    aliases: ["ytmusic"],
    concepts: ["music", "audio", "entertainment"],
  },
  {
    slug: "excalidraw",
    name: "Excalidraw",
    url: "https://excalidraw.com/",
    description: "Collaborative whiteboard and sketching",
    themeColor: "#4f46e5",
    titlebar: "compact",
    concepts: ["design", "whiteboard", "collaboration"],
    prebuild: true,
  },
  {
    slug: "photopea",
    name: "Photopea",
    url: "https://www.photopea.com/",
    description: "Browser-based image editor",
    themeColor: "#0f766e",
    width: 1600,
    height: 1000,
    concepts: ["design", "image-editor", "creative"],
    prebuild: true,
  },
  {
    slug: "squoosh",
    name: "Squoosh",
    url: "https://squoosh.app/",
    description: "Image compression and conversion",
    themeColor: "#ea580c",
    titlebar: "minimal",
    concepts: ["image", "compression", "developer", "creative"],
    prebuild: true,
  },
  {
    slug: "desmos",
    name: "Desmos",
    url: "https://www.desmos.com/calculator",
    description: "Graphing calculator",
    themeColor: "#16a34a",
    concepts: ["math", "education", "learning"],
    prebuild: true,
  },
];

export function findAppRecipe(target: string): AppRecipe | undefined {
  const normalized = target.trim().toLowerCase();
  return appRecipes.find((recipe) => {
    return recipe.slug === normalized || recipe.aliases?.includes(normalized);
  });
}

export function formatRecipeTable(recipes: AppRecipe[] = appRecipes): string {
  const rows = recipes.map((recipe) => [
    recipe.slug,
    recipe.name,
    recipe.url,
    recipe.description,
  ]);
  const widths = [
    columnWidth("recipe", rows.map(([slug]) => slug)),
    columnWidth("name", rows.map(([, name]) => name)),
    columnWidth("url", rows.map(([, , url]) => url)),
    0,
  ];

  return [
    `${pad("recipe", widths[0])}  ${pad("name", widths[1])}  ${pad("url", widths[2])}  description`,
    `${pad("------", widths[0])}  ${pad("----", widths[1])}  ${pad("---", widths[2])}  -----------`,
    ...rows.map(([slug, name, url, description]) => (
      `${pad(slug, widths[0])}  ${pad(name, widths[1])}  ${pad(url, widths[2])}  ${description}`
    )),
  ].join("\n");
}

export function listRecipeConcepts(recipes: AppRecipe[] = appRecipes): string[] {
  return [...new Set(recipes.flatMap((recipe) => recipe.concepts))].sort();
}

export function searchAppRecipes(query: string, recipes: AppRecipe[] = appRecipes): AppRecipe[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return recipes.filter((recipe) => {
    const haystack = [
      recipe.slug,
      recipe.name,
      recipe.url,
      recipe.description,
      ...(recipe.aliases ?? []),
      ...recipe.concepts,
    ].map((value) => value.toLowerCase());

    return haystack.some((value) => value.includes(normalized));
  });
}

export function formatConceptTable(recipes: AppRecipe[] = appRecipes): string {
  const rows = listRecipeConcepts(recipes).map((concept) => {
    const matches = recipes
      .filter((recipe) => recipe.concepts.includes(concept))
      .map((recipe) => recipe.slug)
      .join(", ");
    return [concept, matches];
  });
  const conceptWidth = columnWidth("concept", rows.map(([concept]) => concept));

  return [
    `${pad("concept", conceptWidth)}  recipes`,
    `${pad("-------", conceptWidth)}  -------`,
    ...rows.map(([concept, matches]) => `${pad(concept, conceptWidth)}  ${matches}`),
  ].join("\n");
}

function pad(value: string, width: number): string {
  if (width === 0) {
    return value;
  }
  return value.padEnd(width, " ");
}

function columnWidth(label: string, values: string[]): number {
  return Math.max(label.length, ...values.map((value) => value.length));
}
