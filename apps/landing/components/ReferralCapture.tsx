'use client';

import { useEffect } from 'react';

export default function ReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;

    try {
      localStorage.setItem('zg_ref', ref);
      // Also set a 30-day cookie so server components / other pages can read it
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `zg_ref=${encodeURIComponent(ref)}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {
      // localStorage unavailable (private browsing edge case) — ignore
    }
  }, []);

  return null;
}
