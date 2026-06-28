import { Capacitor, registerPlugin } from '@capacitor/core'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = unknown

interface NativeLogEntry {
  timestamp: string
  level: LogLevel
  category: string
  message: string
  context?: string
  platform: string
  sessionId: string
}

interface NativeLogInfo {
  tag?: string
  directory?: string
  currentFile?: string
}

interface NativeLoggerPlugin {
  write(entry: NativeLogEntry): Promise<void>
  clear(): Promise<void>
  getInfo(): Promise<NativeLogInfo>
}

const NativeLogger = registerPlugin<NativeLoggerPlugin>('NativeLogger')

const STORAGE_KEY = 'marktext-for-android:debug-logs:v2'
const MAX_LOCAL_ENTRIES = 400
const MAX_CONTEXT_LENGTH = 2400
const REDACTED_CONTEXT_KEYS = new Set(['blocks', 'content', 'doc', 'markdown', 'prevdoc', 'text'])
const sessionId = createSessionId()
const platform = Capacitor.getPlatform()

let globalLoggingInstalled = false
let nativeLoggingUnavailable = false

function createSessionId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `${Date.now().toString(36)}-${random}`
}

function clamp(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

function normalizeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  }
}

function shouldRedactContextKey(key: string) {
  return REDACTED_CONTEXT_KEYS.has(key.toLowerCase())
}

function safeStringify(value: LogContext) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (value instanceof Error) {
    return clamp(JSON.stringify(normalizeError(value)), MAX_CONTEXT_LENGTH)
  }

  if (typeof value === 'string') {
    return clamp(value, MAX_CONTEXT_LENGTH)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  const seen = new WeakSet<object>()
  try {
    return clamp(
      JSON.stringify(value, (key, innerValue) => {
        if (key && shouldRedactContextKey(key)) {
          return '[redacted]'
        }

        if (typeof innerValue === 'bigint') {
          return innerValue.toString()
        }

        if (innerValue instanceof Error) {
          return normalizeError(innerValue)
        }

        if (typeof innerValue === 'object' && innerValue !== null) {
          if (seen.has(innerValue)) {
            return '[Circular]'
          }
          seen.add(innerValue)
        }

        return innerValue
      }),
      MAX_CONTEXT_LENGTH,
    )
  } catch (error) {
    return JSON.stringify({
      serializationError: error instanceof Error ? error.message : String(error),
    })
  }
}

function formatLine(entry: NativeLogEntry) {
  const level = entry.level.toUpperCase()
  const context = entry.context ? ` ${entry.context}` : ''
  return `[${entry.timestamp}] [${level}] [${entry.category}] ${entry.message}${context}`
}

function readStoredEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as NativeLogEntry[]) : []
  } catch {
    return []
  }
}

function writeStoredEntry(entry: NativeLogEntry) {
  try {
    const entries = readStoredEntries()
    entries.push(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_LOCAL_ENTRIES)))
  } catch {
    // localStorage can be unavailable in restricted WebView modes. Console and
    // native logging still carry the diagnostic trail.
  }
}

function writeConsole(entry: NativeLogEntry) {
  const line = formatLine(entry)
  if (entry.level === 'error') {
    console.error(line)
  } else if (entry.level === 'warn') {
    console.warn(line)
  } else if (entry.level === 'debug') {
    console.debug(line)
  } else {
    console.info(line)
  }
}

function writeNative(entry: NativeLogEntry) {
  if (nativeLoggingUnavailable) {
    return
  }

  NativeLogger.write(entry).catch(() => {
    nativeLoggingUnavailable = true
  })
}

function write(level: LogLevel, category: string, message: string, context?: LogContext) {
  const entry: NativeLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    context: safeStringify(context),
    platform,
    sessionId,
  }

  writeStoredEntry(entry)
  writeConsole(entry)
  writeNative(entry)
}

export function createLogger(category: string) {
  return {
    debug: (message: string, context?: LogContext) => write('debug', category, message, context),
    info: (message: string, context?: LogContext) => write('info', category, message, context),
    warn: (message: string, context?: LogContext) => write('warn', category, message, context),
    error: (message: string, context?: LogContext) => write('error', category, message, context),
  }
}

export const appLogger = createLogger('app')

export function installGlobalLogging() {
  if (globalLoggingInstalled) {
    return
  }

  globalLoggingInstalled = true

  window.addEventListener('error', event => {
    appLogger.error('window error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error instanceof Error ? normalizeError(event.error) : undefined,
    })
  })

  window.addEventListener('unhandledrejection', event => {
    appLogger.error('unhandled promise rejection', {
      reason: event.reason instanceof Error ? normalizeError(event.reason) : event.reason,
    })
  })

  appLogger.info('global logging installed', {
    platform,
    sessionId,
    userAgent: navigator.userAgent,
  })
}

export function getLocalLogText() {
  return readStoredEntries().map(formatLine).join('\n')
}

export function getLocalLogCount() {
  return readStoredEntries().length
}

export async function copyLocalLogs() {
  const text = getLocalLogText()
  if (!text || !navigator.clipboard) {
    return false
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function downloadLocalLogs() {
  const text = getLocalLogText()
  if (!text) {
    return false
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `marktext-android-logs-${timestamp}.log`
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}

export async function clearLogs() {
  localStorage.removeItem(STORAGE_KEY)
  nativeLoggingUnavailable = false
  try {
    await NativeLogger.clear()
  } catch {
    nativeLoggingUnavailable = true
  }
}

export async function getNativeLogInfo() {
  try {
    return await NativeLogger.getInfo()
  } catch {
    nativeLoggingUnavailable = true
    return null
  }
}
