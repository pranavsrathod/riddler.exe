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

const DARK  = [10,  10,  10];
const LIGHT = [ 0, 255, 102];

let pixelSize = 1;
let contrast  = 0;

// ── ripple state ─────────────────────────────────────────────────────────────

let mouseTrail = [];
const ripples  = [];
let time       = 0;
let lastTime   = performance.now();

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
  const hoverR = 60;
  const hoverR2 = hoverR * hoverR;
  const speed = 280;
  const ringWidth = 25;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {

      // ambient
      const ambDx = Math.sin((x * 0.015) + time * 0.8) * 0.6;
      const ambDy = Math.cos((y * 0.015) + time * 0.7) * 0.6;

      // hover trail
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

      // click ripples
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

function dither(imageData) {
  const { data, width, height } = imageData;

  for (let by = 0; by < height; by += pixelSize) {
    for (let bx = 0; bx < width; bx += pixelSize) {
      const sx = Math.min(bx + Math.floor(pixelSize / 2), width - 1);
      const sy = Math.min(by + Math.floor(pixelSize / 2), height - 1);
      const i  = (sy * width + sx) * 4;

      const gray      = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const threshold = (BAYER4[(by / pixelSize) % 4][(bx / pixelSize) % 4] / 16) * 255;
      const [r, g, b] = (gray + contrast) > threshold ? LIGHT : DARK;

      for (let dy = 0; dy < pixelSize && by + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && bx + dx < width; dx++) {
          const j = ((by + dy) * width + (bx + dx)) * 4;
          data[j] = r; data[j+1] = g; data[j+2] = b;
        }
      }
    }
  }
}

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

  requestAnimationFrame(loop);
}

// ── controls ─────────────────────────────────────────────────────────────────

document.getElementById('pixel-size').addEventListener('input', e => {
  pixelSize = Number(e.target.value);
  document.getElementById('pixel-val').textContent = pixelSize;
});

document.getElementById('contrast-input').addEventListener('input', e => {
  contrast = Number(e.target.value);
  document.getElementById('contrast-val').textContent = contrast;
});

// ── mouse / ripple input ──────────────────────────────────────────────────────

canvas.addEventListener('mousemove', (e) => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx     = (e.clientX - rect.left) * scaleX;
  const cy     = (e.clientY - rect.top)  * scaleY;
  const mx     = canvas.width - cx; // mirror to match CSS scaleX(-1)
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
