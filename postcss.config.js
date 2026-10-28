// The app ships plain CSS (src/styles.css), so the dev server needs no Tailwind step.
// Regenerate that file with `bun run build:css` after adding new utility classes.
export default {
  plugins: {
    autoprefixer: {},
  },
}
