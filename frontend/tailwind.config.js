/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ---------- Colors ----------
      colors: {
        // Surfaces
        surface: 'var(--surface)',
        'surface-dim': 'var(--surface-dim)',
        'surface-bright': 'var(--surface-bright)',
        'surface-lowest': 'var(--surface-lowest)',
        'surface-low': 'var(--surface-low)',
        'surface-high': 'var(--surface-high)',
        'surface-highest': 'var(--surface-highest)',
        'on-surface': 'var(--on-surface)',
        'on-surface-var': 'var(--on-surface-var)',
        'inverse-surface': 'var(--inverse-surface)',
        'inverse-on-surface': 'var(--inverse-on-surface)',

        // Primary
        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        'primary-cont': 'var(--primary-cont)',
        'on-primary-cont': 'var(--on-primary-cont)',
        'inverse-primary': 'var(--inverse-primary)',
        'primary-fixed': 'var(--primary-fixed)',
        'primary-fixed-dim': 'var(--primary-fixed-dim)',
        'on-primary-fixed': 'var(--on-primary-fixed)',
        'on-primary-fixed-var': 'var(--on-primary-fixed-var)',

        // Secondary
        secondary: 'var(--secondary)',
        'on-secondary': 'var(--on-secondary)',
        'secondary-cont': 'var(--secondary-cont)',
        'on-secondary-cont': 'var(--on-secondary-cont)',
        'secondary-fixed': 'var(--secondary-fixed)',
        'secondary-fixed-dim': 'var(--secondary-fixed-dim)',
        'on-secondary-fixed': 'var(--on-secondary-fixed)',
        'on-secondary-fixed-var': 'var(--on-secondary-fixed-var)',

        // Tertiary
        tertiary: 'var(--tertiary)',
        'on-tertiary': 'var(--on-tertiary)',
        'tertiary-cont': 'var(--tertiary-cont)',
        'on-tertiary-cont': 'var(--on-tertiary-cont)',
        'tertiary-fixed': 'var(--tertiary-fixed)',
        'tertiary-fixed-dim': 'var(--tertiary-fixed-dim)',
        'on-tertiary-fixed': 'var(--on-tertiary-fixed)',
        'on-tertiary-fixed-var': 'var(--on-tertiary-fixed-var)',

        // Error
        error: 'var(--error)',
        'on-error': 'var(--on-error)',
        'error-cont': 'var(--error-cont)',
        'on-error-cont': 'var(--on-error-cont)',

        // Background & status
        bg: 'var(--bg)',
        'on-bg': 'var(--on-bg)',
        'surface-var': 'var(--surface-var)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        outline: 'var(--outline)',
        'outline-var': 'var(--outline-var)',
        'surface-tint': 'var(--surface-tint)',
      },

      // ---------- Typography ----------
      fontFamily: {
        sans: ['var(--font)', { fontFeatureSettings: '"ss01" on' }],
      },

      fontSize: {
        title: [
          'var(--fz-title)',
          { lineHeight: 'var(--lh-title)', fontWeight: 'var(--fw-title)' },
        ],
        section: [
          'var(--fz-section)',
          { lineHeight: 'var(--lh-section)', fontWeight: 'var(--fw-section)' },
        ],
        card: [
          'var(--fz-card)',
          { lineHeight: 'var(--lh-card)', fontWeight: 'var(--fw-card)' },
        ],
        body: [
          'var(--fz-body)',
          { lineHeight: 'var(--lh-body)', fontWeight: 'var(--fw-body)' },
        ],
        label: [
          'var(--fz-label)',
          { lineHeight: 'var(--lh-label)', fontWeight: 'var(--fw-label)' },
        ],
        btn: [
          'var(--fz-btn)',
          { lineHeight: 'var(--lh-btn)', fontWeight: 'var(--fw-btn)' },
        ],
        helper: [
          'var(--fz-helper)',
          { lineHeight: 'var(--lh-helper)', fontWeight: 'var(--fw-helper)' },
        ],
      },

      // ---------- Border Radius ----------
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        full: 'var(--r-full)',
      },

      // ---------- Shadows ----------
      boxShadow: {
        DEFAULT: 'var(--shadow)',
        subtle: 'var(--shadow)', // alias for clarity
      },

      // ---------- Layout & Spacing ----------
      maxWidth: {
        container: 'var(--max-w)',
      },
      spacing: {
        gutter: 'var(--gutter)',
        'margin-d': 'var(--margin-d)',
        'margin-m': 'var(--margin-m)',
        'input-h': 'var(--input-h)',
      },
    },
  },

  // ---------- DaisyUI Configuration ----------
  daisyui: {
    themes: [
      {
        // Your custom enterprise theme
        enterprise: {
          // Map daisyUI’s semantic roles to your design tokens
          primary: 'var(--primary)',
          'primary-content': 'var(--on-primary)',
          secondary: 'var(--secondary)',
          'secondary-content': 'var(--on-secondary)',
          accent: 'var(--tertiary)',
          'accent-content': 'var(--on-tertiary)',
          neutral: 'var(--surface-high)',
          'neutral-content': 'var(--on-surface)',
          'base-100': 'var(--surface)',
          'base-200': 'var(--surface-low)',
          'base-300': 'var(--surface-container)',
          'base-content': 'var(--on-surface)',
          info: 'var(--primary-cont)',
          success: 'var(--success)',
          warning: 'var(--warning)',
          error: 'var(--danger)',
        },
      },
      'light', // fallback (optional)
    ],
    // Prefer the enterprise theme by default
    defaultTheme: 'enterprise',
    // Keep daisyUI’s base styles and components
    base: true,
    styled: true,
    utils: true,
  },

  plugins: [require('daisyui')],
};
