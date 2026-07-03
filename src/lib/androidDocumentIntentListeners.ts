import type { PluginListenerHandle } from '@capacitor/core'
import {
  addAndroidOpenWithDocumentListener,
  addAndroidShareDocumentListener,
  isAndroidDocumentAccessAvailable,
  type AndroidOpenWithDocumentEvent,
  type AndroidShareDocumentEvent,
} from './androidDocuments'

interface AndroidDocumentIntentLogger {
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
}

interface AndroidDocumentIntentListenerOptions {
  onOpenWithDocument: (event: AndroidOpenWithDocumentEvent) => void
  onShareDocument: (event: AndroidShareDocumentEvent) => void
  logger?: AndroidDocumentIntentLogger
}

export interface AndroidDocumentIntentListeners {
  remove(): void
}

export function installAndroidDocumentIntentListeners({
  onOpenWithDocument,
  onShareDocument,
  logger,
}: AndroidDocumentIntentListenerOptions): AndroidDocumentIntentListeners {
  if (!isAndroidDocumentAccessAvailable()) {
    return {
      remove() {},
    }
  }

  let listenerHandles: PluginListenerHandle[] = []
  Promise.all([
    addAndroidOpenWithDocumentListener(onOpenWithDocument),
    addAndroidShareDocumentListener(onShareDocument),
  ])
    .then(handles => {
      listenerHandles = handles
      logger?.info('Android document intent listeners installed')
    })
    .catch(error => {
      logger?.warn('Android document intent listeners unavailable', error)
    })

  return {
    remove() {
      const handles = listenerHandles
      listenerHandles = []
      for (const handle of handles) {
        void handle.remove()
      }
    },
  }
}
