// Stage 1: get the webcam onto a canvas.
// Three steps: grab DOM elements, request webcam, paint frames in a loop.

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
// `willReadFrequently: true` tells the browser we're going to call getImageData
// a lot. It picks a CPU-friendly internal representation. Important for Stage 2.

async function start() {
  try {
    // Ask the browser for the webcam. The user will see a permission prompt.
    // `video: true` means "any video, you choose". You can constrain resolution etc later.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });

    // Wire the stream into the <video> element.
    video.srcObject = stream;

    // Wait until the video has actual dimensions before drawing.
    // Without this, the first few frames can be 0x0 and silently fail.
    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    status.textContent = 'streaming · stage 1';
    loop();
  } catch (err) {
    // Permission denied, no camera, etc. Show something useful.
    status.textContent = `error: ${err.message}`;
    console.error(err);
  }
}

function loop() {
  // Copy the current video frame onto the canvas.
  // drawImage handles all the format conversion for us.
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Schedule the next frame. Browser will sync this to the display refresh (~60fps).
  requestAnimationFrame(loop);
}

start();
