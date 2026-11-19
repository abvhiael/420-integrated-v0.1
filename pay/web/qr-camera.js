import jsQR from 'jsqr';

export function payQrCamera({ open, close, video, accept, report }) {
  let stream;
  let timer;
  let revision = 0;

  function stop() {
    ++revision;
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    video.srcObject = null;
    video.hidden = close.hidden = true;
    open.disabled = false;
  }

  open.hidden = !navigator.mediaDevices?.getUserMedia;
  close.addEventListener('click', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  open.addEventListener('click', async () => {
    stop();
    const ticket = revision;
    open.disabled = true;
    close.hidden = false;
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      if (ticket !== revision) {
        camera.getTracks().forEach(track => track.stop());
        return;
      }
      stream = camera;
      video.srcObject = camera;
      video.hidden = false;
      await video.play();
      if (ticket !== revision) return;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const read = () => {
        if (ticket !== revision) return;
        try {
          if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
            const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(pixels.data, pixels.width, pixels.height);
            if (decoded && decoded.data.length <= 1024) {
              stop();
              accept(decoded.data);
              return;
            }
          }
          timer = setTimeout(read, 150);
        } catch {
          stop();
          report('The camera QR could not be read. Try an image instead.');
        }
      };
      read();
    } catch {
      if (ticket !== revision) return;
      stop();
      report('Camera unavailable. You can still choose a QR image.');
    }
  });
  return stop;
}
