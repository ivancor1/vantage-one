import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light "Gamut" system — monochrome, warm paper neutrals, ink accent.
        // Token ROLES are preserved from the old dark theme (black = app canvas,
        // text = foreground, yellow = accent) so the whole app flips at the token
        // level; only the luminance is inverted.
        vantage: {
          black:   '#eae7e1',            // app canvas (warm light gray)
          surface: '#f7f5f1',            // raised panels / inputs / overlays / shell
          card:    '#ffffff',            // cards
          border:  '#e5e1d9',            // warm hairline
          bright:  '#d3cec4',            // stronger border / hover
          yellow:  '#1a1813',            // accent → ink (Gamut is monochrome)
          'yellow-dim':  'rgba(26, 24, 19, 0.06)',   // subtle ink tint (active chips)
          'yellow-glow': 'rgba(26, 24, 19, 0.12)',
          text:    '#1a1813',            // foreground ink
          muted:   '#6c6862',            // secondary (AA on white)
          faint:   '#857e72',            // tertiary labels / icons
        },
        // Semantic status kept (real storm severity) — retuned to AA on white.
        status: {
          critical: '#c0392b',
          high:     '#b45309',
          elevated: '#a16207',
          standard: '#6c6862',
          success:  '#15803d',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
