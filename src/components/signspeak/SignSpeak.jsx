import { useState, useEffect, useRef, useCallback } from 'react'
import { classifyGesture, classifyLetter, GESTURE_LIST, LETTER_LIST, isLetterModelReady, isGestureModelReady } from '../../utils/asl.js'
import { speak, preloadVoices } from '../../utils/speech.js'
import { initHands, drawHand } from '../../utils/mediapipe.js'

const F1F5 = '#f1f5f9'

const S = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pop    { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.2} }
  .pop     { animation: pop 0.25s cubic-bezier(.34,1.56,.64,1) both; }
  .fade-up { animation: fadeUp 0.3s ease both; }
  .tool-btn { transition:all .15s; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
  .tool-btn:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.08); }
  .mode-btn { transition:all .2s; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px; padding:8px 18px; border-radius:10px; }
  .key-btn  { transition:all .1s; border:1px solid #ddd6fe; cursor:pointer; font-family:'Syne',sans-serif; font-weight:800; border-radius:8px; background:#f5f3ff; color:#7c3aed; font-size:15px; padding:8px 6px; width:40px; text-align:center; }
  .key-btn:hover { background:#ede9fe; transform:scale(1.08); }
  .key-btn:active { transform:scale(0.94); }
`

const HOLD_MS_GESTURE = 1500
const HOLD_MS_LETTER  = 1200
const COOLDOWN_MS     = 2000
const SPACE_MS        = 2500

const MODES = {
  gesture: { label:'Gesture', icon:'🤟', accent:'#7c3aed', light:'#f5f3ff', border:'#ddd6fe', grad:'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  letter:  { label:'Letter',  icon:'🔤', accent:'#0369a1', light:'#eff6ff', border:'#bfdbfe', grad:'linear-gradient(135deg,#3b82f6,#0369a1)' },
}

const KEYBOARD_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ']

export default function SignSpeak({ onBack }) {
  const [mode, setMode]                 = useState('gesture')
  const [active, setActive]             = useState(false)
  const [currentSign, setCurrentSign]   = useState(null)
  const [history, setHistory]           = useState([])
  const [letterBuf, setLetterBuf]       = useState('')
  const [handPresent, setHandPresent]   = useState(false)
  const [mpStatus, setMpStatus]         = useState('idle')
  const [holdProgress, setHoldProgress] = useState(0)
  const [cooldown, setCooldown]         = useState(false)
  const [showGuide, setShowGuide]       = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [videoReady, setVideoReady]     = useState(false)
  const [camError, setCamError]         = useState('')
  const [debugInfo, setDebugInfo]       = useState(null)
  const [showDebug, setShowDebug]       = useState(false)
  const [modelStatus, setModelStatus]   = useState('loading')

  const videoRef      = useRef(null)
  const streamRef     = useRef(null)
  const canvasRef     = useRef(null)
  const handsRef      = useRef(null)
  const loopRef       = useRef(false)
  const holdRef       = useRef({ label:'', startTime:0, committed:false })
  const cooldownRef   = useRef(false)
  const cooldownTimer = useRef(null)
  const lastHandRef   = useRef(0)
  const spaceRef      = useRef(false)
  const historyRef    = useRef([])
  const letterBufRef  = useRef('')
  const modeRef       = useRef('gesture')

  useEffect(() => { historyRef.current = history }, [history])
  useEffect(() => { letterBufRef.current = letterBuf }, [letterBuf])
  useEffect(() => { modeRef.current = mode }, [mode])

  // Poll for model load status from asl.js
  useEffect(() => {
    const check = setInterval(() => {
      // classifyLetter returns null if model not loaded, non-null if ready
      // We detect readiness by checking the module-level flags via a dummy call
      // asl.js exposes modelError indirectly — if it errors, status = error
      // check both models
      // If no error thrown, model is either loading or ready
      // We check window flag set by asl.js console messages
      if (isLetterModelReady() && isGestureModelReady()) {
        setModelStatus('ready')
        clearInterval(check)
      }
    }, 500)

    // Also listen for the console log from asl.js
    const origLog = console.log
    console.log = (...args) => {
      origLog(...args)
      if (args[0]?.includes?.('ASL ML model loaded')) {
        setModelStatus('ready')
        window._aslModelReady = true
      }
    }
    const origErr = console.error
    console.error = (...args) => {
      origErr(...args)
      if (args[0]?.includes?.('Failed to load ASL model')) {
        setModelStatus('error')
      }
    }

    return () => {
      clearInterval(check)
      console.log = origLog
      console.error = origErr
    }
  }, [])

  const M = MODES[mode]

  const addToOutput = useCallback((label, emoji) => {
    if (modeRef.current === 'gesture') {
      setHistory(prev => [...prev, { word: label, emoji, id: Date.now() }])
      speak(label, 'en-US', 0.85)
    } else {
      setLetterBuf(prev => { const n = prev + label; letterBufRef.current = n; return n })
      speak(label, 'en-US', 1.0)
    }
  }, [])

  const confirmSign = useCallback((label, emoji) => {
    holdRef.current.committed = true
    addToOutput(label, emoji)
    cooldownRef.current = true
    setCooldown(true)
    holdRef.current = { label:'', startTime:0, committed:false }
    setHoldProgress(0)
    setCurrentSign(null)
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(() => {
      cooldownRef.current = false
      setCooldown(false)
    }, COOLDOWN_MS)
  }, [addToOutput])

  const handleKeyPress = useCallback((char) => {
    setLetterBuf(prev => { const n = prev + char; letterBufRef.current = n; return n })
    speak(char, 'en-US', 1.0)
  }, [])

  useEffect(() => {
    preloadVoices()
    setMpStatus('loading')

    const onResults = async (results) => {
      const canvas = canvasRef.current
      const video  = videoRef.current
      if (!canvas || !video) return

      const w = video.videoWidth  || 640
      const h = video.videoHeight || 480
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, w, h)

      const hasHand = results.multiHandLandmarks?.length > 0

      if (hasHand) {
        const lm = results.multiHandLandmarks[0]
        setHandPresent(true)
        lastHandRef.current = Date.now()
        spaceRef.current    = false
        drawHand(ctx, lm)

        if (cooldownRef.current) { setCurrentSign(null); setHoldProgress(0); return }

        const result = modeRef.current === 'gesture'
          ? classifyGesture(lm)
          : classifyLetter(lm)

        setCurrentSign(result)
        if (result) setDebugInfo({ label: result.word || result.char, conf: result.confidence })

        const holdMs = modeRef.current === 'letter' ? HOLD_MS_LETTER : HOLD_MS_GESTURE
        const now = Date.now()

        if (result) {
          const label = result.word || result.char
          const emoji = result.emoji || ''
          if (holdRef.current.label !== label) {
            holdRef.current = { label, startTime: now, committed: false }
            setHoldProgress(0)
          } else if (!holdRef.current.committed) {
            const elapsed = now - holdRef.current.startTime
            setHoldProgress(Math.min(100, Math.round(elapsed / holdMs * 100)))
            if (elapsed >= holdMs) confirmSign(label, emoji)
          }
        } else {
          holdRef.current = { label:'', startTime:0, committed:false }
          setHoldProgress(0)
        }
      } else {
        setHandPresent(false)
        setCurrentSign(null)
        holdRef.current = { label:'', startTime:0, committed:false }
        setHoldProgress(0)

        const timeSince = Date.now() - lastHandRef.current
        if (timeSince > SPACE_MS && !spaceRef.current) {
          spaceRef.current = true
          if (modeRef.current === 'gesture' && historyRef.current.length > 0) {
            setHistory(prev => {
              if (prev.length && prev[prev.length-1].word === ' ') return prev
              return [...prev, { word:' ', emoji:'', id:Date.now() }]
            })
          } else if (modeRef.current === 'letter' && letterBufRef.current.length > 0) {
            setLetterBuf(prev => prev.endsWith(' ') ? prev : prev + ' ')
          }
        }
      }
    }

    initHands(onResults)
      .then(hands => { handsRef.current = hands; setMpStatus('ready') })
      .catch(e    => setMpStatus('error: ' + e.message))

    return () => {
      loopRef.current = false
      handsRef.current = null
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
    }
  }, [confirmSign])

  const startLoop = useCallback(() => {
    loopRef.current = true
    const run = async () => {
      if (!loopRef.current) return
      const v = videoRef.current, h = handsRef.current
      if (v && h && v.readyState >= 2) { try { await h.send({ image: v }) } catch(e) {} }
      if (loopRef.current) requestAnimationFrame(run)
    }
    requestAnimationFrame(run)
  }, [])

  const handleStart = useCallback(async () => {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:{ ideal:'user' }, width:{ ideal:1280 }, height:{ ideal:720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.onloadedmetadata = () => { video.play(); setVideoReady(true); setActive(true); startLoop() }
      }
    } catch(e) {
      setCamError(e.name==='NotAllowedError' ? 'Camera access denied.' : 'Camera error: ' + e.message)
    }
  }, [startLoop])

  const handleStop = useCallback(() => {
    loopRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false); setVideoReady(false)
    setCurrentSign(null); setHandPresent(false); setHoldProgress(0)
    setCooldown(false); cooldownRef.current = false
    holdRef.current = { label:'', startTime:0, committed:false }
    const cv = canvasRef.current
    if (cv) cv.getContext('2d').clearRect(0,0,cv.width,cv.height)
  }, [])

  const switchMode = useCallback((newMode) => {
    if (active) handleStop()
    setMode(newMode)
    setHistory([]); setLetterBuf(''); setCurrentSign(null)
    setHoldProgress(0); setCooldown(false); cooldownRef.current = false
    setShowKeyboard(false)
  }, [active, handleStop])

  const sentenceText = mode === 'gesture'
    ? history.map(h => h.word).join(' ').replace(/\s+/g,' ').trim()
    : letterBuf.trim()

  const mpReady   = mpStatus === 'ready'
  const mpLoading = mpStatus === 'loading'
  const signLabel = currentSign ? (mode === 'gesture' ? currentSign.word : currentSign.char) : null
  const signEmoji = currentSign ? currentSign.emoji : null

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{S}</style>

      {/* Top bar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onBack} style={{ background:F1F5, border:'none', borderRadius:8, padding:'6px 12px', fontSize:13, color:'#64748b', cursor:'pointer' }}>← Back</button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:30,height:30,borderRadius:8,background:M.grad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15 }}>🤟</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color:'#0f172a' }}>SignSpeak</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {mode === 'letter' && (
            <span style={{
              fontSize:11, padding:'2px 8px', borderRadius:6, fontWeight:600,
              background: modelStatus==='ready' ? '#dcfce7' : modelStatus==='error' ? '#fef2f2' : '#fef9c3',
              color:      modelStatus==='ready' ? '#15803d' : modelStatus==='error' ? '#dc2626' : '#92400e',
            }}>
              {modelStatus==='ready' ? '● ML active (letters + gestures)' : modelStatus==='error' ? '⚠ Model failed' : '⏳ Loading model…'}
            </span>
          )}
          {active && mode === 'letter' && (
            <button className="tool-btn" onClick={() => setShowDebug(v=>!v)}
              style={{ padding:'4px 10px', borderRadius:6, background: showDebug ? '#fef9c3' : F1F5, border:'1px solid #e2e8f0', color:'#64748b', fontSize:11 }}>
              {showDebug ? '🔍 Debug ON' : '🔍 Debug'}
            </button>
          )}
          <span style={{ width:7,height:7,borderRadius:'50%', background:mpReady?M.accent:mpLoading?'#f59e0b':'#ef4444', display:'inline-block', animation:mpReady?'none':'pulse 1.5s infinite' }} />
          <span style={{ fontSize:12, color:'#64748b' }}>{mpReady?'Ready':mpLoading?'Loading…':mpStatus}</span>
        </div>
      </div>

      <div style={{ maxWidth:800, margin:'0 auto', padding:'16px 16px 40px' }}>
        <div style={{ display:'flex', gap:6, marginBottom:14, background:F1F5, borderRadius:12, padding:3 }}>
          {Object.entries(MODES).map(([key, cfg]) => (
            <button key={key} className="mode-btn" onClick={() => switchMode(key)}
              style={{ flex:1, background:mode===key?'#fff':'transparent', color:mode===key?cfg.accent:'#64748b', boxShadow:mode===key?'0 1px 4px rgba(0,0,0,0.08)':'none', border:mode===key?`1px solid ${cfg.border}`:'1px solid transparent' }}>
              {cfg.icon} {cfg.label} Mode
            </button>
          ))}
        </div>

        <div style={{ background:M.light, border:`1px solid ${M.border}`, borderRadius:10, padding:'9px 14px', marginBottom:12, fontSize:13, color:M.accent }}>
          {mode === 'gesture'
            ? '🤟 Hold each gesture steady — confirms after 1.5 seconds'
            : '🔤 Hold each letter steady for 0.9s — use the keyboard below if a letter is missed'}
        </div>

        {mpLoading && (
          <div style={{ background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:10,padding:'12px 14px',marginBottom:12,display:'flex',gap:10,alignItems:'center' }}>
            <span style={{ width:8,height:8,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1s infinite',display:'inline-block',flexShrink:0 }} />
            <div>
              <div style={{ fontSize:14,color:'#6d28d9',fontWeight:600 }}>Loading MediaPipe Hands…</div>
              <div style={{ fontSize:12,color:'#7c3aed',marginTop:1 }}>~8 MB download, cached after first load</div>
            </div>
          </div>
        )}
        {mpStatus.startsWith('error') && (
          <div style={{ background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:10,padding:'12px 14px',marginBottom:12 }}>
            <div style={{ fontSize:14,color:'#dc2626',fontWeight:600 }}>⚠️ MediaPipe Failed</div>
            <div style={{ fontSize:12,color:'#991b1b',marginTop:3 }}>{mpStatus}</div>
          </div>
        )}
        {camError && (
          <div style={{ background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:10,padding:'10px 14px',marginBottom:12,color:'#dc2626',fontSize:13 }}>
            ⚠️ {camError}
          </div>
        )}

        <div style={{ background:'#1e1b4b',borderRadius:20,overflow:'hidden',position:'relative',marginBottom:12,aspectRatio:'4/3',display:'flex',alignItems:'center',justifyContent:'center',maxHeight:420 }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)',display:videoReady?'block':'none' }} />
          <canvas ref={canvasRef}
            style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',transform:'scaleX(-1)',display:videoReady?'block':'none' }} />

          {!active && (
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:32 }}>
              <div style={{ width:60,height:60,borderRadius:18,background:M.grad,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28 }}>{M.icon}</div>
              <p style={{ color:'#a5b4fc',fontSize:13,textAlign:'center',maxWidth:280,lineHeight:1.7,margin:0 }}>
                {mode==='gesture' ? 'Show hand gestures to detect words' : 'Finger-spell letters A–Z'}
              </p>
              {mpReady
                ? <button className="tool-btn" onClick={handleStart}
                    style={{ background:M.grad,color:'#fff',padding:'11px 24px',borderRadius:12,fontSize:14,fontWeight:600 }}>
                    📹 Start Camera
                  </button>
                : <div style={{ fontSize:12,color:'#a5b4fc',display:'flex',gap:5,alignItems:'center' }}>
                    <span style={{ width:7,height:7,borderRadius:'50%',background:'#f59e0b',animation:'pulse 1s infinite',display:'inline-block' }} />
                    {mpLoading ? 'Loading model…' : mpStatus}
                  </div>
              }
            </div>
          )}

          {active && !videoReady && (
            <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)' }}>
              <span style={{ fontSize:14,color:'#fff' }}>Starting camera…</span>
            </div>
          )}

          {videoReady && currentSign && !cooldown && (
            <div key={signLabel} className="pop"
              style={{ position:'absolute',top:14,left:14,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)',borderRadius:16,padding:'12px 18px',textAlign:'center',minWidth:120,border:`2px solid ${M.accent}` }}>
              {mode==='letter'
                ? <div style={{ fontFamily:"'Syne',sans-serif",fontSize:50,fontWeight:800,color:'#fff',lineHeight:1 }}>{signLabel}</div>
                : <>
                    <div style={{ fontSize:32,marginBottom:3 }}>{signEmoji}</div>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:'#fff' }}>{signLabel}</div>
                  </>
              }
              <div style={{ marginTop:8,height:5,background:'rgba(255,255,255,0.15)',borderRadius:999,overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${holdProgress}%`,background:M.accent,borderRadius:999,transition:'width 0.08s linear' }} />
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.6)',marginTop:3 }}>
                {holdProgress < 100 ? `${Math.round(holdProgress)}%` : '✓'}
              </div>
            </div>
          )}

          {videoReady && cooldown && (
            <div style={{ position:'absolute',top:14,left:14,background:'rgba(16,185,129,0.88)',backdropFilter:'blur(6px)',borderRadius:14,padding:'10px 16px',textAlign:'center' }}>
              <div style={{ fontSize:20 }}>✅</div>
              <div style={{ fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,color:'#fff',marginTop:1 }}>Added!</div>
            </div>
          )}

          {videoReady && (
            <div style={{ position:'absolute',top:14,right:14,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',borderRadius:10,padding:'5px 10px',display:'flex',alignItems:'center',gap:5 }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:handPresent?'#22c55e':'#f59e0b',display:'inline-block',animation:handPresent?'none':'blink 1s infinite' }} />
              <span style={{ fontSize:11,color:'#fff' }}>{handPresent ? 'Hand detected' : 'Show your hand'}</span>
            </div>
          )}

          {videoReady && mode==='letter' && letterBuf && (
            <div style={{ position:'absolute',bottom:12,left:12,right:12,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',borderRadius:10,padding:'6px 12px',display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:10,color:'rgba(255,255,255,0.45)',flexShrink:0 }}>Spelling:</span>
              <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:'#fff',letterSpacing:'0.08em',wordBreak:'break-all' }}>{letterBuf}</span>
            </div>
          )}

          {videoReady && showDebug && debugInfo && (
            <div style={{ position:'absolute',bottom:12,right:12,background:'rgba(0,0,0,0.8)',borderRadius:8,padding:'4px 10px',fontSize:11,color:'#fde68a' }}>
              {debugInfo.label} ({Math.round((debugInfo.conf||0)*100)}%)
            </div>
          )}
        </div>

        {active && (
          <div style={{ marginBottom:12 }}>
            <button className="tool-btn" onClick={handleStop}
              style={{ padding:'10px 18px',borderRadius:12,background:'#fff',border:'1px solid #fca5a5',color:'#ef4444',fontSize:13,fontWeight:600 }}>
              ✕ Stop Camera
            </button>
          </div>
        )}

        <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:18,padding:'18px',marginBottom:12 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8 }}>
            <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'#0f172a' }}>
              {mode==='gesture' ? '💬 Detected Words' : '🔤 Spelled Text'}
            </div>
            <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
              {mode==='letter' && (
                <button className="tool-btn" onClick={() => setShowKeyboard(v=>!v)}
                  style={{ padding:'5px 10px',borderRadius:8,background:showKeyboard?M.light:F1F5,color:M.accent,border:`1px solid ${M.border}`,fontSize:11,fontWeight:600 }}>
                  ⌨️ Keyboard
                </button>
              )}
              {mode==='gesture'
                ? <button className="tool-btn" onClick={()=>setHistory(p=>p.slice(0,-1))}
                    style={{ padding:'5px 10px',borderRadius:8,background:F1F5,color:'#64748b',fontSize:11,fontWeight:500 }}>⌫ Undo</button>
                : <button className="tool-btn" onClick={()=>setLetterBuf(p=>p.slice(0,-1))}
                    style={{ padding:'5px 10px',borderRadius:8,background:F1F5,color:'#64748b',fontSize:11,fontWeight:500 }}>⌫</button>
              }
              {mode==='letter' && (
                <button className="tool-btn" onClick={()=>setLetterBuf(p=>p+' ')}
                  style={{ padding:'5px 10px',borderRadius:8,background:M.light,color:M.accent,border:`1px solid ${M.border}`,fontSize:11,fontWeight:500 }}>␣</button>
              )}
              <button className="tool-btn"
                onClick={()=>{ mode==='gesture' ? setHistory([]) : setLetterBuf('') }}
                style={{ padding:'5px 10px',borderRadius:8,background:'#fef2f2',color:'#ef4444',fontSize:11,fontWeight:500 }}>✕ Clear</button>
            </div>
          </div>

          {mode==='gesture' ? (
            <div style={{ minHeight:48,background:'#f8fafc',borderRadius:12,padding:'10px 12px',marginBottom:10,display:'flex',flexWrap:'wrap',gap:7,alignItems:'center' }}>
              {history.length===0
                ? <span style={{ color:'#94a3b8',fontSize:13 }}>Hold a gesture to add a word…</span>
                : history.map((h,i) =>
                    h.word===' '
                      ? <span key={i} style={{ width:6 }} />
                      : <span key={i} className="fade-up" style={{ display:'inline-flex',alignItems:'center',gap:4,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:M.accent,background:M.light,borderRadius:8,padding:'4px 10px',border:`1px solid ${M.border}` }}>
                          {h.emoji} {h.word}
                        </span>
                  )
              }
            </div>
          ) : (
            <div style={{ minHeight:48,background:'#f8fafc',borderRadius:12,padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center' }}>
              {letterBuf
                ? <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:M.accent,letterSpacing:'0.06em',wordBreak:'break-all' }}>
                    {letterBuf}
                    <span style={{ borderRight:`3px solid ${M.accent}`,height:'1.1em',display:'inline-block',marginLeft:1,animation:'blink 1s infinite',verticalAlign:'text-bottom' }} />
                  </span>
                : <span style={{ color:'#94a3b8',fontSize:13 }}>Hold each letter for {HOLD_MS_LETTER/1000}s — pause hand to add a space</span>
              }
            </div>
          )}

          {showKeyboard && mode==='letter' && (
            <div style={{ background:M.light,borderRadius:12,padding:'12px',marginBottom:10,border:`1px solid ${M.border}` }}>
              <div style={{ fontSize:11,color:M.accent,fontWeight:600,marginBottom:8 }}>⌨️ Tap to type manually</div>
              {KEYBOARD_ROWS.map((row,ri) => (
                <div key={ri} style={{ display:'flex',gap:5,marginBottom:5,flexWrap:'wrap' }}>
                  {row.split('').map(char => (
                    <button key={char} className="key-btn" onClick={() => handleKeyPress(char)}>{char}</button>
                  ))}
                </div>
              ))}
              <div style={{ display:'flex',gap:5,marginTop:4 }}>
                <button className="tool-btn" onClick={()=>setLetterBuf(p=>p+' ')}
                  style={{ padding:'6px 16px',borderRadius:8,background:'#ede9fe',color:M.accent,border:`1px solid ${M.border}`,fontSize:12,fontWeight:600 }}>Space</button>
                <button className="tool-btn" onClick={()=>setLetterBuf(p=>p.slice(0,-1))}
                  style={{ padding:'6px 14px',borderRadius:8,background:F1F5,color:'#64748b',border:'1px solid #e2e8f0',fontSize:12,fontWeight:600 }}>⌫ Del</button>
              </div>
            </div>
          )}

          {sentenceText && (
            <div style={{ background:M.light,borderRadius:10,padding:'10px 14px',marginBottom:10,fontFamily:"'Syne',sans-serif",fontSize:17,fontWeight:700,color:M.accent,lineHeight:1.5 }}>
              {sentenceText}
            </div>
          )}

          <button className="tool-btn"
            onClick={()=>{ if(sentenceText) speak(sentenceText,'en-US',0.78) }}
            disabled={!sentenceText}
            style={{ width:'100%',padding:'11px',borderRadius:12,background:sentenceText?M.grad:F1F5,color:sentenceText?'#fff':'#94a3b8',fontSize:14,fontWeight:600 }}>
            🔊 Speak All
          </button>
        </div>

        <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'16px 18px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',marginBottom:showGuide?12:0 }}
            onClick={()=>setShowGuide(v=>!v)}>
            <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:'#0f172a' }}>
              {mode==='gesture' ? `📖 All Gestures (${GESTURE_LIST.length})` : '📖 ASL Alphabet Reference'}
            </div>
            <span style={{ fontSize:12,color:'#94a3b8' }}>{showGuide ? '▲' : '▼'}</span>
          </div>

          {showGuide && mode==='gesture' && (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:8 }}>
              {GESTURE_LIST.map(g => (
                <div key={g.word} style={{ background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'9px 11px',display:'flex',gap:8,alignItems:'flex-start' }}>
                  <span style={{ fontSize:20,flexShrink:0 }}>{g.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:11,color:'#0f172a' }}>{g.word}</div>
                    <div style={{ fontSize:10,color:'#64748b',marginTop:1,lineHeight:1.4 }}>{g.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showGuide && mode==='letter' && (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:8 }}>
              {LETTER_LIST.map(l => (
                <div key={l.char} style={{ background:M.light,border:`1px solid ${M.border}`,borderRadius:10,padding:'9px 11px',display:'flex',gap:8,alignItems:'flex-start' }}>
                  <span style={{ fontSize:20,flexShrink:0 }}>{l.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:M.accent }}>{l.char}</div>
                    <div style={{ fontSize:10,color:'#475569',marginTop:1,lineHeight:1.4 }}>{l.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}