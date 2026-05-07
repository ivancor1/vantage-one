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
        vantage: {
          black:   '#07090C',
          surface: '#0D1117',
          card:    '#13191F',
          border:  '#1E2A35',
          bright:  '#2D3B47',
          yellow:  '#F0C020',
          'yellow-dim': 'rgba(240, 192, 32, 0.12)',
          'yellow-glow': 'rgba(240, 192, 32, 0.25)',
          text:    '#E2EAF0',
          muted:   '#8B9CB0',
          faint:   '#4A5568',
        },
        status: {
          critical: '#EF4444',
          high:     '#F97316',
          elevated: '#F0C020',
          standard: '#6B7280',
          success:  '#10B981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
