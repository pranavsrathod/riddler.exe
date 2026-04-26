# riddler.exe

> Live webcam dithering in your browser. You, but rendered in 1-bit puzzle pieces.

A real-time webcam dithering web app with a hijacked-broadcast aesthetic. Point a camera at yourself, get rendered as a 1-bit dithered surveillance feed.

Inspired by [asciiyourself](https://asciiyourself-okay-pranjul.vercel.app/) — but doing dithering instead of ASCII, with a Riddler-from-Batman vibe instead of generic cyberpunk.

## What it does

- Captures your webcam via `getUserMedia`
- Runs each frame through a Bayer 4×4 ordered dithering algorithm in real-time
- Renders the result on a fullscreen mirrored canvas in a black + green CRT palette
- Greets you with a terminal-style boot sequence before the feed appears

## Implemented so far

### Boot sequence

A terminal-style intro that runs before the canvas appears:

- Blinking cursor + typewriter text effect
- Prompts `> are you ready to enter the matrix? (y/n)` — keyboard-driven
- Branches on `y` / `n` — typing `n` exits with `> coward.`
- Requests camera access with in-character status updates
- Handles permission denial gracefully (`> access denied. you cannot see what you cannot perceive.`)
- ASCII loading bar animates 0 → 100% before the feed cuts in
- Fades out cleanly into the canvas view

### Real-time dithering

- Bayer 4×4 ordered dithering at full webcam resolution
- Luminance-weighted grayscale conversion (`0.299R + 0.587G + 0.114B`)
- Two-color palette: `#0a0a0a` (dark) and `#00ff66` (CRT green)
- Mirrored horizontally so it behaves like a real mirror
- Fullscreen canvas with `image-rendering: pixelated` for crisp scaling

### Controls

A subtle controls panel in the bottom-right that hover-reveals on demand:

- **Pixel size** slider (1–12) — chunkiness of the dithered output
- **Contrast** slider (-100 to 100) — shifts the dark/light threshold

### CRT overlay

A pure-CSS broadcast aesthetic stacked over the canvas:

- Subtle horizontal scanlines
- Radial vignette darkening the corners
- Irregular fluorescent-tube flicker animation
- Fades in only after the boot sequence completes

## Stack

- Vanilla HTML, CSS, and JavaScript
- No frameworks, no build step, no npm dependencies
- Hosted on GitHub Pages

## Running locally

Webcam access requires HTTPS or `localhost` — opening `index.html` directly via `file://` won't work.

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve
```

Then open `http://localhost:8000`.

## Roadmap

Things on deck, roughly in order:

- **Snapshot button** — save the current frame as a PNG
- **More dithering algorithms** — Floyd-Steinberg error diffusion (Obra Dinn vibe), Bayer 8×8
- **Palette picker** — amber CRT, classic Game Boy 4-color, pure mono
- **Identity overlays** — `?` watermark, REC timestamp, signal indicators
- **Face detection** — bounding-box reticle and face-isolated dithering via TensorFlow.js (runs in-browser, no API calls)
- **Facial landmark reactions** — effects that respond to expressions and head movement

## Credits

Inspiration: [asciiyourself](https://asciiyourself-okay-pranjul.vercel.app/) by Pranjul.