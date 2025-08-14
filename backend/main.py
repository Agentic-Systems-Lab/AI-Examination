"""
ExamFlow Backend - Main Application

This is the main FastAPI application that provides the backend services for the ExamFlow platform.
It handles file uploads, question generation, student interactions, and scoring functionality.

Author: ExamFlow Team
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from routers import upload, questions, exam, scoring, audio

# Import database initialization
from database import init_database

# Initialize FastAPI app
app = FastAPI(
    title="ExamFlow API",
    description="Backend API for the ExamFlow platform - Seamless AI-Powered Testing for university students",
    version="1.0.0"
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],  # React/Vite dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("questions", exist_ok=True)
os.makedirs("audio_temp", exist_ok=True)
os.makedirs("audio_cache", exist_ok=True)
os.makedirs("exam_logs", exist_ok=True)

# Initialize database
init_database()

# Mount static files for serving uploaded content
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# Include routers
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(questions.router, prefix="/api/questions", tags=["Questions"])
app.include_router(exam.router, prefix="/api/exam", tags=["Exam"])
app.include_router(scoring.router, prefix="/api/scoring", tags=["Scoring"])
app.include_router(audio.router, prefix="/api/audio", tags=["Audio"])

@app.get("/")
async def root():
    """
    Root endpoint that provides basic API information.
    
    Returns:
        dict: Welcome message and API status
    """
    return {
        "message": "ExamFlow API is running",
        "version": "1.0.0",
        "status": "active"
    }

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring the API status.
    
    Returns:
        dict: Health status information
    """
    return {
        "status": "healthy",
        "service": "ExamFlow API"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 