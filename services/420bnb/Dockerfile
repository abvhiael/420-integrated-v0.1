ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}
ARG BNB_BUILD_SHA
LABEL org.opencontainers.image.revision=$BNB_BUILD_SHA
ENV BNB_BUILD_SHA=$BNB_BUILD_SHA
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY services/420bnb/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && useradd -r -u 10001 bnb
COPY services/420bnb/production.py /app/production.py
COPY services/420bnb/migrate.py /app/migrate.py
COPY services/420bnb/migrations/ /app/migrations/
COPY services/420bnb/api.py /app/api.py
COPY services/420bnb/identity.py /app/identity.py
COPY services/420bnb/authority.py /app/authority.py
COPY services/420bnb/calendar_engine.py /app/calendar_engine.py
COPY services/420bnb/availability_projection.py /app/availability_projection.py
COPY services/420bnb/discovery_sync.py /app/discovery_sync.py
COPY services/420bnb/outbox.py /app/outbox.py
COPY services/420bnb/pricing.py /app/pricing.py
COPY services/420bnb/travel_location.py /app/travel_location.py
USER bnb
EXPOSE 8080
CMD ["uvicorn","api:app","--host","0.0.0.0","--port","8080","--no-proxy-headers"]

