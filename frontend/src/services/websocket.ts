// Глобальный экземпляр WebSocket клиента для переиспользования
import { getConfig } from '../config/environment'

let globalWebSocketClient: VoiceTranscriptionClient | null = null

// WebSocket клиент для real-time транскрипции
export class VoiceTranscriptionClient {
  private ws: WebSocket | null = null
  private isConnected = false
  private messageQueue: any[] = []
  private onTranscriptionCallback?: (text: string) => void
  private onAnalysisCallback?: (analysis: any) => void
  private onErrorCallback?: (error: string) => void
  private onConnectedCallback?: () => void
  private onDisconnectedCallback?: () => void

  constructor(
    onTranscription?: (text: string) => void,
    onError?: (error: string) => void,
    onConnected?: () => void,
    onDisconnected?: () => void,
    onAnalysis?: (analysis: any) => void
  ) {
    this.onTranscriptionCallback = onTranscription
    this.onErrorCallback = onError
    this.onConnectedCallback = onConnected
    this.onDisconnectedCallback = onDisconnected
    this.onAnalysisCallback = onAnalysis
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Подключаемся к WebSocket серверу транскрипции (порт 8001)
        this.ws = new WebSocket(getConfig().WS_VOICE_URL)
        
        this.ws.onopen = () => {
          console.log('WebSocket подключен для транскрипции на ws://localhost:8001/ws/voice')
          this.isConnected = true
          
          // Отправляем накопленные сообщения
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()
            console.log('Отправляем накопленное сообщение:', message)
            this.ws?.send(JSON.stringify(message))
          }
          
          this.onConnectedCallback?.()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            console.log('Получено сообщение от WebSocket:', event.data)
            const data = JSON.parse(event.data)
            
            if (data.type === 'transcription') {
              console.log('Получена транскрипция:', data.text)
              this.onTranscriptionCallback?.(data.text)
              
              // После получения транскрипции НЕ закрываем соединение автоматически
              // Соединение остается открытым для следующей записи
              console.log('Транскрипция обработана, соединение остается открытым')
            } else if (data.type === 'final_result') {
              console.log('Получен финальный результат:', data)
              console.log('Транскрипция:', data.transcription)
              console.log('Анализ:', data.analysis)
              
              // Отправляем транскрипцию через callback
              this.onTranscriptionCallback?.(data.transcription)
              
              // Если есть callback для анализа, отправляем и его
              if (this.onAnalysisCallback) {
                this.onAnalysisCallback(data.analysis)
              }
              
              console.log('Финальный результат обработан, соединение остается открытым')
            } else {
              console.log('Неизвестный тип сообщения:', data.type)
            }
          } catch (error) {
            console.error('Ошибка при разборе сообщения:', error)
            this.onErrorCallback?.('Ошибка при разборе ответа сервера')
          }
        }

        this.ws.onclose = () => {
          console.log('WebSocket отключен')
          this.isConnected = false
          this.onDisconnectedCallback?.()
        }

        this.ws.onerror = (error) => {
          console.error('Ошибка WebSocket:', error)
          this.onErrorCallback?.('Ошибка подключения к серверу транскрипции')
          reject(error)
        }
      } catch (error) {
        console.error('Ошибка при создании WebSocket:', error)
        reject(error)
      }
    })
  }

  sendAudioChunk(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket не подключен, пропускаем аудио чанк')
      return
    }

    if (audioData.byteLength === 0) {
      console.warn('Получен пустой аудио чанк, пропускаем')
      return
    }

    try {
      // Конвертируем ArrayBuffer в base64
      const uint8Array = new Uint8Array(audioData)
      const binaryString = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('')
      const base64Data = btoa(binaryString)

      const message = {
        type: 'audio_chunk',
        data: base64Data
      }

      console.log(`Отправляем аудио чанк размером ${audioData.byteLength} байт (base64: ${base64Data.length} символов)`)
      this.ws.send(JSON.stringify(message))
      console.log('Аудио чанк успешно отправлен')
    } catch (error) {
      console.error('Ошибка при отправке аудио чанка:', error)
      this.onErrorCallback?.('Ошибка при отправке аудио данных')
    }
  }

  endTranscription(): void {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket не подключен для завершения транскрипции')
      return
    }

    try {
      const message = {
        type: 'end'
      }

      console.log('Отправляем сигнал завершения транскрипции')
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Ошибка при завершении транскрипции:', error)
      this.onErrorCallback?.('Ошибка при завершении транскрипции')
    }
  }

  disconnect(): void {
    if (this.ws) {
      console.log('Закрываем WebSocket соединение')
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  // Публичный геттер для состояния подключения
  get connected(): boolean {
    return this.isConnected
  }

  // Метод для обновления коллбэков без пересоздания соединения
  updateCallbacks(
    onTranscription?: (text: string) => void,
    onError?: (error: string) => void,
    onConnected?: () => void,
    onDisconnected?: () => void,
    onAnalysis?: (analysis: any) => void
  ): void {
    this.onTranscriptionCallback = onTranscription
    this.onErrorCallback = onError
    this.onConnectedCallback = onConnected
    this.onDisconnectedCallback = onDisconnected
    this.onAnalysisCallback = onAnalysis
  }
}

// Функция для получения глобального экземпляра WebSocket клиента
export const getGlobalWebSocketClient = (
  onTranscription?: (text: string) => void,
  onError?: (error: string) => void,
  onConnected?: () => void,
  onDisconnected?: () => void,
  onAnalysis?: (analysis: any) => void
): VoiceTranscriptionClient => {
  if (!globalWebSocketClient) {
    console.log('Создаем новый глобальный WebSocket клиент')
    globalWebSocketClient = new VoiceTranscriptionClient(
      onTranscription,
      onError,
      onConnected,
      onDisconnected,
      onAnalysis
    )
  } else {
    console.log('Переиспользуем существующий WebSocket клиент')
    globalWebSocketClient.updateCallbacks(onTranscription, onError, onConnected, onDisconnected, onAnalysis)
  }
  
  return globalWebSocketClient
}
