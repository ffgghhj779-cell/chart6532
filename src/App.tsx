/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LiveFinancialChart } from './components/LiveFinancialChart';

// ─── Password Protection Gate ───
const ACCESS_KEY = 'gold2025@secure';

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Check if already unlocked in this session
    if (sessionStorage.getItem('chart_access') === 'granted') {
      setUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ACCESS_KEY) {
      sessionStorage.setItem('chart_access', 'granted');
      setUnlocked(true);
      setError(false);
    } else {
      setAttempts(a => a + 1);
      setError(true);
      setInput('');
    }
  };

  if (unlocked) {
    return (
      <main className="w-full h-screen bg-[#0b0e11]">
        <LiveFinancialChart />
      </main>
    );
  }

  return (
    <main className="w-full h-screen bg-[#0b0e11] flex items-center justify-center" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1e2a 0%, #0f1318 100%)',
        border: '1px solid #2a3040',
        borderRadius: '16px',
        padding: '48px 40px',
        width: '360px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
        <h1 style={{ color: '#f0b429', fontSize: '20px', marginBottom: '8px', fontWeight: 700 }}>
          Gold Chart Pro
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>
          يرجى إدخال كلمة المرور للوصول
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="كلمة المرور"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#0b0e11',
              border: error ? '1px solid #ef4444' : '1px solid #2a3040',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
              textAlign: 'center',
              direction: 'ltr'
            }}
            autoFocus
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
              كلمة المرور غير صحيحة {attempts > 2 ? '— تواصل مع مزود الخدمة' : ''}
            </p>
          )}
          <button
            type="submit"
            style={{
              marginTop: '20px',
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #f0b429 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#000000',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            دخول
          </button>
        </form>
      </div>
    </main>
  );
}
