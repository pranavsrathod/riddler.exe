const video  = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const ctx    = canvas.getContext('2d', { willReadFrequently: true });

const BAYER4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

const DARK  = [10,  10,  10];   // #0a0a0a
const LIGHT = [ 0, 255, 102];   // #00ff66

async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    await video.play();

    statusEl.textContent = 'streaming · stage 2';
    loop();
  } catch (err) {
    statusEl.textContent = `error: ${err.message}`;
    console.error(err);
  }
}

function dither(imageData) {
  const { data, width, height } = imageData;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const threshold = (BAYER4[y % 4][x % 4] / 16) * 255;

      const [r, g, b] = gray > threshold ? LIGHT : DARK;
      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
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

start();
