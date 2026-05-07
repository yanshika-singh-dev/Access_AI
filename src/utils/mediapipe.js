// mediapipe.js - loads from local public/mediapipe folder

const BASE_LOCAL = '/mediapipe'

const SCRIPTS = [
  `${BASE_LOCAL}/camera_utils/camera_utils.js`,
  `${BASE_LOCAL}/drawing_utils/drawing_utils.js`,
  `${BASE_LOCAL}/hands/hands.js`,
]

let loaded = false
let loadPromise = null

const sleep = ms => new Promise(r => setTimeout(r, ms))

function injectScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

export async function loadMediaPipe() {
  if (loaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    for (const src of SCRIPTS) {
      await injectScript(src)
    }

    let waited = 0
    while (!window.Hands && waited < 10000) {
      await sleep(200); waited += 200
    }
    if (!window.Hands) throw new Error('window.Hands not available after loading scripts')

    loaded = true
  })()

  return loadPromise
}

export async function initHands(onResults) {
  await loadMediaPipe()

  const hands = new window.Hands({
    locateFile: file => `${BASE_LOCAL}/hands/${file}`
  })

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
  })

  hands.onResults(onResults)
  // NO hands.initialize() — it triggers the Module.arguments bug
  return hands
}

export function drawHand(ctx, landmarks) {
  if (!window.drawConnectors || !window.HAND_CONNECTIONS) return
  window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#8b5cf6', lineWidth: 2 })
  if (window.drawLandmarks) {
    window.drawLandmarks(ctx, landmarks, { color: '#fff', fillColor: '#7c3aed', lineWidth: 1, radius: 4 })
  }
}