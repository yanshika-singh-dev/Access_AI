/**
 * detector.js
 * Switched back to TensorFlow.js COCO-SSD — loads reliably, no external data files.
 * YOLOv8n ONNX from HuggingFace always has split external data files which
 * ONNX Runtime Web cannot load in browser. COCO-SSD works 100% of the time.
 */

export const COCO_CLASSES = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
  'traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat',
  'dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack',
  'umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball',
  'kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket',
  'bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple',
  'sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake',
  'chair','couch','potted plant','bed','dining table','toilet','tv','laptop',
  'mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink',
  'refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'
]

let model       = null
let loadPromise = null

// Label smoothing
const frameHistory = {}
const missCount    = {}
const CONFIRM = 2
const DECAY   = 4

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Dynamically load TF.js + COCO-SSD from CDN.
 * Uses esm.sh which correctly handles module resolution.
 */
export async function loadModel(onProgress) {
  if (model) return model
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    onProgress?.('Loading TensorFlow.js…')

    // Load TF.js first
    const tf = await import('https://esm.sh/@tensorflow/tfjs@4.22.0')
    await tf.ready()

    onProgress?.('Downloading COCO-SSD model… (~5 MB, cached after first load)')

    // Load COCO-SSD
    const cocoSsd = await import('https://esm.sh/@tensorflow-models/coco-ssd@2.2.3')
    model = await cocoSsd.load({ base: 'mobilenet_v2' })

    onProgress?.('Model ready ✓')
    return model
  })()

  return loadPromise
}

export async function detect(videoEl, fw, fh, conf = 0.40) {
  if (!model) throw new Error('Model not loaded')

  const raw = await model.detect(videoEl, 15, conf)

  // Label smoothing
  const seen = new Set(raw.map(d => d.class))
  seen.forEach(c => { frameHistory[c] = (frameHistory[c] || 0) + 1; missCount[c] = 0 })
  Object.keys(frameHistory).forEach(c => {
    if (!seen.has(c)) {
      missCount[c] = (missCount[c] || 0) + 1
      if (missCount[c] >= DECAY) { delete frameHistory[c]; delete missCount[c] }
    }
  })
  const confirmed = new Set(
    Object.entries(frameHistory).filter(([, v]) => v >= CONFIRM).map(([k]) => k)
  )

  return raw
    .filter(d => confirmed.has(d.class))
    .map(d => enrich(d, fw, fh))
}

function enrich(d, fw, fh) {
  const [x, y, w, h] = d.bbox
  const cx  = x + w / 2
  const pos = cx < fw/3 ? 'left' : cx > fw*2/3 ? 'right' : 'center'
  const r   = (w * h) / (fw * fh)
  const dist = r > 0.25 ? 'very close' : r > 0.10 ? 'close' : r > 0.03 ? 'medium' : 'far'
  const HZ  = ['person','car','truck','bus','motorcycle','bicycle','chair','dining table','bench','fire hydrant','stop sign','potted plant','couch','bed']
  return {
    class: d.class, score: d.score, bbox: d.bbox,
    _position: pos, _distance: dist,
    _isHazard: HZ.includes(d.class) && (dist === 'very close' || dist === 'close') && pos === 'center',
    _areaRatio: r,
  }
}

export function resetSmoothing() {
  Object.keys(frameHistory).forEach(k => delete frameHistory[k])
  Object.keys(missCount).forEach(k => delete missCount[k])
}

export function buildHazards(p) {
  return p.filter(x => x._isHazard).map(x => `${x.class} very close ahead`)
}

export function buildNavAdvice(p) {
  const hz = p.filter(x => x._isHazard)
  if (!hz.length) return ''
  const c = hz.find(x => x._position === 'center')
  return c
    ? `Caution. ${c.class} directly ahead. Please stop or move aside.`
    : 'Hazard nearby. Proceed with caution.'
}