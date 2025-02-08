# Udemy Reset Progress Extension

A browser extension that allows you to quickly reset your progress in Udemy courses. Built with WXT, SolidJS, and TailwindCSS.

## Features

- 🚀 One-click progress reset
- ⚡️ Fast and lightweight
- 🎨 Clean, minimal interface
- 💪 TypeScript support
- 🔒 Works only on Udemy course pages

## Installation

### Chrome Web Store
*Coming soon*

### Firefox Add-ons
*Coming soon*

### Manual Installation

1. Clone this repository:
```
git clone https://github.com/Shramkoweb/udemy-reset-progress.git
```

2. Install dependencies:
```
npm install
```

3. Build the extension:
```
# For Chrome
npm run build

# For Firefox
npm run build:firefox
```

4. Load the extension:
- Chrome: Go to `chrome://extensions/`, enable "Developer mode", and click "Load unpacked". Select the `extension/dist` directory.
- Firefox: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select any file from the `extension/dist` directory.

## Development

```
# Start development server for Chrome
npm run dev

# Start development server for Firefox
npm run dev:firefox

# Type checking
npm run compile

# Build extension
npm run build

# Create distribution ZIP
npm run zip
```

## Tech Stack

- [WXT](https://wxt.dev/) - Web Extension Framework
- [SolidJS](https://www.solidjs.com/) - UI Framework
- [TailwindCSS](https://tailwindcss.com/) - CSS Framework
- [DaisyUI](https://daisyui.com/) - Component Library
- TypeScript

## License

[AGPL-3](LICENSE)

## Author

[Serhii Shramko](https://shramko.dev/)

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Shramkoweb/udemy-reset-progress/issues).

## Support

If you found this project helpful, please consider giving it a ⭐️!