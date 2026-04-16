/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(240, 10%, 4%)",
        foreground: "hsl(0, 0%, 98%)",
        primary: "hsl(267, 100%, 60%)",
        secondary: "hsl(240, 5%, 20%)",
        accent: "hsl(280, 100%, 65%)"
      },
    },
  },
  plugins: [],
};
