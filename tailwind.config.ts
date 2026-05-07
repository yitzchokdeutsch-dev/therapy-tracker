import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff", 100: "#e0effe", 200: "#bae0fd", 300: "#7cc8fb",
          400: "#36aaf5", 500: "#0c8ee6", 600: "#0070c4", 700: "#01599f",
          800: "#064c83", 900: "#0b406d",
        },
        surface: { 0: "#ffffff", 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db" },
        ink: { 900: "#111827", 700: "#374151", 500: "#6b7280", 400: "#9ca3af", 300: "#d1d5db" },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
