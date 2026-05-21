import { useState, useCallback } from 'react';

interface CVUploadProps {
  onUploaded: (profile: any) => void;
}

export function CVUpload({ onUploaded }: CVUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      setError('Only PDF and Word documents are supported');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('access_token');
      const deviceId = await window.zoomguru.getDeviceId();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cv/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Device-ID': deviceId },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      const { profile } = await res.json();
      setFilename(file.name);
      onUploaded(profile);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const openPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 8, fontSize: 15, fontWeight: 600 }}>
        Upload Your CV
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
        We'll personalise every answer based on your experience.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={openPicker}
        style={{
          border: `2px dashed ${filename ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 12,
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          background: filename ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Parsing your CV with AI...
            </p>
          </div>
        ) : filename ? (
          <div>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <p style={{ color: '#22c55e', fontSize: 13, fontWeight: 500 }}>
              {filename}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
              CV loaded — click to replace
            </p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              Drop your CV here or click to upload
            </p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
              PDF or Word document (.pdf, .doc, .docx)
            </p>
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
