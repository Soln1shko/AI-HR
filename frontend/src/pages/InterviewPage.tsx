import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AudioRecorder from '../components/AudioRecorder'
import VideoRecorder from '../components/VideoRecorder'
import { startInterview, saveInterviewAnswer, deleteInterview, uploadVideo, InterviewData } from '../services/api'
import { ttsClient } from '../services/tts'

const InterviewPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'uploading' | 'recorded' | 'error'>('idle')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  
  // Состояния для видео
  const [isVideoRecording, setIsVideoRecording] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [isAIPreparingToSpeak, setIsAIPreparingToSpeak] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showTranscriptionNotification, setShowTranscriptionNotification] = useState(false)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [isNotificationFadingOut, setIsNotificationFadingOut] = useState(false)
  const [showProcessingNotification, setShowProcessingNotification] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState("Начинаем собеседование...")
  const [transcription, setTranscription] = useState("")
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null)
  const [interviewStatus, setInterviewStatus] = useState<'starting' | 'active' | 'completed' | 'error'>('starting')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [optimalTime, setOptimalTime] = useState<number>(90)
  const [questionSpoken, setQuestionSpoken] = useState<boolean>(false)
  const isInitializing = useRef(false)
  const timerRef = useRef<number | null>(null)
  const vacancyId = location.state?.vacancyId

  // Функции для работы с таймером
  const saveTimerToLocalStorage = useCallback((startTime: number, optimalTime: number, questionSpoken: boolean = false) => {
    const timerData = {
      startTime,
      optimalTime,
      questionSpoken,
      timestamp: Date.now()
    }
    localStorage.setItem('interview_timer', JSON.stringify(timerData))
  }, [])

  const loadTimerFromLocalStorage = useCallback(() => {
    try {
      const timerData = localStorage.getItem('interview_timer')
      if (timerData) {
        const parsed = JSON.parse(timerData)
        const now = Date.now()
        const elapsed = Math.floor((now - parsed.startTime) / 1000)
        const remaining = Math.max(0, parsed.optimalTime - elapsed)
        
        if (remaining > 0) {
          setOptimalTime(parsed.optimalTime)
          setTimeLeft(remaining)
          setIsTimerActive(true)
          setQuestionSpoken(parsed.questionSpoken || false)
          return true
        } else {
          // Таймер истек
          localStorage.removeItem('interview_timer')
          setIsTimerActive(false)
          setTimeLeft(0)
          setQuestionSpoken(false)
          return false
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке таймера из localStorage:', error)
      localStorage.removeItem('interview_timer')
    }
    return false
  }, [])

  const startTimer = useCallback((optimalTime: number) => {
    const startTime = Date.now()
    setOptimalTime(optimalTime)
    setTimeLeft(optimalTime)
    setIsTimerActive(true)
    setQuestionSpoken(true)
    saveTimerToLocalStorage(startTime, optimalTime, true)
  }, [saveTimerToLocalStorage])

  const stopTimer = useCallback(() => {
    setIsTimerActive(false)
    setTimeLeft(0)
    setQuestionSpoken(false)
    localStorage.removeItem('interview_timer')
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Убрали console.log из рендера для предотвращения бесконечных перерендеров

  useEffect(() => {
    console.log('useEffect инициализации запущен, vacancyId:', vacancyId)
    console.log('Текущее состояние interviewData:', interviewData)
    console.log('isInitializing.current:', isInitializing.current)
   
    if (interviewData !== null || isInitializing.current) {
      console.log('Интервью уже инициализировано или инициализируется, пропускаем')
      return
    }
   
    isInitializing.current = true
    
    // Пытаемся восстановить таймер из localStorage
    const timerRestored = loadTimerFromLocalStorage()
    if (timerRestored) {
      console.log('Таймер восстановлен из localStorage')
    }
   
    if (!vacancyId) {
      console.error('ID вакансии не найден, перенаправляем на главную страницу')
      isInitializing.current = false
      navigate('/welcomescreen')
      return
    }

    const initializeInterview = async () => {
      try {
        console.log('Начинаем инициализацию собеседования...')
        setInterviewStatus('starting')
        setCurrentQuestion('Инициализируем собеседование...')
       
        const response = await startInterview(vacancyId)
        console.log('Ответ от startInterview:', response)
       
        if (response.success && response.data) {
          const interviewData = {
            interview_id: response.data.interview_id,
            mlinterview_id: '',
            status: 'active' as const
          }
          console.log('Создаем interviewData:', interviewData)
          setInterviewData(interviewData)
         
          setInterviewStatus('active')
          const firstQuestion = 'Здравствуйте! Благодарим за интерес к нашей компании. Я — ваш AI-ассистент по подбору персонала. Сегодня мы проведем структурированное интервью, чтобы лучше понять ваш опыт, навыки и мотивацию. Пожалуйста, начните с краткого рассказа о себе. Желаю успешного собеседования!'
          setCurrentQuestion(firstQuestion)
          console.log('Собеседование инициализировано, ожидаем ответ пользователя')
         
          // Воспроизводим вопрос только если он еще не был сказан
          if (!questionSpoken) {
            console.log('Воспроизводим вопрос, так как questionSpoken =', questionSpoken)
            playAIQuestion(firstQuestion)
          } else {
            console.log('Пропускаем воспроизведение, так как questionSpoken =', questionSpoken)
          }
          
          isInitializing.current = false // Сбрасываем флаг после успешной инициализации
        } else {
          console.error('Ошибка ответа:', response.error)
          setInterviewStatus('error')
          setCurrentQuestion('Ошибка при инициализации собеседования')
        }
      } catch (error) {
        console.error('Ошибка при инициализации собеседования:', error)
        setInterviewStatus('error')
        setCurrentQuestion('Ошибка подключения к серверу')
      } finally {
        isInitializing.current = false // Сбрасываем флаг в любом случае
      }
    }

    initializeInterview()
  }, [vacancyId, loadTimerFromLocalStorage, navigate]) // Добавили navigate

  const handleRecordingStart = useCallback(() => {
    // Проверяем доступность камеры перед началом записи
    if (!cameraAvailable) {
      console.log('Камера недоступна, показываем модальное окно')
      setShowCameraModal(true)
      return
    }
    
    setIsRecording(true)
    setRecordingStatus('recording')
    setTranscription('')
  }, [cameraAvailable])

  const handleRecordingStop = useCallback(() => {
    setIsRecording(false)
    setRecordingStatus('uploading')
  }, [])

  const handleUploadSuccess = useCallback((blob?: Blob) => {
    if (blob) {
      setAudioBlob(blob)
    }
    setRecordingStatus('recorded')
    setShowProcessingNotification(true)
   
    setTimeout(() => {
      if (!transcription.trim()) {
        console.log('Транскрипция не получена в течение 60 секунд')
      }
    }, 60000)
  }, [transcription])

  const handleUploadError = useCallback(() => {
    setRecordingStatus('error')
    setTimeout(() => setRecordingStatus('idle'), 3000)
  }, [])

  const handleTranscription = useCallback((text: string) => {
    console.log('Получена транскрипция:', text)
    
    if (text.trim()) {
      console.log('Транскрипция обновлена, текущий текст:', text)
      
      // Обновляем транскрипцию
      setTranscription(text)
      
      // Скрываем уведомление об обработке и показываем уведомление о готовности
      setShowProcessingNotification(false)
      setShowTranscriptionNotification(true)
      setIsNotificationFadingOut(false)
     
      // Транскрипция получена успешно
    }
  }, [])

  const handleAnalysis = useCallback(async (analysis: any) => {
    console.log('Получен анализ речи:', analysis)
    setLastAnalysis(analysis)
    console.log('Анализ сохранен в состоянии, будет отправлен вместе с ответом')
  }, [])


  const playAIQuestion = useCallback(async (questionText: string, customOptimalTime?: number) => {
    if (!questionText || questionText.trim() === '') return;
    
    try {
      console.log('Начинаем синтез речи для вопроса:', questionText);
      
      setIsAIPreparingToSpeak(true);
      
      if (!ttsClient.isConnected()) {
        await ttsClient.connect();
      }
      
      const audioBlob = await ttsClient.speak(questionText, 'xenia', 48000);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        console.log('Воспроизведение завершено - выключаем подсветку');
        setIsAISpeaking(false);
        setIsAIPreparingToSpeak(false);
        URL.revokeObjectURL(audioUrl);
        
        // Начинаем запись видео после окончания речи AI
        console.log('Начинаем запись видео после речи AI');
        setIsVideoRecording(true);
        
        // Запускаем таймер после окончания речи ассистента
        const timeToUse = customOptimalTime || optimalTime;
        if (timeToUse > 0) {
          // Сначала останавливаем старый таймер, если он есть
          stopTimer();
          startTimer(timeToUse);
          console.log(`Запущен таймер на ${timeToUse} секунд`);
        }
      };
      
      audio.onerror = (error) => {
        console.error('Ошибка воспроизведения аудио:', error);
        setIsAISpeaking(false);
        setIsAIPreparingToSpeak(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onpause = () => {
        console.log('Воспроизведение приостановлено - выключаем подсветку');
        setIsAISpeaking(false);
        setIsAIPreparingToSpeak(false);
      };
      
      console.log('Включаем подсветку перед воспроизведением');
      setIsAISpeaking(true);
      setIsAIPreparingToSpeak(false);
      
      await audio.play();
      console.log('Воспроизведение запущено');
      
    } catch (error) {
      console.error('Ошибка синтеза или воспроизведения речи:', error);
      setIsAISpeaking(false);
      setIsAIPreparingToSpeak(false);
    }
  }, [optimalTime, stopTimer, startTimer])

  const handleSendAnswer = useCallback(async () => {
    console.log('handleSendAnswer вызван, состояние:', {
      interviewData,
      transcription: transcription.trim(),
      interviewStatus
    })
    if (!interviewData || !transcription.trim()) {
      console.error('Нет данных для отправки ответа', { interviewData, transcription: transcription.trim() })
      return
    }

    if (!interviewData.interview_id) {
      console.error('interview_id не найден, не можем отправить ответ', { interviewData })
      setRecordingStatus('error')
      setTimeout(() => setRecordingStatus('idle'), 3000)
      return
    }

   

    try {
      setRecordingStatus('uploading')
      
      // Останавливаем запись видео если она идет
      if (isVideoRecording) {
        setIsVideoRecording(false)
      }
      
      // Загружаем видео если оно есть
      let videoId = null
      console.log('Проверяем videoBlob:', {
        hasVideoBlob: !!videoBlob,
        videoBlobSize: videoBlob?.size,
        isFirstRequest: !interviewData.mlinterview_id || interviewData.mlinterview_id === ''
      })
      
      if (videoBlob) {
        try {
          const videoResponse = await uploadVideo(videoBlob, `interview_${interviewData.interview_id}_${Date.now()}.webm`)
          if (videoResponse.success && videoResponse.data) {
            videoId = videoResponse.data.yc_video_id
            console.log('Видео загружено:', videoId)
          } else {
            console.warn('Не удалось загрузить видео:', videoResponse.error)
          }
        } catch (error) {
          console.error('Ошибка загрузки видео:', error)
        }
      } else {
        console.log('videoBlob отсутствует, videoId будет null')
      }
      
      const isFirstRequest = !interviewData.mlinterview_id || interviewData.mlinterview_id === ''
     
      console.log(`Отправляем ${isFirstRequest ? 'первый' : 'последующий'} ответ:`, {
        interview_id: interviewData.interview_id,
        mlinterview_id: interviewData.mlinterview_id,
        question: isFirstRequest ? '' : (interviewData.question || currentQuestion),
        answer_text: transcription,
        video_id: videoId
      })

      const response = await saveInterviewAnswer(
        interviewData.interview_id,
        interviewData.mlinterview_id || '',
        isFirstRequest ? '' : (interviewData.question || currentQuestion),
        transcription,
        lastAnalysis,
        videoId || undefined
      )

      if (response.success && response.data) {
        // Останавливаем текущий таймер
        stopTimer()
        
        if (response.data.status === 'completed') {
          setInterviewStatus('completed')
          setCurrentQuestion('Собеседование завершено!')
          setShowCompletionModal(true)
        } else {
          const nextQuestion = response.data.question || response.data.current_question
          if (nextQuestion) {
            setCurrentQuestion(nextQuestion)
            setInterviewData(prev => prev ? {
              ...prev,
              mlinterview_id: response.data.mlinterview_id || prev.mlinterview_id,
              question: nextQuestion
            } : null)
            
            // Сохраняем optimal_time из ответа
            if (response.data.optimal_time) {
              setOptimalTime(response.data.optimal_time)
              console.log(`Обновлен optimal_time: ${response.data.optimal_time} секунд`)
            }
            
            playAIQuestion(nextQuestion, response.data.optimal_time)
          }
        }
        setRecordingStatus('idle')
        setLastAnalysis(null)
        setAudioBlob(null)
        setVideoBlob(null)
        setShowTranscriptionNotification(false)
        setShowProcessingNotification(false)
        setIsNotificationFadingOut(false)
      } else {
        throw new Error(response.error || 'Ошибка при отправке ответа')
      }
    } catch (error) {
      console.error('Ошибка при отправке ответа:', error)
      setRecordingStatus('error')
      setTimeout(() => setRecordingStatus('idle'), 3000)
    }
  }, [interviewData, transcription, currentQuestion, lastAnalysis, stopTimer, playAIQuestion])

  const handleSendAndNext = useCallback(async () => {
    await handleSendAnswer()
  }, [handleSendAnswer])

  // Обработчики для видео
  const handleVideoRecordingStart = useCallback(() => {
    console.log('Начинаем запись видео')
    console.log('Устанавливаем isVideoRecording = true')
    setIsVideoRecording(true)
    console.log('isVideoRecording установлен в true')
  }, [])

  const handleVideoRecordingStop = useCallback(() => {
    console.log('Останавливаем запись видео')
    setIsVideoRecording(false)
  }, [])

  const handleVideoReady = useCallback((blob: Blob) => {
    console.log('Видео готово:', blob.size, 'байт')
    console.log('Тип видео:', blob.type)
    console.log('Устанавливаем videoBlob в состояние')
    setVideoBlob(blob)
    console.log('videoBlob установлен в состояние')
  }, [])

  const handleVideoError = useCallback((error: string) => {
    console.error('Ошибка записи видео:', error)
    setIsVideoRecording(false)
  }, [])

  // Обработчики для модального окна камеры
  const handleCameraModalClose = useCallback(() => {
    setShowCameraModal(false)
  }, [])

  const handleCameraPermissionGranted = useCallback(() => {
    setCameraAvailable(true)
    setShowCameraModal(false)
  }, [])


  const handleRerecord = useCallback(() => {
    console.log('Начинаем перезапись...')
    
    // Останавливаем запись аудио если она идет
    if (isRecording) {
      setIsRecording(false)
    }
    
    // Останавливаем запись видео если она идет
    if (isVideoRecording) {
      setIsVideoRecording(false)
    }
    
    setAudioBlob(null)
    setVideoBlob(null)
    setRecordingStatus('idle')
    setTranscription('')
    setShowTranscriptionNotification(false)
    setShowProcessingNotification(false)
    setIsNotificationFadingOut(false)
    
    // АВТОМАТИЧЕСКИ ЗАПУСКАЕМ ЗАПИСЬ ВИДЕО ПРИ ПЕРЕЗАПИСИ
    console.log('Автоматически запускаем запись видео при перезаписи')
    setTimeout(() => {
      if (cameraAvailable) {
        console.log('Камера доступна, запускаем запись видео')
        setIsVideoRecording(true)
      } else {
        console.log('Камера недоступна, запись видео не запущена')
      }
    }, 100) // Небольшая задержка чтобы состояние успело обновиться
    
    // НЕ останавливаем таймер при перезаписи - оставляем его работать
    // stopTimer() - убираем эту строку
  }, [isRecording, isVideoRecording, cameraAvailable])

  const handleExitClick = useCallback(() => {
    setShowExitModal(true)
  }, [])

  const handleConfirmExit = useCallback(async () => {
    if (interviewData?.interview_id) {
      try {
        console.log('Удаляем интервью с ID:', interviewData.interview_id)
        const result = await deleteInterview(interviewData.interview_id)
        
        if (result.success) {
          console.log('Интервью успешно удалено')
        } else {
          console.error('Ошибка при удалении интервью:', result.error)
        }
      } catch (error) {
        console.error('Ошибка при удалении интервью:', error)
      }
    }
    setIsRecording(false)
    setRecordingStatus('idle')
    setAudioBlob(null)
    setVideoBlob(null)
    
    navigate('/welcomescreen')
  }, [navigate, interviewData?.interview_id])

  const handleCancelExit = useCallback(() => {
    setShowExitModal(false)
  }, [])

  const handleLogoClick = useCallback(() => {
    setShowExitModal(true)
  }, [])

  const handleCompletionModalClose = useCallback(() => {
    setShowCompletionModal(false)
    navigate('/welcomescreen')
  }, [navigate])

  const toggleChatPanel = useCallback(() => {
    setShowChatPanel(prev => !prev)
  }, [])


  // useEffect для таймера
  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Таймер истек
            setIsTimerActive(false)
            localStorage.removeItem('interview_timer')
            
            // Автоматически останавливаем запись если она идет
            if (isRecording) {
              setIsRecording(false)
              setRecordingStatus('uploading')
            }
            
            
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Проверяем консистентность состояния
    if (isTimerActive && timeLeft === 0) {
      setIsTimerActive(false)
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isTimerActive, timeLeft, isRecording])


  useEffect(() => {
    console.log('Инициализация TTS клиента...')
    ttsClient.connect().catch((error) => {
      console.warn('TTS сервер недоступен:', error)
    })
    
    return () => {
      ttsClient.disconnect()
    }
  }, [])

  return (
    <div className="min-h-screen bg-dark-950 text-white relative overflow-hidden focus:outline-none">
      {/* Фоновые элементы */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-1/3 -right-48 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.04) 30%, rgba(168, 85, 247, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
      </div>

      {/* TopPanel как на Welcome странице с кнопкой Назад */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6">
        <div className="glass rounded-2xl px-8 py-4 w-full">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center space-x-3 cursor-pointer group transition-all duration-200 hover:scale-105"
              onClick={handleLogoClick}
            >
              <img 
                src="/vtb.png" 
                alt="VTB Logo" 
                className="w-10 h-10 object-contain rounded-lg transition-all duration-200 group-hover:opacity-80"
              />
              <h1 className="text-xl font-semibold text-white tracking-tight transition-all duration-200 group-hover:text-accent-blue">MORE.tech</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Таймер */}
              <div className="glass rounded-xl px-4 py-2.5 border border-dark-600/30">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-dark-300 text-sm font-medium">Время:</span>
                    <div className={`text-sm font-mono font-semibold tracking-wider ${
                      timeLeft <= 10 ? 'text-red-400' : 
                      timeLeft <= 30 ? 'text-yellow-400' : 
                      'text-accent-blue'
                    }`}>
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleExitClick}
                className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 text-dark-300 hover:text-white transition-all duration-300 border border-dark-700/50 hover:border-dark-600/50 focus:outline-none"
              >
                <div className="flex items-center space-x-2 relative z-10">
                  <svg className="w-4 h-4 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
                  </svg>
                  <span className="text-sm font-medium">Назад</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Основной контейнер в стиле Teams */}
      <div className="relative z-10 pt-32 px-6" style={{ height: 'calc(100vh - 8rem - 5rem)' }}>
        <div className="w-full max-w-full mx-auto flex gap-6 h-full">
          
          {/* Левая колонка: Видео участников */}
          <div className="flex-1 flex flex-col">
            {/* Основная область с участниками видеоконференции */}
            <div className="flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                
                {/* Пользователь - видео с камеры */}
                <div className={`relative rounded-3xl border overflow-hidden h-full flex flex-col transition-all duration-300 ${isRecording ? 'border-green-500' : 'border-dark-600/30'}`} style={{
                  background: isRecording 
                    ? 'rgba(34, 197, 94, 0.25)'
                    : 'rgba(34, 197, 94, 0.15)'
                }}>
                  <div className="flex-grow relative">
                    {cameraAvailable ? (
                      <VideoRecorder
                        onRecordingStart={handleVideoRecordingStart}
                        onRecordingStop={handleVideoRecordingStop}
                        onVideoReady={handleVideoReady}
                        onError={handleVideoError}
                        isRecording={isVideoRecording}
                        showPreview={true}
                        onCameraAvailable={setCameraAvailable}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-8">
                        <div className="relative">
                          <div className="w-48 h-48 rounded-full transition-all duration-300" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))' }}>
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center">
                              <svg className="w-24 h-24 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center justify-center">
                      <span className="text-white font-semibold text-xl">Вы</span>
                    </div>
                  </div>
                </div>
                
                {/* AI Ассистент */}
                <div className={`relative rounded-3xl border overflow-hidden h-full flex flex-col transition-all duration-300 ${isAISpeaking ? 'border-accent-blue' : 'border-dark-600/30'}`} style={{
                  background: isAISpeaking 
                    ? 'rgba(17, 24, 39, 0.95)'
                    : 'rgba(17, 24, 39, 0.9)'
                }}>
                  <div className="flex-grow relative flex items-center justify-center p-8">
                    <div className="relative">
                      <div className="w-48 h-48 rounded-full transition-all duration-300" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))' }}>
                        <img 
                          src="/assistant.jpg" 
                          alt="AI Assistant"
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="hidden w-full h-full rounded-full bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 flex items-center justify-center">
                          <svg className="w-24 h-24 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center justify-center">
                      <span className="text-white font-semibold text-xl">Ассистент Кирилл</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Выдвижная панель чата справа */}
      <div className={`fixed top-32 right-0 z-[60] transition-transform duration-300 ease-in-out ${showChatPanel ? 'translate-x-0' : 'translate-x-full'}`} style={{ height: 'calc(100vh - 8rem - 5rem)' }}>
        <div className="w-96 h-full glass rounded-l-3xl border-l border-dark-600/30 shadow-2xl flex flex-col">
          <div className="p-6 flex-shrink-0">
            <div className="flex items-center justify-between pb-4 border-b border-dark-700/50">
              <h3 className="text-white font-semibold text-lg">Транскрипция</h3>
            </div>
          </div>
          {/* Контент транскрипции */}
          <div className="px-6 py-4 flex-1 overflow-y-auto space-y-6 min-h-0">
            {/* Сообщение от AI */}
            <div className="flex items-start space-x-3 animate-fade-in">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 rounded-full flex items-center justify-center flex-shrink-0 border border-accent-blue/30">
                <svg className="w-5 h-5 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm text-accent-blue mb-2 font-medium">Ассистент Кирилл</div>
                <div className="glass-inner rounded-xl p-3 border border-accent-blue/20">
                  <p className="text-dark-200 leading-relaxed text-sm">{currentQuestion}</p>
                </div>
              </div>
            </div>
            
            {/* Если есть запись пользователя */}
            {audioBlob && (
              <div className="flex items-start space-x-3 animate-fade-in">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-full flex items-center justify-center flex-shrink-0 border border-green-500/30">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-green-400 mb-1 font-medium">Вы</div>
                  <div className="glass-inner rounded-xl p-3 border border-green-500/20">
                    {transcription ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-green-300 text-xs">Транскрипция готова</span>
                        </div>
                        <p className="text-dark-200 leading-relaxed text-sm">{transcription}</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-green-300 text-xs">Аудиозапись получена</span>
                        </div>
                        <p className="text-dark-200 text-sm">Обрабатывается транскрипция...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
                
      {/* Модальное окно подтверждения выхода */}
      {showExitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={handleCancelExit}></div>
          <div className="relative glass rounded-3xl max-w-md w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale overflow-hidden">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-xl mb-2">Завершить собеседование?</h3>
                <p className="text-dark-300 text-sm">
                  Вы уверены, что хотите выйти? Это прервет текущее собеседование и весь прогресс будет потерян.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={handleCancelExit} className="flex-1 px-6 py-3 glass border border-dark-600/40 hover:border-dark-500/50 text-dark-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 focus:outline-none">
                  Отмена
                </button>
                <button onClick={handleConfirmExit} className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg shadow-red-500/25 focus:outline-none">
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно предупреждения о камере */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={handleCameraModalClose}></div>
          <div className="relative glass rounded-3xl max-w-md w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale overflow-hidden">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-xl mb-2">Требуется камера</h3>
                <p className="text-dark-300 text-sm">
                  Для участия в этом собеседовании необходимо включить камеру. 
                  Пожалуйста, разрешите доступ к камере для продолжения.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={handleCameraModalClose} 
                  className="flex-1 px-6 py-3 glass border border-dark-600/40 hover:border-dark-500/50 text-dark-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 focus:outline-none"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCameraPermissionGranted} 
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg shadow-blue-500/25 focus:outline-none"
                >
                  Разрешить камеру
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно завершения собеседования */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"></div>
          <div className="relative glass rounded-3xl max-w-lg w-full border border-dark-600/30 shadow-2xl animate-fade-in-scale overflow-hidden">
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500/30">
                  <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  Собеседование завершено!
                </h3>
                <p className="text-dark-300 text-lg leading-relaxed">
                  Спасибо за прохождение AI собеседования. 
                  <br />
                  Результаты будут обработаны и переданы HR-специалистам.
                </p>
              </div>
              <div className="bg-dark-700/30 p-4 rounded-xl mb-6 border border-dark-600/30">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Интервью успешно записано</span>
                </div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-blue-400 text-sm font-medium">Ответы проанализированы AI</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-purple-400 text-sm font-medium">Результаты переданы компании</span>
                </div>
              </div>
              <div className="text-center">
                <button onClick={handleCompletionModalClose} className="px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-xl shadow-accent-blue/25 focus:outline-none">
                  Вернуться на главную
                </button>
                <p className="text-dark-400 text-xs mt-4">
                  Мы свяжемся с вами в ближайшее время с результатами
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Нижняя панель управления микрофоном - переделанная */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl shadow-2xl border border-dark-600/30 backdrop-blur-xl min-h-[140px]">
            {recordingStatus === 'recorded' ? (
              <div className="px-8 py-6 flex flex-col justify-center h-full">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="h-12 flex items-center justify-center">
                    {showProcessingNotification && (
                      <div className="p-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/30 transition-all duration-500 transform opacity-100 translate-y-0 scale-100 animate-fade-in-scale">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                          <p className="text-blue-300 text-sm font-medium">Ваш ответ обрабатывается</p>
                        </div>
                      </div>
                    )}
                    {showTranscriptionNotification && (
                      <div className={`p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 transition-all duration-500 transform ${isNotificationFadingOut ? 'opacity-0 -translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-fade-in-scale'}`}>
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <p className="text-green-300 text-sm font-medium">Ваш ответ появился в транскрипции</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                  <button 
                    onClick={handleRerecord} 
                    disabled={timeLeft === 0}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 focus:outline-none shadow-lg ${
                      timeLeft === 0 
                        ? 'bg-gray-600/50 text-gray-400 border border-gray-600/50 cursor-not-allowed' 
                        : 'bg-dark-700/50 hover:bg-dark-600/50 text-dark-300 hover:text-white border border-dark-600/50 hover:border-dark-500/50 hover:scale-105'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 12a8 8 0 018-8V2.5L14.5 5 12 7.5V6a6 6 0 100 12 6 6 0 006-6h2a8 8 0 01-16 0z"/>
                      </svg>
                      <span>Перезаписать</span>
                    </div>
                  </button>
                  <button 
                    onClick={handleSendAndNext} 
                    disabled={!transcription.trim()} 
                    className="px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-xl shadow-accent-blue/25 disabled:shadow-none focus:outline-none"
                  >
                    <div className="flex items-center space-x-2">
                      <span>Отправить и продолжить</span>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    </div>
                  </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-8 py-8 flex flex-col justify-center h-full">
                <div className="flex items-center justify-center space-x-8">
                  {/* Кнопка камеры слева */}
                  <button 
                    onClick={() => setShowCameraModal(true)}
                    className="w-12 h-12 bg-dark-700/50 hover:bg-dark-600/50 border border-dark-600/50 hover:border-dark-500/50 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 focus:outline-none"
                    title="Камера"
                  >
                    <svg className="w-6 h-6 text-dark-300 hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                  </button>

                  {/* Микрофон по центру */}
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <AudioRecorder
                      onRecordingStart={handleRecordingStart}
                      onRecordingStop={handleRecordingStop}
                      onUploadSuccess={handleUploadSuccess}
                      onUploadError={handleUploadError}
                      onTranscription={handleTranscription}
                      onAnalysis={handleAnalysis}
                      isRecording={isRecording}
                      disabled={recordingStatus === 'uploading' || interviewStatus !== 'active' || isAISpeaking || isAIPreparingToSpeak || timeLeft === 0}
                    />
                  </div>
                  
                  {/* Видеорекордер (скрытый) */}
                  <VideoRecorder
                    onRecordingStart={handleVideoRecordingStart}
                    onRecordingStop={handleVideoRecordingStop}
                    onVideoReady={handleVideoReady}
                    onError={handleVideoError}
                    isRecording={isVideoRecording}
                    showPreview={false}
                    onCameraAvailable={setCameraAvailable}
                  />
                  
                  {/* Кнопка чата справа */}
                  <button 
                    onClick={toggleChatPanel}
                    className={`w-12 h-12 border rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 focus:outline-none ${
                      showChatPanel 
                        ? 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue' 
                        : 'bg-dark-700/50 hover:bg-dark-600/50 border-dark-600/50 hover:border-dark-500/50 text-dark-300 hover:text-white'
                    }`}
                    title="Чат"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                  </button>
                </div>
                
                {/* Текст под микрофоном */}
                <div className="mt-6 flex justify-center">
                  <div className="text-center">
                    {(isAISpeaking || isAIPreparingToSpeak) ? (
                      <p className="text-white text-sm font-medium">
                        {isAIPreparingToSpeak ? 'Ассистент готовит вопрос...' : 'Ассистент говорит...'}
                      </p>
                    ) : recordingStatus === 'uploading' ? (
                      <p className="text-white text-sm font-medium">Обрабатывается запись...</p>
                    ) : isRecording ? (
                      <p className="text-red-400 text-sm font-medium">Идет запись</p>
                    ) : (
                      <p className="text-dark-300 text-sm">Нажмите микрофон для записи</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default InterviewPage
