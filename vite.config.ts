import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const muyaCorePackagePath = realpathSync('node_modules/@muyajs/core')
const muyaNodeModulesPath = resolve(muyaCorePackagePath, '..', '..')
const resolveMuyaDependency = (...paths: string[]) => resolve(muyaNodeModulesPath, ...paths)

const optimizedMuyaDependencies = [
  '@marktext/file-icons',
  'fast-diff',
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
