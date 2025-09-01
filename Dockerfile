# Texas 811 POC Backend - Railway Deployment
FROM python:3.11-slim

# Set environment variables for Python and uv
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/0.4.10/install.sh | sh

# Add uv to PATH
ENV PATH="/root/.cargo/bin:$PATH"

# Copy project files
COPY pyproject.toml requirements.txt README.md ./
COPY src/ ./src/

# Install dependencies with uv
RUN uv pip install --system -r requirements.txt \
    && uv pip install --system -e .

# Set PYTHONPATH for proper imports
ENV PYTHONPATH="/app/src"

# Create data directories
RUN mkdir -p /data /app/data

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:${PORT:-8000}/health')" || exit 1

# Start the application using startup.py which handles PORT environment variable
CMD ["python", "src/startup.py"]
