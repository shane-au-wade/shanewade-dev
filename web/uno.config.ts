import { defineConfig } from "unocss"
import presetWind4 from "@unocss/preset-wind4"

export default defineConfig({
  preflights: [
    {
      getCSS: ({ theme: _theme }) => `
        .full-page-section {
          display: flex;
          flex-direction: row;
          min-height: 100vh;

          @media (orientation: portrait) {
            flex-direction: column;
          }
        }
      `,
    },
  ],
  rules: [
    [
      "auto-grid-css",
      {
        display: "grid",
        gap: "var(--gap, 1rem)",
        "grid-template-columns": "repeat(var(--grid-type, auto-fit), minmax(min(200px, 100%), 1fr))",
        "grid-auto-rows": "auto auto auto",
        "container-type": "inline-size",
      },
    ],
    [
      "section",
      {
        "max-width": "92vw",
        "padding-top": "7rem",
        "padding-bottom": "4rem",
        "margin": "0 auto",
      },
    ],
    [
      "checkbox",
      {
        position: "relative",
        width: "1rem",
        height: "1rem",
        "border-radius": "7px",
        "accent-color": "var(--color-brand-primary)",
      },
    ],
  ],
  presets: [
    presetWind4(),
  ],
  theme: {
    colors: {
      // Brand colors - light theme
      brand: {
        primary: "#89181e",
        "primary-hover": "#a83a2e",
        "primary-dark": "#55161c",
        "primary-light": "#c22028",
      },
      // Neutral grays - light theme
      gray: {
        50: "#f9fafb",
        100: "#fafafa",
        200: "#e5e5e5",
        300: "#e0e0e0",
        400: "#a8a8a8",
        500: "#555555",
        600: "#333333",
        700: "#2a2a2a",
        800: "#1f1f1f",
        900: "#171717",
      },
      // Light theme backgrounds
      page: "#faf9f6",
      // Dark theme colors
      dark: {
        bg: "#0a0a0a",
        "bg-secondary": "#141414",
        "bg-elevated": "#1a1a1a",
        "bg-hover": "#252525",
        border: "#2a2a2a",
        "border-light": "#1f1f1f",
        text: "#e5e5e5",
        "text-secondary": "#a0a0a0",
        "text-muted": "#6b6b6b",
      },
      // Semantic colors
      success: {
        DEFAULT: "#10b981",
        hover: "#059669",
        dark: "#047857",
      },
      warning: {
        DEFAULT: "#f59e0b",
        hover: "#d97706",
        dark: "#b45309",
      },
      error: {
        DEFAULT: "#ef4444",
        hover: "#dc2626",
        dark: "#b91c1c",
      },
      info: {
        DEFAULT: "#3b82f6",
        hover: "#2563eb",
        dark: "#1d4ed8",
      },
    },
  },
  shortcuts: {
    // ===================
    // BUTTONS
    // ===================
    "btn":
      "px-2.5 py-1.5 rounded-sm font-semibold transition-all duration-200 cursor-pointer border-none outline-none inline-flex items-center justify-center gap-2 active:translate-y-[1px]",
    // Button variants
    "btn-primary":
      "btn bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-dark shadow-sm hover:shadow-md dark:bg-brand-primary-light dark:hover:bg-brand-primary",
    "btn-secondary":
      "btn bg-gray-500 text-white hover:bg-gray-600 active:bg-gray-600 shadow-sm hover:shadow-md dark:bg-gray-700 dark:hover:bg-gray-600",
    "btn-default":
      "btn bg-gray-200 text-gray-600 hover:bg-gray-300 active:bg-gray-300 dark:bg-dark-bg-elevated dark:text-dark-text dark:hover:bg-dark-bg-hover",
    "btn-outline":
      "btn border-2 border-brand-primary text-brand-primary bg-transparent hover:bg-brand-primary hover:text-white dark:border-brand-primary-light dark:text-brand-primary-light dark:hover:bg-brand-primary-light dark:hover:text-white",
    "btn-ghost": "btn bg-transparent hover:bg-gray-100 dark:hover:bg-dark-bg-hover dark:text-dark-text",
    "btn-ghost-primary": "btn-ghost text-brand-primary dark:text-brand-primary-light",
    "btn-success": "btn bg-success text-white hover:bg-success-hover shadow-sm",
    "btn-warning": "btn bg-warning text-white hover:bg-warning-hover shadow-sm",
    "btn-error": "btn bg-error text-white hover:bg-error-hover shadow-sm",
    "btn-info": "btn bg-info text-white hover:bg-info-hover shadow-sm",

    // Button sizes
    "btn-sm": "px-3 py-1.5 text-sm",
    "btn-lg": "px-6 py-3 text-lg",
    "btn-icon": "p-2 aspect-square",

    // Button states
    "btn-disabled": "btn bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 dark:bg-gray-800 dark:text-gray-600",

    // ===================
    // TYPOGRAPHY
    // ===================
    "heading-1": "text-3xl md:text-4xl font-bold leading-tight text-gray-900 dark:text-dark-text",
    "heading-2": "text-2xl md:text-3xl font-bold leading-tight text-gray-900 dark:text-gray-400",
    "heading-3": "text-xl  md:text-2xl font-semibold leading-snug text-gray-900 dark:text-gray-400",
    "heading-4": "text-lg md:text-xl font-semibold leading-snug text-gray-700 dark:text-gray-400",
    "heading-5": "text-base md:text-lg font-semibold leading-normal text-gray-700 dark:text-dark-text",
    "heading-6": "text-base md:text-lg font-semibold leading-normal text-gray-700 dark:text-dark-text",

    "text-lead": "text-xl leading-relaxed text-gray-700 dark:text-dark-text-secondary",
    "text-body": "text-base leading-normal text-gray-900 dark:text-dark-text",
    "text-muted": "text-sm text-gray-500 dark:text-dark-text-muted",
    "text-small": "text-sm leading-normal text-gray-600 dark:text-dark-text-secondary",
    "text-sub": "text-xs text-gray-500 dark:text-dark-text-muted",
    "text-blockquote": "text-body italic p-2 my-4 border-s-2 border-brand-primary",

    "link":
      "text-brand-primary underline hover:text-brand-primary-hover transition-colors dark:text-brand-primary-light dark:hover:text-brand-primary",
    "link-subtle":
      "text-gray-600 hover:text-brand-primary transition-colors dark:text-brand-primary-light dark:hover:text-brand-primary",

    // ===================
    // FORMS
    // ===================
    "input":
      "w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all dark:bg-dark-bg-elevated dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-text-muted dark:focus:ring-brand-primary-light",
    "input-sm": "px-2.5 py-1.5 text-sm",
    "input-lg": "px-4 py-3 text-lg",
    "input-error": "border-error focus:ring-error",

    "select": "input appearance-none bg-no-repeat bg-right pr-10 cursor-pointer",
    "textarea": "input resize-y min-h-24",

    "radio": "checkbox rounded-full",

    "label": "block text-sm font-medium text-gray-700 mb-1 dark:text-dark-text-secondary",
    "label-inline": "text-sm font-medium text-gray-700 dark:text-dark-text-secondary",
    "help-text": "text-xs text-gray-500 mt-1 dark:text-dark-text-muted",
    "error-text": "text-xs text-error mt-1",

    "input-group": "flex items-center gap-2",

    // ===================
    // CARDS
    // ===================
    "card":
      "bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 dark:bg-dark-bg-elevated dark:border-dark-border",
    "card-hover": "card hover:border-brand-primary-dark hover:border-dashed cursor-pointer",
    "card-header": "px-1 py-3",
    "card-body": "px-1 py-3",
    "card-footer": "px-1 py-3 border-none",

    // ===================
    // BADGES
    // ===================
    "badge": "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
    "badge-primary":
      "badge bg-brand-primary bg-opacity-10 text-brand-primary dark:bg-brand-primary-light dark:bg-opacity-20 dark:text-brand-primary-light",
    "badge-secondary":
      "badge bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 outline outline-1 outline-gray-400",
    "badge-success":
      "badge bg-success bg-opacity-10 text-success-dark dark:bg-success dark:bg-opacity-20 dark:text-success",
    "badge-warning":
      "badge bg-warning bg-opacity-10 text-warning-dark dark:bg-warning dark:bg-opacity-20 dark:text-warning",
    "badge-error": "badge bg-error bg-opacity-10 text-error-dark dark:bg-error dark:bg-opacity-20 dark:text-error",
    "badge-info": "badge bg-info bg-opacity-10 text-info-dark dark:bg-info dark:bg-opacity-20 dark:text-info",

    // ===================
    // ALERTS
    // ===================
    "alert": "p-4 rounded-lg border",
    "alert-success":
      "alert bg-success bg-opacity-10 border-success text-success-dark dark:bg-success dark:bg-opacity-20 dark:text-success dark:border-success-dark",
    "alert-warning":
      "alert bg-warning bg-opacity-10 border-warning text-warning-dark dark:bg-warning dark:bg-opacity-20 dark:text-warning dark:border-warning-dark",
    "alert-error":
      "alert bg-error bg-opacity-10 border-error text-error-dark dark:bg-error dark:bg-opacity-20 dark:text-error dark:border-error-dark",
    "alert-info":
      "alert bg-info bg-opacity-10 border-info text-info-dark dark:bg-info dark:bg-opacity-20 dark:text-info dark:border-info-dark",

    // ===================
    // MODAL/DIALOG
    // ===================
    "dialog":
      "backdrop:bg-black backdrop:bg-opacity-50 backdrop:backdrop-blur-sm bg-transparent border-none max-w-lg w-full p-0 rounded-lg fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "dialog-backdrop": "fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm",
    "dialog-content": "relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-auto p-6 dark:bg-dark-bg-elevated",
    "dialog-header": "flex items-start justify-between mb-4",
    "dialog-title": "text-xl font-semibold text-gray-900 dark:text-dark-text",
    "dialog-close":
      "text-gray-400 hover:text-gray-600 transition-colors p-1 dark:text-dark-text-muted dark:hover:text-dark-text",
    "dialog-body": "text-gray-700 mb-6 dark:text-dark-text-secondary",
    "dialog-footer": "flex justify-end gap-3",

    // ===================
    // FLOATING ACTION BUTTON
    // ===================
    "floating-action-button": "fixed bottom-4 right-4",

    // ===================
    // LAYOUT
    // ===================
    "container": "max-w-7xl mx-auto px-2 sm:px-6 lg:px-8",
    "divider": "border-t border-gray-200 dark:border-dark-border",
    "auto-grid": "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",

    // ===================
    // UTILITIES
    // ===================
    "loading-spinner": "animate-spin rounded-full border-2 border-gray-300 border-t-brand-primary",
    "focus-ring":
      "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 dark:focus:ring-brand-primary-light dark:focus:ring-offset-dark-bg",
    "hero-image": "rounded-sm border border-gray-200 border-opacity-80 border-2",
    "mobile-image": "w-full h-auto rounded-lg shadow-lg object-cover aspect-[1/1]",
  },
})
