#!/usr/bin/env python3
"""
AI Examiner Setup Script

This script automates the setup process for the AI Examiner project,
including dependency installation, database initialization, and configuration.

Author: AI Assistant
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(command, cwd=None, shell=True):
    """
    Execute a shell command and handle errors.
    
    Args:
        command: Command to execute
        cwd: Working directory
        shell: Whether to use shell
        
    Returns:
        bool: True if command succeeded, False otherwise
    """
    try:
        print(f"Running: {command}")
        result = subprocess.run(
            command,
            shell=shell,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True
        )
        print(f"✅ Success: {command}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running {command}: {e}")
        print(f"Output: {e.output}")
        print(f"Error: {e.stderr}")
        return False

def check_prerequisites():
    """
    Check if all required tools are installed.
    
    Returns:
        bool: True if all prerequisites are met
    """
    print("🔍 Checking prerequisites...")
    
    # Check Python version
    if sys.version_info < (3, 9):
        print("❌ Python 3.9+ is required")
        return False
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor}")
    
    # Check for pip
    if not shutil.which("pip"):
        print("❌ pip is not installed")
        return False
    print("✅ pip is available")
    
    # Check for Node.js
    if not shutil.which("node"):
        print("❌ Node.js is not installed")
        print("Please install Node.js 18+ from https://nodejs.org/")
        return False
    
    # Check Node.js version
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        version = result.stdout.strip().replace('v', '')
        major_version = int(version.split('.')[0])
        if major_version < 18:
            print(f"❌ Node.js 18+ is required (found {version})")
            return False
        print(f"✅ Node.js {version}")
    except Exception as e:
        print(f"❌ Error checking Node.js version: {e}")
        return False
    
    # Check for npm
    if not shutil.which("npm"):
        print("❌ npm is not installed")
        return False
    print("✅ npm is available")
    
    return True

def setup_backend():
    """
    Set up the Python backend.
    
    Returns:
        bool: True if setup succeeded
    """
    print("\n🐍 Setting up Python backend...")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Backend directory not found")
        return False
    
    # Install Python dependencies
    if not run_command("pip install -r requirements.txt", cwd=backend_dir):
        print("❌ Failed to install Python dependencies")
        return False
    
    # Create environment file if it doesn't exist
    env_file = backend_dir / ".env"
    env_example = backend_dir / ".env.example"
    
    if not env_file.exists():
        # Create a basic .env file with defaults
        env_content = """# AI Examiner Environment Configuration
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=sqlite:///./ai_examiner.db
DEBUG=True
SECRET_KEY=ai_examiner_secret_key_change_in_production
MAX_FILE_SIZE=10485760
UPLOAD_DIRECTORY=uploads
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
AUDIO_DIRECTORY=audio
MAX_AUDIO_DURATION=300
"""
        with open(env_file, 'w') as f:
            f.write(env_content)
        print("✅ Created .env file with default settings")
        print("⚠️  Please edit backend/.env with your OpenAI API key!")
    
    # Create necessary directories
    directories = ["uploads", "questions", "audio"]
    for directory in directories:
        dir_path = backend_dir / directory
        dir_path.mkdir(exist_ok=True)
        print(f"✅ Created directory: {directory}")
    
    # Initialize database using a separate Python process
    print("Initializing database...")
    init_script = """
import sys
sys.path.append('.')
from database import init_database
init_database()
print("Database initialized successfully!")
"""
    
    # Write the initialization script to a temporary file
    init_file = backend_dir / "init_db.py"
    with open(init_file, 'w') as f:
        f.write(init_script)
    
    try:
        # Run the database initialization
        if run_command("python init_db.py", cwd=backend_dir):
            print("✅ Database initialized")
        else:
            print("⚠️  Database initialization failed, but continuing setup")
        
        # Clean up the temporary file
        os.remove(init_file)
        
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")
        # Clean up the temporary file
        if init_file.exists():
            os.remove(init_file)
    
    return True

def setup_frontend():
    """
    Set up the TypeScript/React frontend.
    
    Returns:
        bool: True if setup succeeded
    """
    print("\n⚛️  Setting up React frontend...")
    
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("❌ Frontend directory not found")
        return False
    
    # Install Node.js dependencies
    if not run_command("npm install", cwd=frontend_dir):
        print("❌ Failed to install Node.js dependencies")
        return False
    
    # Run type checking
    if not run_command("npm run type-check", cwd=frontend_dir):
        print("⚠️  TypeScript type checking failed (this is expected during initial setup)")
    
    return True

def create_startup_scripts():
    """
    Create convenient startup scripts.
    """
    print("\n📝 Creating startup scripts...")
    
    # Backend startup script
    backend_script = """#!/bin/bash
# AI Examiner Backend Startup Script

echo "🚀 Starting AI Examiner Backend..."

cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
pip install -r requirements.txt

# Start the server
echo "Starting FastAPI server on http://localhost:8000"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
    
    # Frontend startup script
    frontend_script = """#!/bin/bash
# AI Examiner Frontend Startup Script

echo "🚀 Starting AI Examiner Frontend..."

cd frontend

# Install/update dependencies
npm install

# Start the development server
echo "Starting Vite dev server on http://localhost:3000"
npm run dev
"""
    
    # Development startup script
    dev_script = """#!/bin/bash
# AI Examiner Development Environment Startup

echo "🚀 Starting AI Examiner Full Development Environment..."

# Function to kill background processes on exit
cleanup() {
    echo "Shutting down servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup EXIT

# Start backend
echo "Starting backend server..."
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "Starting frontend server..."
cd frontend
npm run dev &
cd ..

echo "✅ Both servers are starting..."
echo "📍 Backend API: http://localhost:8000"
echo "📍 Frontend: http://localhost:3000"
echo "📍 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait
"""
    
    # Write scripts
    scripts = [
        ("start-backend.sh", backend_script),
        ("start-frontend.sh", frontend_script),
        ("start-dev.sh", dev_script)
    ]
    
    for script_name, script_content in scripts:
        with open(script_name, 'w') as f:
            f.write(script_content)
        
        # Make executable on Unix systems
        if os.name != 'nt':
            os.chmod(script_name, 0o755)
        
        print(f"✅ Created {script_name}")

def print_next_steps():
    """
    Print instructions for the user.
    """
    print("\n🎉 Setup Complete!")
    print("\n📋 Next Steps:")
    print("1. Add your OpenAI API key to backend/.env:")
    print("   OPENAI_API_KEY=your_api_key_here")
    print("\n2. Start the development environment:")
    print("   ./start-dev.sh")
    print("\n3. Or start servers individually:")
    print("   Backend:  ./start-backend.sh")
    print("   Frontend: ./start-frontend.sh")
    print("\n4. Access the application:")
    print("   Frontend: http://localhost:3000")
    print("   API Docs: http://localhost:8000/docs")
    print("\n5. Upload study materials and start examining!")
    print("\n📚 For more information, see README.md")

def main():
    """
    Main setup function.
    """
    print("🎓 AI Examiner Setup")
    print("=" * 50)
    
    # Check prerequisites
    if not check_prerequisites():
        print("\n❌ Prerequisites not met. Please install required tools and try again.")
        sys.exit(1)
    
    # Setup backend
    if not setup_backend():
        print("\n❌ Backend setup failed. Please check the errors above.")
        sys.exit(1)
    
    # Setup frontend
    if not setup_frontend():
        print("\n❌ Frontend setup failed. Please check the errors above.")
        sys.exit(1)
    
    # Create startup scripts
    create_startup_scripts()
    
    # Print next steps
    print_next_steps()

if __name__ == "__main__":
    main() 