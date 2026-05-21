import { useState } from 'react';
import { CVUpload } from './CVUpload';
import { JDInput } from './JDInput';

const API_URL = import.meta.env.VITE_API_URL;

type InterviewType = 'behavioral' | 'technical' | 'coding' | 'systemdesign';
type AnswerLength = 'brief' | 'standard' | 'detailed';

interface Props {
  onComplete: () => void;
}

const STEPS = ['CV Upload', 'Job Description', 'Interview Type', 'Answer Length', 'Start'];

export function PreflightCheck({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [cvProfile, setCvProfile] = useState<any>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioral');
  const [answerLength, setAnswerLength] = useState<AnswerLength>('standard');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    setStarting(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const deviceId = await window.zoomguru.getDeviceId();
      const res = await fetch(`${API_URL}/ai/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          jobDescription,
          interviewType,
          answerLength,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to start session');
      }

      const { sessionId } = await res.json();
      localStorage.setItem('session_id', sessionId);
      onComplete();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'rgba(10,10,15,0.96)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  };

  const stepDotStyle = (active: boolean, done: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: done ? '#22c55e' : active ? '#3b82f6' : 'rgba(255,255,255,0.15)',
    transition: 'background 0.2s',
  });

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>ZoomGuru Setup</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={stepDotStyle(i === step, i < step)} />
            ))}
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Step 0: CV Upload */}
        {step === 0 && (
          <div>
            <CVUpload
              onUploaded={(profile) => {
                setCvProfile(profile);
              }}
            />
            <button
              onClick={() => setStep(1)}
              disabled={!cvProfile}
              className="btn-primary"
              style={{ marginTop: 20 }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 1: Job Description */}
        {step === 1 && (
          <JDInput
            onSubmit={(jd) => {
              setJobDescription(jd);
              setStep(2);
            }}
          />
        )}

        {/* Step 2: Interview Type */}
        {step === 2 && (
          <div>
            <h3 style={{ color: '#fff', marginBottom: 8, fontSize: 15, fontWeight: 600 }}>
              Interview Type
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
              Select the type of interview you're preparing for.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(
                [
                  { key: 'behavioral', label: 'Behavioral', desc: 'Tell me about yourself, STAR method' },
                  { key: 'technical', label: 'Technical', desc: 'Concepts, definitions, system questions' },
                  { key: 'coding', label: 'Coding', desc: 'Algorithms, data structures, LeetCode' },
                  { key: 'systemdesign', label: 'System Design', desc: 'Architecture, scale, trade-offs' },
                ] as { key: InterviewType; label: string; desc: string }[]
              ).map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setInterviewType(key)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${interviewType === key ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    background: interviewType === key ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              className="btn-primary"
              style={{ marginTop: 20 }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 3: Answer Length */}
        {step === 3 && (
          <div>
            <h3 style={{ color: '#fff', marginBottom: 8, fontSize: 15, fontWeight: 600 }}>
              Answer Length
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>
              How detailed should the AI answers be?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(
                [
                  { key: 'brief', label: 'Brief', desc: '1-2 sentences, quick bullets' },
                  { key: 'standard', label: 'Standard', desc: '3-5 sentences, balanced' },
                  { key: 'detailed', label: 'Detailed', desc: 'Full structured answer with examples' },
                ] as { key: AnswerLength; label: string; desc: string }[]
              ).map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setAnswerLength(key)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${answerLength === key ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    background: answerLength === key ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(4)}
              className="btn-primary"
              style={{ marginTop: 20 }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 4: Start */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Ready to Start
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 8 }}>
              Your interview copilot is configured:
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 24,
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Type</span>
                <span style={{ color: '#fff', fontSize: 12, textTransform: 'capitalize' }}>{interviewType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Length</span>
                <span style={{ color: '#fff', fontSize: 12, textTransform: 'capitalize' }}>{answerLength}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>CV</span>
                <span style={{ color: cvProfile ? '#22c55e' : '#ef4444', fontSize: 12 }}>
                  {cvProfile ? 'Loaded' : 'Not loaded'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Job Description</span>
                <span style={{ color: jobDescription ? '#22c55e' : 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                  {jobDescription ? 'Added' : 'Skipped'}
                </span>
              </div>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>
            )}

            <button
              onClick={handleStart}
              disabled={starting || !cvProfile}
              className="btn-primary"
            >
              {starting ? 'Starting session...' : 'Start Interview'}
            </button>

            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 12 }}>
              Use Ctrl+Shift+A to listen · Ctrl+Shift+S to screenshot
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
