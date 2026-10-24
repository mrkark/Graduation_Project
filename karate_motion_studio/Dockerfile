FROM python:3.11-slim

WORKDIR /app

# Системные библиотеки для OpenCV и MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Установка зависимостей
COPY requirements.txt ./
RUN pip install --no-cache-dir uvicorn fastapi opencv-python-headless numpy mediapipe qrcode

COPY . ./

EXPOSE 8000 8088

CMD ["python", "web_studio_server.py"]
