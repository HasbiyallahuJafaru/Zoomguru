import { useState, type CSSProperties } from 'react';

type ES = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

interface Props {
  docs: ParsedDoc[];
  onDocsChange: (docs: ParsedDoc[]) => void;
  onLaunch: () => void;
}

function docMeta(doc: ParsedDoc): string {
  if (doc.fileType === 'pdf') return `PDF · ${doc.pageCount ?? '?'} pages`;
  return `PPTX · ${doc.slideCount ?? '?'} slides`;
}

export default function DocCopilotSetup({ docs, onDocsChange, onLaunch }: Props) {
  const [parsing, setParsing] = useState(false);

  async function handleAdd() {
    if (docs.length >= 3 || parsing) return;
    setParsing(true);
    try {
      const raw = await window.zoomguru.docCopilotParseFiles();
      const merged = [...docs];
      for (const d of raw) {
        if (merged.length >= 3) break;
        if (!merged.find((x) => x.docId === d.docId)) merged.push(d);
      }
      onDocsChange(merged);
    } finally {
      setParsing(false);
    }
  }

  const allWarnings = docs.flatMap((d) => d.warnings);

  return (
    <>
      <style>{`
        .zg-dc-close:hover { color: rgba(255,255,255,0.5) !important; }
        .zg-dc-add:hover:not(:disabled) { opacity: 0.85; }
        .zg-dc-launch:hover:not(:disabled) { opacity: 0.90; transform: scale(0.99); }
        .zg-dc-remove:hover { color: rgba(255,255,255,0.6) !important; }
        .zg-dc-ghost:hover { color: rgba(255,255,255,0.45) !important; }
      `}</style>

      <div style={s.root}>
        <button
          className="zg-dc-close"
          style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }}
          aria-label="Close"
        >
          ×
        </button>

        <div style={s.content}>
          {/* Header */}
          <div style={s.header}>
            <span style={s.title}>Doc Copilot</span>
            <span style={s.subtitle}>Answers grounded in your own documents</span>
          </div>

          {/* Document list */}
          <div style={s.docList}>
            {docs.length === 0 ? (
              <div style={s.emptyState}>
                <span style={s.emptyIcon}>📂</span>
                <span style={s.emptyText}>No documents loaded</span>
                <span style={s.emptyHint}>PDF and PPTX · up to 3 files</span>
              </div>
            ) : (
              docs.map((doc) => (
                <div key={doc.docId} style={s.docItem}>
                  <span style={s.docIcon}>{doc.fileType === 'pdf' ? '📑' : '📊'}</span>
                  <div style={s.docInfo}>
                    <span style={s.docName} title={doc.fileName}>{doc.fileName}</span>
                    <span style={s.docMeta}>{docMeta(doc)}</span>
                    {doc.warnings.length > 0 && (
                      <span style={s.docWarn}>⚠ {doc.warnings.length} parse warning{doc.warnings.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <button
                    className="zg-dc-remove"
                    style={s.removeBtn}
                    onClick={() => onDocsChange(docs.filter((d) => d.docId !== doc.docId))}
                    aria-label="Remove document"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Parse warnings */}
          {allWarnings.length > 0 && (
            <div style={s.warnBox}>
              {allWarnings.map((w, i) => (
                <p key={i} style={s.warnText}><em>{w}</em></p>
              ))}
            </div>
          )}

          {/* Add button */}
          {docs.length < 3 && (
            <button
              className="zg-dc-add"
              style={{ ...s.addBtn, ...(parsing || docs.length >= 3 ? s.addBtnDisabled : s.addBtnEnabled) }}
              disabled={parsing || docs.length >= 3}
              onClick={() => { void handleAdd(); }}
            >
              {parsing ? 'Parsing…' : `+ Add Document${docs.length > 0 ? ` (${docs.length}/3)` : ''}`}
            </button>
          )}

          {/* Launch */}
          <button
            className="zg-dc-launch"
            style={{ ...s.launchBtn, ...(docs.length === 0 ? s.launchBtnOff : s.launchBtnOn) }}
            disabled={docs.length === 0}
            onClick={onLaunch}
          >
            Launch Overlay →
          </button>

          <button
            className="zg-dc-ghost"
            style={s.hideBtn}
            onClick={() => { void window.zoomguru.hideWindow(); }}
          >
            Hide window
          </button>
        </div>
      </div>
    </>
  );
}

const s: Record<string, ES> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: 'rgba(7,7,11,0.97)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: SANS,
    overflow: 'hidden',
    position: 'relative',
    WebkitAppRegion: 'drag',
  },
  closeBtn: {
    position: 'absolute',
    top: '10px',
    right: '12px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '2px 4px',
    transition: 'color 120ms ease',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '14px',
    padding: '36px 24px 24px',
    WebkitAppRegion: 'no-drag',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: '0.2px',
  },
  subtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: '0.2px',
    textAlign: 'center' as const,
  },
  docList: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    overflow: 'hidden',
    minHeight: '80px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '24px 16px',
  },
  emptyIcon: { fontSize: '22px', opacity: 0.4 },
  emptyText: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.30)',
    fontFamily: SANS,
  },
  emptyHint: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.18)',
    fontFamily: SANS,
  },
  docItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  docIcon: { fontSize: '16px', flexShrink: 0 },
  docInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  docName: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.75)',
    fontFamily: SANS,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  docMeta: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.30)',
    fontFamily: SANS,
  },
  docWarn: {
    fontSize: '9px',
    color: 'rgba(251,191,36,0.70)',
    fontFamily: SANS,
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '2px 4px',
    flexShrink: 0,
    transition: 'color 120ms ease',
    fontFamily: SANS,
  },
  warnBox: {
    padding: '10px 12px',
    border: '1px solid rgba(251,191,36,0.20)',
    borderRadius: '6px',
    background: 'rgba(251,191,36,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  warnText: {
    fontSize: '10px',
    color: 'rgba(251,191,36,0.70)',
    fontFamily: SANS,
    margin: 0,
    fontStyle: 'italic',
  },
  addBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: SANS,
    textAlign: 'center' as const,
    transition: 'opacity 120ms ease',
    cursor: 'pointer',
  },
  addBtnEnabled: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.65)',
  },
  addBtnDisabled: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.22)',
    cursor: 'not-allowed',
  },
  launchBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: SANS,
    textAlign: 'center' as const,
    transition: 'opacity 120ms ease, transform 100ms ease',
    border: 'none',
    letterSpacing: '-0.1px',
  },
  launchBtnOn: {
    background: '#ffffff',
    color: '#07070b',
    cursor: 'pointer',
  },
  launchBtnOff: {
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.25)',
    cursor: 'not-allowed',
  },
  hideBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
};
