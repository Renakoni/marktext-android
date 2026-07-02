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

export interface AppReferenceLink {
  label: string
  value: string
  href: string
  testId: string
}

export interface AppReferenceSection {
  title: string
  links: readonly AppReferenceLink[]
}

export const APP_REFERENCE_SECTIONS = [
  {
    title: 'Project',
    links: [
      {
        label: 'GitHub repository',
        value: 'Renakoni/marktext-android',
        href: APP_INFO.repositoryUrl,
        testId: 'settings-reference-repository',
      },
      {
        label: 'Report an issue',
        value: 'GitHub issues',
        href: APP_INFO.issuesUrl,
        testId: 'settings-reference-issues',
      },
      {
        label: 'All releases',
        value: 'GitHub releases',
        href: APP_INFO.releasesUrl,
        testId: 'settings-reference-releases',
      },
    ],
  },
  {
    title: 'Upstream',
    links: [
      {
        label: 'MarkText desktop',
        value: 'marktext/marktext',
        href: APP_INFO.upstreamMarkTextUrl,
        testId: 'settings-reference-upstream-marktext',
      },
      {
        label: 'Editor core',
        value: 'marktext/muya',
        href: APP_INFO.upstreamMuyaUrl,
        testId: 'settings-reference-muya',
      },
    ],
  },
] as const satisfies readonly AppReferenceSection[]

export const APP_REFERENCE_LINKS: readonly AppReferenceLink[] = APP_REFERENCE_SECTIONS.flatMap(section =>
  [...section.links],
)
