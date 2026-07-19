import { Bodoni_Moda, Archivo } from "next/font/google";

// Editorial Didone identity: Bodoni Moda carries the high-contrast display serif
// (section titles, the footer wordmark), Archivo is the clean grotesque for body,
// UI, buttons and eyebrows. Both are exposed as CSS variables and consumed by the
// --font-display / --font-sans tokens in globals.css. Arabic keeps Janna (self-hosted),
// which the RTL rules already fall back to for headings.
export const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
});

export const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

// One string to spread onto every <html> (both root layouts) so the variables
// are in scope for the whole document.
export const fontVars = `${bodoni.variable} ${archivo.variable}`;
