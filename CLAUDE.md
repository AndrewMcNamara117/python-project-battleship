# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository actually is

Despite the repo name, this repository contains **two unrelated projects**:

1. **Iron Miles marketing site** (the active project) — an immersive static website for the Iron Miles endurance community (Limerick, Ireland), served from the repo root. Documented in `IRONMILES.md`. All recent work happens here.
2. **Legacy battleship game** (the original project, dormant) — a Code Institute Python terminal game (`run.py`) plus the template's Node "mock terminal" that runs it in a browser for Heroku (`index.js`, `package.json`, `Procfile`, `controllers/`, `views/`, `.vscode/`, `.gitpod.*`). Leave these files alone unless explicitly asked; the `package.json` belongs to this legacy layer, not the website.

## Commands

There is no build step, test suite, or linter configured. The site is plain static files.

```bash
# Serve the Iron Miles site locally
python3 -m http.server 8080          # from the repo root, then visit http://localhost:8080

# Standalone logo-reveal animation (also works by opening logo-reveal/index.html directly)
python3 -m http.server 8080 --directory logo-reveal

# Legacy battleship game
python3 run.py
```

## Deployment

Pushes to `main` deploy the repo root to GitHub Pages via `.github/workflows/pages.yml`. The workflow only triggers on changes to root-level `*.html` files (or the workflow itself) — edits to `logo-reveal/` or markdown do not redeploy. `.nojekyll` disables Jekyll processing; keep it.

## Iron Miles site architecture

Read `IRONMILES.md` first — it is the project's own overview and lists every page.

**Every page is a single self-contained HTML file.** Zero external dependencies: no frameworks, no CDNs, no web fonts (system font stack only), no separate CSS/JS files. Photography is embedded as `data:` URIs, which is why the files are 1–3.7 MB each. Do not introduce external resources; this constraint is deliberate.

**Because the HTML files are huge, never read one whole.** Use Grep to locate the section/id you need, then Read with offset/limit. The data-URI images appear as extremely long single lines.

Key structural facts that span multiple files:

- **`im-motion` engine**: inner pages (`club.html`, `origins.html`, `coaching.html`, `tay.html`) each carry an injected copy of a shared vanilla-JS motion engine in `<style id="im-motion-css">` and `<script id="im-motion-js">` blocks. It provides the custom cursor, parallax, per-character reveals (`.im-split`), clip reveals (`.im-clip`), and animated counters, gated behind an `im-motion` class on `<html>`. A change to the engine must be replicated into each page's copy.
- **`index.html`** is the heavyweight page: hand-rolled WebGL 1 (custom shaders) for the ~10,000-particle hero forming the Iron Miles mark, a procedural GLSL fBm wireframe terrain in the Forge Ultra section, a scroll-scrubbed "logo forge", pinned kinetic manifesto, and velocity marquees.
- **`logo-reveal/`** is a separate standalone deliverable (cinematic logo animation), the only place with split HTML/CSS/JS files. Its timeline is a deterministic rAF engine where every property is a pure function of master time (that's what makes the loop seamless); tuning knobs are CSS variables at the top of `styles.css` and the `pieces` array in `script.js`. Supports `?export` and `?t=SECONDS` URL params for frame-perfect capture.
- **Legal pages** (`privacy.html`, `terms.html`, `waiver.html`) are templates that require solicitor review before publishing — flag this if asked to finalize them.

## Conventions (locked design system)

- Colors: Iron Black `#080808`, Miles Green `#2dff8a`, Forge White `#eeeeee`. System font stack only.
- **`prefers-reduced-motion` support is mandatory** for any new animation: all motion must collapse to static, fully-readable content. Existing pages follow this pattern; match it.
- Animate only `transform`, `opacity`, and SVG attributes — no layout-thrashing properties.
- Semantic markup, `aria` labels, focus-visible styles, and alt text on photography are expected throughout.
