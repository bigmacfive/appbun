import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const filePath = resolve("docs", "showcase", "community-builds.json");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function fieldFromIssueBody(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`### ${escaped}\\s+([\\s\\S]*?)(?=\\n### |$)`, "i"));
  return match?.[1]?.trim() || undefined;
}

async function readIssueFields() {
  if (!process.env.GITHUB_EVENT_PATH) {
    return {};
  }

  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const body = event.issue?.body;
  if (typeof body !== "string") {
    return {};
  }

  return {
    name: fieldFromIssueBody(body, "App name"),
    url: fieldFromIssueBody(body, "App URL"),
    builder: fieldFromIssueBody(body, "Builder name"),
    description: fieldFromIssueBody(body, "What did you build?"),
    command: fieldFromIssueBody(body, "Build command"),
    repository: fieldFromIssueBody(body, "Source repo or writeup"),
    screenshot: fieldFromIssueBody(body, "Screenshot URL"),
  };
}

function assertHttpUrl(value, label) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must start with http:// or https://`);
  }
  return parsed.toString();
}

const issueFields = await readIssueFields();

function requiredValue(envName, issueName) {
  return process.env[envName]?.trim() || issueFields[issueName] || requiredEnv(envName);
}

function optionalValue(envName, issueName) {
  return process.env[envName]?.trim() || issueFields[issueName] || undefined;
}

const entry = {
  name: requiredValue("APPBUN_GALLERY_NAME", "name"),
  url: assertHttpUrl(requiredValue("APPBUN_GALLERY_URL", "url"), "APPBUN_GALLERY_URL"),
  builder: requiredValue("APPBUN_GALLERY_BUILDER", "builder"),
  description: requiredValue("APPBUN_GALLERY_DESCRIPTION", "description"),
  command: requiredValue("APPBUN_GALLERY_COMMAND", "command"),
  repository: optionalValue("APPBUN_GALLERY_REPOSITORY", "repository"),
  screenshot: optionalValue("APPBUN_GALLERY_SCREENSHOT", "screenshot"),
};

if (entry.repository) {
  entry.repository = assertHttpUrl(entry.repository, "APPBUN_GALLERY_REPOSITORY");
}

if (entry.screenshot) {
  entry.screenshot = assertHttpUrl(entry.screenshot, "APPBUN_GALLERY_SCREENSHOT");
}

const existing = JSON.parse(await readFile(filePath, "utf8"));
if (!Array.isArray(existing)) {
  throw new Error("docs/showcase/community-builds.json must contain an array");
}

const withoutDuplicate = existing.filter((item) => {
  return item.url !== entry.url && item.name?.toLowerCase() !== entry.name.toLowerCase();
});

withoutDuplicate.push(entry);
withoutDuplicate.sort((a, b) => String(a.name).localeCompare(String(b.name)));

await writeFile(filePath, `${JSON.stringify(withoutDuplicate, null, 2)}\n`, "utf8");
console.log(`Added community build: ${entry.name}`);
