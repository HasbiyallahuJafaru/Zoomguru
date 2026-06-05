import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import pdfParse from 'pdf-parse';
import { BrowserWindow, ipcMain, dialog, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createHash } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedSlide {
  slideNumber: number;
  title: string | null;
  textBlocks: string[];
  tables: Array<{ headers: string[]; rows: string[][] }>;
  chartWarnings: string[];
}

export interface ParsedPdfPage {
  pageNumber: number;
  text: string;
  isEmpty: boolean;
}

export interface ParsedDoc {
  docId: string;
  fileName: string;
  fileType: 'pdf' | 'pptx';
  pageCount?: number;
  slideCount?: number;
  parsedContent: ParsedSlide[] | ParsedPdfPage[];
  warnings: string[];
  loadedAt: string;
}

// ─── xml2js helpers ───────────────────────────────────────────────────────────

function first<T>(arr: T[] | T | undefined): T | undefined {
  if (Array.isArray(arr)) return arr[0];
  return arr;
}

function asArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function extractTxBodyText(txBodyRaw: unknown): string[] {
  const txBody = first(txBodyRaw as Record<string, unknown>[] | undefined) as Record<string, unknown> | undefined;
  if (!txBody) return [];
  const texts: string[] = [];
  for (const para of asArray(txBody['a:p'] as unknown)) {
    const p = para as Record<string, unknown>;
    for (const item of [
      ...asArray(p['a:r'] as unknown),
      ...asArray(p['a:fld'] as unknown),
    ]) {
      const r = item as Record<string, unknown>;
      const t = r['a:t'];
      const str = Array.isArray(t) ? t.join('') : typeof t === 'string' ? t : '';
      if (str.trim()) texts.push(str.trim());
    }
  }
  return texts;
}

function isPlaceholderTitle(sp: Record<string, unknown>): boolean {
  const nvSpPr = first(sp['p:nvSpPr'] as unknown) as Record<string, unknown> | undefined;
  const nvPr   = first(nvSpPr?.['p:nvPr'] as unknown) as Record<string, unknown> | undefined;
  const ph     = first(nvPr?.['p:ph'] as unknown) as Record<string, unknown> | undefined;
  const phType = (ph?.['$'] as Record<string, string> | undefined)?.type;
  return phType === 'title' || phType === 'ctrTitle';
}

function extractTable(tblRaw: unknown): { headers: string[]; rows: string[][] } | null {
  const tbl = first(tblRaw as unknown) as Record<string, unknown> | undefined;
  if (!tbl) return null;
  const parsedRows = asArray(tbl['a:tr'] as unknown).map((rowRaw) => {
    const row = rowRaw as Record<string, unknown>;
    return asArray(row['a:tc'] as unknown).map((cellRaw) => {
      const cell = cellRaw as Record<string, unknown>;
      return extractTxBodyText(cell['a:txBody']).join(' ');
    });
  });
  if (parsedRows.length === 0) return null;
  const [headers = [], ...rows] = parsedRows;
  return { headers, rows };
}

// ─── PPTX parser ──────────────────────────────────────────────────────────────

async function parsePptxFile(filePath: string): Promise<ParsedDoc> {
  const zip      = new AdmZip(filePath);
  const fileName = path.basename(filePath);
  const buffer   = fs.readFileSync(filePath);
  const docId    = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

  const slides: ParsedSlide[] = [];
  const warnings: string[] = [];
  let slideIndex = 1;

  while (true) {
    const entry = zip.getEntry(`ppt/slides/slide${slideIndex}.xml`);
    if (!entry) break;

    const xml    = entry.getData().toString('utf8');
    // eslint-disable-next-line no-await-in-loop
    const parsed = await parseStringPromise(xml) as Record<string, unknown>;
    const sld    = first(parsed['p:sld'] as unknown) as Record<string, unknown> | undefined;
    const cSld   = first(sld?.['p:cSld'] as unknown) as Record<string, unknown> | undefined;
    const spTree = first(cSld?.['p:spTree'] as unknown) as Record<string, unknown> | undefined;

    let slideTitle: string | null = null;
    const textBlocks: string[] = [];
    const tables: Array<{ headers: string[]; rows: string[][] }> = [];
    const chartWarnings: string[] = [];

    if (spTree) {
      for (const sp of asArray(spTree['p:sp'] as unknown) as Record<string, unknown>[]) {
        const texts = extractTxBodyText(sp['p:txBody']);
        if (texts.length === 0) continue;
        if (!slideTitle && isPlaceholderTitle(sp)) {
          slideTitle = texts.join(' ');
        } else {
          textBlocks.push(...texts);
        }
      }

      for (const frame of asArray(spTree['p:graphicFrame'] as unknown) as Record<string, unknown>[]) {
        const graphic     = first(frame['a:graphic'] as unknown) as Record<string, unknown> | undefined;
        const graphicData = first(graphic?.['a:graphicData'] as unknown) as Record<string, unknown> | undefined;
        const uri         = ((graphicData?.['$'] as Record<string, string> | undefined)?.uri) ?? '';

        if (uri.includes('/table')) {
          const t = extractTable(graphicData?.['a:tbl']);
          if (t) tables.push(t);
        } else if (uri.includes('/chart')) {
          const warn = `Slide ${slideIndex} contains a chart that could not be fully parsed. Answers about this chart may be incomplete.`;
          chartWarnings.push(warn);
          warnings.push(warn);
        }
      }
    }

    slides.push({ slideNumber: slideIndex, title: slideTitle, textBlocks, tables, chartWarnings });
    slideIndex++;
  }

  return {
    docId,
    fileName,
    fileType: 'pptx',
    slideCount: slides.length,
    parsedContent: slides,
    warnings,
    loadedAt: new Date().toISOString(),
  };
}

// ─── PDF parser ───────────────────────────────────────────────────────────────

async function parsePdfFile(filePath: string): Promise<ParsedDoc> {
  const fileName = path.basename(filePath);
  const buffer   = fs.readFileSync(filePath);
  const docId    = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const parsed   = await pdfParse(buffer);

  const rawText: string = (parsed as unknown as { text: string }).text ?? '';
  const pages = rawText.split(/\f/).map((t, i) => ({
    pageNumber: i + 1,
    text: t.replace(/\r\n/g, '\n').trim(),
    isEmpty: t.trim().length < 20,
  }));

  const warnings: string[] = [];
  const emptyPages = pages.filter((p) => p.isEmpty).map((p) => p.pageNumber);
  if (emptyPages.length > 0) {
    warnings.push(
      `Pages with limited content detected: ${emptyPages.slice(0, 5).join(', ')}. Answers from these pages may be incomplete.`,
    );
  }

  return {
    docId,
    fileName,
    fileType: 'pdf',
    pageCount: pages.length,
    parsedContent: pages,
    warnings,
    loadedAt: new Date().toISOString(),
  };
}

// ─── Window ───────────────────────────────────────────────────────────────────

let docCopilotWindow: BrowserWindow | null = null;

export function getDocCopilotWindow(): BrowserWindow | null {
  return docCopilotWindow && !docCopilotWindow.isDestroyed() ? docCopilotWindow : null;
}

export function createDocCopilotWindow(): void {
  const existing = getDocCopilotWindow();
  if (existing) { existing.show(); existing.focus(); return; }

  docCopilotWindow = new BrowserWindow({
    width: 460,
    height: 560,
    minWidth: 360,
    minHeight: 400,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    movable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  try { docCopilotWindow.setContentProtection(true); } catch { /* not all platforms */ }
  docCopilotWindow.setAlwaysOnTop(true, 'screen-saver');
  docCopilotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (!app.isPackaged) {
    void docCopilotWindow.loadURL('http://localhost:5173/doc-copilot.html');
  } else {
    void docCopilotWindow.loadFile(
      path.join(__dirname, '../dist-renderer/doc-copilot.html'),
    );
  }

  docCopilotWindow.once('ready-to-show', () => { docCopilotWindow?.show(); });
  docCopilotWindow.on('closed', () => { docCopilotWindow = null; });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

export function registerDocCopilotIpcHandlers(): void {
  ipcMain.handle('doccopilot:open', () => { createDocCopilotWindow(); });

  ipcMain.handle('doccopilot:parse-files', async () => {
    const win = getDocCopilotWindow() ?? BrowserWindow.getFocusedWindow();
    if (!win) return [];

    const result = await dialog.showOpenDialog(win, {
      title: 'Select documents (up to 3)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents', extensions: ['pdf', 'pptx'] }],
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const docs: ParsedDoc[] = [];
    for (const fp of result.filePaths.slice(0, 3)) {
      const ext = path.extname(fp).toLowerCase();
      try {
        if (ext === '.pdf')  docs.push(await parsePdfFile(fp));
        else if (ext === '.pptx') docs.push(await parsePptxFile(fp));
      } catch (err) {
        docs.push({
          docId: `err-${Date.now()}`,
          fileName: path.basename(fp),
          fileType: ext === '.pptx' ? 'pptx' : 'pdf',
          parsedContent: [],
          warnings: [`Failed to parse: ${err instanceof Error ? err.message : 'Unknown error'}`],
          loadedAt: new Date().toISOString(),
        });
      }
    }
    return docs;
  });
}
