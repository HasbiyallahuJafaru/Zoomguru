import { ipcMain, BrowserWindow } from 'electron';

export function initSpeech(win: BrowserWindow) {
  ipcMain.handle('speech:start', async () => {
    // Renderer handles mic via Web Speech API; this is a future Whisper ONNX hook
    return '';
  });

  ipcMain.handle('speech:stop', async () => {
    // No-op until Whisper ONNX is integrated
  });
}
