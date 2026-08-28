import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        candy: {
          50: "#fff5f8",
          100: "#ffe4ee",
          200: "#ffc9dd",
          300: "#ffa3c6",
          400: "#ff75aa",
          500: "#f44a8b",
          600: "#d92b70",
          700: "#b31c5c",
          800: "#8f1a4d",
          900: "#6e1740",
        },
        lilac: {
          100: "#f3e8ff",
          200: "#e2c7ff",
          300: "#c9a4f5",
          400: "#ab7de8",
          500: "#8d5bd6",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-quicksand)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      animation: {
        "float-slow": "float 8s ease-in-out infinite",
        "float-slower": "float 11s ease-in-out infinite",
        wiggle: "wiggle 2.5s ease-in-out infinite",
        "pulse-soft": "pulse 3s ease-in-out infinite",
        bob: "bob 4s ease-in-out infinite",
        "bob-fast": "bob 2.2s ease-in-out infinite",
        "tail-wag": "tailWag 2.8s ease-in-out infinite",
        "ear-twitch": "earTwitch 5s ease-in-out infinite",
        "cat-blink": "catBlink 4.5s ease-in-out infinite",
        "paw-tap": "pawTap 3.5s ease-in-out infinite",
        "meow-float": "meowFloat 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(2deg)" },
        },
        tailWag: {
          "0%, 100%": { transform: "rotate(-14deg)" },
          "50%": { transform: "rotate(16deg)" },
        },
        earTwitch: {
          "0%, 92%, 100%": { transform: "rotate(0deg)" },
          "96%": { transform: "rotate(-8deg)" },
        },
        catBlink: {
          "0%, 90%, 100%": { transform: "scaleY(1)" },
          "94%": { transform: "scaleY(0.1)" },
        },
        pawTap: {
          "0%, 100%": { transform: "rotate(0deg) translateY(0)" },
          "25%": { transform: "rotate(-6deg) translateY(-2px)" },
          "60%": { transform: "rotate(4deg) translateY(-1px)" },
        },
        meowFloat: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-18px) scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
