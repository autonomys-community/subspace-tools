# Subspace Tools

A collection of tools for working with the Autonomys Network and ecosystem.

## Available Tools

- XDM Channel Dashboard

## Getting Started

### Development

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

Then visit `http://localhost:3000` in your browser.

### Static Build

To build the static export:

```bash
npm run build
```

The output will be in the `out/` directory.

## Deployment to GitHub Pages

This project is already configured for deployment to GitHub Pages using the `gh-pages` package.

### Steps

1. Ensure dependencies are installed:

```bash
npm install
```

2. Deploy the site:

```bash
npm run deploy
```

This will:
- Build and export the site to `out/`
- Add a `.nojekyll` file
- Publish the output to the `gh-pages` branch using `gh-pages`

You can access the deployed site at:

📦 https://subspace.tools/

---

Happy building 🚀
