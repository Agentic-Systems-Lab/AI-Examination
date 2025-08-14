"""
Scoring Router

This module handles comprehensive scoring analysis, performance evaluation,
and generates detailed score reports for completed exam sessions.

Author: AI Assistant
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from openai import OpenAI
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import statistics
import os

# Local imports
from database import get_database_session
from models import (
    ExamSessionDB, AnswerDB, QuestionDB, MaterialDB,
    ScoreReport, ExamStatus
)

router = APIRouter()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def calculate_detailed_score(session: ExamSessionDB, db: Session) -> Dict[str, Any]:
    """
    Calculate a comprehensive score for an exam session.
    
    This function performs detailed analysis of the student's performance,
    considering multiple factors beyond simple correctness.
    
    Args:
        session: The completed exam session
        db: Database session
        
    Returns:
        Dict containing detailed scoring analysis
    """
    answers_data = session.answers_data or []
    questions_data = session.questions_data or []
    
    if not answers_data:
        return {
            "final_score": 0.0,
            "breakdown": {},
            "analysis": "No answers submitted"
        }
    
    # Basic metrics
    total_answered = len(answers_data)
    correct_answers = sum(1 for a in answers_data if a.get('is_correct', False))
    accuracy = correct_answers / total_answered if total_answered > 0 else 0
    
    # Time analysis
    time_scores = []
    for i, answer in enumerate(answers_data):
        time_taken = answer.get('time_taken', 0)
        difficulty = questions_data[i].get('difficulty_level', 3) if i < len(questions_data) else 3
        
        # Expected time based on difficulty (in seconds)
        expected_time = {1: 30, 2: 45, 3: 60, 4: 90, 5: 120}.get(difficulty, 60)
        
        # Score time efficiency (1.0 = optimal, penalize too fast or too slow)
        if time_taken == 0:
            time_score = 0.5  # Default for no time data
        elif time_taken <= expected_time:
            time_score = 1.0
        elif time_taken <= expected_time * 2:
            time_score = 0.8
        else:
            time_score = 0.6
        
        time_scores.append(time_score)
    
    avg_time_efficiency = statistics.mean(time_scores) if time_scores else 0.5
    
    # Confidence analysis
    confidence_scores = []
    confidence_accuracy = []
    
    for answer in answers_data:
        confidence = answer.get('confidence_level', 3)
        is_correct = answer.get('is_correct', False)
        
        # Normalize confidence to 0-1 scale
        conf_normalized = (confidence - 1) / 4 if confidence else 0.5
        confidence_scores.append(conf_normalized)
        
        # Check if confidence matches correctness
        if is_correct and confidence >= 4:  # High confidence, correct
            confidence_accuracy.append(1.0)
        elif not is_correct and confidence <= 2:  # Low confidence, incorrect
            confidence_accuracy.append(0.8)
        elif is_correct and confidence >= 3:  # Medium+ confidence, correct
            confidence_accuracy.append(0.9)
        elif not is_correct and confidence <= 3:  # Low-medium confidence, incorrect
            confidence_accuracy.append(0.6)
        else:  # Mismatched confidence and correctness
            confidence_accuracy.append(0.3)
    
    avg_confidence_calibration = statistics.mean(confidence_accuracy) if confidence_accuracy else 0.5
    
    # Difficulty-weighted scoring
    difficulty_weighted_score = 0
    total_difficulty_weight = 0
    
    for i, answer in enumerate(answers_data):
        if i < len(questions_data):
            difficulty = questions_data[i].get('difficulty_level', 3)
            is_correct = answer.get('is_correct', False)
            
            # Weight by difficulty
            weight = {1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 2.5}.get(difficulty, 1.5)
            total_difficulty_weight += weight
            
            if is_correct:
                difficulty_weighted_score += weight
    
    weighted_accuracy = difficulty_weighted_score / total_difficulty_weight if total_difficulty_weight > 0 else 0
    
    # Calculate final score (0-10 scale)
    # Weighted combination of different factors
    final_score = (
        accuracy * 0.5 +  # 50% - correctness
        weighted_accuracy * 0.3 +  # 30% - difficulty-weighted correctness
        avg_time_efficiency * 0.1 +  # 10% - time efficiency
        avg_confidence_calibration * 0.1  # 10% - confidence calibration
    ) * 10
    
    # Ensure score is within bounds
    final_score = max(0, min(10, final_score))
    
    # Detailed breakdown
    breakdown = {
        "basic_accuracy": round(accuracy * 100, 1),
        "weighted_accuracy": round(weighted_accuracy * 100, 1),
        "time_efficiency": round(avg_time_efficiency * 100, 1),
        "confidence_calibration": round(avg_confidence_calibration * 100, 1),
        "questions_answered": total_answered,
        "correct_answers": correct_answers,
        "difficulty_distribution": {},
        "time_statistics": {
            "total_time": sum(a.get('time_taken', 0) for a in answers_data),
            "average_time": statistics.mean([a.get('time_taken', 0) for a in answers_data if a.get('time_taken', 0) > 0]) if any(a.get('time_taken', 0) > 0 for a in answers_data) else 0
        }
    }
    
    # Difficulty distribution
    for i, answer in enumerate(answers_data):
        if i < len(questions_data):
            difficulty = questions_data[i].get('difficulty_level', 3)
            if difficulty not in breakdown["difficulty_distribution"]:
                breakdown["difficulty_distribution"][difficulty] = {"total": 0, "correct": 0}
            
            breakdown["difficulty_distribution"][difficulty]["total"] += 1
            if answer.get('is_correct', False):
                breakdown["difficulty_distribution"][difficulty]["correct"] += 1
    
    return {
        "final_score": round(final_score, 2),
        "breakdown": breakdown,
        "components": {
            "accuracy_score": round(accuracy * 5, 2),  # out of 5
            "difficulty_bonus": round((weighted_accuracy - accuracy) * 5, 2),  # bonus for hard questions
            "efficiency_score": round(avg_time_efficiency * 1, 2),  # out of 1
            "confidence_score": round(avg_confidence_calibration * 1, 2)  # out of 1
        }
    }

async def generate_ai_feedback(session: ExamSessionDB, score_data: Dict[str, Any], 
                             material: MaterialDB) -> Dict[str, List[str]]:
    """
    Generate AI-powered feedback including strengths, weaknesses, and recommendations.
    
    This function uses OpenAI to analyze the student's performance and provide
    personalized feedback and study recommendations.
    
    Args:
        session: The completed exam session
        score_data: Calculated score data
        material: The study material
        
    Returns:
        Dict containing strengths, weaknesses, and recommendations
    """
    try:
        answers_data = session.answers_data or []
        questions_data = session.questions_data or []
        
        # Prepare performance summary for AI analysis
        performance_summary = {
            "subject": material.subject,
            "material_title": material.title,
            "final_score": score_data["final_score"],
            "accuracy": score_data["breakdown"]["basic_accuracy"],
            "questions_answered": len(answers_data),
            "difficulty_performance": score_data["breakdown"]["difficulty_distribution"],
            "time_efficiency": score_data["breakdown"]["time_efficiency"],
            "confidence_calibration": score_data["breakdown"]["confidence_calibration"]
        }
        
        # Analyze specific question performance
        question_analysis = []
        for i, (answer, question) in enumerate(zip(answers_data, questions_data)):
            question_analysis.append({
                "question_type": question.get('type', 'unknown'),
                "difficulty": question.get('difficulty_level', 3),
                "correct": answer.get('is_correct', False),
                "confidence": answer.get('confidence_level', 3),
                "time_taken": answer.get('time_taken', 0)
            })
        
        prompt = f"""
You are an expert academic tutor analyzing a student's exam performance. Provide personalized feedback.

EXAM PERFORMANCE SUMMARY:
Subject: {performance_summary['subject']}
Material: {performance_summary['material_title']}
Final Score: {performance_summary['final_score']}/10
Overall Accuracy: {performance_summary['accuracy']}%
Questions Answered: {performance_summary['questions_answered']}
Time Efficiency: {performance_summary['time_efficiency']}%
Confidence Calibration: {performance_summary['confidence_calibration']}%

DETAILED QUESTION ANALYSIS:
{json.dumps(question_analysis, indent=2)}

DIFFICULTY BREAKDOWN:
{json.dumps(performance_summary['difficulty_performance'], indent=2)}

Provide specific, actionable feedback in the following format:

{{
    "strengths": [
        "List 2-3 specific strengths based on performance",
        "Include both content knowledge and exam-taking skills"
    ],
    "weaknesses": [
        "List 2-3 specific areas for improvement",
        "Be constructive and specific"
    ],
    "recommendations": [
        "Provide 3-4 specific study recommendations",
        "Include both content review and strategy suggestions",
        "Make recommendations actionable and specific to the subject"
    ]
}}

Focus on being specific, constructive, and helpful. Consider the student's confidence calibration,
time management, and performance across different difficulty levels.
"""
        
        # Use gpt-4o-mini for better performance and larger context window
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert academic tutor providing personalized feedback to students."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.7
        )
        
        response_content = response.choices[0].message.content
        
        try:
            # Extract JSON from response
            start_idx = response_content.find('{')
            end_idx = response_content.rfind('}') + 1
            json_content = response_content[start_idx:end_idx]
            
            feedback_data = json.loads(json_content)
            
            return {
                "strengths": feedback_data.get("strengths", []),
                "weaknesses": feedback_data.get("weaknesses", []),
                "recommendations": feedback_data.get("recommendations", [])
            }
            
        except json.JSONDecodeError:
            return {
                "strengths": ["Completed the exam successfully"],
                "weaknesses": ["AI feedback generation failed"],
                "recommendations": ["Review the material and try again"]
            }
            
    except Exception as e:
        print(f"AI feedback generation error: {str(e)}")
        return {
            "strengths": ["Completed the exam successfully"],
            "weaknesses": ["AI feedback generation failed"],
            "recommendations": ["Review the material and try again"]
        }

@router.post("/session/{session_id}/calculate")
async def calculate_comprehensive_score(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Calculate comprehensive score and generate detailed report for completed exam.
    
    This endpoint performs in-depth analysis of the exam session and generates
    a comprehensive score report with AI-powered feedback.
    
    Args:
        session_id: ID of the completed exam session
        db: Database session
        
    Returns:
        ScoreReport: Comprehensive score report
        
    Raises:
        HTTPException: If session not found or not completed
    """
    try:
        # Get exam session
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        if session.status != ExamStatus.COMPLETED.value:
            raise HTTPException(
                status_code=400,
                detail="Cannot calculate score: exam session is not completed"
            )
        
        # Get material info
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Associated material not found")
        
        # Calculate detailed score
        score_data = calculate_detailed_score(session, db)
        
        # Generate AI feedback
        ai_feedback = await generate_ai_feedback(session, score_data, material)
        
        # Update session with final score
        session.final_score = score_data["final_score"]
        session.score_breakdown = score_data["breakdown"]
        
        db.commit()
        
        # Create comprehensive report
        report = ScoreReport(
            exam_session_id=session_id,
            final_score=score_data["final_score"],
            breakdown=score_data["breakdown"],
            strengths=ai_feedback["strengths"],
            weaknesses=ai_feedback["weaknesses"],
            recommendations=ai_feedback["recommendations"]
        )
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate comprehensive score: {str(e)}"
        )

@router.get("/session/{session_id}/report")
async def get_score_report(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get the detailed score report for a completed exam session.
    
    Args:
        session_id: ID of the exam session
        db: Database session
        
    Returns:
        dict: Detailed score report with all analysis
        
    Raises:
        HTTPException: If session not found
    """
    try:
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        # Get material info
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        
        # If no score calculated yet, calculate it
        if session.final_score is None:
            score_data = calculate_detailed_score(session, db)
            ai_feedback = await generate_ai_feedback(session, score_data, material)
            
            session.final_score = score_data["final_score"]
            session.score_breakdown = score_data["breakdown"]
            db.commit()
        else:
            # Use existing score data
            score_data = {
                "final_score": session.final_score,
                "breakdown": session.score_breakdown or {}
            }
            ai_feedback = await generate_ai_feedback(session, score_data, material)
        
        # Get detailed answer analysis
        answers_data = session.answers_data or []
        questions_data = session.questions_data or []
        
        question_details = []
        for i, (answer, question) in enumerate(zip(answers_data, questions_data)):
            question_details.append({
                "question_number": i + 1,
                "question_text": question.get('text', ''),
                "question_type": question.get('type', ''),
                "difficulty_level": question.get('difficulty_level', 3),
                "student_answer": answer.get('answer', ''),
                "correct_answer": question.get('correct_answer', ''),
                "is_correct": answer.get('is_correct', False),
                "confidence_level": answer.get('confidence_level'),
                "time_taken": answer.get('time_taken'),
                "explanation": question.get('explanation', '')
            })
        
        return {
            "exam_session_id": session_id,
            "material_title": material.title if material else "Unknown",
            "material_subject": material.subject if material else "Unknown",
            "exam_date": session.start_time.isoformat() if session.start_time else None,
            "completion_time": session.end_time.isoformat() if session.end_time else None,
            "final_score": session.final_score,
            "score_breakdown": session.score_breakdown,
            "performance_analysis": {
                "strengths": ai_feedback["strengths"],
                "weaknesses": ai_feedback["weaknesses"],
                "recommendations": ai_feedback["recommendations"]
            },
            "question_details": question_details,
            "summary": {
                "total_questions": len(questions_data),
                "questions_answered": len(answers_data),
                "correct_answers": sum(1 for a in answers_data if a.get('is_correct', False)),
                "accuracy_percentage": round((sum(1 for a in answers_data if a.get('is_correct', False)) / len(answers_data)) * 100, 1) if answers_data else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate score report: {str(e)}"
        )

@router.get("/sessions/history")
async def get_exam_history(
    material_id: Optional[int] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_database_session)
):
    """
    Get history of completed exam sessions with scores.
    
    This endpoint provides a summary of past exam performance,
    useful for tracking progress over time.
    
    Args:
        material_id: Optional filter by material
        limit: Maximum number of sessions to return
        offset: Number of sessions to skip
        db: Database session
        
    Returns:
        dict: List of exam sessions with summary scores
    """
    try:
        query = db.query(ExamSessionDB).filter(
            ExamSessionDB.status == ExamStatus.COMPLETED.value
        )
        
        if material_id:
            query = query.filter(ExamSessionDB.material_id == material_id)
        
        # Order by completion time (most recent first)
        query = query.order_by(ExamSessionDB.end_time.desc())
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        sessions = query.offset(offset).limit(limit).all()
        
        # Format results
        session_history = []
        for session in sessions:
            # Get material info
            material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
            
            # Calculate basic stats
            answers_data = session.answers_data or []
            correct_answers = sum(1 for a in answers_data if a.get('is_correct', False))
            accuracy = (correct_answers / len(answers_data)) if answers_data else 0
            
            session_history.append({
                "exam_session_id": session.id,
                "material_title": material.title if material else "Unknown",
                "material_subject": material.subject if material else "Unknown",
                "exam_date": session.start_time.isoformat() if session.start_time else None,
                "completion_date": session.end_time.isoformat() if session.end_time else None,
                "final_score": session.final_score,
                "questions_answered": len(answers_data),
                "correct_answers": correct_answers,
                "accuracy_percentage": round(accuracy * 100, 1)
            })
        
        return {
            "exam_history": session_history,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total_count
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve exam history: {str(e)}"
        ) 