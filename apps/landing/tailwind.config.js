/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#F5F3EE',
                foreground: '#111111',
                primary: '#E8E4DD',
                accent: '#E63B2E',
            },
            fontFamily: {
                heading: ['"Space Grotesk"', 'sans-serif'],
                drama: ['"DM Serif Display"', 'serif'],
                data: ['"Space Mono"', 'monospace'],
                sans: ['"Space Grotesk"', 'sans-serif']
            }
        },
    },
    plugins: [],
}
