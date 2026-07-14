import { spawnSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const PACKAGE_NAME = 'io.github.renakoni.marktextandroid'
const ACTIVITY_NAME = `${PACKAGE_NAME}/.MainActivity`
const OUTPUT_DIRECTORY = resolve('logs', 'large-document-matrix')
const RESULTS_PATH = join(OUTPUT_DIRECTORY, 'matrix-results.json')
const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
const SETTINGS_STORAGE_KEY = 'marktext-for-android:settings-ui'
const RESUME_STORAGE_KEY = 'marktext-for-android:resume-positions'
const CDP_PORT = 9222

const cases = [250, 1_000, 5_000, 10_000].map(sectionCount => ({
  id: `large-${sectionCount}`,
  title: `Large-${sectionCount}`,
  sectionCount,
}))

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  })
  if (!options.allowFailure && result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || result.status
    throw new Error(`${command} ${args.join(' ')} failed: ${detail}`)
  }
  return result
}

let serial = process.env.ANDROID_SERIAL ?? ''

function resolveSerial() {
  if (serial) return serial
  const devices = run('adb', ['devices']).stdout
    .split(/\r?\n/)
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts[1] === 'device')
    .map(parts => parts[0])
  if (devices.length !== 1) {
    throw new Error(`Expected one connected Android device, found ${devices.length}`)
  }
  serial = devices[0]
  return serial
}

function adb(args, options = {}) {
  return run('adb', ['-s', serial, ...args], options)
}

function adbText(args, options = {}) {
  return adb(args, options).stdout?.trim() ?? ''
}

async function waitFor(check, timeoutMs, description) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(250)
  }
  throw new Error(
    `Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`,
  )
}

async function connectToApp() {
  adb(['shell', 'am', 'force-stop', PACKAGE_NAME])
  adb(['shell', 'am', 'start', '-W', '-n', ACTIVITY_NAME])
  const pid = await waitFor(
    async () => adbText(['shell', 'pidof', PACKAGE_NAME]),
    15_000,
    'the app process',
  )
  run('adb', ['-s', serial, 'forward', '--remove', `tcp:${CDP_PORT}`], {
    allowFailure: true,
  })
  adb(['forward', `tcp:${CDP_PORT}`, `localabstract:webview_devtools_remote_${pid}`])
  const browser = await waitFor(
    async () => chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`),
    15_000,
    'the app WebView CDP endpoint',
  )
  const page = browser.contexts()[0]?.pages()[0]
  if (!page) {
    await browser.close()
    throw new Error('The app WebView did not expose a page')
  }
  await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 })
  return { browser, page }
}

async function captureStorage() {
  const { browser, page } = await connectToApp()
  try {
    return await page.evaluate(() => Object.fromEntries(
      Array.from(
        { length: globalThis.localStorage.length },
        (_, index) => globalThis.localStorage.key(index),
      )
        .filter(key => key !== null)
        .map(key => [key, globalThis.localStorage.getItem(key)]),
    ))
  } finally {
    await browser.close()
  }
}

async function restoreStorage(storage) {
  const { browser, page } = await connectToApp()
  try {
    await page.evaluate(entries => {
      globalThis.localStorage.clear()
      for (const [key, value] of Object.entries(entries)) {
        if (value !== null) globalThis.localStorage.setItem(key, value)
      }
    }, storage)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
  } finally {
    await browser.close()
  }
}

function createMarkdown(sectionCount) {
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const number = String(index + 1).padStart(5, '0')
    return `## Section ${number} benchmark\n\nParagraph ${number} carries dense-probe and representative mobile Markdown text. TARGET-${number}\n\n- Item ${number}.1\n- Item ${number}.2\n`
  })
  return `# Large-${sectionCount}\n\n${sections.join('\n')}`
}

async function seedCase(page, testCase, markdown) {
  const now = new Date().toISOString()
  await page.evaluate(
    ({ draftsKey, settingsKey, draft }) => {
      globalThis.localStorage.clear()
      globalThis.localStorage.setItem(draftsKey, JSON.stringify([draft]))
      globalThis.localStorage.setItem(settingsKey, JSON.stringify({
        startUpAction: 'home',
        localDrafts: true,
        recoveryDrafts: true,
      }))
    },
    {
      draftsKey: DRAFTS_STORAGE_KEY,
      settingsKey: SETTINGS_STORAGE_KEY,
      draft: {
        id: testCase.id,
        markdown,
        createdAt: now,
        updatedAt: now,
        lastSavedAt: now,
      },
    },
  )
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
}

async function installLongTaskObserver(page) {
  await page.evaluate(() => {
    globalThis.__marktextLargeDocumentLongTasks = []
    if (typeof globalThis.PerformanceObserver === 'undefined') return
    const observer = new globalThis.PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        globalThis.__marktextLargeDocumentLongTasks.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        })
      }
    })
    try {
      observer.observe({ type: 'longtask', buffered: true })
      globalThis.__marktextLargeDocumentLongTaskObserver = observer
    } catch {
      // Older WebViews may not expose the Long Tasks API.
    }
  })
}

async function setSearchQuery(page, value) {
  await page.getByTestId('search-input').evaluate((input, query) => {
    input.value = query
    input.dispatchEvent(new globalThis.InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: query,
    }))
  }, value)
}

async function measureSearchQuery(page, value, expectedCountText) {
  const startedAt = globalThis.performance.now()
  await setSearchQuery(page, value)
  await page.waitForFunction(
    ({ testId, expected }) =>
      globalThis.document.querySelector(`[data-testid="${testId}"]`)?.textContent === expected,
    { testId: 'search-count', expected: expectedCountText },
    { timeout: 120_000 },
  )
  return globalThis.performance.now() - startedAt
}

async function measureCase(page, testCase) {
  const markdown = createMarkdown(testCase.sectionCount)
  await seedCase(page, testCase, markdown)
  await installLongTaskObserver(page)

  const profileClient = await page.context().newCDPSession(page)
  await profileClient.send('Profiler.enable')
  await profileClient.send('Profiler.start')
  const openStartedAt = globalThis.performance.now()
  await page.getByRole('button', { name: new RegExp(testCase.title) }).click()
  await page.locator('[data-testid="editor-host"] .mu-editor').waitFor({
    state: 'visible',
    timeout: 120_000,
  })
  const editorReadyMs = globalThis.performance.now() - openStartedAt
  const profile = await profileClient.send('Profiler.stop')
  await profileClient.detach()
  writeFileSync(
    join(OUTPUT_DIRECTORY, `${testCase.id}-editor-open-profile.json`),
    JSON.stringify(profile),
    'utf8',
  )
  const editorState = await page.evaluate(() => {
    const container = globalThis.document.querySelector('[data-testid="editor-host"] .mu-container')
    const memory = globalThis.performance.memory
    return {
      topLevelBlocks: container?.children.length ?? 0,
      usedJsHeapBytes: memory?.usedJSHeapSize ?? null,
    }
  })

  const outlineProfileClient = await page.context().newCDPSession(page)
  await outlineProfileClient.send('Profiler.enable')
  await outlineProfileClient.send('Profiler.start')
  const outlineStartedAt = globalThis.performance.now()
  await page.getByTestId('outline-open-button').click()
  await page.getByTestId('outline-sheet').waitFor({ state: 'visible', timeout: 120_000 })
  const outlineOpenMs = globalThis.performance.now() - outlineStartedAt
  const outlineProfile = await outlineProfileClient.send('Profiler.stop')
  await outlineProfileClient.detach()
  writeFileSync(
    join(OUTPUT_DIRECTORY, `${testCase.id}-outline-open-profile.json`),
    JSON.stringify(outlineProfile),
    'utf8',
  )
  const outlineRows = await page.getByTestId('outline-row').count()
  await page.getByTestId('outline-close-button').click()
  await page.getByTestId('outline-sheet').waitFor({ state: 'detached', timeout: 30_000 })

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').waitFor({ state: 'visible', timeout: 30_000 })

  const sparseSearchMs = await measureSearchQuery(
    page,
    `TARGET-${String(testCase.sectionCount).padStart(5, '0')}`,
    '1/1',
  )
  const sparseSearchCount = await page.getByTestId('search-count').textContent()

  const denseSearchMs = await measureSearchQuery(
    page,
    'dense-probe',
    `1/${testCase.sectionCount}`,
  )
  const denseSearchCount = await page.getByTestId('search-count').textContent()
  const findNextMs = await page.getByTestId('search-next-button').evaluate(button => {
    const startedAt = globalThis.performance.now()
    button.click()
    return globalThis.performance.now() - startedAt
  })
  const clearSearchStartedAt = globalThis.performance.now()
  await setSearchQuery(page, '')
  await page.getByTestId('search-count').waitFor({ state: 'hidden', timeout: 120_000 })
  const clearSearchMs = globalThis.performance.now() - clearSearchStartedAt
  await page.getByTestId('search-close-button').click()

  const previousResume = await page.evaluate(key => globalThis.localStorage.getItem(key), RESUME_STORAGE_KEY)
  await page.evaluate(() => {
    const shell = globalThis.document.querySelector('[data-testid="editor-host"]')
    if (!(shell instanceof globalThis.HTMLElement)) throw new Error('Missing editor scroll container')
    shell.scrollTo({ top: shell.scrollHeight * 0.8 })
    shell.dispatchEvent(new globalThis.Event('scroll'))
  })
  await delay(50)
  const resumeStartedAt = globalThis.performance.now()
  await page.evaluate(() => globalThis.dispatchEvent(new globalThis.PageTransitionEvent('pagehide')))
  await page.waitForFunction(
    ({ key, previous }) => globalThis.localStorage.getItem(key) !== previous,
    { key: RESUME_STORAGE_KEY, previous: previousResume },
    { timeout: 120_000 },
  )
  const resumePersistMs = globalThis.performance.now() - resumeStartedAt

  const longTasks = await page.evaluate(() => globalThis.__marktextLargeDocumentLongTasks ?? [])
  await page.getByTestId('back-button').click()
  await page.getByTestId('documents-screen').waitFor({ state: 'visible', timeout: 30_000 })
  return {
    id: testCase.id,
    sectionCount: testCase.sectionCount,
    markdownBytes: Buffer.byteLength(markdown, 'utf8'),
    ...editorState,
    outlineRows,
    editorReadyMs: Math.round(editorReadyMs),
    outlineOpenMs: Math.round(outlineOpenMs),
    sparseSearchMs: Math.round(sparseSearchMs),
    sparseSearchCount,
    denseSearchMs: Math.round(denseSearchMs),
    denseSearchCount,
    findNextMs: Math.round(findNextMs),
    clearSearchMs: Math.round(clearSearchMs),
    resumePersistMs: Math.round(resumePersistMs),
    longTaskCount: longTasks.length,
    longestTaskMs: Math.round(Math.max(0, ...longTasks.map(task => task.duration))),
    longTasks,
  }
}

mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
resolveSerial()
const storageBackup = await captureStorage()
const results = []
let fatalError

try {
  const { browser, page } = await connectToApp()
  try {
    for (const testCase of cases) {
      const result = await measureCase(page, testCase)
      results.push(result)
      globalThis.console.log(JSON.stringify(result))
    }
  } finally {
    await browser.close()
  }
} catch (error) {
  fatalError = error
} finally {
  try {
    await restoreStorage(storageBackup)
  } catch (error) {
    fatalError = new Error(
      `Could not restore app storage: ${error instanceof Error ? error.message : error}`,
    )
  }
}

const report = {
  capturedAt: new Date().toISOString(),
  device: {
    serial,
    model: adbText(['shell', 'getprop', 'ro.product.model']),
    android: adbText(['shell', 'getprop', 'ro.build.version.release']),
    api: Number(adbText(['shell', 'getprop', 'ro.build.version.sdk'])),
  },
  results,
}
writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2), 'utf8')
globalThis.console.log(JSON.stringify(report, null, 2))

if (fatalError) throw fatalError
