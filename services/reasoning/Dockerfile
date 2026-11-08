FROM python:3.13-slim
WORKDIR /app
COPY docker/certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt > /usr/local/share/extra-ca.pem 2>/dev/null || true
COPY services/reasoning/requirements.txt services/reasoning/requirements-llm.txt ./
# llama.cpp is compiled for the host CPU; the build tools are removed afterwards.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake && \
    CERT=""; if [ -s /usr/local/share/extra-ca.pem ]; then CERT="--cert /usr/local/share/extra-ca.pem"; fi; \
    pip install --no-cache-dir $CERT -r requirements.txt -r requirements-llm.txt && \
    apt-get purge -y build-essential cmake && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY services/reasoning/app app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
