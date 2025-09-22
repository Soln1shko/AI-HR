import React, { useRef, useCallback, useState, useEffect } from 'react'

interface VideoRecorderProps {
  onRecordingStart: () => void
  onRecordingStop: () => void
  onVideoReady: (videoBlob: Blob) => void
  onError: (error: string) => void
  isRecording: boolean
  showPreview?: boolean
  onCameraAvailable?: (available: boolean) => void
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({
  onRecordingStart,
  onRecordingStop,
  onVideoReady,
  onError,
  isRecording,
  showPreview = false,
  onCameraAvailable
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [isInitialized, setIsInitialized] = useState(false)

  // Инициализация камеры
  const initializeCamera = useCallback(async () => {
    try {
      console.log('Инициализация камеры...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false  
      })

      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setIsInitialized(true)
      console.log('Камера инициализирована')
      
      // Уведомляем о доступности камеры
      if (onCameraAvailable) {
        onCameraAvailable(true)
      }
    } catch (error) {
      console.error('Ошибка инициализации камеры:', error)
      onError('Не удалось получить доступ к камере')
      
      // Уведомляем о недоступности камеры
      if (onCameraAvailable) {
        onCameraAvailable(false)
      }
    }
  }, [onError, onCameraAvailable])

  // Остановка камеры
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsInitialized(false)
    console.log('Камера остановлена')
  }, [])

  // Начало записи
  const startRecording = useCallback(async () => {
    // Инициализируем камеру если еще не инициализирована
    if (!isInitialized) {
      await initializeCamera()
      if (!isInitialized) {
        console.error('Не удалось инициализировать камеру')
        return
      }
    }

    if (!streamRef.current) {
      console.error('Камера не инициализирована')
      return
    }

    try {
      console.log('Начинаем запись видео...')
      
      chunksRef.current = []
      
      // Проверяем поддерживаемые MIME типы 
      let mimeType = 'video/webm;codecs=vp9'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm'
        }
      }
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: mimeType
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('Запись видео остановлена')
        
        const videoBlob = new Blob(chunksRef.current, { type: mimeType })
        console.log(`Создан видео blob: ${videoBlob.size} байт`)
        
        onVideoReady(videoBlob)
        onRecordingStop()
      }

      mediaRecorder.onerror = (event) => {
        console.error('Ошибка записи видео:', event)
        onError('Ошибка записи видео')
      }

      mediaRecorder.start(1000)
      onRecordingStart()
      
      console.log('Запись видео запущена')
    } catch (error) {
      console.error('Ошибка запуска записи:', error)
      onError('Не удалось начать запись видео')
    }
  }, [isInitialized, initializeCamera, onRecordingStart, onRecordingStop, onVideoReady, onError])

  // Остановка записи
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Останавливаем запись видео...')
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Эффект для управления записью
  useEffect(() => {
    if (isRecording) {
      startRecording()
    } else if (!isRecording && mediaRecorderRef.current?.state === 'recording') {
      stopRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // Инициализация камеры для preview
  useEffect(() => {
    if (showPreview && !isInitialized) {
      initializeCamera()
    }
  }, [showPreview, isInitialized, initializeCamera])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Видео элемент для preview или скрытый для записи
  return (
    <div className={showPreview ? "w-full h-full" : "hidden"}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover rounded-3xl"
        onError={(e) => {
          console.warn('Ошибка видео элемента:', e)
        }}
        onLoadStart={() => {
          console.log('Видео элемент начал загрузку')
        }}
      />
    </div>
  )
}

export default VideoRecorder
