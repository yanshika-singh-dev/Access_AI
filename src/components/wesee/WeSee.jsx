import { useState, useEffect, useRef, useCallback } from 'react'
import { useCamera } from '../../hooks/useCamera.js'
import { loadModel, detect, buildHazards, buildNavAdvice, resetSmoothing } from '../../utils/detector.js'
import { speak, speakLocked, preloadVoices, LANGUAGES, getSpeechRate } from '../../utils/speech.js'

const DIST_STYLE = {
  'very close': { bg:'#fef2f2', color:'#dc2626', dot:'#ef4444' },
  'close':      { bg:'#fff7ed', color:'#ea580c', dot:'#f97316' },
  'medium':     { bg:'#f0fdf4', color:'#16a34a', dot:'#22c55e' },
  'far':        { bg:'#eff6ff', color:'#2563eb', dot:'#3b82f6' },
}

const S = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes hazard { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.3)} 60%{box-shadow:0 0 0 12px rgba(239,68,68,0)} }
  .obj-card { transition: transform 0.2s; }
  .obj-card:hover { transform: translateY(-2px); }
  .tool-btn { transition: all 0.15s; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; }
  .tool-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
  .tool-btn:active:not(:disabled) { transform: translateY(0); }

  @media (max-width: 768px) {
    .main-grid { grid-template-columns: 1fr !important; }
    .right-col { margin-top: 0 !important; }
  }
`

export default function WeSee({ onBack }) {
  const [modelStatus, setModelStatus] = useState('loading')
  const [active, setActive]           = useState(false)
  const [autoMode, setAutoMode]       = useState(false)
  const [predictions, setPredictions] = useState([])
  const [hazards, setHazards]         = useState([])
  const [navAdvice, setNavAdvice]     = useState('')
  const [fps, setFps]                 = useState(0)
  const [lang, setLang]               = useState('en')
  const [threshold, setThreshold]     = useState(0.40)
  const [videoDims, setVideoDims]     = useState({ w:640, h:480 })

  const { videoRef, cameraReady, cameraError, startCamera, stopCamera, getVideoElement } = useCamera()
  const canvasRef     = useRef(null)
  const autoRef       = useRef(false)
  const animRef       = useRef(null)
  const isSpeakingRef = useRef(false)
  const lastSpeakRef  = useRef(0)
  const lastHazardRef = useRef(0)
  const fpsRef        = useRef({ count:0, ts:Date.now() })
  const threshRef     = useRef(threshold)

  useEffect(() => { threshRef.current = threshold }, [threshold])

  useEffect(() => {
    preloadVoices()
    loadModel(msg => setModelStatus(msg))
      .then(() => setModelStatus('ready'))
      .catch(e  => setModelStatus('error: ' + e.message))
    return () => { autoRef.current = false; if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const fn = () => setVideoDims({ w: v.videoWidth||640, h: v.videoHeight||480 })
    v.addEventListener('loadedmetadata', fn)
    return () => v.removeEventListener('loadedmetadata', fn)
  }, [videoRef])

  const trySpeak = useCallback((text, langCode) => {
    if (isSpeakingRef.current) return
    isSpeakingRef.current = true
    speakLocked(text, langCode,
      () => { isSpeakingRef.current = true },
      () => { isSpeakingRef.current = false }
    )
  }, [])

  const detectionLoop = useCallback(async () => {
    if (!autoRef.current) return
    const video = getVideoElement()
    if (!video || video.readyState < 2) { animRef.current = requestAnimationFrame(detectionLoop); return }

    try {
      const w = video.videoWidth||640, h = video.videoHeight||480
      const preds = await detect(video, w, h, threshRef.current)

      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0,0,w,h)
        preds.forEach(p => {
          const [x,y,bw,bh] = p.bbox
          const c = p._isHazard ? '#ef4444' : p._distance==='close'?'#f97316':p._distance==='medium'?'#22c55e':'#3b82f6'
          ctx.strokeStyle=c; ctx.lineWidth=p._isHazard?3:2
          ctx.strokeRect(x,y,bw,bh)
          const label=`${p.class} ${Math.round(p.score*100)}%`
          ctx.font=`bold ${Math.max(11,Math.min(14,bw/7))}px DM Sans,sans-serif`
          const tw=ctx.measureText(label).width
          ctx.fillStyle=c+'cc'; ctx.fillRect(x,y-20,tw+10,20)
          ctx.fillStyle='#fff'; ctx.fillText(label,x+5,y-5)
        })
      }

      setPredictions(preds)
      const hz = buildHazards(preds), adv = buildNavAdvice(preds)
      setHazards(hz); setNavAdvice(adv)

      const fc = fpsRef.current; fc.count++
      if (Date.now()-fc.ts>=1000){ setFps(Math.round(fc.count*1000/(Date.now()-fc.ts))); fc.count=0; fc.ts=Date.now() }

      const now=Date.now(), hasHz=hz.length>0
      if (hasHz && now-lastHazardRef.current>3000) {
        const desc = buildDesc(preds, lang, hz, adv)
        trySpeak(desc, LANGUAGES[lang].code)
        lastHazardRef.current=now; lastSpeakRef.current=now
      } else if (!hasHz && preds.length>0 && now-lastSpeakRef.current>6000) {
        trySpeak(buildDesc(preds,lang,[],adv), LANGUAGES[lang].code)
        lastSpeakRef.current=now
      }
    } catch(e) { console.warn(e) }

    animRef.current = requestAnimationFrame(detectionLoop)
  }, [getVideoElement, lang, trySpeak])

  const handleStart = useCallback(async () => {
    const ok = await startCamera('environment')
    if (ok) setActive(true)
  }, [startCamera])

  const handleStop = useCallback(() => {
    autoRef.current=false; setAutoMode(false)
    if (animRef.current) cancelAnimationFrame(animRef.current)
    stopCamera(); setActive(false)
    setPredictions([]); setHazards([]); setNavAdvice(''); setFps(0)
    resetSmoothing()
    const canvas=canvasRef.current; if(canvas){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height)}
  }, [stopCamera])

  const handleToggleAuto = useCallback(() => {
    if (autoRef.current) {
      autoRef.current=false; setAutoMode(false)
      if(animRef.current) cancelAnimationFrame(animRef.current)
      setPredictions([]); setHazards([]); setNavAdvice(''); setFps(0); resetSmoothing()
      const cv=canvasRef.current; if(cv){cv.getContext('2d').clearRect(0,0,cv.width,cv.height)}
    } else {
      autoRef.current=true; setAutoMode(true); detectionLoop()
    }
  }, [detectionLoop])

  const handleOnce = useCallback(async () => {
    const video = getVideoElement()
    if (!video||video.readyState<2) return
    try {
      const w=video.videoWidth||640,h=video.videoHeight||480
      const preds = await detect(video,w,h,threshRef.current)
      setPredictions(preds)
      const hz=buildHazards(preds),adv=buildNavAdvice(preds)
      setHazards(hz); setNavAdvice(adv)
      isSpeakingRef.current=false
      speak(buildDesc(preds,lang,hz,adv), LANGUAGES[lang].code)
    } catch(e){ console.error(e) }
  }, [getVideoElement, lang])

  const hasHazard  = hazards.length > 0
  const modelReady = modelStatus === 'ready'

  const deduped = predictions
    .reduce((acc,p)=>{ const ex=acc.find(a=>a.class===p.class); if(!ex||p.score>ex.score)return[...acc.filter(a=>a.class!==p.class),p]; return acc },[])
    .sort((a,b)=>{ if(a._isHazard!==b._isHazard)return a._isHazard?-1:1; const o={'very close':0,close:1,medium:2,far:3}; return(o[a._distance]??4)-(o[b._distance]??4) })

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{S}</style>

      {/* ── Top bar ── */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #e2e8f0',
        padding:'0 28px', height:56,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:50,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onBack} style={{ background:'#f1f5f9', border:'none', borderRadius:8, padding:'6px 12px', fontSize:13, color:'#64748b', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
            ← Back
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:30,height:30,borderRadius:8,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15 }}>👁️</div>
            <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:'#0f172a' }}>WeSee</span>
            <span style={{ fontSize:11,padding:'2px 8px',borderRadius:999,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',fontWeight:500 }}>COCO-SSD</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {cameraReady && <span style={{ fontSize:12,color:'#64748b' }}>FPS: <strong style={{color:'#3b82f6'}}>{fps}</strong></span>}
          <StatusDot ready={modelReady} label={modelReady?'Model Ready':'Loading…'} color="#3b82f6" />
          <select value={lang} onChange={e=>{setLang(e.target.value);speak('Language changed.',LANGUAGES[e.target.value].code)}}
            style={{ background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:8,padding:'5px 10px',fontSize:12,color:'#334155',cursor:'pointer' }}>
            {Object.entries(LANGUAGES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'20px 24px 48px' }}>

        {/* ── 2-column grid ── */}
        <div
          className="main-grid"
          style={{
            display:'grid',
            gridTemplateColumns:'minmax(0, 1.5fr) minmax(0, 1fr)',
            gap:20,
            alignItems:'start',
          }}
        >
          {/* ═══ LEFT COLUMN: camera + controls ═══ */}
          <div>
            {/* Camera panel */}
            <div style={{
              background:'#000', borderRadius:20, overflow:'hidden',
              position:'relative', marginBottom:14,
              border:`2px solid ${hasHazard?'#fca5a5':'#e2e8f0'}`,
              aspectRatio:'16/10',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover',display:active?'block':'none' }} />
              <canvas ref={canvasRef} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',display:autoMode?'block':'none' }} />

              {!active && (
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:40 }}>
                  <div style={{ width:64,height:64,borderRadius:20,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30 }}>👁️</div>
                  <p style={{ color:'#94a3b8',fontSize:14,textAlign:'center',maxWidth:280,lineHeight:1.6,margin:0 }}>
                    Point your camera at the environment to detect objects and receive voice guidance.
                  </p>
                  {modelReady
                    ? <button className="tool-btn" onClick={handleStart} style={{ background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'#fff',padding:'12px 28px',borderRadius:12,fontSize:14,fontWeight:600,boxShadow:'0 4px 14px rgba(59,130,246,.35)' }}>
                        📹 Start Camera
                      </button>
                    : <div style={{ fontSize:13,color:'#94a3b8',display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ width:7,height:7,borderRadius:'50%',background:'#f59e0b',display:'inline-block',animation:'pulse 1s infinite' }}/>
                        {modelStatus}
                      </div>
                  }
                </div>
              )}

              {active && !cameraReady && (
                <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)' }}>
                  <span style={{ color:'#fff',fontSize:14 }}>Starting camera…</span>
                </div>
              )}
            </div>

            {/* Controls */}
            {active && cameraReady && (
              <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap' }}>
                <button className="tool-btn" onClick={handleOnce} disabled={!modelReady}
                  style={{ flex:1,minWidth:120,padding:'12px 16px',borderRadius:12,background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'#fff',fontSize:14,fontWeight:600,boxShadow:'0 4px 14px rgba(59,130,246,.25)',opacity:!modelReady?.5:1 }}>
                  🔍 Detect Once
                </button>
                <button className="tool-btn" onClick={handleToggleAuto} disabled={!modelReady}
                  style={{ flex:1,minWidth:120,padding:'12px 16px',borderRadius:12,
                    background:autoMode?'linear-gradient(135deg,#10b981,#059669)':'#f1f5f9',
                    color:autoMode?'#fff':'#334155',fontSize:14,fontWeight:600,
                    boxShadow:autoMode?'0 4px 14px rgba(16,185,129,.25)':'none',border:'1px solid #e2e8f0',opacity:!modelReady?.5:1 }}>
                  {autoMode?'⏹ Stop Live':'▶ Live Detect'}
                </button>
                <button className="tool-btn" onClick={handleStop}
                  style={{ padding:'12px 16px',borderRadius:12,background:'#fff',border:'1px solid #fca5a5',color:'#ef4444',fontSize:14,fontWeight:600 }}>
                  ✕ Stop
                </button>
              </div>
            )}

            {/* Threshold slider */}
            {active && (
              <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'14px 16px' }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                  <span style={{ fontSize:13,color:'#64748b',fontWeight:500 }}>Detection Sensitivity</span>
                  <span style={{ fontSize:12,color:'#3b82f6',fontWeight:600 }}>
                    {threshold<=0.35?'High (more objects)':threshold<=0.50?'Balanced ✓':'Strict (accurate)'}
                  </span>
                </div>
                <input type="range" min="0.25" max="0.70" step="0.05" value={threshold}
                  onChange={e=>setThreshold(parseFloat(e.target.value))}
                  style={{ width:'100%',accentColor:'#3b82f6',height:4 }} />
              </div>
            )}

            {cameraError && <ErrorBox msg={cameraError} />}
          </div>

          {/* ═══ RIGHT COLUMN: hazard + info + objects ═══ */}
          <div className="right-col" style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Hazard banner */}
            {hasHazard && (
              <div style={{ background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:16,padding:'14px 18px',animation:'hazard 2s infinite,fadeUp .3s ease' }} role="alert">
                <div style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>⚠️</div>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:'#dc2626',marginBottom:4 }}>Hazard Detected</div>
                    {hazards.map((h,i)=><div key={i} style={{fontSize:13,color:'#991b1b'}}>• {h}</div>)}
                  </div>
                </div>
              </div>
            )}

            {/* Nav advice */}
            {navAdvice && (
              <div style={{ background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 16px',display:'flex',gap:10,alignItems:'center' }}>
                <span style={{ fontSize:20 }}>🧭</span>
                <span style={{ fontSize:14,color:'#1d4ed8',fontWeight:500 }}>{navAdvice}</span>
              </div>
            )}

            {/* Object cards */}
            {deduped.length > 0 && (
              <div style={{ animation:'fadeUp .4s ease' }}>
                <div style={{ fontSize:12,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10 }}>
                  Detected Objects ({deduped.length})
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10 }}>
                  {deduped.map((obj,i)=>{
                    const ds=DIST_STYLE[obj._distance]||{bg:'#f1f5f9',color:'#64748b',dot:'#94a3b8'}
                    return (
                      <div key={i} className="obj-card" style={{ background:'#fff',border:`1.5px solid ${obj._isHazard?'#fca5a5':'#e2e8f0'}`,borderRadius:14,padding:'12px 14px',position:'relative',overflow:'hidden' }}>
                        {obj._isHazard && <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#ef4444,#f97316)' }} />}
                        <div style={{ fontSize:13,fontWeight:600,color:obj._isHazard?'#dc2626':'#0f172a',marginBottom:8,textTransform:'capitalize' }}>
                          {obj._isHazard?'⚠️ ':''}{obj.class}
                        </div>
                        <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                          <span style={{ fontSize:10,padding:'2px 8px',borderRadius:999,background:ds.bg,color:ds.color,fontWeight:600,display:'flex',alignItems:'center',gap:3 }}>
                            <span style={{ width:5,height:5,borderRadius:'50%',background:ds.dot,display:'inline-block' }} />
                            {obj._distance}
                          </span>
                          <span style={{ fontSize:10,padding:'2px 8px',borderRadius:999,background:'#f1f5f9',color:'#64748b' }}>{obj._position}</span>
                          <span style={{ fontSize:10,padding:'2px 8px',borderRadius:999,background:'#f1f5f9',color:'#94a3b8' }}>{Math.round(obj.score*100)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button className="tool-btn" onClick={()=>speak(buildDesc(predictions,lang,hazards,navAdvice),LANGUAGES[lang].code)}
                  style={{ marginTop:12,width:'100%',padding:'11px',borderRadius:12,background:'#f1f5f9',border:'1px solid #e2e8f0',color:'#3b82f6',fontSize:13,fontWeight:600 }}>
                  🔊 Replay Audio
                </button>
              </div>
            )}

            {active && autoMode && deduped.length===0 && modelReady && (
              <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'32px 20px',textAlign:'center' }}>
                <div style={{ fontSize:36,marginBottom:10 }}>👀</div>
                <div style={{ color:'#64748b',fontSize:14 }}>No objects detected yet.</div>
                <div style={{ color:'#94a3b8',fontSize:12,marginTop:6 }}>Try moving closer or sliding sensitivity left.</div>
              </div>
            )}

            {/* Empty state when camera not active */}
            {!active && (
              <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'32px 24px',textAlign:'center' }}>
                <div style={{ fontSize:40,marginBottom:12 }}>🗺️</div>
                <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:'#0f172a',marginBottom:8 }}>Detection Results</div>
                <div style={{ fontSize:13,color:'#94a3b8',lineHeight:1.6 }}>Start the camera and detected objects will appear here with distance and position info.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function buildDesc(preds, lang, hz, adv) {
  if (!preds?.length) return lang==='hi'?'कोई वस्तु नहीं मिली।':lang==='mr'?'कोणतीही वस्तू आढळली नाही.':'No objects detected.'
  const best={}; preds.forEach(p=>{if(!best[p.class]||p.score>best[p.class].score)best[p.class]=p})
  const unique=Object.values(best), close=unique.filter(p=>p._isHazard), others=unique.filter(p=>!p._isHazard)
  const parts=[]
  if(hz.length) parts.push(lang==='hi'?`सावधान। ${hz.join('. ')}`:lang==='mr'?`सावधान. ${hz.join('. ')}`:`Warning. ${hz.join('. ')}`)
  close.forEach(p=>parts.push(lang==='hi'?`${p.class} बहुत पास है`:lang==='mr'?`${p.class} खूप जवळ आहे`:`${p.class} is very close on your ${p._position}`))
  if(others.length) parts.push(lang==='hi'?`मैं देख रहा हूँ: ${others.map(p=>p.class).join(', ')}`:lang==='mr'?`मला दिसत आहे: ${others.map(p=>p.class).join(', ')}`:`I can see: ${others.map(p=>p.class).join(', ')}`)
  if(adv) parts.push(adv)
  return parts.join('. ')+'.'
}

function StatusDot({ ready, label, color }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#64748b' }}>
      <span style={{ width:7,height:7,borderRadius:'50%',background:ready?color:'#f59e0b',display:'inline-block',animation:ready?'none':'pulse 1.5s infinite' }} />
      {label}
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:12,padding:'12px 16px',color:'#dc2626',fontSize:13,marginTop:14 }}>
      ⚠️ {msg}
    </div>
  )
}