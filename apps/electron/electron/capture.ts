import { desktopCapturer, ipcMain, BrowserWindow } from 'electron';

export function initCapture(win: BrowserWindow) {
  ipcMain.handle('capture:screen', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });

    const primaryScreen = sources[0];
    if (!primaryScreen) {
      throw new Error('No screen source found');
    }
    // JPEG, not PNG: a vision model gains nothing from lossless. Measured at
    // 1280x720 over the UI screenshots in apps/landing/.shots, JPEG q80 is ~1.9x
    // smaller than PNG (1062KB -> 551KB of base64); a busier screen — an IDE, a
    // video call — compresses worse as PNG, so the gap widens there. That halves
    // upload size, body buffered on the server, JSON.parse time on its single
    // thread, and egress on every key a Gemini failover retries. Vision billing
    // is by dimensions, not bytes, so q80 costs the same as lossless. The backend
    // sniffs the format (imageMime in ai.service.ts), so old clients still work.
    const jpeg = primaryScreen.thumbnail.toJPEG(80);
    return jpeg.toString('base64');
  });
}
