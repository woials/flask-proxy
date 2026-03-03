FROM python:3.12-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
ENV TZ=Asia/Tokyo

CMD ["gunicorn", "-k", "gevent", "-w", "4", "--timeout", "300", "-b", "0.0.0.0:5000", "main:app"]