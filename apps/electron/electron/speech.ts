import { ipcMain, BrowserWindow } from 'electron';

export function initSpeech(win: BrowserWindow) {
  // Start listening — returns transcript when done
  // Currently returns a mock transcript; Whisper ONNX integration is a future step
  ipcMain.handle('speech:start', async () => {
    // TODO: integrate onnxruntime-node + whisper.onnx for real STT
    // For now, return empty string — the renderer handles the mic via Web Audio API
    return '';
  });

  ipcMain.handle('speech:stop', async () => {
    // No-op for now; real implementation would stop the onnx inference
  });
}
