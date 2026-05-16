import { useState, useEffect } from 'react'

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap');

  @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes drift    { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-12px) rotate(2deg)} }
  @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes slideIn  { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }

  .home-wrap { font-family: 'Space Grotesk', system-ui, sans-serif; }

  .tool-card {
    transition: transform 0.32s cubic-bezier(.34,1.4,.64,1), box-shadow 0.32s ease, border-color 0.2s ease;
    cursor: pointer; position: relative; overflow: hidden;
  }
  .tool-card:hover { transform: translateY(-8px); }
  .tool-card:active { transform: translateY(-3px) scale(0.99); }

  .pill-btn {
    transition: all 0.18s ease;
    border: none; cursor: pointer;
    font-family: 'Space Grotesk', sans-serif;
  }
  .pill-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
  .pill-btn:active { transform: translateY(0); }

  .nav-link {
    transition: background 0.15s, color 0.15s;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 500;
  }

  .stat-num {
    font-family: 'Cabinet Grotesk', 'Space Grotesk', sans-serif;
    font-weight: 900;
  }

  .hero-title {
    font-family: 'Cabinet Grotesk', 'Space Grotesk', sans-serif;
    animation: fadeUp 0.7s ease both;
  }
  .hero-sub   { animation: fadeUp 0.7s 0.1s ease both; opacity: 0; animation-fill-mode: forwards; }
  .hero-cta   { animation: fadeUp 0.7s 0.2s ease both; opacity: 0; animation-fill-mode: forwards; }
  .stat-row   { animation: fadeUp 0.7s 0.25s ease both; opacity: 0; animation-fill-mode: forwards; }
  .card-1     { animation: fadeUp 0.7s 0.3s ease both; opacity: 0; animation-fill-mode: forwards; }
  .card-2     { animation: fadeUp 0.7s 0.4s ease both; opacity: 0; animation-fill-mode: forwards; }
  .how-sec    { animation: fadeUp 0.7s 0.15s ease both; opacity: 0; animation-fill-mode: forwards; }
  .footer-row { animation: fadeIn 1s 0.5s ease both; opacity: 0; animation-fill-mode: forwards; }

  /* Noise overlay */
  .noise-overlay {
    position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-size: 200px;
  }

  .gradient-orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px); pointer-events: none; z-index: 0;
  }

  .badge-live {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(59,130,246,0.08);
    border: 1px solid rgba(59,130,246,0.2);
    border-radius: 999px; padding: 6px 16px;
    animation: fadeIn 0.5s ease;
  }

  .step-card {
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 16px;
    padding: 24px 20px;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .step-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,0.07); }

  .gradient-text {
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 55%, #ec4899 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }
`

export default function Home({ onNavigate }) {
  const [hoveredCard, setHoveredCard] = useState(null)

  return (
    <div className="home-wrap" style={{ minHeight: '100vh', background: '#f8fafc', position: 'relative' }}>
      <style>{STYLES}</style>

      {/* Noise */}
      <div className="noise-overlay" />

      {/* Background orbs */}
      <div className="gradient-orb" style={{ width: 500, height: 500, top: -100, right: -150, background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
      <div className="gradient-orb" style={{ width: 400, height: 400, top: 200, left: -100, background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)' }} />

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,250,252,0.8)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}>♿</div>
          <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3 }}>
            AccessAI
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, zIndex: 1 }}>
          <NavLink color="#3b82f6" bg="#eff6ff" onClick={() => onNavigate('wesee')}>
            <span>👁️</span> WeSee
          </NavLink>
          <NavLink color="#7c3aed" bg="#f5f3ff" onClick={() => onNavigate('signspeak')}>
            <span>🤟</span> SignSpeak
          </NavLink>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: '80px 28px 64px', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        <div className="badge-live" style={{ marginBottom: 32 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 2s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, letterSpacing: 0.2 }}>AI-Powered Accessibility · 100% Free · Runs in Browser</span>
        </div>

        <h1 className="hero-title" style={{
          fontSize: 'clamp(40px, 7vw, 72px)',
          fontWeight: 900, lineHeight: 1.05,
          color: '#0f172a', marginBottom: 22, letterSpacing: -2,
        }}>
          AI Built for<br />
          <span className="gradient-text">Everyone.</span>
        </h1>

        <p className="hero-sub" style={{
          fontSize: 18, color: '#64748b', lineHeight: 1.75,
          maxWidth: 500, margin: '0 auto 40px', fontWeight: 400,
        }}>
          Two assistive tools for the visually impaired and deaf community — running entirely in your browser with zero data leaving your device.
        </p>

        <div className="hero-cta" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 72 }}>
          <button className="pill-btn" onClick={() => onNavigate('wesee')} style={{
            padding: '13px 28px', borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 6px 20px rgba(59,130,246,0.35)',
          }}>👁️ Try WeSee</button>
          <button className="pill-btn" onClick={() => onNavigate('signspeak')} style={{
            padding: '13px 28px', borderRadius: 12,
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            boxShadow: '0 6px 20px rgba(139,92,246,0.35)',
          }}>🤟 Try SignSpeak</button>
        </div>

        {/* Stats */}
        <div className="stat-row" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 72 }}>
          {[
            { num: '80+', label: 'Objects Detected', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
            { num: '91.3%', label: 'ASL Accuracy', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { num: '26', label: 'ASL Letters', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
            { num: '0ms', label: 'Server Latency', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          ].map(({ num, label, color, bg, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`,
              borderRadius: 14, padding: '16px 24px', textAlign: 'center', minWidth: 120,
            }}>
              <div className="stat-num" style={{ fontSize: 26, color, lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, fontWeight: 500, letterSpacing: 0.3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Tool Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, textAlign: 'left' }}>

          {/* WeSee Card */}
          <div className="tool-card card-1"
            onClick={() => onNavigate('wesee')}
            onMouseEnter={() => setHoveredCard('wesee')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: '#fff',
              borderRadius: 24,
              border: `2px solid ${hoveredCard === 'wesee' ? '#3b82f6' : '#e2e8f0'}`,
              padding: '32px 28px',
              boxShadow: hoveredCard === 'wesee'
                ? '0 20px 60px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.06)'
                : '0 2px 12px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 6px 18px rgba(59,130,246,0.35)',
                animation: hoveredCard === 'wesee' ? 'drift 3s ease-in-out infinite' : 'none',
              }}>👁️</div>
              <span style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 999,
                background: '#eff6ff', color: '#2563eb',
                border: '1px solid #bfdbfe', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>COCO-SSD</span>
            </div>

            <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, color: '#0f172a', marginBottom: 8, letterSpacing: -0.5 }}>WeSee</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75, marginBottom: 22 }}>
              Real-time object detection with voice feedback. Detects 80+ objects including people, furniture, vehicles — with hazard alerts and navigation guidance.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 26 }}>
              {['30 FPS', 'Voice Alerts', 'Hazard Detection', 'EN / HI / MR'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 999,
                  background: '#eff6ff', color: '#1d4ed8',
                  border: '1px solid #bfdbfe', fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>

            <button className="pill-btn" style={{
              width: '100%', padding: '14px 20px', borderRadius: 12,
              background: hoveredCard === 'wesee'
                ? 'linear-gradient(135deg, #60a5fa, #2563eb)'
                : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              Launch WeSee <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>

          {/* SignSpeak Card */}
          <div className="tool-card card-2"
            onClick={() => onNavigate('signspeak')}
            onMouseEnter={() => setHoveredCard('signspeak')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: '#fff',
              borderRadius: 24,
              border: `2px solid ${hoveredCard === 'signspeak' ? '#7c3aed' : '#e2e8f0'}`,
              padding: '32px 28px',
              boxShadow: hoveredCard === 'signspeak'
                ? '0 20px 60px rgba(139,92,246,0.15), 0 4px 16px rgba(0,0,0,0.06)'
                : '0 2px 12px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #a78bfa, #6d28d9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 6px 18px rgba(139,92,246,0.35)',
                animation: hoveredCard === 'signspeak' ? 'drift 3s ease-in-out infinite' : 'none',
              }}>🤟</div>
              <span style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 999,
                background: '#f5f3ff', color: '#7c3aed',
                border: '1px solid #ddd6fe', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>MediaPipe</span>
            </div>

            <h2 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 28, fontWeight: 900, color: '#0f172a', marginBottom: 8, letterSpacing: -0.5 }}>SignSpeak</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75, marginBottom: 22 }}>
              ASL hand gesture recognition trained on self-collected data — achieving 91.3% accuracy. Translates sign language letters into text and speech in real time.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 26 }}>
              {['91.3% Accuracy', '26 ASL Letters', 'Word Builder', 'Text-to-Speech'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 999,
                  background: '#f5f3ff', color: '#6d28d9',
                  border: '1px solid #ddd6fe', fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>

            <button className="pill-btn" style={{
              width: '100%', padding: '14px 20px', borderRadius: 12,
              background: hoveredCard === 'signspeak'
                ? 'linear-gradient(135deg, #a78bfa, #6d28d9)'
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              Launch SignSpeak <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="how-sec" style={{
        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(226,232,240,0.8)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        padding: '64px 28px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>How it works</span>
            <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 30, fontWeight: 800, color: '#0f172a', marginTop: 10, letterSpacing: -0.8 }}>
              Runs entirely in your browser
            </p>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>No server. No uploads. Your camera feed never leaves your device.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
            {[
              { icon: '📷', title: 'Camera Input', desc: 'Your device camera captures live video frames in real time', color: '#3b82f6' },
              { icon: '🧠', title: 'Local AI', desc: 'TensorFlow.js & MediaPipe run fully on-device via WebGL', color: '#8b5cf6' },
              { icon: '📍', title: 'Detection', desc: 'Objects or hand signs identified with position and confidence', color: '#ec4899' },
              { icon: '🔊', title: 'Voice Output', desc: 'Results spoken aloud — in English, Hindi, or Marathi', color: '#059669' },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} className="step-card" style={{ textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: color + '15', border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, margin: '0 auto 14px',
                }}>{icon}</div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy Note ── */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '48px 28px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.06))',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: 20, padding: '28px 32px',
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
          <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 8 }}>
            Your privacy is guaranteed
          </p>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
            All AI inference runs locally in your browser. No video, audio, or personal data is ever transmitted to any server. Fully offline-capable as a PWA.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer-row" style={{ padding: '28px 28px 40px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {['React', 'TensorFlow.js', 'MediaPipe', 'Vite', 'PWA'].map(t => (
            <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
        <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 480, margin: '0 auto 8px', lineHeight: 1.6 }}>
          AccessAI is a free, open-source project built with ❤️ to empower individuals with disabilities through on-device AI.
        </p>
        <p style={{ fontSize: 12, color: '#cbd5e1' }}>© 2026 AccessAI · All rights reserved.</p>
      </footer>
    </div>
  )
}

function NavLink({ children, color, bg, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="nav-link"
      style={{
        background: hovered ? bg : 'transparent',
        border: `1.5px solid ${hovered ? color + '40' : '#e2e8f0'}`,
        color: hovered ? color : '#64748b',
        padding: '7px 14px', borderRadius: 10,
        fontSize: 13, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >{children}</button>
  )
}