import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Geist Sans (next/font), system fallback'ler ile.
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        destructive: "hsl(var(--destructive))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Anlamsal tipografi: kullanım yerine göre seç, ham `text-xs/sm/...` yerine.
      // Tasarım dokümanı: 8px grid + minimum 14px body.
      fontSize: {
        "ui-caption": ["0.75rem", { lineHeight: "1rem" }],       // 12/16 — sadece etiket/badge metni
        "ui-body": ["0.875rem", { lineHeight: "1.25rem" }],      // 14/20 — varsayılan body
        "ui-body-lg": ["1rem", { lineHeight: "1.5rem" }],        // 16/24 — vurgulu body
        "ui-h3": ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],          // 16/24 600 — kart başlığı
        "ui-h2": ["1.125rem", { lineHeight: "1.75rem", fontWeight: "600" }],     // 18/28 600 — bölüm başlığı
        "ui-h1": ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],          // 24/32 600 — sayfa başlığı
        "ui-display": ["2rem", { lineHeight: "2.5rem", fontWeight: "700" }],     // 32/40 700 — büyük rakam/KPI
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
