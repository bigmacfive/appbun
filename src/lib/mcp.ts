import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { resolveAppConfig, writeProject } from "./generator.js";
import { createFallbackSiteMetadata, fetchSiteMetadata } from "./metadata.js";
import { appRecipes, findAppRecipe, listRecipeConcepts, searchAppRecipes } from "./recipes.js";
import type { CreateCommandOptions, TitlebarStyle } from "./types.js";
import { getAppbunVersion } from "./version.js";

const TITLEBARS: TitlebarStyle[] = ["system", "unified", "compact", "minimal"];

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

interface CreateInput {
  target: string;
  name?: string;
  outDir?: string;
  titlebar?: TitlebarStyle;
  themeColor?: string;
  width?: number;
  height?: number;
  icon?: boolean;
}

/**
 * Non-interactive scaffold used by the MCP `appbun_create` tool. Mirrors the CLI create
 * flow (recipe resolution → metadata → resolveAppConfig → writeProject) but never prompts
 * and never installs or packages, so it is safe to run inside an agent session.
 */
async function createProjectHeadless(input: CreateInput) {
  const target = input.target.trim();
  let url = target;
  let recipeLabel: string | undefined;
  const recipeDefaults: Partial<CreateCommandOptions> = {};

  if (!looksLikeUrl(target)) {
    const recipe = findAppRecipe(target);
    if (!recipe) {
      const suggestions = searchAppRecipes(target).slice(0, 3).map((r) => r.slug);
      const hint = suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : "";
      throw new Error(`Unknown recipe or URL: ${target}.${hint}`);
    }
    url = recipe.url;
    recipeLabel = `${recipe.slug} (${recipe.name})`;
    recipeDefaults.name = recipe.name;
    recipeDefaults.description = recipe.description;
    recipeDefaults.themeColor = recipe.themeColor;
    recipeDefaults.titlebar = recipe.titlebar;
    recipeDefaults.width = recipe.width;
    recipeDefaults.height = recipe.height;
  }

  if (input.titlebar && !TITLEBARS.includes(input.titlebar)) {
    throw new Error(`Invalid titlebar: ${input.titlebar}. Use one of ${TITLEBARS.join(", ")}.`);
  }

  const options: CreateCommandOptions = {
    name: input.name ?? recipeDefaults.name,
    outDir: input.outDir,
    description: recipeDefaults.description,
    themeColor: input.themeColor ?? recipeDefaults.themeColor,
    titlebar: input.titlebar ?? recipeDefaults.titlebar ?? "unified",
    width: input.width ?? recipeDefaults.width ?? 1440,
    height: input.height ?? recipeDefaults.height ?? 900,
    packageManager: "bun",
    install: false,
    dmg: false,
    icon: input.icon !== false,
    yes: true,
    showConfig: false,
    quiet: true,
  };

  const metadata = await fetchSiteMetadata(url).catch(() => createFallbackSiteMetadata(url));
  const config = resolveAppConfig(url, options, metadata);
  const iconMetadata = options.icon === false ? { ...metadata, iconCandidates: [] } : metadata;
  const prepared = await writeProject(config, iconMetadata);

  return {
    name: config.name,
    url: config.url,
    outDir: config.outDir,
    recipe: recipeLabel,
    iconSource: prepared.sourceUrl ?? null,
    nextSteps: [
      `cd ${config.outDir}`,
      `${config.packageManager} install`,
      `${config.packageManager} run dev`,
      `appbun package --cwd ${config.outDir} --dmg   # macOS only`,
    ],
  };
}

const TOOLS = [
  {
    name: "appbun_create",
    description:
      "Scaffold an inspectable Electrobun desktop app project from a website URL or a built-in recipe slug. Does not install dependencies or build a DMG; returns the output directory and next-step commands.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Website URL (https://...) or a built-in recipe slug like 'chatgpt'." },
        name: { type: "string", description: "App display name. Defaults to the recipe name or site title." },
        outDir: { type: "string", description: "Output directory. Defaults to a slug-derived folder." },
        titlebar: { type: "string", enum: TITLEBARS, description: "Window chrome preset." },
        themeColor: { type: "string", description: "Accent color hex, e.g. #2563eb." },
        width: { type: "number", description: "Window width in pixels." },
        height: { type: "number", description: "Window height in pixels." },
        icon: { type: "boolean", description: "Set false to skip icon extraction. Defaults true." },
      },
      required: ["target"],
    },
  },
  {
    name: "appbun_recipes",
    description: "List appbun's built-in app recipes, optionally filtered by concept (e.g. ai, design, music, work).",
    inputSchema: {
      type: "object",
      properties: { concept: { type: "string", description: "Filter recipes by concept." } },
    },
  },
  {
    name: "appbun_discover",
    description: "Search recipes by concept, name, alias, or description. Omit query to list all known concepts.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term. Omit to list concepts." } },
    },
  },
] as const;

function asText(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

export async function runMcpServer(): Promise<void> {
  const server = new Server(
    { name: "appbun", version: getAppbunVersion() },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS as unknown as typeof TOOLS[number][] }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      switch (name) {
        case "appbun_create": {
          const result = await createProjectHeadless(args as unknown as CreateInput);
          return asText(result);
        }
        case "appbun_recipes": {
          const concept = (args as { concept?: string }).concept;
          const recipes = concept ? searchAppRecipes(concept) : appRecipes;
          return asText(recipes);
        }
        case "appbun_discover": {
          const query = (args as { query?: string }).query;
          if (!query) return asText({ concepts: listRecipeConcepts() });
          return asText(searchAppRecipes(query));
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: message }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive on stdio; the transport resolves connect() immediately.
  process.stderr.write(`appbun MCP server ${getAppbunVersion()} ready (stdio)\n`);
}
