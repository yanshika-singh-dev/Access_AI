import { useState, useEffect } from 'react'

const STYLES = `
  @keyframes fadeUp   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes shimmer  { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.5} }

  .home-card {
    transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease;
    cursor: pointer;
  }
  .home-card:hover {
    transform: translateY(-6px) scale(1.01);
  }
  .home-card:active { transform: translateY(-2px) scale(0.99); }

  .tag-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 500; letter-spacing: 0.3px;
  }
  .btn-primary {
    transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
    border: none; cursor: pointer;
  }
  .btn-primary:hover { transform: translateY(-1px); filter: brightness(1.08); }
  .btn-primary:active { transform: translateY(0); filter: brightness(0.96); }

  .stat-item { animation: fadeUp 0.6s ease both; }
  .hero-title { animation: fadeUp 0.7s ease both; }
  .hero-sub   { animation: fadeUp 0.7s 0.1s ease both; }
  .card-1     { animation: fadeUp 0.7s 0.2s ease both; }
  .card-2     { animation: fadeUp 0.7s 0.3s ease both; }
  .footer-row { animation: fadeIn 1s 0.5s ease both; opacity: 0; animation-fill-mode: forwards; }
`

export default function Home({ onNavigate }) {
  const [hoveredCard, setHoveredCard] = useState(null)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{STYLES}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,250,252,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
          }}>♿</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
            AccessAI
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavBtn color="#3b82f6" onClick={() => onNavigate('wesee')}>👁️ WeSee</NavBtn>
          <NavBtn color="#8b5cf6" onClick={() => onNavigate('signspeak')}>🤟 SignSpeak</NavBtn>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 56px', textAlign: 'center' }}>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '5px 14px', marginBottom: 28, animation: 'fadeIn 0.6s ease' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 2s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>AI-Powered Accessibility • 100% Free </span>
        </div>

        <h1 className="hero-title" style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800, lineHeight: 1.1,
          color: '#0f172a', marginBottom: 20, letterSpacing: -1.5,
        }}>
          AI Tools Built for<br />
          <span style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Everyone.</span>
        </h1>

        <p className="hero-sub" style={{
          fontSize: 18, color: '#64748b', lineHeight: 1.7,
          maxWidth: 520, margin: '0 auto 48px', fontWeight: 300,
        }}>
          Two powerful assistive tools — one for the visually impaired,
          one for the deaf — running entirely in your browser.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 64, flexWrap: 'wrap' }}>
          {[
            ['80+', 'Objects Detected', '0.1s'],
            ['26', 'ASL Letters', '0.2s'],
            ['24', 'Gestures', '0.25s'],
          ].map(([num, label, delay]) => (
            <div key={label} className="stat-item" style={{ animationDelay: delay, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 400 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Tool Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, textAlign: 'left' }}>

          {/* WeSee Card */}
          <div className="home-card card-1"
            onClick={() => onNavigate('wesee')}
            onMouseEnter={() => setHoveredCard('wesee')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: '#fff',
              borderRadius: 24,
              border: hoveredCard === 'wesee' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
              padding: '32px 28px',
              boxShadow: hoveredCard === 'wesee' ? '0 12px 40px rgba(59,130,246,0.15)' : '0 4px 16px rgba(0,0,0,0.06)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* BG accent */}
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
              }}>👁️</div>
              <span className="tag-pill" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                COCO-SSD
              </span>
            </div>

            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>WeSee</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 20 }}>
              Real-time object detection with voice feedback for visually impaired users. Detects people, furniture, vehicles, and 80+ objects.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {['Live Camera', 'Voice Alerts', 'Hazard Detection', 'EN/HI/MR'].map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 500 }}>{tag}</span>
              ))}
            </div>

            <button className="btn-primary" style={{
              width: '100%', padding: '13px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              Open WeSee <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>

          {/* SignSpeak Card */}
          <div className="home-card card-2"
            onClick={() => onNavigate('signspeak')}
            onMouseEnter={() => setHoveredCard('signspeak')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: '#fff',
              borderRadius: 24,
              border: hoveredCard === 'signspeak' ? '2px solid #8b5cf6' : '2px solid #e2e8f0',
              padding: '32px 28px',
              boxShadow: hoveredCard === 'signspeak' ? '0 12px 40px rgba(139,92,246,0.15)' : '0 4px 16px rgba(0,0,0,0.06)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
              }}>🤟</div>
              <span className="tag-pill" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                MediaPipe
              </span>
            </div>

            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>SignSpeak</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 20 }}>
              Real-time ASL hand gesture recognition that translates sign language letters into text and speech for seamless communication.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {['26 ASL Letters', '24 Gestures', 'Live Text', 'Text-to-Speech', 'Word Builder'].map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', fontWeight: 500 }}>{tag}</span>
              ))}
            </div>

            <button className="btn-primary" style={{
              width: '100%', padding: '13px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              Open SignSpeak <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: '#fff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '56px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>How it works</h3>
          <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', color: '#0f172a', marginBottom: 48, letterSpacing: -0.5 }}>Runs entirely in your browser</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32 }}>
            {[
              ['📷', 'Camera Input', 'Your device camera captures live video frames in real time'],
              ['🧠', 'AI Processing', 'COCO-SSD or MediaPipe runs locally — no server, no cloud'],
              ['📍', 'Detection', 'Objects or hand signs identified with position and distance'],
              ['🔊', 'Voice Output', 'Results spoken aloud in English, Hindi, or Marathi'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer-row" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          AccessAI is a free, open-source project . Built with ❤️ using React, TensorFlow.js, and MediaPipe. Designed to empower individuals with disabilities through AI-driven assistive tools that run entirely in the browser, ensuring privacy and accessibility for all.
        </p>
        <p style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
          © 2026 AccessAI. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

function NavBtn({ children, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: `1.5px solid ${color}20`,
      color, padding: '6px 14px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      transition: 'background 0.15s',
      fontFamily: "'DM Sans', sans-serif",
    }}
    onMouseEnter={e => e.target.style.background = color + '12'}
    onMouseLeave={e => e.target.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}
