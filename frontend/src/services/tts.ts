/**
 * WebSocket клиент для TTS (Text-to-Speech) сервера
 * Подключается к TTS серверу через Nginx проксирование
 */
import { getConfig } from '../config/environment'

export class TTSClient {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 5;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;

  constructor(private url: string = getConfig().WS_TTS_URL) {}

  /**
   * Подключение к TTS серверу
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.isConnecting = true;
      console.log('Подключение к TTS серверу...', this.url);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('TTS WebSocket подключен');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('Ошибка TTS WebSocket:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('TTS WebSocket отключен');
          this.isConnecting = false;
          this.scheduleReconnect();
        };

      } catch (error) {
        console.error('Ошибка создания TTS WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Синтез речи из текста
   */
  async speak(text: string, speaker: string = 'xenia', sampleRate: number = 48000): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      // Убеждаемся что соединение установлено
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        try {
          await this.connect();
        } catch (error) {
          reject(new Error('Не удалось подключиться к TTS серверу'));
          return;
        }
      }

      // Дополнительная проверка - ждём пока соединение точно не будет готово
      try {
        await this.waitForConnection();
      } catch (error) {
        reject(error);
        return;
      }

      // Убираем таймаут, так как синтез может занимать много времени для длинных текстов
      // const timeout = setTimeout(() => {
      //   reject(new Error('Timeout: TTS сервер не ответил'));
      // }, 30000);

      // Настраиваем обработчик для получения аудио
      const messageHandler = (event: MessageEvent) => {
        if (event.data instanceof Blob) {
          this.ws!.removeEventListener('message', messageHandler);
          console.log('Получено аудио от TTS сервера:', event.data.size, 'байт');
          resolve(event.data);
        }
      };

      this.ws!.addEventListener('message', messageHandler);

      // Отправляем запрос на синтез только после проверки готовности
      const request = {
        text: text,
        speaker: speaker,
        sample_rate: sampleRate
      };

      console.log('Отправляем запрос на TTS синтез:', request);
      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Ожидание готовности соединения
   */
  private waitForConnection(timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout ожидания готовности WebSocket соединения'));
      }, timeout);

      const checkConnection = () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          clearTimeout(timeoutId);
          resolve();
        } else if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
          clearTimeout(timeoutId);
          reject(new Error('WebSocket соединение закрыто'));
        } else {
          // Проверяем снова через 100ms
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Планирование переподключения
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения к TTS серверу ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${this.reconnectInterval}ms`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Ошибка переподключения к TTS серверу:', error);
        });
      }, this.reconnectInterval);
    } else {
      console.error('Превышено максимальное количество попыток переподключения к TTS серверу');
    }
  }

  /**
   * Отключение от сервера
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Проверка состояния подключения
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Создаем глобальный экземпляр TTS клиента
export const ttsClient = new TTSClient();
