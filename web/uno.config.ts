import { defineConfig } from "unocss"
import presetWind4 from "@unocss/preset-wind4"

export default defineConfig({
  presets: [
    presetWind4(),
  ],
  theme: {
    colors: {
      // Brand colors from your colors.css
      brand: {
        primary: "#c44536",
        "primary-hover": "#a83a2e",
        "primary-dark": "#8b2f23",
      },
      // Neutral grays
      gray: {
        100: "#fafafa",
        200: "#e5e5e5",
        300: "#e0e0e0",
        400: "#666666",
        500: "#555555",
        600: "#333333",
      },
      // Background from your homepage
      page: "#faf9f6",
    },
  },
  shortcuts: {
    // Base button styles
    "btn": "px-4 py-2 rounded-md font-semibold transition-all duration-200 cursor-pointer border-none outline-none",
    
    // Button variants
    "btn-primary": "btn bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-dark shadow-sm hover:shadow-md",
    "btn-secondary": "btn bg-gray-500 text-white hover:bg-gray-600 active:bg-gray-600 shadow-sm hover:shadow-md",
    "btn-default": "btn bg-gray-200 text-gray-600 hover:bg-gray-300 active:bg-gray-300",
    "btn-outline": "btn border-2 border-brand-primary text-brand-primary bg-transparent hover:bg-brand-primary hover:text-white",
    "btn-ghost": "btn bg-transparent text-brand-primary hover:bg-gray-100",
    
    // Button sizes
    "btn-sm": "px-3 py-1.5 text-sm",
    "btn-lg": "px-6 py-3 text-lg",
    
    // Disabled state
    "btn-disabled": "btn bg-gray-300 text-gray-500 cursor-not-allowed opacity-60",
  },
})