import os
import requests
import logging
from flask import abort
YC_IAM_TOKEN = os.getenv("YC_IAM_TOKEN")
YC_FOLDER_ID = os.getenv("YC_FOLDER_ID")
CHANNEL_ID = os.getenv("CHANNEL_ID")

if not all([YC_IAM_TOKEN, YC_FOLDER_ID, CHANNEL_ID]):
    logging.warning("⚠️ Переменные окружения Yandex Cloud не настроены. Загрузка видео будет недоступна.")
    logging.warning("Необходимо определить: YC_IAM_TOKEN, YC_FOLDER_ID, CHANNEL_ID")

def delete_video_in_yc(yc_video_id: str) -> None:
    headers = {
        "Authorization": f"Bearer {YC_IAM_TOKEN}",
    }
    response = requests.delete(f"https://video.api.cloud.yandex.net/video/v1/videos/{yc_video_id}", headers=headers)
    
    if response.status_code != 200:
        logging.error(f"!!! Ошибка от API Яндекса: {response.text}")
        abort(500, {"description":f"Yandex Cloud API Error: {response.text}"})

def create_video_in_yc(filename: str, filesize: int) -> tuple[str, str]:
    """Создает видеообъект в Yandex Cloud и возвращает URL для загрузки и ID видео."""
    headers = {
        "Authorization": f"Bearer {YC_IAM_TOKEN}",
        "Content-Type": "application/json",
    }
    data = {
        "channelId": CHANNEL_ID,
        "title": filename,
        "folderId": YC_FOLDER_ID,
        "tusd": {"fileSize": str(filesize), "fileName": filename},
        "publicAccess": {}
    }
    logging.info(f">>> Отправка данных в Yandex Cloud API: {data}")
    response = requests.post("https://video.api.cloud.yandex.net/video/v1/videos", headers=headers, json=data)
    
    if response.status_code != 200:
        logging.error(f"!!! Ошибка от API Яндекса: {response.text}")
        abort(500, description=f"Yandex Cloud API Error: {response.text}")

    response_data = response.json()
    logging.info(f"<<< Получен ответ от Yandex Cloud API: {response_data}")

    try:
        yc_video_id = response_data["metadata"]["videoId"]
        upload_url = response_data["response"]["tusd"]["url"]

    except KeyError as e:
        logging.error(f"!!! Не удалось найти ключ {e} в ответе от API")
        abort(500, description="Не удалось разобрать ответ от API Яндекса.")
    
    if not upload_url or not yc_video_id:
        abort(500, description="Не удалось получить upload_url или video_id из ответа API.")
        
    return upload_url, yc_video_id

def get_video_in_yc(yc_video_id: str) -> None:
    headers = {"Authorization": f"Bearer {YC_IAM_TOKEN}"}
    
    try:

        status_url = f"https://video.api.cloud.yandex.net/video/v1/videos/{yc_video_id}"
        status_response = requests.get(status_url, headers=headers)
        status_response.raise_for_status()
        video_data = status_response.json()
        video_status = video_data.get("status")
        logging.info(f"Статус видео {yc_video_id}: {video_status}")

        if video_status != 'READY':
            return {"status": "processing", "message": f"Video is still processing. Current status: {video_status}"}, 202 

        publish_url = f"https://video.api.cloud.yandex.net/video/v1/videos/{yc_video_id}:getPlayerURL"
        publish_response = requests.get(publish_url, headers=headers)
        publish_response.raise_for_status()
        publish_data = publish_response.json()
        hls_url = publish_data.get("playerUrl")

        if not hls_url:
            return {"detail": "HLS manifest not found even though video is published."}, 404
            
        return {"status": "ready", "hls_url": hls_url},200
    except requests.exceptions.RequestException as e:
        logging.error(f"Ошибка при обращении к YC API: {e}")
        return {"detail":str(e)}, 502
    except Exception as e:
        logging.error(f"Неизвестная ошибка в get_playback_url: {e}")
        return {"detail":str(e)}, 500
