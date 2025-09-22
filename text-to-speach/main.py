from cartesia import Cartesia
import uvicorn
import io
import json
import wave
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import os
from dotenv import load_dotenv
import logging

load_dotenv()

CARTESIA_API_KEY = os.getenv('CARTESIA_API_KEY', 'default-secret-key')
client = Cartesia(api_key=CARTESIA_API_KEY)
if not CARTESIA_API_KEY:
    logging.error("Не найден CARTESIA_API_KEY в .env файле.")
    exit()
app = FastAPI(title='TTS FastAPI App')

@app.websocket("/ws/speak")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)

            text_to_speak = data.get("text", "")
            logging.info(f'WebSocket получил запрос: text="{text_to_speak}"')
            # Получаем 16-битные PCM-чанки (удобно для совместимости)
            data_chunks = client.tts.bytes(
                model_id="sonic-2",
                transcript=text_to_speak,
                voice={"id": "2b3bb17d-26b9-421f-b8ca-1dd92332279f"},
                output_format={
                    "container": "raw",
                    "encoding": "pcm_s16le",  # 16-bit little-endian
                    "sample_rate": 44100,
                },
            )
            logging.info(f'WebSocket отправил ответ: text="{text_to_speak}"')

            f = io.BytesIO()
            with wave.open(f, 'wb') as w:
                w.setnchannels(1)
                w.setsampwidth(2)          # 16 бит => 2 байта
                w.setframerate(44100)
                w.writeframes(b"".join(data_chunks))

            await websocket.send_bytes(f.getvalue())
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close(code=1011, reason=f"Internal Server Error: {e}")

if __name__ == "__main__":
    print("Запуск FastAPI сервера на http://localhost:8003")
    uvicorn.run(app, host="0.0.0.0", port=8003)
 
