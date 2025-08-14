#!/bin/bash
# AI Examiner Frontend Startup Script

echo "🚀 Starting AI Examiner Frontend..."

cd frontend

# Install/update dependencies
npm install

# Start the development server
echo "Starting Vite dev server on http://localhost:3000"
npm run dev
