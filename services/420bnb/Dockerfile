FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY services/420bnb/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && useradd -r -u 10001 bnb
COPY services/420bnb/api.py /app/api.py
USER bnb
EXPOSE 8080
CMD ["uvicorn","api:app","--host","0.0.0.0","--port","8080","--proxy-headers=false"]
