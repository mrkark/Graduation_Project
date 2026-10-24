FROM python:3.11-slim

WORKDIR /app

# Системные библиотеки для OpenCV и MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Установка зависимостей с точными версиями для совместимости с MediaPipe Pose Solutions
RUN pip install --no-cache-dir \
    "numpy<2.0.0" \
    "protobuf<5.0.0" \
    "mediapipe>=0.10.14,<=0.10.21" \
    opencv-python-headless \
    fastapi \
    uvicorn \
    pillow \
    qrcode \
    websockets \
    cryptography

COPY . ./

EXPOSE 8000 8088

CMD ["python", "web_studio_server.py"]
