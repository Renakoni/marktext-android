import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'

interface AppLifecycleLogger {
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
}

interface AppLifecycleListenerOptions {
  onBackButton: () => void | Promise<void>
  onDocumentHidden: () => void
  onPageHide: () => void
  onPause: () => void
  onInactive: () => void
  logger?: AppLifecycleLogger
}

export interface AppLifecycleListeners {
  remove(): void
}

export function installAppLifecycleListeners({
  onBackButton,
  onDocumentHidden,
  onPageHide,
  onPause,
  onInactive,
  logger,
}: AppLifecycleListenerOptions): AppLifecycleListeners {
  const handleDocumentVisibilityChange = () => {
    if (document.hidden) {
      onDocumentHidden()
    }
  }
  const handlePageHide = () => {
    onPageHide()
  }

  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
  window.addEventListener('pagehide', handlePageHide)

  let appHandles: PluginListenerHandle[] = []
  void Promise.all([
    App.addListener('backButton', () => {
      void onBackButton()
    }),
    App.addListener('pause', () => {
      onPause()
    }),
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        onInactive()
      }
    }),
  ])
    .then(handles => {
      appHandles = handles
      logger?.info('app lifecycle listeners installed')
    })
    .catch(error => {
      logger?.warn('app lifecycle listeners unavailable', error)
    })

  return {
    remove() {
      document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)

      const handles = appHandles
      appHandles = []
      for (const handle of handles) {
        void handle.remove()
      }
    },
  }
}
