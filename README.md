# Tailwind CSS Build Instructions (Windows)

## Prerequisites
- Node.js and npm must be installed (https://nodejs.org/)
- This project uses Tailwind CSS v3.3.3 for compatibility

## One-Time Setup
1. Open a terminal in the project root.
2. Run:
   npm install

## Building Tailwind CSS
To generate or update `css/tailwind.output.css` after editing `css/tailwind.css`:

    npm run build:css

Or use the provided PowerShell script:

    ./build-tailwind.ps1

## Troubleshooting
- If you see errors about missing `tailwindcss` or `.bin`, ensure you are using Tailwind v3.3.3 (see `package.json`).
- If you upgrade Tailwind, verify the CLI is still available and `.bin` is created.
- For a clean install, delete `node_modules` and `package-lock.json`, then run `npm install` again.

---

## Why Tailwind v3.3.3?
Tailwind v4.x may not install the CLI correctly in some Windows/npm environments. v3.3.3 is known to work reliably with this setup.

---

## Quick Reference
- Edit your styles in `css/tailwind.css`.
- Build with `npm run build:css` to update `css/tailwind.output.css`.
- The app loads `css/tailwind.output.css` for all styling.
