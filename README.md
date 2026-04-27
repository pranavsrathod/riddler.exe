# riddler.exe

Live webcam dithering in your browser.

## Features

- Terminal boot sequence before the feed appears
- Real-time dithering — Bayer, Floyd-Steinberg, Atkinson, halftone
- Four palettes — green CRT, purple, amber, mono
- Ripple distortion on hover and click
- RGB channel-split glitch effect
- CRT scanlines, vignette, flicker
- Controls panel with pixel size and contrast sliders

## Run locally

Webcam requires HTTPS or localhost — `file://` won't work.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Stack

Vanilla HTML, CSS, JavaScript. No frameworks, no build step.
