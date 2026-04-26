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
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  dither(imageData);
  ctx.putImageData(imageData, 0, 0);
  requestAnimationFrame(loop);
}

document.getElementById('pixel-size').addEventListener('input', e => {
  pixelSize = Number(e.target.value);
  document.getElementById('pixel-val').textContent = pixelSize;
});

document.getElementById('contrast-input').addEventListener('input', e => {
  contrast = Number(e.target.value);
  document.getElementById('contrast-val').textContent = contrast;
});

boot();
