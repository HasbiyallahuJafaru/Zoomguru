// Self-check for CV / document text extraction.
//   node scripts/check-documents.mjs
//
// Guards the two failures that produced support complaints:
//   1. pdf.js internals ("bad XRef entry", "Invalid PDF structure") reaching
//      the user verbatim instead of something actionable.
//   2. An image-only PDF parsing "successfully" to an empty string, so the app
//      stored an empty CV and every later answer silently lost its context.
//
// Fixtures come from pdf-parse's own test data plus a few written here, so this
// needs no network and no extra dependency. documents.ts is bundled on the fly
// because it is TypeScript; pdf-parse and adm-zip stay external and resolve
// from node_modules as they do at runtime.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const tmp = mkdtempSync(path.join(tmpdir(), 'zg-docs-'));

const PDF_DATA = path.join(appRoot, 'node_modules', 'pdf-parse', 'test', 'data');
if (!existsSync(PDF_DATA)) {
  console.error('check-documents: pdf-parse test fixtures missing — run npm install first');
  process.exit(1);
}

// Emitted inside the package, not tmp: the bundle keeps pdf-parse and adm-zip
// external, so it has to sit somewhere their require() can still resolve.
const cacheDir = path.join(appRoot, 'node_modules', '.cache');
mkdirSync(cacheDir, { recursive: true });
const outfile = path.join(cacheDir, 'zg-check-documents.cjs');
await esbuild.build({
  entryPoints: [path.join(appRoot, 'electron', 'documents.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['pdf-parse', 'adm-zip'],
  logLevel: 'silent',
});
const { extractDocumentText, readablePdfError, MAX_DOC_BYTES } = require(outfile);

const write = (name, buf) => {
  const p = path.join(tmp, name);
  writeFileSync(p, buf);
  return p;
};

const validPdf = path.join(PDF_DATA, '01-valid.pdf');
const invalidPdf = path.join(PDF_DATA, '03-invalid.pdf');
const emptyPdf = write('empty.pdf', Buffer.alloc(0));
const notAPdf = write('lies.pdf', Buffer.from('this is not a pdf, it is a docx someone renamed'));
const emptyTxt = write('empty.txt', Buffer.from('   \n\t  '));
const goodTxt = write('cv.txt', Buffer.from('  Jane Doe\nSenior Engineer  '));
const bigPdf = write('big.pdf', Buffer.alloc(MAX_DOC_BYTES + 1));

const failsWith = async (file, pattern, label) => {
  let msg = null;
  try { await extractDocumentText(file); } catch (e) { msg = e.message; }
  assert.notEqual(msg, null, `${label}: expected a throw, got success`);
  assert.match(msg, pattern, `${label}: unhelpful message -> ${msg}`);
  // The whole point: pdf.js internals must never reach the user.
  assert.doesNotMatch(msg, /XRef|FormatError|stream must have data|Invalid PDF structure/,
    `${label}: leaked a pdf.js internal -> ${msg}`);
  return msg;
};

// A real PDF still works, and comes back trimmed.
{
  const text = await extractDocumentText(validPdf);
  assert.ok(text.length > 1000, 'valid PDF should yield substantial text');
  assert.equal(text, text.trim(), 'text should be trimmed');
}

// The silent one: a scanned or photographed CV is a structurally valid PDF that
// simply has no text layer, so pdf-parse returns success with an empty string.
// Rather than hand-roll such a PDF (easy to get subtly wrong, and then you are
// testing your fixture instead of the code), stub pdf-parse the way
// check-sessions.mjs stubs Redis. documents.ts requires it per call, so
// swapping the module cache entry is enough.
{
  const pdfParseEntry = require.resolve(path.join(appRoot, 'node_modules', 'pdf-parse'));
  const real = require.cache[pdfParseEntry];
  require.cache[pdfParseEntry] = {
    id: pdfParseEntry, filename: pdfParseEntry, loaded: true, children: [], paths: [],
    exports: async () => ({ text: '  \n \t ' }),   // whitespace only, as a scan yields
  };
  try {
    await failsWith(validPdf, /scan or photo/i, 'image-only PDF (stubbed)');
  } finally {
    if (real) require.cache[pdfParseEntry] = real;
    else delete require.cache[pdfParseEntry];
  }
}

// Broken inputs get an actionable message, never pdf.js wording.
await failsWith(invalidPdf, /could not be read as a PDF/i, 'invalid PDF');
await failsWith(emptyPdf, /could not be read as a PDF/i, 'empty PDF');
await failsWith(notAPdf, /could not be read as a PDF/i, 'non-PDF renamed .pdf');

// Size cap, so the main process cannot be frozen for seconds.
await failsWith(bigPdf, /20 MB limit/, 'oversized file');

// Plain text paths.
await failsWith(emptyTxt, /empty/i, 'whitespace-only txt');
assert.equal(await extractDocumentText(goodTxt), 'Jane Doe\nSenior Engineer', 'txt is trimmed, not mangled');

// Password-protected PDFs are their own message — pdf.js says "password".
assert.match(readablePdfError(new Error('No password given')), /password-protected/i);
assert.match(readablePdfError(new Error('bad XRef entry')), /could not be read as a PDF/i);

// --- Word documents ---
// A .docx is a zip with the text in word/document.xml, so a fixture can be
// built with the adm-zip already used for .pptx. No new dependency, and no
// binary blob checked into the repo.
const AdmZip = require(path.join(appRoot, 'node_modules', 'adm-zip'));
const makeDocx = (name, documentXml, withDocumentPart = true) => {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types/>'));
  if (withDocumentPart) zip.addFile('word/document.xml', Buffer.from(documentXml));
  const p = path.join(tmp, name);
  zip.writeZip(p);
  return p;
};

{
  const docx = makeDocx('cv.docx',
    '<?xml version="1.0"?><w:document><w:body>' +
    '<w:p><w:r><w:t>Jane Doe</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>R&amp;D Engineer</w:t></w:r><w:r><w:t> &amp; mentor</w:t></w:r></w:p>' +
    '</w:body></w:document>');
  const text = await extractDocumentText(docx);
  // Paragraphs must survive as newlines, or a CV arrives as one run-on line.
  assert.equal(text, 'Jane Doe\nR&D Engineer & mentor', `docx extraction wrong -> ${JSON.stringify(text)}`);
  // XML entities decoded, and no markup left behind.
  assert.doesNotMatch(text, /&amp;|<w:|\/>/, 'docx text still contains markup');
}

await failsWith(makeDocx('empty.docx', '<?xml version="1.0"?><w:document><w:body></w:body></w:document>'),
  /No text found in this Word document/i, 'docx with no text');

await failsWith(makeDocx('bogus.docx', '', false),
  /could not be read as a Word document/i, 'zip without word/document.xml');

await failsWith(write('legacy.doc', Buffer.from('\xD0\xCF\x11\xE0 OLE compound file', 'latin1')),
  /Save As to create a \.docx/i, 'legacy .doc');

// Regression: the formats that already worked must be untouched by the above.
assert.ok((await extractDocumentText(validPdf)).length > 1000, 'pdf still parses');
assert.equal(await extractDocumentText(goodTxt), 'Jane Doe\nSenior Engineer', 'txt still parses');

console.log('check-documents: OK');
