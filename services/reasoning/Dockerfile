# Stage 1: compile llama.cpp into a wheel. The full Python image already has the C/C++ toolchain;
# cmake comes from PyPI. Built for generic x86-64 with AVX2 (not this machine's CPU) so the same
# image runs on the presenter laptop and the VM.
FROM python:3.13 AS build
COPY docker/certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt > /usr/local/share/extra-ca.pem 2>/dev/null || true
COPY services/reasoning/requirements-llm.txt .
RUN set -eux; CERT=""; if [ -s /usr/local/share/extra-ca.pem ]; then CERT="--cert /usr/local/share/extra-ca.pem"; fi; \
    CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_OPENMP=OFF" \
    pip wheel --no-cache-dir $CERT -w /wheels -r requirements-llm.txt

# Stage 2: slim runtime.
FROM python:3.13-slim
WORKDIR /app
COPY docker/certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt > /usr/local/share/extra-ca.pem 2>/dev/null || true
COPY --from=build /wheels /wheels
COPY services/reasoning/requirements.txt .
RUN set -eux; CERT=""; if [ -s /usr/local/share/extra-ca.pem ]; then CERT="--cert /usr/local/share/extra-ca.pem"; fi; \
    pip install --no-cache-dir $CERT -r requirements.txt /wheels/*.whl; rm -rf /wheels /tmp/certs /usr/local/share/extra-ca.pem
COPY services/reasoning/app app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
