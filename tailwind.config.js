/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        kanit: ['Kanit', 'sans-serif'],
        prompt: ['Prompt', 'sans-serif'],
        sarabun: ['Sarabun', 'sans-serif'],
        itim: ['Itim', 'cursive'],
        mali: ['Mali', 'cursive'],
        niramit: ['Niramit', 'sans-serif'],
        chonburi: ['Chonburi', 'cursive'],
      }
    },
  },
  plugins: [],
}
