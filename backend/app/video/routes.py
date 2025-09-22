import os
import requests
import logging
from flask import Flask, request, jsonify, abort, Blueprint
from werkzeug.exceptions import HTTPException
from ..services.video_yc import create_video_in_yc, get_video_in_yc

video_bp = Blueprint('video', __name__)

@video_bp.route("/upload-video/", methods=['POST'])
def upload_video():
    """Принимает файл, загружает в Yandex Cloud и возвращает yc_video_id."""
    
    if 'file' not in request.files:
        return jsonify({"detail": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No selected file"}), 400

    try:
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        print(file)
        upload_url, yc_video_id = create_video_in_yc(file.filename, file_size)
        print(upload_url, yc_video_id)
        tus_headers = {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream"
        }
        upload_response = requests.patch(upload_url, data=file, headers=tus_headers)
        upload_response.raise_for_status()

        return jsonify({"message": f"File '{file.filename}' uploaded.", "yc_video_id": yc_video_id})
    except Exception as e:
        logging.error(f"Произошла ошибка в /upload-video/: {e}")
        if isinstance(e, HTTPException):
            return jsonify(detail=e.description), e.code
        return jsonify(detail=str(e)), 500


@video_bp.route("/videos/<string:yc_video_id>/playback", methods=['GET'])
def get_playback_url(yc_video_id: str):
    """Получает ссылку на HLS, предварительно проверив статус обработки видео."""
    dict , code = get_video_in_yc(yc_video_id)
    return jsonify(dict), code

