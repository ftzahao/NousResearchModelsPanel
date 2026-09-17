import type { Model } from "../types"
import { useLang } from "../i18n"
import { ModelCard } from "./ModelCard"
import { ModalShell } from "./ModalShell"

export function ModelDetailModal({
  model,
  selected,
  onSelect,
  rawDetails,
  onToggleRawDetails,
  favorite,
  onToggleFavorite,
  onClose
}: {
  model: Model
  selected: boolean
  onSelect: () => void
  rawDetails: boolean
  onToggleRawDetails: () => void
  favorite: boolean
  onToggleFavorite: () => void
  onClose: () => void
}) {
  const { t } = useLang()

  return (
    <ModalShell
      title={t.modelDetails}
      onClose={onClose}
      bodyClassName="flex-1 overflow-auto min-h-0 p-3 sm:p-4"
    >
      <ModelCard
        model={model}
        expanded
        onToggle={onClose}
        selected={selected}
        onSelect={onSelect}
        rawDetails={rawDetails}
        onToggleRawDetails={onToggleRawDetails}
        favorite={favorite}
        onToggleFavorite={onToggleFavorite}
      />
    </ModalShell>
  )
}
