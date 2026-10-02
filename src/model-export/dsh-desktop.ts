import type { ExportableModel } from "./shared"
import {
  DSH_LLM_PI_AI_ID,
  DSH_PROVIDER_ID,
  buildDshProviderProfile,
  type DshProviderProfile
} from "./dsh"

// the desktop app composes its config from a profile, and a profile's user layer is a
// cordis.patch.yml: a top-level YAML array of id-targeted patch entries applied after the
// bundle layers, so one entry of exactly this shape is what the desktop app mounts.
export interface DshDesktopPatchEntry {
  id: typeof DSH_LLM_PI_AI_ID
  name: string
  config: { providers: Record<string, DshProviderProfile> }
}

// `name` must be the bundling package, otherwise the patch targets no entry and only
// prints a stderr warning at boot
const DSH_DESKTOP_PATCH_PACKAGE = "@deepseek-ai/dsh-llm-pi-ai"

export function buildDshDesktopPatch(models: ExportableModel[]): DshDesktopPatchEntry[] {
  return [
    {
      id: DSH_LLM_PI_AI_ID,
      name: DSH_DESKTOP_PATCH_PACKAGE,
      config: {
        providers: {
          [DSH_PROVIDER_ID]: buildDshProviderProfile(models)
        }
      }
    }
  ]
}
