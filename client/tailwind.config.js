/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4d6bfe", // Custom primary color (purple)
        secondary: "#7A7A7A", // Custom secondary color (grey)
        ternary: "#FEFEFE", // Custom tertiary color (light white)
        bg: "#F7F5F4", // Custom success color (white)
        stroke: "#DDDEDB", // Custom stroke color (light grey)
      },
      fontFamily: {
        poppins: ["Poppins", "Arial", "sans-serif"], // Custom font for poppins
        serif: ["Merriweather", "serif"], // Custom font for serif
      },
      borderRadius: {
        sm: "8px", // Custom border-radius
        md: "20px", // Custom border-radius
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],  // Extra small
        'sm': ['14px', { lineHeight: '20px' }], // Small
        'base': ['18px', { lineHeight: '28px' }], // Base (default)
        'lg': ['20px', { lineHeight: '28px' }], // Large
        'xl': ['24px', { lineHeight: '32px' }], // Extra large
        '2xl': ['28px', { lineHeight: '36px' }], // 2x large
      },
    },
  },
  plugins: [],
};
