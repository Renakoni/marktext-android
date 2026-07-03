import type { I18nKey } from './i18n'

export const APP_INFO = Object.freeze({
  name: 'MarkText for Android',
  version: '0.0.0',
  repositoryOwner: 'Renakoni',
  repositoryName: 'marktext-android',
  repositoryUrl: 'https://github.com/Renakoni/marktext-android',
  issuesUrl: 'https://github.com/Renakoni/marktext-android/issues',
  releasesUrl: 'https://github.com/Renakoni/marktext-android/releases',
  latestReleaseApiUrl: 'https://api.github.com/repos/Renakoni/marktext-android/releases/latest',
  upstreamMarkTextUrl: 'https://github.com/marktext/marktext',
  upstreamMuyaUrl: 'https://github.com/marktext/muya',
} as const)

interface AppReferenceLink {
  labelKey: I18nKey
  value: string
  valueKey?: I18nKey
  href: string
  testId: string
}

interface AppReferenceSection {
  titleKey: I18nKey
  links: readonly AppReferenceLink[]
}

export const APP_REFERENCE_SECTIONS: readonly AppReferenceSection[] = [
  {
    titleKey: 'about.section.project',
    links: [
      {
        labelKey: 'about.githubRepository',
        value: 'Renakoni/marktext-android',
        href: APP_INFO.repositoryUrl,
        testId: 'settings-reference-repository',
      },
      {
        labelKey: 'about.allReleases',
        value: 'GitHub releases',
        valueKey: 'about.githubReleases',
        href: APP_INFO.releasesUrl,
        testId: 'settings-reference-releases',
      },
    ],
  },
  {
    titleKey: 'about.section.upstream',
    links: [
      {
        labelKey: 'about.upstreamMarkText',
        value: 'marktext/marktext',
        href: APP_INFO.upstreamMarkTextUrl,
        testId: 'settings-reference-upstream-marktext',
      },
      {
        labelKey: 'about.muyaAttribution',
        value: 'marktext/muya',
        href: APP_INFO.upstreamMuyaUrl,
        testId: 'settings-reference-muya',
      },
    ],
  },
  {
    titleKey: 'about.section.support',
    links: [
      {
        labelKey: 'about.reportIssue',
        value: 'GitHub issues',
        valueKey: 'about.githubIssues',
        href: APP_INFO.issuesUrl,
        testId: 'settings-reference-issues',
      },
    ],
  },
]
