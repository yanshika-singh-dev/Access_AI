export const LANGUAGES = {
  en: { label: 'English', code: 'en-US' },
  hi: { label: 'हिंदी',   code: 'hi-IN' },
  mr: { label: 'मराठी',   code: 'mr-IN' },
}

let selectedVoice = null
let globalRate    = 0.78

export function getSpeechRate() { return globalRate }
export function setSpeechRate(r) { globalRate = r }
export function setVoice(v) { selectedVoice = v }
export function getAllVoices() { return window.speechSynthesis?.getVoices() || [] }

export function preloadVoices() {
  if (!window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}

function pickVoice(langCode) {
  if (selectedVoice) return selectedVoice
  const voices = window.speechSynthesis.getVoices()
  const prefix = langCode.split('-')[0].toLowerCase()
  const m      = voices.filter(v => v.lang.toLowerCase().startsWith(prefix))
  return m.find(v => /natural|neural|aria|jenny|swara|neerja/i.test(v.name))
      || m.find(v => /microsoft/i.test(v.name))
      || m[0] || null
}

export function speak(text, langCode = 'en-US', rate) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const utt   = new SpeechSynthesisUtterance(text)
  utt.lang    = langCode
  utt.rate    = rate ?? globalRate
  utt.pitch   = 1.0
  utt.volume  = 1.0
  const v = pickVoice(langCode)
  if (v) utt.voice = v
  window.speechSynthesis.speak(utt)
}

export function speakLocked(text, langCode, onStart, onEnd, rate) {
  if (!window.speechSynthesis || !text) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utt   = new SpeechSynthesisUtterance(text)
  utt.lang    = langCode
  utt.rate    = rate ?? globalRate
  utt.pitch   = 1.0
  utt.volume  = 1.0
  const v = pickVoice(langCode)
  if (v) utt.voice = v
  utt.onstart  = onStart
  utt.onend    = onEnd
  utt.onerror  = onEnd
  utt.oncancel = onEnd
  window.speechSynthesis.speak(utt)
}

export function stopSpeech() { window.speechSynthesis?.cancel() }
