import { computed, ref } from 'vue'

/**
 * Multi-select state for the home document list. Edit mode is not a separate
 * flag: it is active exactly while at least one document is selected, so
 * deselecting the last document leaves edit mode on its own.
 */
export function useDocumentSelection() {
  const selectedIds = ref<ReadonlySet<string>>(new Set())

  const isActive = computed(() => selectedIds.value.size > 0)
  const count = computed(() => selectedIds.value.size)

  function isSelected(id: string) {
    return selectedIds.value.has(id)
  }

  function beginWith(id: string) {
    if (!selectedIds.value.has(id)) {
      selectedIds.value = new Set([...selectedIds.value, id])
    }
  }

  function toggle(id: string) {
    const next = new Set(selectedIds.value)
    if (!next.delete(id)) {
      next.add(id)
    }
    selectedIds.value = next
  }

  function clear() {
    if (selectedIds.value.size > 0) {
      selectedIds.value = new Set()
    }
  }

  /** Drops selected ids that no longer exist in the document list. */
  function retain(existingIds: Iterable<string>) {
    const existing = new Set(existingIds)
    const next = [...selectedIds.value].filter(id => existing.has(id))
    if (next.length !== selectedIds.value.size) {
      selectedIds.value = new Set(next)
    }
  }

  return {
    selectedIds,
    isActive,
    count,
    isSelected,
    beginWith,
    toggle,
    clear,
    retain,
  }
}

export type DocumentSelection = ReturnType<typeof useDocumentSelection>
