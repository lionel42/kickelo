# Multi-stage build for Kickelo
FROM node:20-slim AS frontend-builder

WORKDIR /app

# Copy frontend dependencies
COPY package*.json ./
RUN npm ci

# Copy frontend source
COPY vite.config.js ./
COPY index.html ./
COPY src ./src
COPY public ./public

# Build frontend
RUN npm run build

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Expose port
EXPOSE 8000

# Set working directory to backend
WORKDIR /app/backend

# Run FastAPI with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
