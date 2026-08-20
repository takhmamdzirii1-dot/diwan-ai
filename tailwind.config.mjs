/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#050506',
        'bg-soft': '#0A0B0D',
        teal: {
          DEFAULT: '#1FD8B8',
          dim: '#0EA98E',
        },
        gold: '#F5B942',
        violet: '#6E6BFF',
      },
    },
  },
  plugins: [],
};
