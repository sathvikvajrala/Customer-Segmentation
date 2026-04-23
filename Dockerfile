# Use Python 3.9 slim image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files into the working directory
COPY backend/ .

# Copy frontend files into the working directory
COPY frontend/ ./frontend/

# Ensure data directory exists if it's still needed, but we migrated to DB
# Still, model files are in model/
RUN mkdir -p data

# Expose port (FastAPI default is 8000)
EXPOSE 8000

# Run the application
# Use the PORT env var provided by host platforms like Railway
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
