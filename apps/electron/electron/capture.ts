import { desktopCapturer, ipcMain, BrowserWindow } from 'electron';

export function initCapture(win: BrowserWindow) {
  ipcMain.handle('capture:screen', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const primaryScreen = sources[0];
    if (!primaryScreen) {
      throw new Error('No screen source found');
    }
    const png = primaryScreen.thumbnail.toPNG();
    return png.toString('base64');
  });
}
