/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand palette ──────────────────────────────────────────────────────
        ivory: {
          DEFAULT: '#FAF7F2',
          50: '#FDFCFA',
          100: '#FAF7F2',
          200: '#F2EBE0',
          300: '#E8DDD0',
        },
        plum: {
          DEFAULT: '#4A1942',
          50: '#F5EDF4',
          100: '#E8D0E6',
          200: '#C89DC4',
          300: '#A56CA0',
          400: '#7B3F7A',
          500: '#4A1942',
          600: '#3A1233',
          700: '#2B0D26',
          800: '#1C0819',
          900: '#0D030C',
        },
        gold: {
          DEFAULT: '#C9A84C',
          50: '#FBF6E9',
          100: '#F5EACC',
          200: '#E8D5A3',
          300: '#DAC07A',
          400: '#C9A84C',
          500: '#B08930',
          600: '#8A6A24',
          700: '#654E1A',
          800: '#3F3110',
          900: '#1A1406',
        },
        charcoal: {
          DEFAULT: '#2C2C2C',
          light: '#444444',
        },
        muted: '#8B8B8B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 4px 24px -4px rgba(74, 25, 66, 0.08)',
        'card-hover': '0 12px 40px -8px rgba(74, 25, 66, 0.18)',
        'gold': '0 4px 20px -4px rgba(201, 168, 76, 0.3)',
        'glass': '0 8px 32px rgba(74, 25, 66, 0.12)',
      },
      backgroundImage: {
        'gradient-plum': 'linear-gradient(135deg, #4A1942 0%, #7B3F7A 100%)',
        'gradient-gold': 'linear-gradient(135deg, #C9A84C 0%, #E8D5A3 100%)',
        'gradient-ivory': 'linear-gradient(180deg, #FAF7F2 0%, #F2EBE0 100%)',
        'hero-pattern':
          'radial-gradient(ellipse at 20% 50%, rgba(74,25,66,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(201,168,76,0.12) 0%, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-gold': 'pulseGold 2.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out -3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': {
            boxShadow: '0 4px 20px -4px rgba(201, 168, 76, 0.3), 0 0 0 0 rgba(201, 168, 76, 0)',
          },
          '50%': {
            boxShadow: '0 4px 24px -2px rgba(201, 168, 76, 0.45), 0 0 0 10px rgba(201, 168, 76, 0.15)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};
