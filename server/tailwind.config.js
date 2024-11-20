import daisyui from "daisyui"

/** @type {import('tailwindcss').Config} */
const config = {
    content: [
        "./app/**/*.{html,js,jsx}",
        "./components/**/*.{html,js,jsx}",
        "./pages/**/*.{html,js,jsx}",
        "./styles/**/*.{html,js,jsx}"
    ],
    theme: {
        extend: {},
    },
    darkMode: "class",
    plugins: [
        daisyui,
    ],
    daisyui: {
        themes: ["light", "dark", "valentine"],
    },
};

export default config;
