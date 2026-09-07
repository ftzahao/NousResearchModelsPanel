import type { ExportableModel, ModelConfigExporter } from "../model-export"

export type Lang = "zh" | "en"
export type Theme = "dark" | "light"
export type Currency = "USD" | "CNY"
export type { ExportableModel, ModelConfigExporter }

export interface Model {
  id: string
  name: string
  created: number
  description: string
  context_length: number
  architecture: {
    modality: string
    input_modalities: string[]
    output_modalities: string[]
    tokenizer: string
  }
  pricing: {
    prompt: string
    completion: string
    image?: string
    audio?: string
    input_cache_read?: string
    input_cache_write?: string
    input_cache_write_1h?: string
    web_search?: string
    internal_reasoning?: string
    overrides?: Array<{
      min_prompt_tokens?: number
      max_prompt_tokens?: number
      utc_days?: string[]
      utc_start?: number
      utc_end?: number
      prompt?: string
      completion?: string
      input_cache_read?: string
      input_cache_write?: string
    }>
    original?: {
      prompt?: string
      completion?: string
      image?: string
      audio?: string
      input_cache_read?: string
      input_cache_write?: string
      web_search?: string
      internal_reasoning?: string
    }
  }
  top_provider: {
    context_length: number
    max_completion_tokens: number
    is_moderated: boolean
  }
  supported_parameters: string[]
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number
      coding_index?: number
      agentic_index?: number
    }
    design_arena?: Array<{
      arena: string
      category: string
      elo: number
      win_rate: number
      rank: number
    }>
  }
  reasoning?: {
    mandatory: boolean
    default_enabled?: boolean
    supported_efforts: string[]
    default_effort: string
  }
  synthesizedFreeVariant?: boolean
  alias_target?: { name: string; slug: string }
  aliases?: string[]
}

