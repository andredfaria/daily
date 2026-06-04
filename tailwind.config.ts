import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'on-surface-variant': '#c7c4d7',
        'surface-container-low': '#1b1b20',
        'on-primary-fixed': '#07006c',
        'surface-container-highest': '#35343a',
        'on-primary': '#1000a9',
        'surface-container-high': '#2a292f',
        'inverse-primary': '#494bd6',
        'surface-tint': '#c0c1ff',
        'on-surface': '#e4e1e9',
        'primary-fixed': '#e1e0ff',
        'secondary-container': '#3a4a5f',
        'on-primary-container': '#0d0096',
        'on-secondary': '#213145',
        'on-background': '#e4e1e9',
        'background': '#131318',
        'primary': '#c0c1ff',
        'surface-variant': '#35343a',
        'tertiary-container': '#00a74b',
        'surface-dim': '#131318',
        'outline-variant': '#464554',
        'on-error': '#690005',
        'outline': '#908fa0',
        'on-secondary-container': '#a9bad3',
        'primary-container': '#8083ff',
        'error': '#ffb4ab',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
        'tertiary': '#4ae176',
        'surface': '#131318',
        'tertiary-fixed': '#6bff8f',
        'surface-container': '#1f1f25',
        'surface-container-lowest': '#0e0e13',
        'secondary': '#b7c8e1',
        'primary-fixed-dim': '#c0c1ff',
        'inverse-on-surface': '#303036',
        'surface-bright': '#39383e',
        'on-tertiary': '#003915',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xl: '20px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        badgeGreen: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        fadeIn: 'fadeIn 0.3s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        badgeGreen: 'badgeGreen 0.4s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
