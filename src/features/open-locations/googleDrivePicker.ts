import { AndroidDocumentError } from '../../lib/androidDocuments'

/**
 * Google Picker bridge for the Open page's Google Drive row.
 *
 * Under the non-sensitive `drive.file` scope the app cannot enumerate the
 * user's Drive, so choosing an existing document goes through Google's own
 * Picker: it runs with full visibility inside its iframe and grants the
 * app access to exactly the files the user picks. The gapi script loads
 * lazily from Google on first use — an offline Open page never pays for it.
 */

export interface GoogleDrivePickerConfig {
  accessToken: string
  pickerApiKey: string
  /** Cloud project number; without it picks are not granted to the app. */
  appId: string
  locale?: string
}

export interface PickedDriveDocument {
  fileId: string
  name: string
}

export interface PickerCallbackData {
  action?: string
  docs?: { id?: unknown; name?: unknown }[]
}

interface GoogleDocsView {
  setMimeTypes(mimeTypes: string): GoogleDocsView
  setIncludeFolders(include: boolean): GoogleDocsView
}

interface GooglePicker {
  setVisible(visible: boolean): void
  dispose(): void
}

interface GooglePickerBuilder {
  setAppId(appId: string): GooglePickerBuilder
  setDeveloperKey(key: string): GooglePickerBuilder
  setOAuthToken(token: string): GooglePickerBuilder
  setLocale(locale: string): GooglePickerBuilder
  addView(view: GoogleDocsView): GooglePickerBuilder
  setCallback(callback: (data: PickerCallbackData) => void): GooglePickerBuilder
  build(): GooglePicker
}

interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilder
  DocsView: new (viewId?: unknown) => GoogleDocsView
  ViewId: { DOCS: unknown }
}

declare global {
  interface Window {
    gapi?: { load(name: string, options: { callback: () => void; onerror?: () => void }): void }
    google?: { picker?: GooglePickerNamespace }
  }
}

const GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js'
/**
 * Markdown candidates as Drive stores them: .md uploads get text/markdown
 * (older ones text/plain or application/octet-stream). A stray binary pick
 * is still caught downstream by the read path's size and decode gates.
 */
const PICKER_MIME_TYPES = 'text/markdown,text/x-markdown,text/plain,application/octet-stream'

function pickerUnavailableError() {
  return new AndroidDocumentError(
    'CLOUD_NETWORK_FAILED',
    'The Google Drive picker could not be loaded',
  )
}

let pickerApiPromise: Promise<GooglePickerNamespace> | null = null

function loadPickerApi(): Promise<GooglePickerNamespace> {
  const loaded = window.google?.picker
  if (loaded) {
    return Promise.resolve(loaded)
  }
  if (!pickerApiPromise) {
    pickerApiPromise = new Promise<GooglePickerNamespace>((resolve, reject) => {
      const failOnce = () => {
        // Allow a retry on the next invocation (e.g. connectivity restored).
        pickerApiPromise = null
        reject(pickerUnavailableError())
      }
      const loadPickerModule = () => {
        window.gapi?.load('picker', {
          callback: () => {
            const picker = window.google?.picker
            if (picker) {
              resolve(picker)
            } else {
              failOnce()
            }
          },
          onerror: failOnce,
        })
      }
      if (window.gapi) {
        loadPickerModule()
        return
      }
      const script = document.createElement('script')
      script.src = GAPI_SCRIPT_SRC
      script.async = true
      script.onload = () => {
        if (window.gapi) {
          loadPickerModule()
        } else {
          failOnce()
        }
      }
      script.onerror = () => {
        script.remove()
        failOnce()
      }
      document.head.appendChild(script)
    })
  }
  return pickerApiPromise
}

/**
 * Maps a Picker callback event to its outcome: a document, `null` for
 * cancel, or `undefined` for non-terminal events (`loaded` etc.) that must
 * keep the session open.
 */
export function pickedDriveDocumentFrom(
  data: PickerCallbackData,
): PickedDriveDocument | null | undefined {
  if (data.action === 'cancel') {
    return null
  }
  if (data.action !== 'picked') {
    return undefined
  }
  const doc = data.docs?.[0]
  if (!doc || typeof doc.id !== 'string' || doc.id.length === 0) {
    return null
  }
  return { fileId: doc.id, name: typeof doc.name === 'string' ? doc.name : '' }
}

/** Shows the Picker; resolves with the picked document or null on cancel. */
export async function showGoogleDrivePicker(
  config: GoogleDrivePickerConfig,
): Promise<PickedDriveDocument | null> {
  const pickerApi = await loadPickerApi()
  return new Promise(resolve => {
    const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS)
    view.setMimeTypes(PICKER_MIME_TYPES)
    view.setIncludeFolders(true)

    let pickerInstance: GooglePicker | null = null
    const builder = new pickerApi.PickerBuilder()
      .setAppId(config.appId)
      .setDeveloperKey(config.pickerApiKey)
      .setOAuthToken(config.accessToken)
      .addView(view)
      .setCallback(data => {
        const result = pickedDriveDocumentFrom(data)
        if (result === undefined) {
          return
        }
        pickerInstance?.dispose()
        pickerInstance = null
        resolve(result)
      })
    if (config.locale) {
      builder.setLocale(config.locale)
    }
    pickerInstance = builder.build()
    pickerInstance.setVisible(true)
  })
}
