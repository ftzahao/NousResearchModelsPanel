import { Layers, Globe, Brain, Sparkles, Activity } from "lucide-react"
import { StatCard } from "./StatCard"
import { useLang } from "../i18n"

export interface AppStats {
  total: number
  providers: number
  reasoning: number
  free: number
  avgIntelligence: string
}

export function StatsGrid({ stats }: { stats: AppStats }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
      <StatCard icon={<Layers size={18} />} label={t.totalModels} value={stats.total} />
      <StatCard icon={<Globe size={18} />} label={t.providers} value={stats.providers} />
      <StatCard icon={<Brain size={18} />} label={t.reasoningModels} value={stats.reasoning} />
      <StatCard icon={<Sparkles size={18} />} label={t.freeModels} value={stats.free} />
      <StatCard
        icon={<Activity size={18} />}
        label={t.avgIntelligence}
        value={stats.avgIntelligence}
      />
    </div>
  )
}
