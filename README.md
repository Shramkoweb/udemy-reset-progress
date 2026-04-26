# Udemy Reset Progress

> Reset or complete your Udemy course progress in one click.

Whether you want to re-watch a course from scratch or mark everything as done — this extension handles it instantly. Smart pacing modes prevent rate-limiting and unexpected logouts, even on large courses with hundreds of lectures.

[Chrome Web Store](https://chromewebstore.google.com/detail/udemy-reset-progress/dddnklikfgdefjekcbhehjogkpfkbdlo) · [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/udemy-reset-progress/) · [Report an Issue](https://github.com/Shramkoweb/udemy-reset-progress/issues)

## Features

- **Clear Progress** — reset all lecture completion checkmarks across every section
- **Mark All Complete** — mark every lecture as completed in one click
- **Smart Pacing** — auto-adjusts speed based on course size to avoid rate-limiting
  - *Auto* — best speed for your course (recommended)
  - *Turbo* — fastest, for small courses
  - *Balanced* — reliable with batch cooldowns
  - *Safe* — slowest and most reliable for large courses
  - *Custom* — full control over delay (50–1000ms), batch size, and cooldowns
- **Lightweight** — under 85 KiB, no background processes
- **Private** — zero data collection, zero analytics, zero network requests
- **Cross-browser** — Chrome, Firefox, and Edge

## Installation

### Chrome Web Store

[<img src="https://developer.chrome.com/static/docs/webstore/branding/image/YT2Grfi9vEBa2wAPzhWa.png" alt="Chrome" height="60px">](https://chromewebstore.google.com/detail/udemy-reset-progress/dddnklikfgdefjekcbhehjogkpfkbdlo)

### Firefox Add-ons

[<img src="https://blog.mozilla.org/addons/files/2015/11/get-the-addon.png" alt="Firefox">](https://addons.mozilla.org/en-US/firefox/addon/udemy-reset-progress/)

### Manual Installation

1. Clone this repository:
```
git clone https://github.com/Shramkoweb/udemy-reset-progress.git
```

2. Install dependencies:
```
pnpm install
```

3. Build the extension:
```
# For Chrome
pnpm run build

# For Firefox
pnpm run build:firefox
```

4. Load the extension:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", select `.output/chrome-mv3`
   - **Firefox**: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", select any file from `.output/firefox-mv2`

## Usage

1. Open any Udemy course page (the curriculum/lecture view)
2. Click the extension icon in your toolbar
3. Choose **Clear Progress** to reset or **Mark All Complete** to finish
4. Done

> **Tip:** If you experience rate-limiting or unexpected logouts, open Settings (gear icon) and switch to **Safe** mode.

## Development

```
# Start development server for Chrome
pnpm run dev

# Start development server for Firefox
pnpm run dev:firefox

# Run tests
pnpm run test

# Type checking
pnpm run compile

# Build extension
pnpm run build

# Create distribution ZIP
pnpm run zip
```

## Tech Stack

- [WXT](https://wxt.dev/) — Web Extension Framework
- [SolidJS](https://www.solidjs.com/) — UI Framework
- [TailwindCSS](https://tailwindcss.com/) — CSS Framework
- [DaisyUI](https://daisyui.com/) — Component Library
- TypeScript

## License

[AGPL-3](LICENSE)

## Author

[Serhii Shramko](https://shramko.dev/)

## Contributing

Contributions, issues, and feature requests are welcome! Check the [issues page](https://github.com/Shramkoweb/udemy-reset-progress/issues).

## Support

If you found this project helpful, please consider giving it a star!
