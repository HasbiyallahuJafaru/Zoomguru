import path from 'path';
import fs from 'fs';

// Document text extraction for the CV upload and the meeting/doc copilot.
//
// Both paths held identical copies of this code and therefore identical bugs,
// so it lives in one place now: fixing it twice is the bigger diff. It sits in
// its own module rather than main.ts so it can be exercised without Electron —
// see scripts/check-documents.mjs.
//
// Two failures users actually hit:
//
// 1. pdf-parse surfaces pdf.js internals — "bad XRef entry", "Invalid PDF
//    structure", "PDFDocument: stream must have data" — and those went verbatim
//    into the UI. They tell someone uploading a CV nothing about what to do.
// 2. An image-only PDF (a scanned or photographed CV) parses *successfully* and
//    yields an empty string. The app stored an empty CV, showed the filename as
//    though it had worked, and every answer afterwards quietly lost its CV
//    context with no error anywhere. That silence is the worse of the two.
//
// The size cap is not arbitrary: parsing runs on the main process at roughly
// 34ms/page, so a large file freezes the whole app — overlay included — for
// seconds. 20MB is far above any real CV and keeps that bounded.
// ponytail: main-process parse, move to a utilityProcess if decks get big.
export const MAX_DOC_BYTES = 20 * 1024 * 1024;

export function readablePdfError(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);

  // Keep the internal for debugging, never show it. pdf.js reports things like
  // "bad XRef entry", "Illegal character: 41" and "PDFDocument: stream must
  // have data" — and it is not even consistent, the same broken file can give
  // different wording on different runs. Matching on that set is a treadmill,
  // so anything that is not a password problem gets one honest message: we
  // could not read it. From the user's side that is the whole truth anyway.
  console.error('[documents] pdf parse failed:', m);

  if (/password|encrypt/i.test(m)) {
    return 'This PDF is password-protected. Remove the password, then upload it again.';
  }
  return 'This file could not be read as a PDF. It may be corrupted, incomplete, or not actually a PDF — try opening it and re-exporting as PDF.';
}

export async function extractDocumentText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  const { size } = fs.statSync(filePath);
  if (size > MAX_DOC_BYTES) {
    throw new Error(`That file is ${(size / 1024 / 1024).toFixed(1)} MB, above the 20 MB limit. Please upload a smaller file.`);
  }

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = (require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>);
    let parsed: { text: string };
    try {
      parsed = await pdfParse(buffer);
    } catch (err) {
      throw new Error(readablePdfError(err));
    }
    const text = parsed.text.trim();
    if (!text) {
      throw new Error('No selectable text found in this PDF. It looks like a scan or photo, where the words are pixels rather than text. Export a text-based PDF from Word or Google Docs, or paste the text in instead.');
    }
    return text;
  }

  if (ext === '.pptx') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdmZip = require('adm-zip') as new (p: string) => { getEntries(): { entryName: string; getData(): Buffer }[]; };
    let slideTexts: string[];
    try {
      const zip = new AdmZip(filePath);
      slideTexts = zip.getEntries()
        .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
        .sort((a, b) => a.entryName.localeCompare(b.entryName))
        .map((entry) => entry.getData().toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    } catch {
      throw new Error('This file could not be read as a PowerPoint deck. It may be corrupted, or saved in the older .ppt format — re-save it as .pptx.');
    }
    const text = slideTexts.join('\n\n---\n\n').trim();
    if (!text) {
      throw new Error('No text found in this deck. If the slides are images, the text cannot be read from them.');
    }
    return text;
  }

  if (ext === '.docx') {
    // A .docx is a zip, exactly like the .pptx above — the text lives in
    // word/document.xml. adm-zip is already a dependency for pptx, so this
    // costs no new package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdmZip = require('adm-zip') as new (p: string) => { getEntries(): { entryName: string; getData(): Buffer }[]; };
    let xml: string;
    try {
      const zip = new AdmZip(filePath);
      const doc = zip.getEntries().find((e) => e.entryName === 'word/document.xml');
      if (!doc) throw new Error('no word/document.xml');
      xml = doc.getData().toString('utf-8');
    } catch {
      throw new Error('This file could not be read as a Word document. It may be corrupted, or actually be an older .doc saved with a .docx name — open it in Word and use Save As to create a real .docx.');
    }
    // Paragraph ends become newlines before tags are stripped. Without that
    // every line of a CV runs into the next one, which reads as one long
    // sentence to the model and loses the structure entirely.
    const text = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim();
    if (!text) {
      throw new Error('No text found in this Word document. If the content is images or scans, the text cannot be read from them.');
    }
    return text;
  }

  if (ext === '.doc') {
    // Word 97-2003 is a binary OLE compound file, not a zip, so nothing already
    // installed can read it and it would need a new dependency for a format
    // Word stopped defaulting to in 2007. Saying so is more useful than either
    // a new package or the silent garbage the utf-8 branch below would produce.
    throw new Error('This is the older Word 97-2003 format (.doc), which cannot be read directly. Open it in Word and use Save As to create a .docx, then upload that.');
  }

  const text = fs.readFileSync(filePath, 'utf-8').trim();
  if (!text) throw new Error('That file is empty.');
  return text;
}
