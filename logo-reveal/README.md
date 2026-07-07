# Iron Miles — "Forged from Motion" logo reveal

A cinematic, loopable logo-reveal animation for the Iron Miles endurance brand.
The mark is rebuilt as clean SVG polygons **traced from the reference PNG**
(both strokes 122 units wide, all diagonals 45°, aligned baselines), split into
seven "forged" pieces that assemble in sequence, followed by the
`FORGE ONE MORE` tagline wipe. ~10.4s including hold and a seamless loop.

## Files

| File | Purpose |
|---|---|
| `index.html` | Stage, inline SVG logo (7 pieces + effects layers), tagline |
| `styles.css` | Layout, vignette/grain, tagline type, reduced-motion fallback |
| `script.js` | The whole timeline — commented, phase by phase |
| *(no assets folder needed — everything is inline SVG/CSS)* |

## Run it locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8080          # then visit http://localhost:8080
```

Controls: **↻ Replay** button (bottom-right) or press **R**.

## Tweak it

All the main knobs are CSS variables at the top of `styles.css`:

| Variable | Default | What it does |
|---|---|---|
| `--logo-scale` | `.62` | Logo width as a fraction of the square stage |
| `--speed` | `1` | Master speed multiplier (2 = twice as fast) |
| `--mint` | `#10d7ae` | The brand green, used by CSS *and* read by the canvas effects |

Timing of individual phases lives in the `pieces` array and the timeline
comment block at the top of `script.js` — every number is a plain
seconds value.

## Responsive behaviour

The composition is a centred 1:1 square that letterboxes into any viewport,
so 1080×1080, 1080×1350 and 1920×1080 all render the identical composition
with true-black bars. Logo proportions never change.

## Recording / export

- **Screen recording:** open `index.html?export` (hides the replay button),
  make the window ≥1080×1080, press **R** to restart cleanly, and record one
  10.4-second loop with your screen recorder (macOS: ⇧⌘5, Windows: Xbox Game
  Bar, or OBS at 60fps). Crop to the square.
- **Frame-perfect export (Puppeteer/Playwright):** the page accepts `?t=SECONDS`
  to freeze any exact frame. Capture frames in a loop
  (`?t=0.000`, `?t=0.033`, … step 1/30) and assemble with ffmpeg:

  ```bash
  ffmpeg -framerate 30 -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p ironmiles.mp4
  ```

- **Transparent background version:** in `styles.css` set the `body` and
  `.stage` backgrounds to `transparent` and delete the `.vignette` and
  `.grain` rules, then record with a transparency-capable pipeline
  (e.g. Puppeteer `omitBackground: true` → PNG sequence → ProRes 4444/WebM).

## Notes

- No external dependencies — the timeline is a small deterministic
  rAF engine (every property is a pure function of master time, which is what
  makes the loop seamless). It mirrors GSAP's timeline structure, so porting
  to GSAP later is a mechanical change if you ever want its tooling.
- Animates only `transform`, `opacity` and SVG attributes — no layout thrash.
- `prefers-reduced-motion` shows the finished static lockup instead.
