# Iron Miles — Forge One More

Immersive marketing site for the Iron Miles endurance community (Limerick, Ireland).

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Immersive homepage — WebGL 3D hero, pinned kinetic manifesto, wireframe terrain, velocity marquees |
| `club.html` | The Iron Miles Club — sessions, ethos, the Forge Ultra |
| `origins.html` | The origin story and journey timeline |
| `coaching.html` | 1:1 coaching tiers and philosophy |
| `tay.html` | Tay Cooper — co-founder page |
| `privacy.html` / `terms.html` / `waiver.html` | Legal templates (solicitor review required before publishing) |

## Tech

- **Zero external dependencies** — no frameworks, no CDNs, no web fonts. Every page is a single self-contained HTML file (photos embedded as data URIs).
- **WebGL, hand-rolled** — the homepage hero renders ~10,000 particles forming the Iron Miles mark (raw WebGL 1, custom shaders, mouse parallax, scroll-driven dissolve). The Forge Ultra section renders a procedural wireframe terrain (GLSL fBm noise) that flows toward the camera.
- **Scroll choreography** — pinned kinetic-type manifesto (position: sticky + rAF), scroll-velocity marquees, parallax photography, clip-path image reveals, per-character headline staggers, animated stat counters.
- **Micro-interactions** — custom cursor with trailing ring, magnetic buttons, 3D tilt cards with pointer-tracked glow, scroll progress bar.
- **Motion engine** — inner pages share an injected vanilla-JS engine (`im-motion`) providing the cursor, parallax, char reveals and counters site-wide.
- **Accessible by default** — full `prefers-reduced-motion` support (all animation collapses to static content), semantic markup, focus-visible styles, aria labels, alt text on photography.

## Design system (locked)

Iron Black `#080808` · Miles Green `#2dff8a` · Forge White `#eeeeee` — system font stack only.

Serve statically from this directory (any static host works):

```
python3 -m http.server --directory ironmiles 8080
```
