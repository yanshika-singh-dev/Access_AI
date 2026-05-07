import { useRef, useState, useCallback } from 'react'

export function useCamera() {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const startCamera = useCallback(async (facingMode = 'user') => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setCameraReady(true) }
      }
      return true
    } catch (err) {
      const msg = err.name === 'NotAllowedError' ? 'Camera access denied. Please allow camera permissions.' :
                  err.name === 'NotFoundError'   ? 'No camera found on this device.' :
                  `Camera error: ${err.message}`
      setCameraError(msg)
      return false
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const getVideoElement = useCallback(() => videoRef.current, [])

  return { videoRef, cameraReady, cameraError, startCamera, stopCamera, getVideoElement }
}
