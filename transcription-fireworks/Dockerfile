# Transcription (Whisper) Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system deps (ffmpeg for audio)
RUN apt-get update && apt-get install -y build-essential ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*

# Copy sources
COPY . /app

# Install Python deps (CPU Torch first) + websockets support
RUN pip install  --upgrade pip \
    && pip install -r requirements.txt

EXPOSE 8001

CMD ["python", "main.py"]
