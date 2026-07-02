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
          +
        </button>
      </div>
    </header>

    <p v-if="notice" class="home-notice" role="status">{{ notice }}</p>

    <nav class="home-tabs" :aria-label="t('home.documentSections')">
      <button class="home-tab is-active" type="button">{{ t('home.recent') }}</button>
    </nav>

    <div class="home-content">
      <section v-if="continueDocument" class="document-group" aria-labelledby="continue-title">
        <h2 id="continue-title">{{ t('home.continueWriting') }}</h2>
        <button class="document-row" type="button" @click="$emit('openDocument', continueDocument.id)">
          <span class="document-icon" aria-hidden="true">M</span>
          <span class="document-text">
            <strong>{{ continueDocument.title }}</strong>
            <span>{{ continueDocument.details }}</span>
          </span>
        </button>
      </section>

      <section v-if="earlierDocuments.length > 0" class="document-group" aria-labelledby="earlier-title">
        <h2 id="earlier-title">{{ t('home.earlier') }}</h2>
        <button
          v-for="document in earlierDocuments"
          :key="document.id"
          class="document-row"
          type="button"
          @click="$emit('openDocument', document.id)"
        >
          <span class="document-icon" aria-hidden="true">M</span>
          <span class="document-text">
            <strong>{{ document.title }}</strong>
            <span>{{ document.details }}</span>
          </span>
        </button>
      </section>

      <section
        v-if="!continueDocument && earlierDocuments.length === 0"
        class="document-group"
        aria-labelledby="recent-title"
      >
        <div class="empty-recent">
          <h2 id="recent-title">{{ t('home.emptyTitle') }}</h2>
          <p>{{ t('home.emptyBody') }}</p>
        </div>
      </section>
    </div>
  </section>
</template>
