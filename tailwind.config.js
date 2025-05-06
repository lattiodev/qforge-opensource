/** @type {import('tailwindcss').Config} */
module.exports = {
    // Keep your existing content setting or use the example's if appropriate
    content: ["./src/**/*.{js,jsx,ts,tsx}"], 
    theme: {
        extend: {
            keyframes: {
                blink: {
                    '50%': { opacity: '0' },
                },
            },
            animation: {
                blink: 'blink 1s infinite',
            },
            colors: ({ colors }) => ({
                inherit: colors.inherit,
                current: colors.current,
                transparent: "transparent",
                black: "#22292F", // Example's black
                white: "#fff",
                'smoke-light': 'rgba(0, 0, 0, 0.4)', // Example's overlay color
                primary: {
                    20: "#CCFCFF",
                    30: "#202E3C",
                    40: "#61F0FE", // Often used for buttons/accents
                    50: "#61F0FE",
                    60: "#101820", // Dark background elements
                    70: "#019AB8",
                    90: "#112C35", // Very dark background
                },
                // Use example's gray definitions, overriding default Tailwind gray
                gray: {
                    50: "#FAFAFA", // Lightest gray (example used FAFAFA in 'grey')
                    60: "#4B5565", // Example's gray-60
                    70: "#202E3C", // Example's gray-70 (dark background element)
                    80: "#151E27", // Example's gray-80 (main background?)
                    90: "#101820", // Example's gray-90 (darkest background)
                    100: "#F5F5F5",
                    200: "#EEEEEE",
                    300: "#E0E0E0",
                    400: "#BDBDBD", // Medium gray for borders/text
                    500: "#9E9E9E",
                    DEFAULT: "#9E9E9E",
                    600: "#757575", // Darker text/icons
                    700: "#616161", // Darker background/borders
                    800: "#424242", // Dark background
                    900: "#212121", // Near black
                    // Example included A shades, keep if needed
                    A100: "#D5D5D5",
                    A200: "#AAAAAA",
                    A400: "#303030",
                    A700: "#616161",
                },
                 // Keep other color definitions from example (error, success, warning, etc.)
                 // These are useful for status indicators
                error: {
                    40: "#F97066",
                    90: "#381D1E",
                },
                success: {
                    40: "#47CD89",
                    90: "#11322D",
                },
                warning: {
                    40: "#CDA747",
                    90: "#322D11",
                },
                 // Full color palettes from example (optional, but harmless to include)
                red: colors.red,
                orange: colors.orange,
                amber: colors.amber,
                yellow: colors.yellow,
                lime: colors.lime,
                green: colors.green,
                emerald: colors.emerald,
                teal: colors.teal,
                cyan: colors.cyan,
                sky: colors.sky,
                blue: colors.blue,
                indigo: colors.indigo,
                violet: colors.violet,
                purple: colors.purple,
                fuchsia: colors.fuchsia,
                pink: colors.pink,
                rose: colors.rose,
            }),
            // Use example's font sizes if desired
            fontSize: {
                10: "10px",
                12: "12px",
                14: "14px",
                16: "16px",
                18: "18px",
                20: "20px",
                24: "24px",
                28: "28px",
                32: "32px",
                35: "35px",
                40: "40px",
                48: "48px",
                64: "64px",
            },
            // Use example's font families
            fontFamily: {
                space: ["Space Grotesk", "sans-serif"],
                sans: [
                    "Inter var", // Keep Inter if you prefer it
                    "Roboto",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    '"Segoe UI"',
                    "Roboto",
                    '"Helvetica Neue"',
                    "Arial",
                    '"Noto Sans"',
                    "sans-serif",
                    '"Apple Color Emoji"',
                    '"Segoe UI Emoji"',
                    '"Segoe UI Symbol"',
                    '"Noto Color Emoji"',
                ],
                 // Keep serif and mono if needed
                serif: [
                    "ui-serif",
                    "Georgia",
                    "Cambria",
                    '"Times New Roman"',
                    "Times",
                    "serif",
                ],
                mono: [
                    "ui-monospace",
                    "SFMono-Regular",
                    "Menlo",
                    "Monaco",
                    "Consolas",
                    '"Liberation Mono"',
                    '"Courier New"',
                    "monospace",
                ],
            },
        },
    },
    // Include line-clamp plugin from example
    plugins: [
        require('@tailwindcss/line-clamp'),
    ],
}; 