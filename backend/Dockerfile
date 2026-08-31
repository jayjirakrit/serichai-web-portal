FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# No HEALTHCHECK here: docker-compose.yml defines the backend service's
# healthcheck (GET /docs, FastAPI's built-in Swagger UI) so it isn't
# duplicated in both places (research.md #7).

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
