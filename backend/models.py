"""
AI Examiner Data Models

This module contains all the data models used throughout the AI Examiner application.
It includes Pydantic models for API validation and SQLAlchemy models for database operations.

Author: AI Assistant
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

# SQLAlchemy Base
Base = declarative_base()

# Enums
class QuestionType(str, Enum):
    """Enumeration of different question types that can be generated."""
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    TRUE_FALSE = "true_false"

class ExamStatus(str, Enum):
    """Enumeration of exam session statuses."""
    STARTED = "started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# Pydantic Models for API validation
class MaterialUpload(BaseModel):
    """
    Model for material upload request validation.
    
    Attributes:
        title: Title of the uploaded material
        description: Optional description of the content
        subject: Academic subject/field
    """
    title: str = Field(..., min_length=1, max_length=200, description="Title of the material")
    description: Optional[str] = Field(None, max_length=1000, description="Description of the material")
    subject: str = Field(..., min_length=1, max_length=100, description="Academic subject")
    document_type: str = Field(..., description="Type of document (study_material, assignment, thesis, paper)")
    student_email: str = Field(..., description="Student email address")

class QuestionRequest(BaseModel):
    """
    Model for question generation request.
    
    Attributes:
        material_id: ID of the uploaded material
        num_questions: Number of questions to generate
        question_types: Types of questions to generate
        difficulty_level: Difficulty level (1-5)
    """
    material_id: int = Field(..., description="ID of the uploaded material")
    num_questions: int = Field(default=10, ge=1, le=50, description="Number of questions to generate")
    question_types: List[QuestionType] = Field(default=[QuestionType.SHORT_ANSWER], description="Types of questions")
    difficulty_level: int = Field(default=3, ge=1, le=5, description="Difficulty level from 1 (easy) to 5 (hard)")

class Question(BaseModel):
    """
    Model representing a generated question.
    
    Attributes:
        id: Unique question identifier
        text: The question text
        type: Type of question
        options: Multiple choice options (if applicable)
        correct_answer: The correct answer for scoring
        explanation: Explanation of the correct answer
        difficulty_level: Question difficulty
    """
    id: Optional[int] = None
    text: str = Field(..., description="The question text")
    type: QuestionType = Field(..., description="Type of question")
    options: Optional[List[str]] = Field(None, description="Options for multiple choice questions")
    correct_answer: str = Field(..., description="The correct answer")
    explanation: str = Field(..., description="Explanation of the correct answer")
    difficulty_level: int = Field(..., ge=1, le=5, description="Question difficulty level")

class StudentAnswer(BaseModel):
    """
    Model for student's answer to a question.
    
    Attributes:
        question_id: ID of the question being answered
        answer: Student's answer text
        confidence_level: Student's confidence in their answer (1-5)
        time_taken: Time taken to answer in seconds
    """
    question_id: int = Field(..., description="ID of the question")
    answer: str = Field(..., description="Student's answer")
    confidence_level: Optional[int] = Field(None, ge=1, le=5, description="Confidence level")
    time_taken: Optional[int] = Field(None, ge=0, description="Time taken to answer in seconds")

class ExamSession(BaseModel):
    """
    Model representing an exam session.
    
    Attributes:
        id: Session identifier
        material_id: Associated material ID
        status: Current exam status
        current_question: Index of current question
        questions: List of questions in the exam
        answers: Student's answers so far
        start_time: When the exam started
        score: Current score
    """
    id: Optional[int] = None
    material_id: int = Field(..., description="Associated material ID")
    status: ExamStatus = Field(default=ExamStatus.STARTED, description="Exam status")
    current_question: int = Field(default=0, description="Current question index")
    questions: List[Question] = Field(default=[], description="Questions in the exam")
    answers: List[StudentAnswer] = Field(default=[], description="Student's answers")
    start_time: Optional[datetime] = None
    score: Optional[float] = Field(None, ge=0, le=10, description="Current score out of 10")

class FollowUpRequest(BaseModel):
    """
    Model for requesting follow-up questions.
    
    Attributes:
        exam_session_id: ID of the current exam session
        question_id: ID of the original question
        student_answer: Student's answer that triggered follow-up
        context: Additional context for follow-up generation
    """
    exam_session_id: int = Field(..., description="Current exam session ID")
    question_id: int = Field(..., description="Original question ID")
    student_answer: str = Field(..., description="Student's answer")
    context: Optional[str] = Field(None, description="Additional context")



class ScoreReport(BaseModel):
    """
    Model for the final score report.
    
    Attributes:
        exam_session_id: ID of the completed exam session
        final_score: Final score out of 10
        breakdown: Detailed score breakdown by question/topic
        strengths: Areas where student performed well
        weaknesses: Areas needing improvement
        recommendations: Study recommendations
    """
    exam_session_id: int = Field(..., description="Completed exam session ID")
    final_score: float = Field(..., ge=0, le=10, description="Final score out of 10")
    breakdown: Dict[str, Any] = Field(..., description="Detailed score breakdown")
    strengths: List[str] = Field(..., description="Student's strengths")
    weaknesses: List[str] = Field(..., description="Areas for improvement")
    recommendations: List[str] = Field(..., description="Study recommendations")

# SQLAlchemy Database Models
class MaterialDB(Base):
    """
    Database model for uploaded study materials.
    
    This table stores information about materials uploaded by students,
    including metadata and file paths.
    """
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    subject = Column(String(100), nullable=False)
    document_type = Column(String(50), nullable=False, server_default="study_material")
    student_email = Column(String(200), nullable=True)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    content_text = Column(Text)  # Extracted text content
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    
class QuestionDB(Base):
    """
    Database model for generated questions.
    
    This table stores all questions generated from study materials,
    along with their metadata and correct answers.
    """
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, nullable=False)  # Foreign key to materials
    text = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    options = Column(JSON)  # For multiple choice options
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    difficulty_level = Column(Integer, nullable=False)
    created_time = Column(DateTime(timezone=True), server_default=func.now())

class ExamSessionDB(Base):
    """
    Database model for exam sessions.
    
    This table tracks individual exam sessions, including progress,
    answers, and scoring information.
    """
    __tablename__ = "exam_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, nullable=False)  # Foreign key to materials
    student_email = Column(String(200), nullable=True)  # Student email from material
    status = Column(String(50), nullable=False, default="started")
    current_question = Column(Integer, default=0)
    questions_data = Column(JSON)  # Serialized questions list
    answers_data = Column(JSON)    # Serialized answers list
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True))
    final_score = Column(Float)
    score_breakdown = Column(JSON)

class AnswerDB(Base):
    """
    Database model for individual student answers.
    
    This table stores each answer provided by students during exams,
    allowing for detailed analysis and scoring.
    """
    __tablename__ = "answers"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_session_id = Column(Integer, nullable=False)  # Foreign key to exam_sessions
    question_id = Column(Integer, nullable=False)      # Foreign key to questions
    answer_text = Column(Text, nullable=False)
    confidence_level = Column(Integer)
    time_taken = Column(Integer)  # in seconds
    is_correct = Column(Boolean)
    score = Column(Float)  # Partial scoring for complex answers
    feedback = Column(Text)  # AI-generated feedback
    answer_time = Column(DateTime(timezone=True), server_default=func.now()) 