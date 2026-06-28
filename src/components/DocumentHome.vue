<script setup lang="ts">
interface DocumentListItem {
  id: string
  title: string
  details: string
}

interface Props {
  continueDocument: DocumentListItem | null
  earlierDocuments: DocumentListItem[]
}

defineProps<Props>()

defineEmits<{
  openDocument: [id: string]
  newDocument: []
}>()
</script>

<template>
  <section class="home-screen" aria-label="Recent documents">
    <header class="home-top">
      <div>
        <h1>MarkText</h1>
      </div>
      <button
        class="home-new-button"
        type="button"
        aria-label="New document"
        data-testid="new-document-button"
        title="New document"
        @click="$emit('newDocument')"
      >
        +
      </button>
    </header>

    <nav class="home-tabs" aria-label="Document sections">
      <button class="home-tab is-active" type="button">Recent</button>
    </nav>

    <div class="home-content">
      <section v-if="continueDocument" class="document-group" aria-labelledby="continue-title">
        <h2 id="continue-title">Continue writing</h2>
        <button class="document-row" type="button" @click="$emit('openDocument', continueDocument.id)">
          <span class="document-icon" aria-hidden="true">M</span>
          <span class="document-text">
            <strong>{{ continueDocument.title }}</strong>
            <span>{{ continueDocument.details }}</span>
          </span>
        </button>
      </section>

      <section v-if="earlierDocuments.length > 0" class="document-group" aria-labelledby="earlier-title">
        <h2 id="earlier-title">Earlier</h2>
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
          <h2 id="recent-title">No recent Markdown files</h2>
          <p>Use the plus button to start a local draft.</p>
        </div>
      </section>
    </div>
  </section>
</template>
