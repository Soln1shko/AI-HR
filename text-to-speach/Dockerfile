# 1. Используем официальный образ Python 3.11 в slim-версии
FROM python:3.11-slim

# 2. Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

RUN apt-get update && apt-get install -y build-essential libsndfile1 ffmpeg && rm -rf /var/lib/apt/lists/*
# 3. Копируем файл с зависимостями в рабочую директорию
COPY requirements.txt .

# 4. Устанавливаем зависимости
# --no-cache-dir уменьшает размер слоя
RUN pip install --no-cache-dir -r requirements.txt

# 5. Копируем исходный код приложения
COPY main.py .

# 6. Открываем порт, на котором будет работать приложение
EXPOSE 8003

# 7. Задаем команду для запуска приложения при старте контейнера
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
