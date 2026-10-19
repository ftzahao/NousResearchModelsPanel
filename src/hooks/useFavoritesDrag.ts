import { useCallback, useState } from "react"
import type { Dispatch, DragEvent, SetStateAction } from "react"
import { reorderFavorites } from "../utils"

export interface DropHint {
  id: string
  position: "before" | "after"
}

/**
 * Drag-and-drop state for reordering the favorites list. `enabled` (only true
 * while the favorites filter is in manual "custom" order) decides whether the
 * view wires the handlers at all.
 */
export function useFavoritesDrag(
  setFavorites: Dispatch<SetStateAction<Set<string>>>,
  enabled: boolean
) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint | null>(null)

  const moveFavorite = useCallback(
    (fromId: string, toId: string, position: "before" | "after") => {
      setFavorites((current) => new Set(reorderFavorites([...current], fromId, toId, position)))
    },
    [setFavorites]
  )

  const handleDragStart = useCallback((id: string) => setDragId(id), [])
  const handleDragOver = useCallback(
    (id: string, e: DragEvent) => {
      if (!dragId || dragId === id) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      const rect = e.currentTarget.getBoundingClientRect()
      const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after"
      setDropHint((prev) =>
        prev && prev.id === id && prev.position === position ? prev : { id, position }
      )
    },
    [dragId]
  )
  const handleDrop = useCallback(
    (id: string) => {
      if (dragId && dropHint?.id === id && dragId !== id) {
        moveFavorite(dragId, id, dropHint.position)
      }
      setDragId(null)
      setDropHint(null)
    },
    [dragId, dropHint, moveFavorite]
  )
  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDropHint(null)
  }, [])

  return { enabled, dragId, dropHint, handleDragStart, handleDragOver, handleDrop, handleDragEnd }
}
