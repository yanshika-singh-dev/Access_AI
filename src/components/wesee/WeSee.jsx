import { useState, useEffect, useRef, useCallback } from 'react'
import { useCamera } from '../../hooks/useCamera.js'
import { loadModel, detect, buildHazards, buildNavAdvice, resetSmoothing } from '../../utils/detector.js'
import { speak, speakLocked, preloadVoices, LANGUAGES, getSpeechRate } from '../../utils/speech.js'

const DIST_STYLE = {
  'very close': { bg:'#fef2f2', color:'#dc2626', dot:'#ef4444', label:'Very Close' },
  'close':      { bg:'#fff7ed', color:'#ea580c', dot:'#f97316', label:'Close' },
  'medium':     { bg:'#f0fdf4', color:'#16a34a', dot:'#22c55e', label:'Medium' },
  'far':        { bg:'#eff6ff', color:'#2563eb', dot:'#3b82f6', label:'Far' },
}

const S = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes hazard { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.25)} 60%{box-shadow:0 0 0 14px rgba(239,68,68,0)} }
  @keyframes scanLine { 0%{top:0%} 100%{top:100%} }

  .obj-card {
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: default;
  }
  .obj-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }

  .tool-btn {
    transition: all 0.15s cubic-bezier(.34,1.56,.64,1);
    border: none; cursor: pointer;
    font-family: 'Space Grotesk', 'DM Sans', sans-serif;
    font-weight: 600;
  }
  .tool-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
  .tool-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
  .tool-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .back-btn {
    transition: background 0.15s, color 0.15s;
    font-family: 'Space Grotesk', 'DM Sans', sans-serif;
  }
  .back-btn:hover { background: #e2e8f0 !important; color: #0f172a !important; }

  .scan-line {
    position: absolute; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent);
    animation: scanLine 2.5s ease-in-out infinite;
    pointer-events: none;
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
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:"'Space Grotesk','DM Sans',sans-serif" }}>
      <style>{S}</style>

      {/* ── Top Bar ── */}
      <div style={{
        background:'rgba(255,255,255,0.9)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid #e2e8f0',
        padding:'0 20px', height:60,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:50,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} className="back-btn" style={{
            background:'#f1f5f9', border:'none', borderRadius:9, padding:'7px 13px',
            fontSize:13, color:'#64748b', cursor:'pointer',
            display:'flex', alignItems:'center', gap:5, fontWeight:500,
          }}>
            ← Back
          </button>
          <div style={{ width:1, height:24, background:'#e2e8f0', margin:'0 2px' }} />
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#60a5fa,#2563eb)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,boxShadow:'0 3px 10px rgba(59,130,246,0.3)' }}>👁️</div>
            <span style={{ fontWeight:700,fontSize:16,color:'#0f172a',letterSpacing:-0.3 }}>WeSee</span>
            <span style={{ fontSize:10,padding:'3px 9px',borderRadius:999,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',fontWeight:600,letterSpacing:0.3,textTransform:'uppercase' }}>COCO-SSD</span>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {cameraReady && autoMode && (
            <div style={{ display:'flex',alignItems:'center',gap:5,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:999,padding:'4px 10px' }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:'#22c55e',display:'inline-block',animation:'pulse 1s infinite' }}/>
              <span style={{ fontSize:11,color:'#16a34a',fontWeight:600 }}>{fps} FPS</span>
            </div>
          )}
          <StatusDot ready={modelReady} label={modelReady?'Ready':'Loading…'} color="#3b82f6" />
          <select value={lang} onChange={e=>{setLang(e.target.value);speak('Language changed.',LANGUAGES[e.target.value].code)}}
            style={{ background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,padding:'6px 10px',fontSize:12,color:'#334155',cursor:'pointer',fontFamily:'inherit',fontWeight:500 }}>
            {Object.entries(LANGUAGES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth:820,margin:'0 auto',padding:'20px 16px 48px' }}>

        {/* Hazard Banner */}
        {hasHazard && (
          <div style={{ background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:16,padding:'14px 18px',marginBottom:16,animation:'hazard 2s infinite,fadeUp .3s ease' }} role="alert">
            <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
              <div style={{ width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#ef4444,#dc2626)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,boxShadow:'0 4px 12px rgba(239,68,68,0.35)' }}>⚠️</div>
              <div>
                <div style={{ fontWeight:700,fontSize:13,color:'#dc2626',marginBottom:5,letterSpacing:0.3,textTransform:'uppercase' }}>Hazard Detected</div>
                {hazards.map((h,i)=><div key={i} style={{fontSize:13,color:'#991b1b',marginTop:2}}>• {h}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* Camera Panel */}
        <div style={{
          background:'#0a0a0a', borderRadius:20, overflow:'hidden',
          position:'relative', marginBottom:14,
          border:`2px solid ${hasHazard?'#fca5a5':autoMode?'rgba(59,130,246,0.4)':'#1e293b'}`,
          aspectRatio:'16/9',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: autoMode ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
          transition: 'border-color 0.3s, box-shadow 0.3s',
        }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover',display:active?'block':'none' }} />
          <canvas ref={canvasRef} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',display:autoMode?'block':'none' }} />

          {/* Scan line when active */}
          {autoMode && <div className="scan-line" />}

          {/* Corner brackets when active */}
          {active && (
            <>
              <div style={{ position:'absolute',top:10,left:10,width:20,height:20,borderTop:'2px solid rgba(59,130,246,0.6)',borderLeft:'2px solid rgba(59,130,246,0.6)',borderRadius:'4px 0 0 0',pointerEvents:'none' }}/>
              <div style={{ position:'absolute',top:10,right:10,width:20,height:20,borderTop:'2px solid rgba(59,130,246,0.6)',borderRight:'2px solid rgba(59,130,246,0.6)',borderRadius:'0 4px 0 0',pointerEvents:'none' }}/>
              <div style={{ position:'absolute',bottom:10,left:10,width:20,height:20,borderBottom:'2px solid rgba(59,130,246,0.6)',borderLeft:'2px solid rgba(59,130,246,0.6)',borderRadius:'0 0 0 4px',pointerEvents:'none' }}/>
              <div style={{ position:'absolute',bottom:10,right:10,width:20,height:20,borderBottom:'2px solid rgba(59,130,246,0.6)',borderRight:'2px solid rgba(59,130,246,0.6)',borderRadius:'0 0 4px 0',pointerEvents:'none' }}/>
            </>
          )}

          {!active && (
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:16,padding:40,zIndex:1 }}>
              <div style={{ width:68,height:68,borderRadius:20,background:'linear-gradient(135deg,#60a5fa,#2563eb)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,boxShadow:'0 8px 24px rgba(59,130,246,0.35)' }}>👁️</div>
              <p style={{ color:'#64748b',fontSize:14,textAlign:'center',maxWidth:260,lineHeight:1.65 }}>
                Point your camera at the environment to detect objects and get voice guidance.
              </p>
              {modelReady
                ? <button className="tool-btn" onClick={handleStart} style={{ background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'#fff',padding:'13px 32px',borderRadius:12,fontSize:14,boxShadow:'0 6px 18px rgba(59,130,246,.4)' }}>
                    📹 Start Camera
                  </button>
                : <div style={{ fontSize:13,color:'#94a3b8',display:'flex',alignItems:'center',gap:7 }}>
                    <span style={{ width:7,height:7,borderRadius:'50%',background:'#f59e0b',display:'inline-block',animation:'pulse 1s infinite' }}/>
                    {modelStatus}
                  </div>
              }
            </div>
          )}

          {active && !cameraReady && (
            <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.75)',flexDirection:'column',gap:12 }}>
              <span style={{ width:8,height:8,borderRadius:'50%',background:'#60a5fa',display:'inline-block',animation:'pulse 1s infinite' }}/>
              <span style={{ color:'#94a3b8',fontSize:13 }}>Starting camera…</span>
            </div>
          )}
        </div>

        {/* Controls */}
        {active && cameraReady && (
          <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap' }}>
            <button className="tool-btn" onClick={handleOnce} disabled={!modelReady}
              style={{ flex:1,minWidth:130,padding:'12px 20px',borderRadius:12,background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'#fff',fontSize:14,boxShadow:'0 4px 14px rgba(59,130,246,.3)' }}>
              🔍 Detect Once
            </button>
            <button className="tool-btn" onClick={handleToggleAuto} disabled={!modelReady}
              style={{ flex:1,minWidth:130,padding:'12px 20px',borderRadius:12,
                background:autoMode?'linear-gradient(135deg,#10b981,#059669)':'#fff',
                color:autoMode?'#fff':'#334155',fontSize:14,
                boxShadow:autoMode?'0 4px 14px rgba(16,185,129,.3)':'none',
                border:autoMode?'none':'1.5px solid #e2e8f0',
              }}>
              {autoMode ? '⏹ Stop Live' : '▶ Live Detect'}
            </button>
            <button className="tool-btn" onClick={handleStop}
              style={{ padding:'12px 18px',borderRadius:12,background:'#fff',border:'1.5px solid #fca5a5',color:'#ef4444',fontSize:14 }}>
              ✕
            </button>
          </div>
        )}

        {/* Threshold */}
        {active && (
          <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'14px 18px',marginBottom:14 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <span style={{ fontSize:13,color:'#334155',fontWeight:600 }}>Detection Sensitivity</span>
              <span style={{ fontSize:11,color:'#3b82f6',fontWeight:700,background:'#eff6ff',border:'1px solid #bfdbfe',padding:'2px 10px',borderRadius:999 }}>
                {threshold<=0.35?'High — more objects':threshold<=0.50?'Balanced ✓':'Strict — high accuracy'}
              </span>
            </div>
            <input type="range" min="0.25" max="0.70" step="0.05" value={threshold}
              onChange={e=>setThreshold(parseFloat(e.target.value))}
              style={{ width:'100%',accentColor:'#3b82f6',height:4,cursor:'pointer' }} />
          </div>
        )}

        {cameraError && <ErrorBox msg={cameraError} />}

        {/* Nav advice */}
        {navAdvice && (
          <div style={{ background:'linear-gradient(135deg,rgba(59,130,246,0.06),rgba(99,102,241,0.06))',border:'1px solid #bfdbfe',borderRadius:14,padding:'13px 18px',marginBottom:14,display:'flex',gap:10,alignItems:'center' }}>
            <span style={{ fontSize:20 }}>🧭</span>
            <span style={{ fontSize:14,color:'#1d4ed8',fontWeight:500,lineHeight:1.5 }}>{navAdvice}</span>
          </div>
        )}

        {/* Object cards */}
        {deduped.length > 0 && (
          <div style={{ animation:'fadeUp .4s ease' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
              <span style={{ fontSize:11,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:1 }}>
                Detected · {deduped.length} object{deduped.length !== 1 ? 's' : ''}
              </span>
              <button className="tool-btn" onClick={()=>speak(buildDesc(predictions,lang,hazards,navAdvice),LANGUAGES[lang].code)}
                style={{ padding:'5px 12px',borderRadius:999,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#2563eb',fontSize:12 }}>
                🔊 Replay
              </button>
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:10 }}>
              {deduped.map((obj,i)=>{
                const ds=DIST_STYLE[obj._distance]||{bg:'#f1f5f9',color:'#64748b',dot:'#94a3b8',label:obj._distance}
                return (
                  <div key={i} className="obj-card" style={{
                    background:'#fff',
                    border:`1.5px solid ${obj._isHazard?'#fca5a5':'#e2e8f0'}`,
                    borderRadius:14,padding:'14px 14px 12px',
                    position:'relative',overflow:'hidden',
                  }}>
                    {obj._isHazard && <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#ef4444,#f97316)' }} />}

                    <div style={{ fontSize:13,fontWeight:700,color:obj._isHazard?'#dc2626':'#0f172a',marginBottom:8,textTransform:'capitalize',display:'flex',alignItems:'center',gap:4 }}>
                      {obj._isHazard && <span style={{fontSize:11}}>⚠️</span>}
                      {obj.class}
                    </div>

                    <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                      <span style={{ fontSize:10,padding:'3px 8px',borderRadius:999,background:ds.bg,color:ds.color,fontWeight:600,display:'flex',alignItems:'center',gap:3 }}>
                        <span style={{ width:5,height:5,borderRadius:'50%',background:ds.dot,display:'inline-block',flexShrink:0 }} />
                        {ds.label}
                      </span>
                      <span style={{ fontSize:10,padding:'3px 8px',borderRadius:999,background:'#f1f5f9',color:'#64748b',fontWeight:500 }}>{obj._position}</span>
                    </div>

                    <div style={{ marginTop:8,height:3,borderRadius:999,background:'#f1f5f9',overflow:'hidden' }}>
                      <div style={{ height:'100%',borderRadius:999,width:`${Math.round(obj.score*100)}%`,background:obj._isHazard?'#ef4444':obj._distance==='medium'?'#22c55e':'#3b82f6',transition:'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize:10,color:'#94a3b8',marginTop:3,textAlign:'right' }}>{Math.round(obj.score*100)}% conf</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {active && autoMode && deduped.length===0 && modelReady && (
          <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:'28px',textAlign:'center' }}>
            <div style={{ fontSize:32,marginBottom:10 }}>👀</div>
            <div style={{ color:'#334155',fontSize:14,fontWeight:600 }}>Scanning environment…</div>
            <div style={{ color:'#94a3b8',fontSize:12,marginTop:6 }}>Move the camera slowly or slide sensitivity left for more detections.</div>
          </div>
        )}
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
      <span style={{ width:7,height:7,borderRadius:'50%',background:ready?color:'#f59e0b',display:'inline-block',animation:ready?'none':'pulse 1.5s infinite',flexShrink:0 }} />
      {label}
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:12,padding:'12px 16px',color:'#dc2626',fontSize:13,marginBottom:14,display:'flex',gap:8,alignItems:'center' }}>
      <span>⚠️</span> {msg}
    </div>
  )
}