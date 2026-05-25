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
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('access_token');
      const deviceId = await window.zoomguru.getDeviceId();
      const apiUrl = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
      const res = await fetch(`${apiUrl}/cv/upload`, {
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
    input.accept = '.pdf,.doc,.docx,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
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
        ZoomGuru personalizes every answer using your real experience.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={openPicker}
        style={{
          border: '2px dashed rgba(255,255,255,0.15)',
          borderRadius: 12,
          padding: '32px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)',
          transition: 'border-color 0.2s',
        }}
      >
        {uploading ? (
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Uploading...</span>
        ) : filename ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>{filename}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
              Click to replace
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Click or drag your CV here
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>
              PDF, DOC, DOCX, TXT
            </div>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
