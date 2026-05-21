import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  onClose: () => void;
}

type Currency = 'NGN' | 'USD';
type Plan = 'monthly' | 'lifetime';

const PLANS = {
  NGN: {
    monthly: { label: '₦15,000 / month', amount: '₦15,000', sub: 'Billed monthly' },
    lifetime: { label: '₦100,000 one-time', amount: '₦100,000', sub: 'Pay once, use forever' },
  },
  USD: {
    monthly: { label: '$12 / month', amount: '$12', sub: 'Billed monthly' },
    lifetime: { label: '$79 one-time', amount: '$79', sub: 'Pay once, use forever' },
  },
};

async function checkLicense(): Promise<boolean> {
  try {
    const token = localStorage.getItem('access_token');
    const deviceId = await window.zoomguru.getDeviceId();
    const res = await fetch(`${API_URL}/license/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Device-ID': deviceId,
      },
    });
    const data = await res.json();
    return data.isPro === true;
  } catch {
    return false;
  }
}

export function PaywallModal({ onClose }: Props) {
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [loading, setLoading] = useState<Plan | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  async function handleUpgrade(plan: Plan) {
    setLoading(plan);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const deviceId = await window.zoomguru.getDeviceId();
      const res = await fetch(`${API_URL}/paystack/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ plan, currency }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Payment initialization failed');
      }

      const { authorizationUrl } = await res.json();

      // Open payment page in system browser
      await window.zoomguru.openExternal(authorizationUrl);

      // Poll for license activation (every 3s for up to 60s)
      setPolling(true);
      pollLicenseActivation();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  function pollLicenseActivation() {
    let attempts = 0;
    intervalRef.current = setInterval(async () => {
      attempts++;
      const verified = await checkLicense();

      if (verified) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPolling(false);
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.isPro = true;
          localStorage.setItem('user', JSON.stringify(user));
        }
        onClose();
      } else if (attempts >= 20) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPolling(false);
      }
    }, 3000);
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  };

  const modalStyle: React.CSSProperties = {
    background: 'rgba(15,15,20,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    animation: 'fadeIn 0.2s ease',
  };

  const planCardStyle = (selected: boolean): React.CSSProperties => ({
    padding: '14px 16px',
    borderRadius: 10,
    border: `1px solid ${selected ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
    background: selected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
    marginBottom: 10,
    cursor: 'pointer',
    transition: 'all 0.15s',
    width: '100%',
    textAlign: 'left',
  });

  if (polling) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>
              Waiting for payment...
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Complete your payment in the browser. This will update automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Upgrade to Pro</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
              Unlimited sessions, screenshot mode, wake word
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: 18,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Currency Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 3,
          marginBottom: 16,
        }}>
          {(['NGN', 'USD'] as Currency[]).map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: currency === c ? '#3b82f6' : 'transparent',
                color: currency === c ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {c === 'NGN' ? '₦ Naira' : '$ USD'}
            </button>
          ))}
        </div>

        {/* Plan Cards */}
        {(['monthly', 'lifetime'] as Plan[]).map(plan => {
          const info = PLANS[currency][plan];
          return (
            <button
              key={plan}
              style={planCardStyle(false)}
              onClick={() => handleUpgrade(plan)}
              disabled={loading !== null}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>
                    {plan === 'monthly' ? 'Monthly' : 'Lifetime'}
                    {plan === 'lifetime' && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 10,
                        background: 'rgba(234,179,8,0.2)',
                        color: '#eab308',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        BEST VALUE
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                    {info.sub}
                  </div>
                </div>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
                  {loading === plan ? '...' : info.amount}
                </div>
              </div>
            </button>
          );
        })}

        {error && (
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            {error}
          </p>
        )}

        {/* Features list */}
        <div style={{
          marginTop: 16,
          padding: '12px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {[
            'Unlimited interview sessions',
            'Unlimited AI responses',
            'Screenshot + vision analysis',
            'Wake word: "Hey ZoomGuru"',
            'Session transcript export',
          ].map(feature => (
            <div key={feature} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
            }}>
              <span style={{ color: '#22c55e', fontSize: 10 }}>✓</span>
              {feature}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
