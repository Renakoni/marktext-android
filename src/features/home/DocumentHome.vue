<script setup lang="ts">
import { computed, watch } from 'vue'
import DocumentDeleteConfirmSheet from './components/DocumentDeleteConfirmSheet.vue'
import DocumentRenameSheet from './components/DocumentRenameSheet.vue'
import DocumentSelectionBar from './components/DocumentSelectionBar.vue'
import { useLongPress } from './useLongPress'
import type { HomeDocumentItem } from './homeDocuments'
import { stripMarkdownExtension } from '../../lib/documentState'
import { useI18n } from '../../lib/i18n'

interface Props {
  continueDocument: HomeDocumentItem | null
  pinnedDocuments: HomeDocumentItem[]
  earlierDocuments: HomeDocumentItem[]
  notice: string | null
  selectionActive: boolean
  selectionCount: number
  selectedIds: ReadonlySet<string>
  allSelectedPinned: boolean
  // Sheet visibility lives in App so the Android back button can dismiss a
  // sheet without also clearing the selection behind it.
  deleteSheetOpen: boolean
  renameSheetOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openDocument: [id: string]
  openFile: []
  newDocument: []
  selectDocument: [id: string]
  toggleDocument: [id: string]
  exitSelection: []
  pinSelected: []
  deleteSelected: []
  shareSelected: []
  renameSelected: [id: string, name: string]
  'update:deleteSheetOpen': [open: boolean]
  'update:renameSheetOpen': [open: boolean]
}>()

const { t } = useI18n()

const longPress = useLongPress({
  onLongPress: id => emit('selectDocument', id),
})

const documentSections = computed(() =>
  [
    { key: 'pinned', label: t('home.pinned'), items: props.pinnedDocuments, pinned: true },
    { key: 'earlier', label: t('home.earlier'), items: props.earlierDocuments, pinned: false },
  ].filter(section => section.items.length > 0),
)

const allDocuments = computed(() => {
  const items = [...props.pinnedDocuments, ...props.earlierDocuments]
  return props.continueDocument ? [props.continueDocument, ...items] : items
})

const selectedDocuments = computed(() =>
  allDocuments.value.filter(item => props.selectedIds.has(item.id)),
)

const selectedDraftCount = computed(
  () => selectedDocuments.value.filter(item => item.kind === 'local-draft').length,
)

const renameTarget = computed(() =>
  selectedDocuments.value.length === 1 ? selectedDocuments.value[0] : null,
)

// Renaming edits the document's own name — for device files that is the file
// name, which can differ from a heading-derived list title.
const renameInitialName = computed(() =>
  renameTarget.value ? stripMarkdownExtension(renameTarget.value.displayName) : '',
)

function isSelected(id: string) {
  return props.selectedIds.has(id)
}

function onDocumentClick(id: string) {
  if (longPress.consumeLongPressClick()) {
    return
  }

  if (props.selectionActive) {
    emit('toggleDocument', id)
  } else {
    emit('openDocument', id)
  }
}

function confirmDelete() {
  emit('update:deleteSheetOpen', false)
  emit('deleteSelected')
}

function submitRename(name: string) {
  const target = renameTarget.value
  emit('update:renameSheetOpen', false)
  if (target) {
    emit('renameSelected', target.id, name)
  }
}

watch(
  () => props.selectionActive,
  active => {
    if (!active) {
      longPress.cancel()
    }
  },
)
</script>

<template>
  <section class="home-screen" :aria-label="t('home.documents.aria')" data-testid="documents-screen">
    <header class="home-top">
      <Transition name="home-top-swap" mode="out-in">
        <DocumentSelectionBar
          v-if="selectionActive"
          key="selection"
          :count="selectionCount"
          :all-pinned="allSelectedPinned"
          @exit="emit('exitSelection')"
          @pin="emit('pinSelected')"
          @request-delete="emit('update:deleteSheetOpen', true)"
          @share="emit('shareSelected')"
          @request-rename="emit('update:renameSheetOpen', true)"
        />
        <div v-else key="default" class="home-top-default">
          <div>
            <h1>MarkText</h1>
          </div>
          <div class="home-actions">
            <button
              class="home-open-button"
              type="button"
              data-testid="open-file-button"
              @click="emit('openFile')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 6h12M4 12h12M4 18h8" />
                <path d="M16 14l4 4-4 4" />
                <path d="M20 18h-6" />
              </svg>
              {{ t('home.open') }}
            </button>
            <button
              class="home-new-button"
              type="button"
              :aria-label="t('home.newDocument')"
              data-testid="new-document-button"
              :title="t('home.newDocument')"
              @click="emit('newDocument')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </header>

    <p v-if="notice" class="home-notice" role="status">{{ notice }}</p>

    <div class="home-content">
      <section v-if="continueDocument" class="document-group" aria-labelledby="continue-title">
        <h2 id="continue-title" class="home-section-label">{{ t('home.continueWriting') }}</h2>
        <button
          class="continue-card"
          :class="{
            'is-selecting': selectionActive,
            'is-selected': selectionActive && isSelected(continueDocument.id),
          }"
          type="button"
          :aria-pressed="selectionActive ? isSelected(continueDocument.id) : undefined"
          @click="onDocumentClick(continueDocument.id)"
          @pointerdown="longPress.onPointerDown($event, continueDocument.id)"
          @pointermove="longPress.onPointerMove"
          @pointerup="longPress.onPointerEnd"
          @pointercancel="longPress.onPointerEnd"
          @contextmenu.prevent
        >
          <span
            v-if="selectionActive"
            class="document-check continue-check"
            :class="{ 'is-checked': isSelected(continueDocument.id) }"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5.5 12.5l4.2 4.2 8.8-9.4" />
            </svg>
          </span>
          <span class="continue-card-title">{{ continueDocument.title }}</span>
          <span class="continue-card-meta">{{ continueDocument.details }}</span>
        </button>
      </section>

      <section
        v-for="section in documentSections"
        :key="section.key"
        class="document-group"
        :aria-labelledby="`${section.key}-title`"
      >
        <h2 :id="`${section.key}-title`" class="home-section-label">{{ section.label }}</h2>
        <div class="document-list">
          <button
            v-for="document in section.items"
            :key="document.id"
            class="document-row"
            :class="{
              'is-selected': selectionActive && isSelected(document.id),
              'has-pin': section.pinned,
            }"
            type="button"
            :aria-pressed="selectionActive ? isSelected(document.id) : undefined"
            @click="onDocumentClick(document.id)"
            @pointerdown="longPress.onPointerDown($event, document.id)"
            @pointermove="longPress.onPointerMove"
            @pointerup="longPress.onPointerEnd"
            @pointercancel="longPress.onPointerEnd"
            @contextmenu.prevent
          >
            <span
              v-if="selectionActive"
              class="document-check"
              :class="{ 'is-checked': isSelected(document.id) }"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5.5 12.5l4.2 4.2 8.8-9.4" />
              </svg>
            </span>
            <span v-else class="document-glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 3h7l4 4v14H7z" />
                <path d="M14 3v5h5" />
                <path d="M9.5 12h5" />
                <path d="M9.5 16h5" />
              </svg>
            </span>
            <span class="document-text">
              <strong>{{ document.title }}</strong>
              <span>{{ document.details }}</span>
            </span>
            <span
              v-if="section.pinned"
              class="document-pin-mark"
              role="img"
              :aria-label="t('home.pinnedDocument')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 4h6l-.7 6 3.2 3v1.5H6.5V13l3.2-3z" />
                <path d="M12 14.5V20" />
              </svg>
            </span>
          </button>
        </div>
      </section>

      <section
        v-if="!continueDocument && pinnedDocuments.length === 0 && earlierDocuments.length === 0"
        class="document-group"
        aria-labelledby="recent-title"
      >
        <div class="empty-recent">
          <span class="empty-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 3h7l4 4v14H7z" />
              <path d="M14 3v5h5" />
              <path d="M9.5 13h5" />
            </svg>
          </span>
          <h2 id="recent-title">{{ t('home.emptyTitle') }}</h2>
          <p>{{ t('home.emptyBody') }}</p>
        </div>
      </section>
    </div>

    <Transition name="editor-sheet">
      <DocumentDeleteConfirmSheet
        v-if="deleteSheetOpen"
        :count="selectionCount"
        :draft-count="selectedDraftCount"
        :android-document-count="selectionCount - selectedDraftCount"
        @cancel="emit('update:deleteSheetOpen', false)"
        @confirm="confirmDelete"
      />
    </Transition>

    <Transition name="editor-sheet">
      <DocumentRenameSheet
        v-if="renameSheetOpen && renameTarget"
        :initial-name="renameInitialName"
        @cancel="emit('update:renameSheetOpen', false)"
        @rename="submitRename"
      />
    </Transition>
  </section>
</template>
