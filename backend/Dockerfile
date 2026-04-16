FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port for Cloud Run
EXPOSE 8000

# Run the agent API server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
