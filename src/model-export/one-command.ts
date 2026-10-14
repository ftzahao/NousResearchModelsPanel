/**
 * The dashboard's "one command (no download)" export: a copy-pasteable
 * `deno run … merge.ts --one <program>=<id,…>` line built from the current
 * selection. `--one` is an alias of `-p`: the remote script fetches the model
 * list from the Nous API and merges straight into the tool's target config —
 * no export download, no separate merge step.
 *
 * Kept dependency-free so the browser bundle never pulls in `scripts/merge.ts`
 * (which uses Node APIs). `scripts/merge.ts` mirrors this logic; merge.test.ts
 * keeps the two in sync.
 */
import { translations } from "../translations"
import type { Lang } from "../types"

export type OneCommandResult = { command: string } | { note: string }

const REMOTE_MERGE_URL =
  "https://raw.githubusercontent.com/ftzahao/NousResearchModelsPanel/main/scripts/merge.ts"

const DENO_ONE_PREFIX = `deno run --no-lock --allow-read --allow-write --allow-env --allow-net ${REMOTE_MERGE_URL}`

const PASTE_ONLY_PROGRAM_IDS = new Set(["chatbox"])

export function buildOneCommand(
  program: string,
  ids: string[],
  lang: Lang
): OneCommandResult {
  const t = translations[lang].mergeCli
  if (PASTE_ONLY_PROGRAM_IDS.has(program)) return { note: t.pasteOnly }
  if (ids.length === 0) return { note: t.needSelection }
  const arg = `${program}=${ids.map(encodeURIComponent).join(",")}`
  return { command: `${DENO_ONE_PREFIX} --one ${arg}` }
}
