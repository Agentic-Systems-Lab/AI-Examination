#!/bin/bash
# AI Examiner Backend Startup Script

echo "🚀 Starting AI Examiner Backend..."

cd backend

# Activate virtual environment
source ../.venv/bin/activate

# Install/update dependencies
pip install -r requirements.txt

# Start the server
echo "Starting FastAPI server on http://localhost:8000"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
