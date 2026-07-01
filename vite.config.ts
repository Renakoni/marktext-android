import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const muyaCorePackagePath = realpathSync('node_modules/@muyajs/core')
const muyaNodeModulesPath = resolve(muyaCorePackagePath, '..', '..')
const resolveMuyaDependency = (...paths: string[]) => resolve(muyaNodeModulesPath, ...paths)
const requireFromMuya = createRequire(resolve(muyaCorePackagePath, 'package.json'))
const resolveMuyaPackage = (name: string) =>
  dirname(requireFromMuya.resolve(`${name}/package.json`))
const mermaidPackagePath = resolveMuyaPackage('mermaid')
const requireFromMermaid = createRequire(resolve(mermaidPackagePath, 'package.json'))
const dayjsPackagePath = dirname(requireFromMermaid.resolve('dayjs/package.json'))
const resolveDayjsDependency = (...paths: string[]) => resolve(dayjsPackagePath, ...paths)

const optimizedDayjsPlugins = [
  'dayjs/plugin/advancedFormat.js',
  'dayjs/plugin/customParseFormat.js',
  'dayjs/plugin/duration.js',
  'dayjs/plugin/isoWeek.js',
]

const optimizedMuyaDependencies = [
  '@marktext/file-icons',
  'dayjs',
  ...optimizedDayjsPlugins,
  'fast-diff',
  'mermaid',
  'ot-json1',
  'ot-text-unicode',
  'prismjs',
  'prismjs/components.js',
  'prismjs/dependencies',
  'prismjs/plugins/keep-markup/prism-keep-markup',
  'snabbdom-to-html',
]

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /^mermaid$/,
        replacement: resolve(mermaidPackagePath, 'dist', 'mermaid.core.mjs'),
      },
      {
        find: /^dayjs$/,
        replacement: resolveDayjsDependency('esm', 'index.js'),
      },
      {
        find: /^dayjs\/plugin\/advancedFormat\.js$/,
        replacement: resolveDayjsDependency('esm', 'plugin', 'advancedFormat', 'index.js'),
      },
      {
        find: /^dayjs\/plugin\/customParseFormat\.js$/,
        replacement: resolveDayjsDependency('esm', 'plugin', 'customParseFormat', 'index.js'),
      },
      {
        find: /^dayjs\/plugin\/duration\.js$/,
        replacement: resolveDayjsDependency('esm', 'plugin', 'duration', 'index.js'),
      },
      {
        find: /^dayjs\/plugin\/isoWeek\.js$/,
        replacement: resolveDayjsDependency('esm', 'plugin', 'isoWeek', 'index.js'),
      },
      {
        find: /^@marktext\/file-icons$/,
        replacement: resolveMuyaDependency('@marktext', 'file-icons', 'build', 'index.js'),
      },
      {
        find: /^prismjs\/plugins\/keep-markup\/prism-keep-markup$/,
        replacement: resolveMuyaDependency(
          'prismjs',
          'plugins',
          'keep-markup',
          'prism-keep-markup.js',
        ),
      },
      {
        find: /^prismjs\/components\.js$/,
        replacement: resolveMuyaDependency('prismjs', 'components.js'),
      },
      {
        find: /^prismjs\/dependencies$/,
        replacement: resolveMuyaDependency('prismjs', 'dependencies.js'),
      },
      {
        find: /^prismjs$/,
        replacement: resolveMuyaDependency('prismjs', 'prism.js'),
      },
      {
        find: /^fast-diff$/,
        replacement: resolveMuyaDependency('fast-diff', 'diff.js'),
      },
      {
        find: /^ot-json1$/,
        replacement: resolveMuyaDependency('ot-json1', 'dist', 'index.js'),
      },
      {
        find: /^ot-text-unicode$/,
        replacement: resolveMuyaDependency('ot-text-unicode', 'dist', 'index.js'),
      },
      {
        find: /^snabbdom-to-html$/,
        replacement: resolveMuyaDependency('snabbdom-to-html', 'index.js'),
      },
    ],
  },
  oxc: {
    decorator: {
      legacy: true,
    },
  },
  optimizeDeps: {
    include: optimizedMuyaDependencies,
    exclude: ['@muyajs/core'],
  },
  test: {
    exclude: [
      'android/**',
      'dist/**',
      'node_modules/**',
      'third_party/**',
    ],
  },
})
