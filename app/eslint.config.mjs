import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

/**
 * Flat ESLint config for Next.js 16.
 *
 * eslint-config-next v16 exports native flat-config arrays, so we consume
 * them directly instead of going through FlatCompat (which pulled in the
 * legacy eslintrc loader and crashed on circular references).
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      'src-tauri/**',
      'test-results/**',
      'playwright-report/**',
      'tsconfig.tsbuildinfo',
    ],
  },
]

export default eslintConfig
