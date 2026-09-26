import { Archivo, Geist, Geist_Mono } from "next/font/google";

// Site-wide type: Archivo (display, with its width axis), Geist (body)
// and Geist Mono (data, labels, the control room). Exposed as CSS
// variables on <html>; Tailwind's `font-display` / `font-body` /
// `font-mono` and the SCSS tokens read them.

export const archivo = Archivo({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-display",
    axes: ["wdth"],
});

export const geist = Geist({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-body",
});

export const geistMono = Geist_Mono({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-mono",
});
