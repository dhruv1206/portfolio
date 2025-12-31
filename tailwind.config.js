/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            // Modern color palette
            colors: {
                // Primary backgrounds
                dark: {
                    900: "#030014",
                    800: "#0a0a1f",
                    700: "#0f0f2d",
                    600: "#16162e",
                    500: "#1a1a3e",
                },
                // Accent colors - modern violet/purple spectrum
                accent: {
                    primary: "#8b5cf6", // Violet
                    secondary: "#06b6d4", // Cyan
                    tertiary: "#f472b6", // Pink
                    glow: "#a855f7",
                },
                // Gradients support
                violet: {
                    glow: "rgba(139, 92, 246, 0.4)",
                },
                cyan: {
                    glow: "rgba(6, 182, 212, 0.4)",
                },
            },
            // Typography with variable fonts
            fontFamily: {
                display: ["var(--font-space-grotesk)", "sans-serif"],
                body: ["var(--font-inter)", "sans-serif"],
            },
            // Giant typography for hero
            fontSize: {
                "display-xl": [
                    "clamp(3rem, 12vw, 10rem)",
                    { lineHeight: "0.9", letterSpacing: "-0.02em" },
                ],
                "display-lg": [
                    "clamp(2.5rem, 8vw, 6rem)",
                    { lineHeight: "1", letterSpacing: "-0.02em" },
                ],
                "display-md": [
                    "clamp(2rem, 5vw, 4rem)",
                    { lineHeight: "1.1", letterSpacing: "-0.01em" },
                ],
            },
            // Glassmorphism & blur
            backdropBlur: {
                xs: "2px",
                glass: "16px",
            },
            // Background for gradients
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
                "mesh-gradient":
                    "radial-gradient(at 40% 20%, hsla(264,100%,55%,.15) 0, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,.15) 0, transparent 50%), radial-gradient(at 0% 50%, hsla(280,100%,55%,.1) 0, transparent 50%), radial-gradient(at 80% 50%, hsla(340,100%,55%,.1) 0, transparent 50%)",
                "glow-gradient":
                    "linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 100%)",
            },
            // Shadows for glassmorphism and depth
            boxShadow: {
                glass: "0 4px 30px rgba(0, 0, 0, 0.1)",
                glow: "0 0 40px rgba(139, 92, 246, 0.3)",
                "glow-sm": "0 0 20px rgba(139, 92, 246, 0.2)",
                "glow-lg": "0 0 60px rgba(139, 92, 246, 0.4)",
                card: "0 10px 40px -10px rgba(0, 0, 0, 0.5)",
            },
            // Animations
            animation: {
                "float": "float 6s ease-in-out infinite",
                "glow-pulse": "glow-pulse 3s ease-in-out infinite",
                "gradient-shift": "gradient-shift 8s ease infinite",
                "slide-up": "slide-up 0.6s ease-out",
                "fade-in": "fade-in 0.6s ease-out",
                "scale-in": "scale-in 0.3s ease-out",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-20px)" },
                },
                "glow-pulse": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.5" },
                },
                "gradient-shift": {
                    "0%, 100%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                },
                "slide-up": {
                    "0%": { transform: "translateY(20px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                "scale-in": {
                    "0%": { transform: "scale(0.95)", opacity: "0" },
                    "100%": { transform: "scale(1)", opacity: "1" },
                },
            },
            // Container
            container: {
                center: true,
                padding: {
                    DEFAULT: "1rem",
                    sm: "2rem",
                    lg: "3rem",
                    xl: "4rem",
                    "2xl": "4rem",
                    "3xl": "5rem",
                },
            },
            // Breakpoints
            screens: {
                "4k": "1980px",
            },
            // Border radius
            borderRadius: {
                "4xl": "2rem",
            },
        },
    },
    plugins: [],
};
