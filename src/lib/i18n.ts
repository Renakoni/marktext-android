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
    'settings.code': 'Code',
    'settings.markdown': 'Markdown',
    'settings.documents': 'Documents',
    'settings.imagesSharing': 'Images & Sharing',
    'settings.spelling': 'Spelling',
    'settings.advanced': 'Advanced',
    'settings.about': 'About MarkText',
    'settings.back': 'Back to settings',
    'settings.entry.appearance': 'Theme, language, text',
    'settings.entry.editing': 'Pairs, assist, toolbar',
    'settings.entry.code': 'Blocks, wrap, code font',
    'settings.entry.markdown': 'Lists, extensions, HTML',
    'settings.entry.documents': 'Drafts, save, startup',
    'settings.entry.imagesSharing': 'Import, folder, sharing',
    'settings.entry.spelling': 'Check, language, marks',
    'settings.entry.advanced': 'Logs, files, diagnostics',
    'settings.entry.about': 'Version and links',

    'settings.section.language': 'Language',
    'settings.section.theme': 'Theme',
    'settings.section.text': 'Text',
    'settings.section.autoPair': 'Pairs',
    'settings.section.assist': 'Assist',
    'settings.section.codeBlocks': 'Blocks',
    'settings.section.mobileToolbar': 'Toolbar',
    'settings.section.style': 'Style',
    'settings.section.lists': 'Lists',
    'settings.section.headings': 'Headings',
    'settings.section.extensions': 'Extensions',
    'settings.section.rendering': 'Rendering',
    'settings.section.drafts': 'Drafts',
    'settings.section.save': 'Save',
    'settings.section.startup': 'Startup',
    'settings.section.import': 'Import',
    'settings.section.folder': 'Folder',
    'settings.section.sharing': 'Sharing',
    'settings.section.spellcheck': 'Spellcheck',
    'settings.section.marks': 'Marks',
    'settings.section.dictionary': 'Dictionary',
    'settings.section.images': 'Images',
    'settings.section.maintenance': 'Maintenance',
    'settings.section.diagnostics': 'Diagnostics',
    'settings.section.files': 'Files',
    'settings.section.diagrams': 'Diagrams',

    'settings.language.app': 'Language',
    'settings.language.english': 'English',
    'settings.language.chineseSimplified': '中文',

    'settings.appearance.followSystemTheme': 'System theme',
    'settings.appearance.appTheme': 'App theme',
    'settings.appearance.editorTheme': 'Editor theme',
    'settings.appearance.fontSize': 'Font size',
    'settings.appearance.lineHeight': 'Line height',

    'settings.editing.autoPairBrackets': 'Brackets',
    'settings.editing.autoPairMarkdown': 'Markdown marks',
    'settings.editing.autoPairQuotes': 'Quotes',
    'settings.editing.quickInsert': 'Quick insert',
    'settings.editing.linkPopup': 'Link popup',
    'settings.editing.taskSync': 'Task sync',
    'settings.editing.keyboardBehavior': 'Keyboard',
    'settings.editing.defaultToolbar': 'Default tab',
    'settings.editing.rememberToolbar': 'Remember tab',

    'settings.code.lineNumbers': 'Line numbers',
    'settings.code.wrapLines': 'Wrap lines',
    'settings.code.trimEmptyLines': 'Trim empty lines',
    'settings.code.fontSize': 'Font size',
    'settings.code.font': 'Font',

    'settings.markdown.looseLists': 'Loose lists',
    'settings.markdown.headingStyle': 'Headings',
    'settings.markdown.bulletMarker': 'Bullets',
    'settings.markdown.orderedDelimiter': 'Ordered lists',
    'settings.markdown.listIndentation': 'Indent',
    'settings.markdown.frontMatter': 'Front matter',
    'settings.markdown.htmlRendering': 'HTML',
    'settings.markdown.footnotes': 'Footnotes',
    'settings.markdown.superSub': 'Super/subscript',
    'settings.markdown.gitlab': 'GitLab',
    'settings.markdown.sequenceTheme': 'Sequence theme',

    'settings.documents.localDrafts': 'Local drafts',
    'settings.documents.recovery': 'Recovery',
    'settings.documents.autosave': 'Autosave',
    'settings.documents.saveDelay': 'Save delay',
    'settings.documents.restoreSession': 'Restore session',
    'settings.documents.openLast': 'Open last',

    'settings.images.imageImport': 'Import images',
    'settings.images.copyImages': 'Copy images',
    'settings.images.imageFolder': 'Image folder',
    'settings.images.relativeFolder': 'Relative folder',
    'settings.images.shareImages': 'Share images',
    'settings.images.attachLocal': 'Attach local',
    'settings.images.includeLinked': 'Linked images',

    'settings.spelling.enabled': 'Spellcheck',
    'settings.spelling.language': 'Language',
    'settings.spelling.underlines': 'Underlines',
    'settings.spelling.dictionary': 'Custom words',

    'settings.advanced.exportLogs': 'Export logs',
    'settings.advanced.clearDrafts': 'Clear local drafts',
    'settings.advanced.reset': 'Reset settings',
    'settings.advanced.diagnostics': 'Device info',
    'settings.advanced.webview': 'WebView',
    'settings.advanced.markdownCompat': 'Compatibility',
    'settings.advanced.encoding': 'Encoding',
    'settings.advanced.lineEndings': 'Line endings',
    'settings.advanced.normalizeEndings': 'Normalize endings',
    'settings.advanced.trailingNewline': 'Trailing newline',
    'settings.advanced.plantumlServer': 'PlantUML server',

    'settings.value.on': 'On',
    'settings.value.off': 'Off',
    'settings.value.system': 'System',
    'settings.value.default': 'Default',
    'settings.value.medium': 'Medium',
    'settings.value.normal': 'Normal',
    'settings.value.dockAboveKeyboard': 'Docked',
    'settings.value.format': 'Format',
    'settings.value.atxHeading': 'ATX (#)',
    'settings.value.yaml': 'YAML',
    'settings.value.hyphen': '-',
    'settings.value.period': '.',
    'settings.value.twoSpaces': '2 spaces',
    'settings.value.handDrawn': 'Hand drawn',
    'settings.value.recent': 'Recent',
    'settings.value.onFailure': 'On failure',
    'settings.value.fiveSeconds': '5 s',
    'settings.value.copy': 'Copy',
    'settings.value.appStorage': 'App storage',
    'settings.value.picker': 'Picker',
    'settings.value.assets': 'assets',
    'settings.value.attach': 'Attach',
    'settings.value.english': 'English',
    'settings.value.later': 'Later',
    'settings.value.manual': 'Manual',
    'settings.value.ready': 'Ready',
    'settings.value.advanced': 'Advanced',
    'settings.value.utf8': 'UTF-8',
    'settings.value.preserve': 'Preserve',

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
    'settings.code': '代码',
    'settings.markdown': 'Markdown',
    'settings.documents': '文档',
    'settings.imagesSharing': '图片与分享',
    'settings.spelling': '拼写',
    'settings.advanced': '高级',
    'settings.about': '关于 MarkText',
    'settings.back': '返回设置',
    'settings.entry.appearance': '主题、语言、文字',
    'settings.entry.editing': '配对、辅助、工具栏',
    'settings.entry.code': '代码块、换行、字体',
    'settings.entry.markdown': '列表、扩展、HTML',
    'settings.entry.documents': '草稿、保存、启动',
    'settings.entry.imagesSharing': '导入、文件夹、分享',
    'settings.entry.spelling': '检查、语言、标记',
    'settings.entry.advanced': '日志、文件、诊断',
    'settings.entry.about': '版本与链接',

    'settings.section.language': '语言',
    'settings.section.theme': '主题',
    'settings.section.text': '文字',
    'settings.section.autoPair': '配对',
    'settings.section.assist': '辅助',
    'settings.section.codeBlocks': '代码块',
    'settings.section.mobileToolbar': '工具栏',
    'settings.section.style': '样式',
    'settings.section.lists': '列表',
    'settings.section.headings': '标题',
    'settings.section.extensions': '扩展',
    'settings.section.rendering': '渲染',
    'settings.section.drafts': '草稿',
    'settings.section.save': '保存',
    'settings.section.startup': '启动',
    'settings.section.import': '导入',
    'settings.section.folder': '文件夹',
    'settings.section.sharing': '分享',
    'settings.section.spellcheck': '拼写检查',
    'settings.section.marks': '标记',
    'settings.section.dictionary': '词典',
    'settings.section.images': '图片',
    'settings.section.maintenance': '维护',
    'settings.section.diagnostics': '诊断',
    'settings.section.files': '文件',
    'settings.section.diagrams': '图表',

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
    'settings.editing.quickInsert': '快速插入',
    'settings.editing.linkPopup': '链接弹窗',
    'settings.editing.taskSync': '任务同步',
    'settings.editing.keyboardBehavior': '键盘',
    'settings.editing.defaultToolbar': '默认标签',
    'settings.editing.rememberToolbar': '记住标签',

    'settings.code.lineNumbers': '行号',
    'settings.code.wrapLines': '自动换行',
    'settings.code.trimEmptyLines': '清理空行',
    'settings.code.fontSize': '字号',
    'settings.code.font': '字体',

    'settings.markdown.looseLists': '宽松列表',
    'settings.markdown.headingStyle': '标题',
    'settings.markdown.bulletMarker': '无序列表',
    'settings.markdown.orderedDelimiter': '有序列表',
    'settings.markdown.listIndentation': '缩进',
    'settings.markdown.frontMatter': 'Front matter',
    'settings.markdown.htmlRendering': 'HTML',
    'settings.markdown.footnotes': '脚注',
    'settings.markdown.superSub': '上标/下标',
    'settings.markdown.gitlab': 'GitLab',
    'settings.markdown.sequenceTheme': '时序图主题',

    'settings.documents.localDrafts': '本地草稿',
    'settings.documents.recovery': '恢复',
    'settings.documents.autosave': '自动保存',
    'settings.documents.saveDelay': '保存延迟',
    'settings.documents.restoreSession': '恢复会话',
    'settings.documents.openLast': '打开上次',

    'settings.images.imageImport': '导入图片',
    'settings.images.copyImages': '复制图片',
    'settings.images.imageFolder': '图片文件夹',
    'settings.images.relativeFolder': '相对文件夹',
    'settings.images.shareImages': '分享图片',
    'settings.images.attachLocal': '附带本地',
    'settings.images.includeLinked': '链接图片',

    'settings.spelling.enabled': '拼写检查',
    'settings.spelling.language': '语言',
    'settings.spelling.underlines': '下划线',
    'settings.spelling.dictionary': '自定义词',

    'settings.advanced.exportLogs': '导出日志',
    'settings.advanced.clearDrafts': '清除本地草稿',
    'settings.advanced.reset': '重置设置',
    'settings.advanced.diagnostics': '设备信息',
    'settings.advanced.webview': 'WebView',
    'settings.advanced.markdownCompat': '兼容性',
    'settings.advanced.encoding': '编码',
    'settings.advanced.lineEndings': '换行符',
    'settings.advanced.normalizeEndings': '规范换行符',
    'settings.advanced.trailingNewline': '末尾换行',
    'settings.advanced.plantumlServer': 'PlantUML 服务器',

    'settings.value.on': '开',
    'settings.value.off': '关',
    'settings.value.system': '跟随系统',
    'settings.value.default': '默认',
    'settings.value.medium': '中',
    'settings.value.normal': '标准',
    'settings.value.dockAboveKeyboard': '停靠',
    'settings.value.format': '格式',
    'settings.value.atxHeading': 'ATX (#)',
    'settings.value.yaml': 'YAML',
    'settings.value.hyphen': '-',
    'settings.value.period': '.',
    'settings.value.twoSpaces': '2 空格',
    'settings.value.handDrawn': '手绘',
    'settings.value.recent': '最近',
    'settings.value.onFailure': '失败时',
    'settings.value.fiveSeconds': '5 秒',
    'settings.value.copy': '复制',
    'settings.value.appStorage': '应用存储',
    'settings.value.picker': '选择器',
    'settings.value.assets': 'assets',
    'settings.value.attach': '附带',
    'settings.value.english': 'English',
    'settings.value.later': '稍后',
    'settings.value.manual': '手动',
    'settings.value.ready': '就绪',
    'settings.value.advanced': '高级',
    'settings.value.utf8': 'UTF-8',
    'settings.value.preserve': '保留',

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
