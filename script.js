const video    = document.getElementById('video');
const canvas   = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const terminal = document.getElementById('terminal');
const ctx      = canvas.getContext('2d', { willReadFrequently: true });

const BAYER4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

const PALETTES = {
  green:  { dark: [10, 10, 10], light: [0,   255, 102] },
  purple: { dark: [10, 10, 10], light: [180, 80,  255] },
  amber:  { dark: [10, 10, 10], light: [255, 176, 0  ] },
  mono:   { dark: [10, 10, 10], light: [240, 240, 240] },
};

const ACCENT = {
  green: '#00ff66', purple: '#b450ff', amber: '#ffb000', mono: '#f0f0f0',
};

let palette   = PALETTES.green;
let pixelSize = 1;
let contrast  = -50;
let mode      = 'bayer';

// ── ripple state ─────────────────────────────────────────────────────────────

let mouseTrail = [];
const ripples  = [];
let time       = 0;
let lastTime   = performance.now();

// ── glitch state ──────────────────────────────────────────────────────────────

let glitchActive   = false;
let glitchStrength = 0;
let glitchTarget   = 0;
let nextAmbientGlitch = 0;

const glitchCanvas = document.createElement('canvas');
glitchCanvas.width  = canvas.width;
glitchCanvas.height = canvas.height;
const gctx = glitchCanvas.getContext('2d', { willReadFrequently: true });

function triggerGlitch(intensity = 1, duration = 0.4) {
  glitchTarget = intensity;
  setTimeout(() => { glitchTarget = 0; }, duration * 1000);
}

function updateGlitch(dt) {
  glitchStrength += (glitchTarget - glitchStrength) * Math.min(1, dt * 8);

  if (glitchActive && performance.now() > nextAmbientGlitch) {
    triggerGlitch(0.3 + Math.random() * 0.4, 0.15 + Math.random() * 0.3);
    nextAmbientGlitch = performance.now() + 1500 + Math.random() * 4000;
  }
}

function applyChannelMask(c, channel) {
  const w = c.canvas.width, h = c.canvas.height;
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (channel !== 'r') d[i]   = 0;
    if (channel !== 'g') d[i+1] = 0;
    if (channel !== 'b') d[i+2] = 0;
  }
  c.putImageData(img, 0, 0);
}

function drawGlitchOverlay() {
  const offset = Math.floor(glitchStrength * 18);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = glitchStrength * 0.5;

  gctx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
  gctx.drawImage(video, 0, 0, glitchCanvas.width, glitchCanvas.height);
  applyChannelMask(gctx, 'r');
  ctx.drawImage(glitchCanvas, -offset, 0);

  gctx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
  gctx.drawImage(video, 0, 0, glitchCanvas.width, glitchCanvas.height);
  applyChannelMask(gctx, 'b');
  ctx.drawImage(glitchCanvas, offset, 0);

  gctx.clearRect(0, 0, glitchCanvas.width, glitchCanvas.height);
  gctx.drawImage(video, 0, 0, glitchCanvas.width, glitchCanvas.height);
  applyChannelMask(gctx, 'g');
  ctx.drawImage(glitchCanvas, 0, 0);

  ctx.restore();
}

// ── utilities ────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function typeOut(text, delay = 38) {
  const line = document.createElement('p');
  terminal.appendChild(line);
  for (const char of text) {
    line.textContent += char;
    await sleep(delay);
  }
  return line;
}

function addLine(text) {
  const line = document.createElement('p');
  line.textContent = text;
  terminal.appendChild(line);
  return line;
}

function waitForKey(validKeys) {
  return new Promise(resolve => {
    function handler(e) {
      const key = e.key.toLowerCase();
      if (validKeys.includes(key)) {
        document.removeEventListener('keydown', handler);
        resolve(key);
      }
    }
    document.addEventListener('keydown', handler);
  });
}

async function animateLoadingBar() {
  const line = document.createElement('p');
  terminal.appendChild(line);
  const WIDTH = 20;

  await new Promise(resolve => {
    let progress = 0;
    const id = setInterval(() => {
      progress++;
      const filled = Math.round((progress / 100) * WIDTH);
      line.textContent = `[${'█'.repeat(filled)}${'░'.repeat(WIDTH - filled)}] ${progress}%`;
      if (progress >= 100) { clearInterval(id); resolve(); }
    }, 20);
  });
}

// ── boot sequence ────────────────────────────────────────────────────────────

async function boot() {
  await sleep(400);

  await typeOut('> are you ready to enter the matrix? (y/n)');

  const answer = await waitForKey(['y', 'n']);
  addLine(`> ${answer}`);

  if (answer === 'n') {
    await sleep(300);
    await typeOut('> coward.');
    return;
  }

  await sleep(300);
  await typeOut('> requesting camera access...');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
  } catch (err) {
    await sleep(200);
    await typeOut('> access denied. you cannot see what you cannot perceive.');
    return;
  }

  await sleep(200);
  await typeOut('> access granted. initialising visual cortex...');

  await sleep(400);
  await animateLoadingBar();

  await sleep(600);

  terminal.style.transition = 'opacity 0.6s ease';
  terminal.style.opacity = '0';
  await sleep(600);
  terminal.remove();
  document.getElementById('crt').classList.add('active');

  startWithStream(stream);
}

// ── webcam pipeline ──────────────────────────────────────────────────────────

async function startWithStream(stream) {
  video.srcObject = stream;
  await new Promise(resolve => { video.onloadedmetadata = () => resolve(); });
  await video.play();
  statusEl.textContent = 'streaming · stage 2';
  loop();
}

function warp(source) {
  const { data: src, width, height } = source;
  const output = new ImageData(width, height);
  const dst = output.data;
  const hoverR  = 60;
  const hoverR2 = hoverR * hoverR;
  const speed    = 280;
  const ringWidth = 25;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {

      const ambDx = Math.sin((x * 0.015) + time * 0.8) * 0.6;
      const ambDy = Math.cos((y * 0.015) + time * 0.7) * 0.6;

      let hoverDx = 0, hoverDy = 0;
      for (const entry of mouseTrail) {
        const edx = x - entry.x;
        const edy = y - entry.y;
        const d2  = edx * edx + edy * edy;
        if (d2 < hoverR2) {
          const dist     = Math.sqrt(d2);
          const strength = (1 - dist / hoverR) * (1 - entry.age / 0.8) * 1.5;
          const angle    = Math.atan2(edy, edx);
          hoverDx += Math.cos(angle) * strength;
          hoverDy += Math.sin(angle) * strength;
        }
      }

      let rippleDx = 0, rippleDy = 0;
      for (const ripple of ripples) {
        const rdx  = x - ripple.x;
        const rdy  = y - ripple.y;
        const dist = Math.hypot(rdx, rdy);
        if (dist > ripple.age * speed + ringWidth) continue;

        const angle = Math.atan2(rdy, rdx);
        for (let i = 0; i < 4; i++) {
          const echoAge = ripple.age - i * 0.12;
          if (echoAge < 0) continue;
          const distFromRing = Math.abs(dist - echoAge * speed);
          if (distFromRing < ringWidth) {
            const ringFalloff  = 1 - distFromRing / ringWidth;
            const ageFalloff   = Math.max(0, 1 - ripple.age / 1.5);
            const echoStrength = (1 / (1 + i * 0.8)) * 14;
            const wave = Math.sin(distFromRing * 0.3) * ringFalloff * ageFalloff * echoStrength;
            rippleDx += Math.cos(angle) * wave;
            rippleDy += Math.sin(angle) * wave;
          }
        }
      }

      const totalDx = ambDx + hoverDx + rippleDx;
      const totalDy = ambDy + hoverDy + rippleDy;
      const srcX = Math.round(Math.max(0, Math.min(width  - 1, x + totalDx)));
      const srcY = Math.round(Math.max(0, Math.min(height - 1, y + totalDy)));

      const si = (srcY * width + srcX) * 4;
      const di = (y    * width + x)    * 4;
      dst[di]   = src[si];
      dst[di+1] = src[si+1];
      dst[di+2] = src[si+2];
      dst[di+3] = src[si+3];
    }
  }

  return output;
}

// ── dithering ────────────────────────────────────────────────────────────────

function dither(imageData) {
  switch (mode) {
    case 'bayer':           ditherBayer(imageData);          break;
    case 'floyd-steinberg': ditherFloydSteinberg(imageData); break;
    case 'atkinson':        ditherAtkinson(imageData);       break;
    case 'halftone':        ditherHalftone(imageData);       break;
  }
}

function fillBlock(data, bx, by, width, height, r, g, b) {
  for (let dy = 0; dy < pixelSize && by + dy < height; dy++) {
    for (let dx = 0; dx < pixelSize && bx + dx < width; dx++) {
      const j = ((by + dy) * width + (bx + dx)) * 4;
      data[j] = r; data[j+1] = g; data[j+2] = b;
    }
  }
}

function ditherBayer(imageData) {
  const { data, width, height } = imageData;
  const [dr, dg, db] = palette.dark;
  const [lr, lg, lb] = palette.light;
  for (let by = 0; by < height; by += pixelSize) {
    for (let bx = 0; bx < width; bx += pixelSize) {
      const sx = Math.min(bx + Math.floor(pixelSize / 2), width - 1);
      const sy = Math.min(by + Math.floor(pixelSize / 2), height - 1);
      const i  = (sy * width + sx) * 4;
      const gray      = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const threshold = (BAYER4[(by / pixelSize) % 4][(bx / pixelSize) % 4] / 16) * 255;
      const [r, g, b] = (gray + contrast) > threshold ? [lr, lg, lb] : [dr, dg, db];
      fillBlock(data, bx, by, width, height, r, g, b);
    }
  }
}

function ditherFloydSteinberg(imageData) {
  const { data, width, height } = imageData;
  const [dr, dg, db] = palette.dark;
  const [lr, lg, lb] = palette.light;

  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const sx = Math.min(x + Math.floor(pixelSize / 2), width - 1);
      const sy = Math.min(y + Math.floor(pixelSize / 2), height - 1);
      const i  = (sy * width + sx) * 4;
      gray[y * width + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2] + contrast;
    }
  }

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const idx    = y * width + x;
      const old    = gray[idx];
      const newVal = old > 127 ? 255 : 0;
      gray[idx]    = newVal;
      const err    = old - newVal;
      const xR = x + pixelSize, yD = y + pixelSize, xL = x - pixelSize;

      if (xR < width)                gray[y  * width + xR] += err * 7/16;
      if (xL >= 0 && yD < height)    gray[yD * width + xL] += err * 3/16;
      if (yD < height)               gray[yD * width + x ] += err * 5/16;
      if (xR < width && yD < height) gray[yD * width + xR] += err * 1/16;
    }
  }

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const [r, g, b] = gray[y * width + x] >= 128 ? [lr, lg, lb] : [dr, dg, db];
      fillBlock(data, x, y, width, height, r, g, b);
    }
  }
}

function ditherAtkinson(imageData) {
  const { data, width, height } = imageData;
  const [dr, dg, db] = palette.dark;
  const [lr, lg, lb] = palette.light;

  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const sx = Math.min(x + Math.floor(pixelSize / 2), width - 1);
      const sy = Math.min(y + Math.floor(pixelSize / 2), height - 1);
      const i  = (sy * width + sx) * 4;
      gray[y * width + x] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2] + contrast;
    }
  }

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const idx      = y * width + x;
      const old      = gray[idx];
      const newVal   = old > 127 ? 255 : 0;
      gray[idx]      = newVal;
      const errShare = (old - newVal) / 8;
      const xR1 = x + pixelSize, xR2 = x + 2 * pixelSize;
      const xL  = x - pixelSize;
      const yD1 = y + pixelSize, yD2 = y + 2 * pixelSize;

      if (xR1 < width)                 gray[y   * width + xR1] += errShare;
      if (xR2 < width)                 gray[y   * width + xR2] += errShare;
      if (xL >= 0 && yD1 < height)     gray[yD1 * width + xL]  += errShare;
      if (yD1 < height)                gray[yD1 * width + x]   += errShare;
      if (xR1 < width && yD1 < height) gray[yD1 * width + xR1] += errShare;
      if (yD2 < height)                gray[yD2 * width + x]   += errShare;
    }
  }

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const [r, g, b] = gray[y * width + x] >= 128 ? [lr, lg, lb] : [dr, dg, db];
      fillBlock(data, x, y, width, height, r, g, b);
    }
  }
}

function drawCircle(data, width, height, cx, cy, radius, color) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width  - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = (y * width + x) * 4;
        data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2];
      }
    }
  }
}

function ditherHalftone(imageData) {
  const { data, width, height } = imageData;
  const cell = Math.max(pixelSize, 4);
  const cols = Math.ceil(width  / cell);
  const rows = Math.ceil(height / cell);

  const brightness = new Float32Array(rows * cols);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = Math.min(col * cell + (cell >> 1), width  - 1);
      const sy = Math.min(row * cell + (cell >> 1), height - 1);
      const i  = (sy * width + sx) * 4;
      brightness[row * cols + col] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
  }

  const [dr, dg, db] = palette.dark;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = dr; data[i+1] = dg; data[i+2] = db; data[i+3] = 255;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lum      = brightness[row * cols + col];
      const adjusted = Math.max(0, Math.min(255, 255 - lum + contrast));
      const radius   = (adjusted / 255) * (cell / 2);
      drawCircle(data, width, height, col * cell + cell / 2, row * cell + cell / 2, radius, palette.light);
    }
  }
}

// ── main loop ─────────────────────────────────────────────────────────────────

function loop() {
  const now = performance.now();
  const dt  = (now - lastTime) / 1000;
  lastTime  = now;
  time     += dt;

  mouseTrail = mouseTrail.filter(p => (p.age += dt) < 0.8);
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].age += dt;
    if (ripples[i].age > 1.5) ripples.splice(i, 1);
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const sourceData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const warped     = warp(sourceData);
  dither(warped);
  ctx.putImageData(warped, 0, 0);

  if (glitchStrength > 0.01) drawGlitchOverlay();
  updateGlitch(dt);

  requestAnimationFrame(loop);
}

// ── controls ─────────────────────────────────────────────────────────────────

document.getElementById('pixel-size').addEventListener('input', e => {
  pixelSize = Number(e.target.value);
  document.getElementById('pixel-val').textContent = pixelSize;
});

document.getElementById('contrast-input').addEventListener('input', e => {
  contrast = Number(e.target.value) - 50;
  document.getElementById('contrast-val').textContent = Number(e.target.value);
});

document.querySelectorAll('.palette-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.palette;
    palette = PALETTES[key];
    document.documentElement.style.setProperty('--accent', ACCENT[key]);
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('glitch-toggle').addEventListener('click', (e) => {
  glitchActive = !glitchActive;
  e.target.dataset.active = glitchActive;
  e.target.textContent = `glitch: ${glitchActive ? 'on' : 'off'}`;
  if (!glitchActive) glitchTarget = 0;
});

document.getElementById('glitch-trigger').addEventListener('click', () => {
  triggerGlitch(0.9, 0.5);
});

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'g') triggerGlitch(0.9, 0.5);
});

// ── mouse / ripple input ──────────────────────────────────────────────────────

canvas.addEventListener('mousemove', (e) => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx     = (e.clientX - rect.left) * scaleX;
  const cy     = (e.clientY - rect.top)  * scaleY;
  const mx     = canvas.width - cx;
  mouseTrail.push({ x: mx, y: cy, age: 0 });
});

canvas.addEventListener('mousedown', (e) => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx     = (e.clientX - rect.left) * scaleX;
  const cy     = (e.clientY - rect.top)  * scaleY;
  const mx     = canvas.width - cx;
  ripples.push({ x: mx, y: cy, age: 0 });
});

boot();
