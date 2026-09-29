Site is deployed to: https://teeparty.github.io/pink-tee/

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/29f13668-ebcb-4e53-8189-447791292217

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Single-file build (no server needed)

For computers where the site is blocked or there's no internet (or no Node.js), the app can be built into one self-contained HTML file:

```
npm run build:single
```

This writes `dist-single/bell-schedule.html`, with all the code, styles, fonts, and the cat video inlined (~3 MB). Copy it to any computer and double-click it to open it in the browser. No server, install, or network access is required.

- Re-run `npm run build:single` after making changes, then copy the new file over.
- Settings are saved in the browser separately from the website. To carry a setup over, click **Bookmark State** on the website, then append the `?state=...` part of its URL to the file's URL.
- The regular `npm run build` (used for GitHub Pages) is unaffected.
