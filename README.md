# AI Examiner 🎓

An advanced AI-powered examination tool designed for university students to test their knowledge through interactive Q&A sessions with voice integration. The system uses OpenAI's GPT-4 for question generation and Whisper for speech-to-text capabilities, creating a comprehensive oral and written examination experience.

## 🌟 Features

### Core Functionality
- **📚 Material Upload**: Support for PDF, DOCX, and TXT files
- **🤖 AI Question Generation**: Automatic question creation using OpenAI GPT-4
- **📝 Interactive Exams**: Dynamic question-answer sessions
- **🗣️ Voice Integration**: Oral exam simulation with OpenAI Whisper
- **📊 Comprehensive Scoring**: Advanced scoring algorithm (0-10 scale)
- **💬 Follow-up Questions**: AI-generated deeper inquiry questions
- **📈 Performance Analytics**: Detailed score reports and recommendations

### Advanced Features
- **🎯 Adaptive Difficulty**: Questions adapted to student performance
- **⏱️ Time Tracking**: Response time analysis
- **🔊 Text-to-Speech**: AI-generated audio feedback
- **📱 Real-time Chat**: Interactive conversation interface
- **📋 Question Export**: Save generated questions to text files
- **🎨 Modern UI**: Beautiful, responsive interface with Tailwind CSS

## 🏗️ Architecture

### Backend (Python/FastAPI)
- **FastAPI** - High-performance web framework
- **SQLAlchemy** - Database ORM with SQLite/PostgreSQL support
- **OpenAI API** - GPT-4 for question generation, Whisper for voice
- **Pydantic** - Data validation and serialization
- **Uvicorn** - ASGI server for production deployment

### Frontend (TypeScript/React)
- **React 18** - Modern React with hooks and context
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client for API communication

## 🚀 Quick Start

### Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- **npm 9+**
- **OpenAI API Key**

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ai-examiner.git
cd ai-examiner
```

### 2. Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=sqlite:///./ai_examiner.db
DEBUG=True
```

#### Initialize Database
```bash
python -c "from database import init_database; init_database()"
```

#### Start Backend Server
```bash
# Development mode
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

#### Install Node Dependencies
```bash
cd frontend
npm install
```

#### Start Development Server
```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📖 Usage Guide

### 1. Upload Study Material
1. Navigate to the upload section
2. Select a PDF, DOCX, or TXT file containing study material
3. Provide a title, description, and subject
4. Click "Upload and Process"

### 2. Generate Questions
1. Select your uploaded material
2. Choose number of questions (1-50)
3. Select question types:
   - Multiple Choice
   - Short Answer
   - Essay
   - True/False
4. Set difficulty level (1-5)
5. Click "Generate Questions"

### 3. Take an Exam
1. Start a new exam session
2. Answer questions using text or voice input
3. Get real-time feedback and explanations
4. Receive follow-up questions for deeper understanding

### 4. Voice Features
- **Recording**: Click the microphone to record voice answers
- **Transcription**: Automatic speech-to-text conversion
- **Feedback**: AI-generated audio responses
- **Oral Exam Mode**: Full voice-based examination experience

### 5. Review Results
- View comprehensive score report (0-10 scale)
- Analyze performance by difficulty level
- Read AI-generated strengths and weaknesses
- Get personalized study recommendations

## 🔧 API Documentation

### Core Endpoints

#### Materials Management
```bash
POST /api/upload/material          # Upload study material
GET  /api/upload/materials         # List all materials
GET  /api/upload/material/{id}     # Get specific material
DELETE /api/upload/material/{id}   # Delete material
```

#### Question Generation
```bash
POST /api/questions/generate       # Generate questions from material
GET  /api/questions/material/{id}  # Get questions for material
GET  /api/questions/{id}           # Get specific question
DELETE /api/questions/{id}         # Delete question
```

#### Exam Sessions
```bash
POST /api/exam/start               # Start new exam session
GET  /api/exam/session/{id}        # Get session status
POST /api/exam/session/{id}/answer # Submit answer
POST /api/exam/session/{id}/followup # Generate follow-up question
GET  /api/exam/session/{id}/progress # Get detailed progress
```

#### Voice Features
```bash
POST /api/voice/transcribe         # Transcribe audio to text
POST /api/voice/synthesize         # Convert text to speech
POST /api/voice/record-session     # Record voice session
```

#### Scoring & Analytics
```bash
POST /api/scoring/session/{id}/calculate # Calculate comprehensive score
GET  /api/scoring/session/{id}/report    # Get detailed score report
GET  /api/scoring/sessions/history       # Get exam history
```

## 🔒 Environment Variables

### Required Settings
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=sqlite:///./ai_examiner.db

# Application
DEBUG=False
SECRET_KEY=your_secret_key_here

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIRECTORY=uploads

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Optional Settings
```bash
# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Voice Processing
AUDIO_DIRECTORY=audio
MAX_AUDIO_DURATION=300  # 5 minutes
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest -v                    # Run all tests
pytest tests/test_upload.py   # Test specific module
pytest --cov=.               # Run with coverage
```

### Frontend Tests
```bash
cd frontend
npm test                     # Run unit tests
npm run test:coverage        # Run with coverage
npm run test:e2e            # Run end-to-end tests
```

## 📝 Development

### Project Structure
```
ai-examiner/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Data models
│   ├── database.py          # Database configuration
│   ├── routers/             # API route handlers
│   │   ├── upload.py        # File upload endpoints
│   │   ├── questions.py     # Question generation
│   │   ├── exam.py          # Exam session management
│   │   ├── scoring.py       # Scoring and analytics
│   │   └── voice.py         # Voice processing
│   ├── uploads/             # Uploaded files
│   ├── questions/           # Generated question files
│   └── audio/               # Voice recordings
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── dist/                # Built files
└── README.md                # This file
```

### Adding New Features

#### Backend
1. Create new endpoint in appropriate router
2. Add request/response models in `models.py`
3. Update database schema if needed
4. Add comprehensive docstrings and error handling

#### Frontend
1. Create TypeScript types in `src/types/`
2. Add API service functions in `src/services/`
3. Create React components with proper props typing
4. Add routing if necessary

## 🔧 Configuration

### OpenAI API Setup
1. Create account at [OpenAI](https://platform.openai.com/)
2. Generate API key in dashboard
3. Set up billing and usage limits
4. Add key to `.env` file

### Database Configuration
- **SQLite**: Default, no additional setup required
- **PostgreSQL**: Update `DATABASE_URL` with connection string
- **MySQL**: Install `pymysql` and update connection string

### Production Deployment

#### Backend
```bash
# Install production dependencies
pip install gunicorn

# Run with Gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

#### Frontend
```bash
# Build for production
npm run build

# Serve with your preferred web server
# Example with nginx or serve
npx serve -s dist -l 3000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with proper tests and documentation
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines
- Follow PEP 8 for Python code
- Use ESLint/Prettier for TypeScript/React code
- Write comprehensive docstrings and comments
- Add tests for new functionality
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 and Whisper APIs
- **FastAPI** for the excellent web framework
- **React Team** for the powerful frontend library
- **Tailwind CSS** for the utility-first CSS framework

## 📞 Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Check the [API Documentation](http://localhost:8000/docs)
- Review the comprehensive docstrings in the code

---

**Built with ❤️ for university students worldwide**