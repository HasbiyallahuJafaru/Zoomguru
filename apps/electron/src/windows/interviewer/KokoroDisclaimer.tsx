import { useState, useEffect, useRef } from 'react';
import { env, pipeline } from '@huggingface/transformers';

interface Props {
  onReady: () => void;
  onCancel: () => void;
}

type Phase = 'disclaimer' | 'downloading' | 'error';

interface ProgressInfo {
  loaded: number;
  total: number;
  file: string;
}

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0';

const KokoroDisclaimer = ({ onReady, onCancel }: Props) => {
  const [phase, setPhase] = useState<Phase>('disclaimer');
  const [progress, setProgress] = useState<ProgressInfo>({ loaded: 0, total: 0, file: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(false);

  function formatMB(bytes: number): string {
    return (bytes / 1_048_576).toFixed(1);
  }

  function pct(): number {
    if (!progress.total) return 0;
    return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
  }

  async function startDownload(): Promise<void> {
    setPhase('downloading');
    abortRef.current = false;

    try {
      env.allowRemoteModels = true;
      env.allowLocalModels = false;

      await pipeline('text-to-speech', MODEL_ID, {
        dtype: 'fp32',
        device: 'wasm',
        progress_callback: (info: Record<string, unknown>) => {
          if (abortRef.current) return;
          if (info['status'] === 'progress' && typeof info['loaded'] === 'number') {
            setProgress({
              loaded: info['loaded'] as number,
              total: (info['total'] as number) ?? 0,
              file: (info['file'] as string) ?? '',
            });
          }
        },
      });

      if (abortRef.current) return;

      await window.zoomguru.kokoroSetReady(true);
      onReady();
    } catch (err) {
      if (abortRef.current) return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(msg);
      setPhase('error');
      await cleanupCache();
    }
  }

  async function cleanupCache(): Promise<void> {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.includes('transformers') || k.includes('kokoro'))
          .map((k) => caches.delete(k)),
      );
    } catch {
      // best-effort
    }
  }

  async function handleCancel(): Promise<void> {
    abortRef.current = true;
    await cleanupCache();
    onCancel();
  }

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  if (phase === 'disclaimer') {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.titleRow}>
            <span style={styles.title}>AI Interviewer</span>
            <button style={styles.closeBtn} onClick={onCancel}>✕</button>
          </div>
          <p style={styles.body}>
            To use the AI Interviewer, ZoomGuru will download the Kokoro voice model
            (~350 MB) to your device. This is a one-time download. The model is stored
            locally and never sent to any server.
          </p>
          <div style={styles.actions}>
            <button style={styles.btnSecondary} onClick={onCancel}>Cancel</button>
            <button style={styles.btnPrimary} onClick={() => void startDownload()}>
              Download &amp; Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'downloading') {
    const percent = pct();
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.title}>Downloading voice model…</div>
          <div style={styles.fileName}>{progress.file || 'Preparing…'}</div>
          <div style={styles.barTrack}>
            <div style={{ ...styles.barFill, width: `${percent}%` }} />
          </div>
          <div style={styles.progressText}>
            {progress.total
              ? `${formatMB(progress.loaded)} MB / ${formatMB(progress.total)} MB — ${percent}%`
              : 'Connecting…'}
          </div>
          <button style={{ ...styles.btnSecondary, marginTop: 20 }} onClick={() => void handleCancel()}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={{ ...styles.title, color: '#ef4444' }}>Download failed</div>
        <p style={styles.body}>{errorMsg}</p>
        <p style={{ ...styles.body, color: '#888', marginTop: 8 }}>
          Partial files have been removed. Check your internet connection and try again.
        </p>
        <div style={styles.actions}>
          <button style={styles.btnSecondary} onClick={onCancel}>Cancel</button>
          <button style={styles.btnPrimary} onClick={() => void startDownload()}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 14,
    padding: '28px 32px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
  },
  body: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  btnPrimary: {
    padding: '10px 22px',
    borderRadius: 8,
    border: 'none',
    background: '#fff',
    color: '#0a0a0a',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 22px',
    borderRadius: 8,
    border: '1px solid #333',
    background: 'transparent',
    color: '#aaa',
    fontSize: 14,
    cursor: 'pointer',
  },
  fileName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    background: '#222',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    background: '#fff',
    transition: 'width 0.2s ease',
  },
  progressText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
};

export default KokoroDisclaimer;
