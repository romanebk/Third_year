import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#FAFAFA",
        card: "#0A0A0A",
        "card-foreground": "#FAFAFA",
        popover: "#0A0A0A",
        "popover-foreground": "#FAFAFA",
        primary: "#FAFAFA",
        "primary-foreground": "#000000",
        secondary: "#1A1A1A",
        "secondary-foreground": "#FAFAFA",
        muted: "#1A1A1A",
        "muted-foreground": "#D4D4D4",
        accent: "#262626",
        "accent-foreground": "#FAFAFA",
        destructive: "#F87171",
        "destructive-foreground": "#FFFFFF",
        border: "#262626",
        input: "#404040",
        ring: "#FAFAFA",
        "on-primary": "#FFFFFF",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "ui-monospace", "monospace"],
        "instrument-serif": ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;