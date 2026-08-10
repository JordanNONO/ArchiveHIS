/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
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
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Niveau d'alerte des délais de traitement (voir SuiviDelai côté backend) :
        // plus le retard est grave, plus le mouvement est marqué et rapide.
        "alerte-rouge": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(220, 38, 38, 0.55)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 0 6px rgba(220, 38, 38, 0)" },
        },
        "alerte-orange": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(250, 204, 21, 0.5)" },
          "50%": { transform: "scale(1.015)", boxShadow: "0 0 0 4px rgba(250, 204, 21, 0)" },
        },
        // Transition d'étape d'un parcours séquentiel (ex: ReclamationForm.jsx) —
        // l'étape suivante glisse depuis la droite en avançant, depuis la gauche
        // en reculant, jamais les deux dans le même sens.
        "step-in-right": {
          "0%": { opacity: "0", transform: "translateX(36px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "step-in-left": {
          "0%": { opacity: "0", transform: "translateX(-36px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        // Scintillement doux (opacité, pas de mouvement de mise à l'échelle) réservé
        // aux documents rejetés / échéances dépassées : discret mais impossible à
        // manquer sur une liste, sans le côté "gros bandeau" d'un ring qui grossit.
        "scintille-rejet": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "alerte-rouge": "alerte-rouge 0.9s ease-in-out infinite",
        "alerte-orange": "alerte-orange 2.4s ease-in-out infinite",
        "step-in-right": "step-in-right 0.46s cubic-bezier(0.22,1,0.36,1) both",
        "step-in-left": "step-in-left 0.46s cubic-bezier(0.22,1,0.36,1) both",
        "scintille-rejet": "scintille-rejet 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"),require('daisyui'),],
  daisyui: {
    themes: [
      {
        hisvie: {
          "primary": "#1B365D",
          "secondary": "#274559",
          "accent": "#FACC15",
          "accent-content": "#1B365D",
          "neutral": "#0A0F16",
          "base-100": "#ffffff",
          "info": "#274559",
          "success": "#16a34a",
          "warning": "#FACC15",
          "error": "#dc2626",
        },
      },
      "dark",
    ],
  },
}