/**
 * asl.js — ML-powered ASL letter + gesture detection
 *
 * Letter mode:  MLP trained on your hand data (99.3% accuracy)
 * Gesture mode: MLP trained on your gesture data (99.3% accuracy)
 *
 * Pure JS matrix math — no TF.js, no dependencies
 */

// ─── Model state ──────────────────────────────────────────────────────────────
let letterWeights   = null
let letterLabelMap  = null
let gestureWeights  = null
let gestureLabelMap = null
let letterReady     = false
let gestureReady    = false

// ─── Load both models in parallel ────────────────────────────────────────────
async function loadModels() {
  try {
    const [lw, ll, gw, gl] = await Promise.all([
      fetch('/model_weights.json').then(r => { if (!r.ok) throw new Error(`model_weights: ${r.status}`); return r.json() }),
      fetch('/label_map.json').then(r => { if (!r.ok) throw new Error(`label_map: ${r.status}`); return r.json() }),
      fetch('/gesture_weights.json').then(r => { if (!r.ok) throw new Error(`gesture_weights: ${r.status}`); return r.json() }),
      fetch('/gesture_label_map.json').then(r => { if (!r.ok) throw new Error(`gesture_label_map: ${r.status}`); return r.json() }),
    ])
    letterWeights  = lw;  letterLabelMap  = ll;  letterReady  = true
    gestureWeights = gw;  gestureLabelMap = gl;  gestureReady = true
    console.log('✅ Letter model loaded —',  Object.keys(ll).length, 'classes')
    console.log('✅ Gesture model loaded —', Object.keys(gl).length, 'classes')
  } catch (e) {
    console.error('❌ Model load error:', e.message)
  }
}

loadModels()

// ─── Pure JS matrix math ──────────────────────────────────────────────────────
function matMul(a, b, aRows, aCols, bCols) {
  const out = new Float32Array(aRows * bCols)
  for (let i = 0; i < aRows; i++)
    for (let j = 0; j < bCols; j++) {
      let s = 0
      for (let k = 0; k < aCols; k++) s += a[i*aCols+k] * b[k*bCols+j]
      out[i*bCols+j] = s
    }
  return out
}

function addBias(x, bias) {
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = x[i] + bias[i]
  return out
}

function relu(x) {
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = Math.max(0, x[i])
  return out
}

function softmax(x) {
  const max = Math.max(...x)
  const exp = x.map(v => Math.exp(v - max))
  const sum = exp.reduce((a, b) => a + b, 0)
  return exp.map(v => v / sum)
}

function batchNorm(x, gamma, beta, mean, variance, eps = 0.001) {
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++)
    out[i] = gamma[i] * (x[i] - mean[i]) / Math.sqrt(variance[i] + eps) + beta[i]
  return out
}

function flatten(arr) {
  const out = []
  function walk(a) {
    if (Array.isArray(a[0])) a.forEach(walk)
    else a.forEach(v => out.push(v))
  }
  walk(arr)
  return new Float32Array(out)
}

// ─── MLP forward pass ─────────────────────────────────────────────────────────
function mlpPredict(inputArr, weights, layerDims) {
  const w = weights
  const keys = Object.keys(w)

  const gamma   = new Float32Array(w[keys.find(k => k.includes('gamma'))])
  const beta    = new Float32Array(w[keys.find(k => k.includes('beta'))])
  const movMean = new Float32Array(w[keys.find(k => k.includes('moving_mean'))])
  const movVar  = new Float32Array(w[keys.find(k => k.includes('moving_variance'))])

  const kernels = keys.filter(k => k.includes('kernel')).sort().map(k => flatten(w[k]))
  const biases  = keys.filter(k => k.includes('bias')).sort().map(k => new Float32Array(w[k]))

  let x = new Float32Array(inputArr)
  x = batchNorm(x, gamma, beta, movMean, movVar)

  for (let i = 0; i < layerDims.length; i++) {
    const [inD, outD] = layerDims[i]
    x = matMul(x, kernels[i], 1, inD, outD)
    x = addBias(x, biases[i])
    if (i < layerDims.length - 1) x = relu(x)
  }

  return softmax(Array.from(x))
}

// ─── Feature extraction ───────────────────────────────────────────────────────
function extractFeatures(lm) {
  const wx = lm[0].x, wy = lm[0].y
  const scale = Math.max(Math.hypot(lm[9].x - wx, lm[9].y - wy), 0.01)
  const row = []
  for (const l of lm) row.push((l.x-wx)/scale, (l.y-wy)/scale, l.z/scale)
  return row
}

function bestClass(probs, labelMap, threshold) {
  let bestIdx = 0
  for (let i = 1; i < probs.length; i++)
    if (probs[i] > probs[bestIdx]) bestIdx = i
  const confidence = probs[bestIdx]
  if (confidence < threshold) return null
  return { label: labelMap[String(bestIdx)], confidence }
}

// ─── Public: Letter classification ───────────────────────────────────────────
export function classifyLetter(lm) {
  if (!lm || lm.length < 21 || !letterReady) return null
  try {
    const features = extractFeatures(lm)
    // Letter MLP: 63→256→128→64→26
    const probs = mlpPredict(features, letterWeights, [[63,256],[256,128],[128,64],[64,26]])
    const result = bestClass(probs, letterLabelMap, 0.60)
    if (!result) return null
    const info = LETTER_LIST.find(l => l.char === result.label)
    return { char: result.label, emoji: info?.emoji ?? '', display: info?.desc ?? '', confidence: result.confidence }
  } catch (e) { console.error('classifyLetter error:', e); return null }
}

// ─── Public: Gesture classification ──────────────────────────────────────────
export function classifyGesture(lm) {
  if (!lm || lm.length < 21 || !gestureReady) return null
  try {
    const features = extractFeatures(lm)
    // Gesture MLP: 63→128→64→N
    const numClasses = Object.keys(gestureLabelMap).length
    const probs = mlpPredict(features, gestureWeights, [[63,128],[128,64],[64,numClasses]])
    const result = bestClass(probs, gestureLabelMap, 0.70)
    if (!result) return null

    // Map ID → display label + emoji
    const info = GESTURE_LIST.find(g => g.id === result.label)
    if (!info) return null
    return { word: info.label, emoji: info.emoji, confidence: result.confidence }
  } catch (e) { console.error('classifyGesture error:', e); return null }
}

// ─── Status exports ───────────────────────────────────────────────────────────
export function isLetterModelReady()  { return letterReady  }
export function isGestureModelReady() { return gestureReady }

// ─── Gesture list ─────────────────────────────────────────────────────────────
export const GESTURE_LIST = [
  // Responses
  { id:'YES',        label:'YES',         emoji:'👍', desc:'Fist with thumb pointing up' },
  { id:'NO',         label:'NO',          emoji:'👎', desc:'Fist with thumb pointing down' },
  { id:'OK',         label:'OK',          emoji:'👌', desc:'Index+thumb pinch, 3 fingers up' },
  { id:'SORRY',      label:'SORRY',       emoji:'😔', desc:'Fist, thumb out to the side' },
  // Social
  { id:'HELLO',      label:'HELLO',       emoji:'👋', desc:'Open palm wave' },
  { id:'THANK_YOU',  label:'THANK YOU',   emoji:'🙏', desc:'Flat hand from chin forward' },
  { id:'PLEASE',     label:'PLEASE',      emoji:'🤲', desc:'Flat hand on chest, circular rub' },
  { id:'I_LOVE_YOU', label:'I LOVE YOU',  emoji:'🤟', desc:'Thumb + index + pinky extended' },
  { id:'ROCK_ON',    label:'ROCK ON',     emoji:'🤘', desc:'Index + pinky up, middle+ring curled' },
  { id:'CALL_ME',    label:'CALL ME',     emoji:'🤙', desc:'Thumb + pinky out, others curled' },
  { id:'PEACE',      label:'PEACE',       emoji:'✌️', desc:'Index + middle spread in V' },
  // Needs
  { id:'HELP',       label:'HELP',        emoji:'🆘', desc:'Fist with thumb up on open palm' },
  { id:'STOP',       label:'STOP',        emoji:'✋', desc:'Open palm flat facing forward' },
  { id:'EAT',        label:'EAT',         emoji:'🍴', desc:'Fingers bunched to thumb, tap lips' },
  { id:'DRINK',      label:'DRINK',       emoji:'🥤', desc:'C-shape hand tipped toward mouth' },
  { id:'WATER',      label:'WATER',       emoji:'💧', desc:'W-shape: index+middle+ring up spread' },
  { id:'WASHROOM',   label:'WASHROOM',    emoji:'🚽', desc:'T-shape: thumb between index+middle' },
  { id:'PAIN',       label:'PAIN / HURT', emoji:'😣', desc:'Both index fingers pointing at each other' },
  // Questions
  { id:'WHO',        label:'WHO',         emoji:'🧑', desc:'Index tracing circle at chin' },
  { id:'WHAT',       label:'WHAT',        emoji:'🤔', desc:'Index sweeps side to side' },
  { id:'WHERE',      label:'WHERE',       emoji:'📍', desc:'Index pointing up, wrist shake' },
  { id:'WHEN',       label:'WHEN',        emoji:'⏰', desc:'Index circles then points forward' },
  { id:'WHICH',      label:'WHICH',       emoji:'🔀', desc:'Both thumbs alternate up and down' },
  { id:'COME_HERE',  label:'COME HERE',   emoji:'🫴', desc:'Index finger curled beckoning inward' },
]

// ─── Letter list ──────────────────────────────────────────────────────────────
export const LETTER_LIST = [
  { char:'A', emoji:'🤜', desc:'Fist, thumb beside index' },
  { char:'B', emoji:'🖐️', desc:'4 fingers straight up, thumb tucked' },
  { char:'C', emoji:'🫲', desc:'All fingers curved into C shape' },
  { char:'D', emoji:'👆', desc:'Index up, others curl to touch thumb' },
  { char:'E', emoji:'🤏', desc:'All fingers droop forward in mid-curl' },
  { char:'F', emoji:'👌', desc:'Index-thumb pinch, others open up' },
  { char:'G', emoji:'👉', desc:'Index + thumb point sideways' },
  { char:'H', emoji:'🤞', desc:'Index + middle point sideways' },
  { char:'I', emoji:'🤙', desc:'Pinky only extended straight up' },
  { char:'J', emoji:'🤙', desc:'Like I, then trace J downward' },
  { char:'K', emoji:'✌️', desc:'Index+middle up, thumb UP between them' },
  { char:'L', emoji:'👉', desc:'Index up + thumb out sideways' },
  { char:'M', emoji:'✊', desc:'3 fingers folded over the thumb' },
  { char:'N', emoji:'✊', desc:'2 fingers folded over the thumb' },
  { char:'O', emoji:'⭕', desc:'All fingers and thumb form an O circle' },
  { char:'P', emoji:'👇', desc:'Like K but pointing downward' },
  { char:'Q', emoji:'👇', desc:'Like G but pointing downward' },
  { char:'R', emoji:'🤞', desc:'Index + middle crossed together' },
  { char:'S', emoji:'✊', desc:'Fist, thumb flat across front of fingers' },
  { char:'T', emoji:'✊', desc:'Fist, thumb pokes up between I and M' },
  { char:'U', emoji:'✌️', desc:'Index + middle up, held close together' },
  { char:'V', emoji:'✌️', desc:'Index + middle spread apart in a V' },
  { char:'W', emoji:'🖖', desc:'Index + middle + ring spread wide' },
  { char:'X', emoji:'☝️', desc:'Index finger bent into a hook shape' },
  { char:'Y', emoji:'🤙', desc:'Thumb + pinky both extended outward' },
  { char:'Z', emoji:'☝️', desc:'Index horizontal, traces Z' },
]

export const ASL_DESCRIPTIONS = Object.fromEntries(LETTER_LIST.map(l => [l.char, l.desc]))