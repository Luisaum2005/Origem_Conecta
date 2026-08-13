import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const root = process.cwd();
const fileEnvironment = [".env", ".env.local", ".env.production", ".env.production.local"].reduce(
  (environment, file) => ({ ...environment, ...parseEnvFile(resolve(root, file)) }),
  {},
);
const environment = { ...fileEnvironment, ...process.env };
const url = environment.VITE_SUPABASE_URL?.trim() ?? "";
const anonKey = environment.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
const placeholder = /seu-projeto|sua-chave|replace|example/i;
const problems = [];

try {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") problems.push("VITE_SUPABASE_URL deve usar HTTPS");
} catch {
  problems.push("VITE_SUPABASE_URL ausente ou inválida");
}
if (placeholder.test(url)) problems.push("VITE_SUPABASE_URL ainda contém um placeholder");
if (!anonKey || anonKey.length < 20) problems.push("VITE_SUPABASE_ANON_KEY ausente ou inválida");
if (placeholder.test(anonKey)) problems.push("VITE_SUPABASE_ANON_KEY ainda contém um placeholder");

if (problems.length > 0) {
  console.error("Build de produção bloqueado por configuração insegura:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Configuração de produção validada.");
}
