<script setup lang="ts">
import type { HomeDocumentItem } from '../lib/homeDocuments'
import { useI18n } from '../lib/i18n'

interface Props {
  continueDocument: HomeDocumentItem | null
  earlierDocuments: HomeDocumentItem[]
  notice: string | null
}

defineProps<Props>()

defineEmits<{
  openDocument: [id: string]
  openFile: []
  newDocument: []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="home-screen" :aria-label="t('home.documents.aria')" data-testid="documents-screen">
    <header class="home-top">
      <div>
        <h1>MarkText</h1>
      </div>
      <div class="home-actions">
        <button
          class="home-open-button"
          type="button"
          data-testid="open-file-button"
          @click="$emit('openFile')"
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
          @click="$emit('newDocument')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </header>

    <p v-if="notice" class="home-notice" role="status">{{ notice }}</p>

    <div class="home-content">
      <section v-if="continueDocument" class="document-group" aria-labelledby="continue-title">
        <h2 id="continue-title" class="home-section-label">{{ t('home.continueWriting') }}</h2>
        <button
          class="continue-card"
          type="button"
          @click="$emit('openDocument', continueDocument.id)"
        >
          <span class="continue-card-head">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 4h7l4 4v12H7z" />
              <path d="M14 4v5h5" />
              <path d="M9.5 14h5" />
            </svg>
            {{ t('home.continueWriting') }}
          </span>
          <span>
            <span class="continue-card-title">{{ continueDocument.title }}</span>
            <span class="continue-card-meta">{{ continueDocument.details }}</span>
          </span>
          <span class="continue-card-cta">
            {{ t('home.continueAction') }}
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </section>

      <section v-if="earlierDocuments.length > 0" class="document-group" aria-labelledby="earlier-title">
        <h2 id="earlier-title" class="home-section-label">{{ t('home.earlier') }}</h2>
        <div class="document-list">
          <button
            v-for="document in earlierDocuments"
            :key="document.id"
            class="document-row"
            type="button"
            @click="$emit('openDocument', document.id)"
          >
            <span class="document-glyph" aria-hidden="true">
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
            <span class="document-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </div>
      </section>

      <section
        v-if="!continueDocument && earlierDocuments.length === 0"
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
  </section>
</template>
