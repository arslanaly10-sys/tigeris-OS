FROM python:3.13-slim
WORKDIR /app
COPY docker/certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt > /usr/local/share/extra-ca.pem 2>/dev/null || true
COPY services/reasoning/requirements.txt .
RUN if [ -s /usr/local/share/extra-ca.pem ]; then pip install --no-cache-dir --cert /usr/local/share/extra-ca.pem -r requirements.txt; else pip install --no-cache-dir -r requirements.txt; fi
COPY services/reasoning/app app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
