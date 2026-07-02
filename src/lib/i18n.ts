import { readonly, ref } from 'vue'

export const APP_LOCALES = Object.freeze({
  EN: 'en',
  ZH_CN: 'zh-CN',
} as const)

export type AppLocale = (typeof APP_LOCALES)[keyof typeof APP_LOCALES]

const DEFAULT_APP_LOCALE: AppLocale = APP_LOCALES.EN
const APP_LOCALE_STORAGE_KEY = 'marktext-for-android:locale'

const MESSAGES = {
  [APP_LOCALES.EN]: {
    'app.name': 'MarkText for Android',

    'home.documents.aria': 'Recent documents',
    'home.open': 'Open',
    'home.newDocument': 'New document',
    'home.documentSections': 'Document sections',
    'home.recent': 'Recent',
    'home.continueWriting': 'Continue writing',
    'home.earlier': 'Earlier',
    'home.emptyTitle': 'No recent Markdown files',
    'home.emptyBody': 'Start a local draft or open a Markdown file from this device.',

    'nav.documents': 'Documents',
    'nav.settings': 'Settings',

    'settings.title': 'Settings',
    'settings.display': 'Display',
    'settings.editor': 'Editor',
    'settings.files': 'Files',
    'settings.more': 'More',
    'settings.appearance': 'Appearance',
    'settings.editing': 'Editing',
    'settings.markdown': 'Markdown',
    'settings.filesMedia': 'Files & Media',
    'settings.advanced': 'Advanced',
    'settings.about': 'About MarkText',
    'settings.back': 'Back to settings',
    'settings.entry.appearance': 'Theme, language, text',
    'settings.entry.editing': 'Pairs, code, toolbar',
    'settings.entry.markdown': 'Headings, lists, HTML',
    'settings.entry.filesMedia': 'Drafts, images, sharing',
    'settings.entry.advanced': 'Logs, reset, diagnostics',
    'settings.entry.about': 'Version and links',

    'settings.section.language': 'Language',
    'settings.section.theme': 'Theme',
    'settings.section.reading': 'Reading',
    'settings.section.autoPair': 'Pairs',
    'settings.section.codeBlocks': 'Code',
    'settings.section.mobileToolbar': 'Toolbar',
    'settings.section.style': 'Writing',
    'settings.section.rendering': 'Rendering',
    'settings.section.drafts': 'Drafts',
    'settings.section.images': 'Images',
    'settings.section.maintenance': 'Maintenance',
    'settings.section.diagnostics': 'Diagnostics',

    'settings.language.app': 'Language',
    'settings.language.english': 'English',
    'settings.language.chineseSimplified': '中文',

    'settings.appearance.followSystemTheme': 'System theme',
    'settings.appearance.appTheme': 'App theme',
    'settings.appearance.editorTheme': 'Editor theme',
    'settings.appearance.fontSize': 'Font',
    'settings.appearance.lineHeight': 'Line height',

    'settings.editing.autoPairBrackets': 'Brackets',
    'settings.editing.autoPairMarkdown': 'Markdown marks',
    'settings.editing.autoPairQuotes': 'Quotes',
    'settings.editing.codeLineNumbers': 'Line numbers',
    'settings.editing.wrapCodeBlocks': 'Wrap code',
    'settings.editing.keyboardBehavior': 'Keyboard',

    'settings.markdown.headingStyle': 'Headings',
    'settings.markdown.bulletMarker': 'Bullets',
    'settings.markdown.orderedDelimiter': 'Ordered lists',
    'settings.markdown.listIndentation': 'Indent',
    'settings.markdown.htmlRendering': 'HTML',
    'settings.markdown.footnotes': 'Footnotes',
    'settings.markdown.superSub': 'Super/subscript',

    'settings.files.localDrafts': 'Local drafts',
    'settings.files.recoveryDrafts': 'Recovery',
    'settings.files.imageImport': 'Import images',
    'settings.files.imageShare': 'Share images',
    'settings.files.imageFolder': 'Image folder',

    'settings.advanced.exportLogs': 'Export logs',
    'settings.advanced.clearDrafts': 'Clear local drafts',
    'settings.advanced.reset': 'Reset settings',
    'settings.advanced.diagnostics': 'Device info',
    'settings.advanced.markdownCompat': 'Compatibility',
    'settings.advanced.diagrams': 'Diagrams',

    'settings.value.on': 'On',
    'settings.value.off': 'Off',
    'settings.value.system': 'System',
    'settings.value.default': 'Default',
    'settings.value.medium': 'Medium',
    'settings.value.normal': 'Normal',
    'settings.value.dockAboveKeyboard': 'Docked',
    'settings.value.atxHeading': 'ATX (#)',
    'settings.value.hyphen': '-',
    'settings.value.period': '.',
    'settings.value.twoSpaces': '2 spaces',
    'settings.value.keepRecentDrafts': 'Recent',
    'settings.value.keepOnSaveFailure': 'On failure',
    'settings.value.copyIntoAppStorage': 'Copy',
    'settings.value.attachImportedImages': 'Attach',
    'settings.value.androidPicker': 'Picker',
    'settings.value.manual': 'Manual',
    'settings.value.available': 'Ready',
    'settings.value.advanced': 'Advanced',

    'about.section.app': 'Info',
    'about.section.project': 'Project',
    'about.section.upstream': 'Upstream',
    'about.section.support': 'Support',
    'about.section.updates': 'Updates',
    'about.section.legal': 'Legal',
    'about.app': 'Name',
    'about.version': 'Version',
    'about.githubRepository': 'Repository',
    'about.allReleases': 'Releases',
    'about.githubReleases': 'GitHub',
    'about.upstreamMarkText': 'MarkText',
    'about.muyaAttribution': 'Muya',
    'about.reportIssue': 'Report issue',
    'about.githubIssues': 'GitHub issues',
    'about.checkUpdates': 'Check updates',
    'about.update.checking': 'Checking',
    'about.update.available': 'Update available: v{version}',
    'about.update.current': 'You are on the latest version',
    'about.update.noReleases': 'No published releases yet',
    'about.update.badRelease': 'Latest release did not include a version',
    'about.update.unavailable': 'Could not reach GitHub releases',
    'about.latestRelease': 'Latest release',
    'about.licenseNotices': 'Notices',
    'about.thirdPartyNotices': 'Licenses',
  },
  [APP_LOCALES.ZH_CN]: {
    'app.name': 'MarkText Android',

    'home.documents.aria': '最近文档',
    'home.open': '打开',
    'home.newDocument': '新建文档',
    'home.documentSections': '文档分区',
    'home.recent': '最近',
    'home.continueWriting': '继续写作',
    'home.earlier': '更早',
    'home.emptyTitle': '没有最近的 Markdown 文件',
    'home.emptyBody': '新建一个本地草稿，或从设备打开 Markdown 文件。',

    'nav.documents': '文档',
    'nav.settings': '设置',

    'settings.title': '设置',
    'settings.display': '显示',
    'settings.editor': '编辑器',
    'settings.files': '文件',
    'settings.more': '更多',
    'settings.appearance': '外观',
    'settings.editing': '编辑',
    'settings.markdown': 'Markdown',
    'settings.filesMedia': '文件与媒体',
    'settings.advanced': '高级',
    'settings.about': '关于 MarkText',
    'settings.back': '返回设置',
    'settings.entry.appearance': '主题、语言、文字',
    'settings.entry.editing': '配对、代码、工具栏',
    'settings.entry.markdown': '标题、列表、HTML',
    'settings.entry.filesMedia': '草稿、图片、分享',
    'settings.entry.advanced': '日志、重置、诊断',
    'settings.entry.about': '版本与链接',

    'settings.section.language': '语言',
    'settings.section.theme': '主题',
    'settings.section.reading': '阅读',
    'settings.section.autoPair': '配对',
    'settings.section.codeBlocks': '代码',
    'settings.section.mobileToolbar': '工具栏',
    'settings.section.style': '书写',
    'settings.section.rendering': '渲染',
    'settings.section.drafts': '草稿',
    'settings.section.images': '图片',
    'settings.section.maintenance': '维护',
    'settings.section.diagnostics': '诊断',

    'settings.language.app': '语言',
    'settings.language.english': 'English',
    'settings.language.chineseSimplified': '中文',

    'settings.appearance.followSystemTheme': '系统主题',
    'settings.appearance.appTheme': '应用主题',
    'settings.appearance.editorTheme': '编辑器主题',
    'settings.appearance.fontSize': '字号',
    'settings.appearance.lineHeight': '行高',

    'settings.editing.autoPairBrackets': '括号',
    'settings.editing.autoPairMarkdown': 'Markdown 标记',
    'settings.editing.autoPairQuotes': '引号',
    'settings.editing.codeLineNumbers': '行号',
    'settings.editing.wrapCodeBlocks': '代码换行',
    'settings.editing.keyboardBehavior': '键盘',

    'settings.markdown.headingStyle': '标题',
    'settings.markdown.bulletMarker': '无序列表',
    'settings.markdown.orderedDelimiter': '有序列表',
    'settings.markdown.listIndentation': '缩进',
    'settings.markdown.htmlRendering': 'HTML',
    'settings.markdown.footnotes': '脚注',
    'settings.markdown.superSub': '上标/下标',

    'settings.files.localDrafts': '本地草稿',
    'settings.files.recoveryDrafts': '恢复',
    'settings.files.imageImport': '导入图片',
    'settings.files.imageShare': '分享图片',
    'settings.files.imageFolder': '图片文件夹',

    'settings.advanced.exportLogs': '导出日志',
    'settings.advanced.clearDrafts': '清除本地草稿',
    'settings.advanced.reset': '重置设置',
    'settings.advanced.diagnostics': '设备信息',
    'settings.advanced.markdownCompat': '兼容性',
    'settings.advanced.diagrams': '图表',

    'settings.value.on': '开',
    'settings.value.off': '关',
    'settings.value.system': '跟随系统',
    'settings.value.default': '默认',
    'settings.value.medium': '中',
    'settings.value.normal': '标准',
    'settings.value.dockAboveKeyboard': '停靠',
    'settings.value.atxHeading': 'ATX (#)',
    'settings.value.hyphen': '-',
    'settings.value.period': '.',
    'settings.value.twoSpaces': '2 空格',
    'settings.value.keepRecentDrafts': '最近',
    'settings.value.keepOnSaveFailure': '失败时',
    'settings.value.copyIntoAppStorage': '复制',
    'settings.value.attachImportedImages': '附带',
    'settings.value.androidPicker': '选择器',
    'settings.value.manual': '手动',
    'settings.value.available': '就绪',
    'settings.value.advanced': '高级',

    'about.section.app': '信息',
    'about.section.project': '项目',
    'about.section.upstream': '上游',
    'about.section.support': '支持',
    'about.section.updates': '更新',
    'about.section.legal': '法律',
    'about.app': '名称',
    'about.version': '版本',
    'about.githubRepository': '仓库',
    'about.allReleases': '版本',
    'about.githubReleases': 'GitHub Releases',
    'about.upstreamMarkText': 'MarkText',
    'about.muyaAttribution': 'Muya',
    'about.reportIssue': '报告问题',
    'about.githubIssues': 'GitHub Issues',
    'about.checkUpdates': '检查更新',
    'about.update.checking': '检查中',
    'about.update.available': '发现新版本：v{version}',
    'about.update.current': '已是最新版本',
    'about.update.noReleases': '暂无发布版本',
    'about.update.badRelease': '最新发布未包含版本号',
    'about.update.unavailable': '无法连接 GitHub Releases',
    'about.latestRelease': '最新版本',
    'about.licenseNotices': '声明',
    'about.thirdPartyNotices': '许可证',
  },
} as const

export type I18nKey = keyof (typeof MESSAGES)[typeof APP_LOCALES.EN]

export const APP_LANGUAGE_OPTIONS = [
  {
    id: APP_LOCALES.EN,
    labelKey: 'settings.language.english',
    testId: 'settings-language-option-en',
  },
  {
    id: APP_LOCALES.ZH_CN,
    labelKey: 'settings.language.chineseSimplified',
    testId: 'settings-language-option-zh-cn',
  },
] as const satisfies readonly {
  id: AppLocale
  labelKey: I18nKey
  testId: string
}[]

function isAppLocale(value: unknown): value is AppLocale {
  return Object.values(APP_LOCALES).includes(value as AppLocale)
}

function getStoredLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_LOCALE
  }

  try {
    const storedLocale = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)
    return isAppLocale(storedLocale) ? storedLocale : DEFAULT_APP_LOCALE
  } catch {
    return DEFAULT_APP_LOCALE
  }
}

function writeStoredLocale(nextLocale: AppLocale) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, nextLocale)
  } catch {
    // Changing language should still work for the current session if storage is unavailable.
  }
}

function applyDocumentLocale(nextLocale: AppLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLocale
  }
}

function interpolate(message: string, params: Record<string, string | number> = {}) {
  return message.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  )
}

const appLocale = ref<AppLocale>(getStoredLocale())
applyDocumentLocale(appLocale.value)

export function setAppLocale(nextLocale: AppLocale) {
  appLocale.value = nextLocale
  writeStoredLocale(nextLocale)
  applyDocumentLocale(nextLocale)
}

export function t(key: I18nKey, params?: Record<string, string | number>) {
  const message = MESSAGES[appLocale.value][key] ?? MESSAGES[DEFAULT_APP_LOCALE][key]
  return interpolate(message, params)
}

export function useI18n() {
  return {
    locale: readonly(appLocale),
    setLocale: setAppLocale,
    t,
  }
}
