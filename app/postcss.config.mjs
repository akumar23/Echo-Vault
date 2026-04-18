/**
 * PostCSS configuration for Tailwind v4.
 *
 * Tailwind v4 uses the `@tailwindcss/postcss` plugin and is configured
 * via CSS `@theme` directives in `app/globals.css` (no `tailwind.config.*`).
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
