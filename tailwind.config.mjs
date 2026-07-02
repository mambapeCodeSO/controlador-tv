/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D0B14',
        surface: '#17131F',
        surface2: '#1E1830',
        border: '#2A2340',
        primary: '#7C3AED',
        'primary-hover': '#8B5CF6',
        online: '#10B981',
        offline: '#F43F5E',
        text: '#E8E6F0',
        muted: '#8B84A3',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.55)' },
          '70%': { boxShadow: '0 0 0 7px rgba(16, 185, 129, 0)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        toastIn: 'toastIn 0.22s ease-out',
      },
    },
  },
  plugins: [],
};
