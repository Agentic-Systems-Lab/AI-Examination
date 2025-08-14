"""
Exam Router

This module handles exam session management, student interactions,
and follow-up question generation for the AI Examiner application.

Author: AI Assistant
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from openai import OpenAI
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
from pydantic import BaseModel
from pathlib import Path

# Local imports
from database import get_database_session
from models import (
    ExamSession, ExamSessionDB, StudentAnswer, AnswerDB,
    QuestionDB, MaterialDB, FollowUpRequest, Question,
    ExamStatus, QuestionType
)

router = APIRouter()

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("❌ WARNING: OPENAI_API_KEY not found in environment variables!")
    client = None
else:
    print(f"✅ OpenAI API key found: {openai_api_key[:10]}...{openai_api_key[-4:]}")
    try:
        client = OpenAI(api_key=openai_api_key)
        print("✅ OpenAI client initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize OpenAI client: {e}")
        client = None

class ExamStartRequest(BaseModel):
    """Request model for starting an exam session"""
    material_id: int
    num_questions: int = 10
    difficulty_level: int = 3

@router.post("/start")
async def start_exam_session(
    request: ExamStartRequest,
    db: Session = Depends(get_database_session)
):
    """
    Start a new exam session with questions from specified material.
    
    This endpoint creates a new exam session, selects questions from the
    material's question bank, and initializes the session state.
    
    Args:
        request: Exam start request parameters
        db: Database session
        
    Returns:
        dict: New exam session information with first question
        
    Raises:
        HTTPException: If material not found or insufficient questions
    """
    try:
        # Verify material exists
        material = db.query(MaterialDB).filter(MaterialDB.id == request.material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Get available questions for this material
        available_questions = db.query(QuestionDB).filter(
            QuestionDB.material_id == request.material_id
        ).all()
        
        if len(available_questions) == 0:
            raise HTTPException(
                status_code=400,
                detail="No questions available for this material. Please generate questions first."
            )
        
        # Automatically adjust to available questions if fewer than requested
        actual_num_questions = min(request.num_questions, len(available_questions))
        
        # Log a warning if we had to reduce the number of questions
        if actual_num_questions < request.num_questions:
            print(f"Warning: Requested {request.num_questions} questions but only {len(available_questions)} available. Using {actual_num_questions} questions.")
        
        # Select questions in their original order (by ID) to maintain consistency
        # Sort by ID to keep questions in their original sequence
        sorted_questions = sorted(available_questions, key=lambda q: q.id)
        
        selected_questions = sorted_questions[:actual_num_questions]
        
        # Convert to Question objects
        questions = []
        for q_db in selected_questions:
            question = Question(
                id=q_db.id,
                text=q_db.text,
                type=QuestionType(q_db.type),
                options=q_db.options,
                correct_answer=q_db.correct_answer,
                explanation=q_db.explanation,
                difficulty_level=q_db.difficulty_level
            )
            questions.append(question)
        
        # Create exam session
        exam_session = ExamSessionDB(
            material_id=request.material_id,
            status=ExamStatus.STARTED.value,
            current_question=0,
            questions_data=[q.dict() for q in questions],
            answers_data=[]
        )
        
        db.add(exam_session)
        db.commit()
        db.refresh(exam_session)
        
        # Return session info with first question
        first_question = questions[0].dict()
        # Remove correct answer from response for security
        first_question.pop('correct_answer', None)
        first_question.pop('explanation', None)
        
        # Create appropriate success message
        if actual_num_questions < request.num_questions:
            message = f"Exam session started with {actual_num_questions} questions (reduced from requested {request.num_questions})"
        else:
            message = "Exam session started successfully"
        
        return {
            "exam_session_id": exam_session.id,
            "material_title": material.title,
            "material_subject": material.subject,
            "total_questions": len(questions),
            "current_question_number": 1,
            "status": exam_session.status,
            "question": first_question,
            "message": message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start exam session: {str(e)}"
        )

@router.get("/session/{session_id}")
async def get_exam_session(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get current exam session status and question.
    
    Args:
        session_id: ID of the exam session
        db: Database session
        
    Returns:
        dict: Current session status and question
        
    Raises:
        HTTPException: If session not found
    """
    try:
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        # Get material info
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        
        questions = session.questions_data or []
        
        if session.current_question < len(questions):
            current_question = questions[session.current_question].copy()
            # Remove correct answer for security
            current_question.pop('correct_answer', None)
            current_question.pop('explanation', None)
        else:
            current_question = None
        
        return {
            "exam_session_id": session.id,
            "material_id": session.material_id,
            "material_title": material.title if material else "Unknown",
            "material_subject": material.subject if material else "Unknown",
            "status": session.status,
            "total_questions": len(questions),
            "current_question_number": session.current_question + 1,
            "answered_questions": len(session.answers_data or []),
            "question": current_question,
            "is_completed": session.status == ExamStatus.COMPLETED.value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve exam session: {str(e)}"
        )

@router.post("/session/{session_id}/answer")
async def submit_answer(
    session_id: int,
    answer: StudentAnswer,
    db: Session = Depends(get_database_session)
):
    """
    Submit an answer for the current question in the exam session.
    
    This endpoint processes the student's answer, stores it, and either
    moves to the next question or completes the exam.
    
    Args:
        session_id: ID of the exam session
        answer: Student's answer data
        db: Database session
        
    Returns:
        dict: Answer submission result and next question (if available)
        
    Raises:
        HTTPException: If session not found or invalid state
    """
    try:
        # Get exam session
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        if session.status != ExamStatus.STARTED.value and session.status != ExamStatus.IN_PROGRESS.value:
            raise HTTPException(
                status_code=400,
                detail="Cannot submit answer: exam session is not active"
            )
        
        questions = session.questions_data or []
        if session.current_question >= len(questions):
            raise HTTPException(
                status_code=400,
                detail="No more questions available in this session"
            )
        
        current_question = questions[session.current_question]
        
        # Get material for context
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        material_context = material.content_text if material else ""
        
        # Log evaluation details for debugging
        print(f"\n🎯 EVALUATING ANSWER FOR SESSION {session.id}")
        print(f"   Question ID: {current_question.get('id')}")
        print(f"   Question Type: {current_question.get('type', 'short_answer')}")
        print(f"   Student Answer: '{answer.answer}'")
        print(f"   Correct Answer: '{current_question.get('correct_answer', '')}'")
        print(f"   OpenAI Client Available: {client is not None}")
        
        # Evaluate answer using OpenAI for sophisticated scoring (before database operations)
        evaluation_result = await _evaluate_answer_with_openai(
            student_answer=answer.answer,
            correct_answer=current_question.get('correct_answer', ''),
            question_text=current_question.get('text', ''),
            question_explanation=current_question.get('explanation', ''),
            material_context=material_context,
            question_type=current_question.get('type', 'short_answer'),
            question_options=current_question.get('options', [])
        )
        
        print(f"   📊 Evaluation Result: Score={evaluation_result['score']}/10, Correct={evaluation_result['is_correct']}")
        print(f"   💬 Feedback: {evaluation_result['feedback'][:100]}...")
        print(f"🎯 EVALUATION COMPLETE\n")
        
        # Extract results from OpenAI evaluation
        ai_score = evaluation_result['score']
        ai_feedback = evaluation_result['feedback']
        is_correct = evaluation_result['is_correct']
        
        # Now perform all database operations together in a single transaction
        # Store the answer with all evaluation results
        answer_db = AnswerDB(
            exam_session_id=session.id,
            question_id=current_question['id'],
            answer_text=answer.answer,
            confidence_level=answer.confidence_level,
            time_taken=answer.time_taken,
            is_correct=is_correct,
            score=ai_score,
            feedback=ai_feedback
        )
        
        db.add(answer_db)
        
        # Update session data
        answers_data = session.answers_data or []
        answers_data.append({
            "question_id": current_question['id'],
            "answer": answer.answer,
            "confidence_level": answer.confidence_level,
            "time_taken": answer.time_taken,
            "is_correct": is_correct,
            "score": ai_score,
            "feedback": ai_feedback
        })
        
        session.answers_data = answers_data
        session.current_question += 1
        session.status = ExamStatus.IN_PROGRESS.value
        
        # Check if exam is completed
        if session.current_question >= len(questions):
            session.status = ExamStatus.COMPLETED.value
            session.end_time = datetime.utcnow()
            
        # Commit all changes together to ensure data consistency
        db.commit()
        
        # Generate conversation log if exam is completed
        conversation_log_file = None
        if session.status == ExamStatus.COMPLETED.value:
            try:
                conversation_log_file = await _generate_conversation_log(session, db)
            except Exception as log_error:
                print(f"Warning: Failed to generate conversation log: {log_error}")
        
        # Prepare response
        response = {
            "message": "Answer submitted successfully",
            "is_correct": is_correct,
            "explanation": current_question.get('explanation'),
            "score": ai_score,
            "ai_feedback": ai_feedback,
            "question_number": session.current_question,
            "total_questions": len(questions),
            "is_exam_completed": session.status == ExamStatus.COMPLETED.value
        }
        
        # Add conversation log file to response if exam is completed
        if conversation_log_file:
            response["conversation_log_file"] = conversation_log_file
        
        # Add next question if available
        if session.current_question < len(questions):
            next_question = questions[session.current_question].copy()
            # Remove correct answer for security
            next_question.pop('correct_answer', None)
            next_question.pop('explanation', None)
            response["next_question"] = next_question
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit answer: {str(e)}"
        )

def _evaluate_answer(student_answer: str, correct_answer: str, question_type: str, question_options: List[str] = None) -> bool:
    """
    Improved function for basic answer evaluation.
    
    This function implements more lenient and accurate basic answer evaluation 
    logic with better matching algorithms for different question types.
    
    Args:
        student_answer: The student's answer (normalized)
        correct_answer: The correct answer (normalized)
        question_type: Type of question
        
    Returns:
        bool: True if the answer is considered correct
    """
    if question_type == "true_false":
        # For true/false, check for key words
        true_words = ["true", "yes", "correct", "t"]
        false_words = ["false", "no", "incorrect", "f"]
        
        student_is_true = any(word in student_answer for word in true_words)
        student_is_false = any(word in student_answer for word in false_words)
        
        correct_is_true = any(word in correct_answer for word in true_words)
        
        return (student_is_true and correct_is_true) or (student_is_false and not correct_is_true)
    
    elif question_type == "multiple_choice":
        # For multiple choice, handle both letter options (A, B, C, D) and full text answers
        import re
        
        # Normalize both answers
        student_normalized = student_answer.upper().strip()
        correct_normalized = correct_answer.upper().strip()
        
        print(f"🔍 Multiple choice evaluation:")
        print(f"   Student: '{student_answer}' -> '{student_normalized}'")
        print(f"   Correct: '{correct_answer}' -> '{correct_normalized}'")
        print(f"   Options available: {question_options}")
        
        # Strategy 1: Check for direct letter matching (A, B, C, D)
        student_letters = set()
        correct_letters = set()
        
        # Extract option letters with multiple strategies
        student_letters.update(re.findall(r'\b[A-Da-d1-4]\b', student_normalized))
        correct_letters.update(re.findall(r'\b[A-Da-d1-4]\b', correct_normalized))
        
        # Extract from common patterns
        for pattern in [r'ANSWER\s*([A-D1-4])', r'OPTION\s*([A-D1-4])', r'([A-D1-4])\)', r'([A-D1-4])\.']:
            student_letters.update(re.findall(pattern, student_normalized))
            correct_letters.update(re.findall(pattern, correct_normalized))
        
        # Look for single letters in short answers
        if len(student_normalized) <= 10:
            single_letters = re.findall(r'[A-D]', student_normalized)
            if single_letters:
                student_letters.update(single_letters)
        
        if len(correct_normalized) <= 10:
            single_letters = re.findall(r'[A-D]', correct_normalized)
            if single_letters:
                correct_letters.update(single_letters)
        
        print(f"   Student letters found: {student_letters}")
        print(f"   Correct letters found: {correct_letters}")
        
        # Check letter matching first
        if student_letters and correct_letters:
            letter_match = bool(student_letters.intersection(correct_letters))
            if letter_match:
                print(f"   ✅ Letter match found: {letter_match}")
                return letter_match
        
        # Strategy 2: Check if student typed the full text of the correct option
        if question_options:
            # Find which option corresponds to the correct answer
            correct_option_text = None
            correct_option_letter = None
            
            # Try to find the correct option by matching the correct_answer
            for option in question_options:
                option_upper = option.upper().strip()
                # Check if this option matches the correct answer (by letter or content)
                if any(letter in correct_letters for letter in re.findall(r'[A-D]', option_upper[:3])):
                    correct_option_text = option_upper
                    correct_option_letter = re.findall(r'[A-D]', option_upper[:3])
                    break
            
            # If we found the correct option text, check if student's answer matches it
            if correct_option_text:
                # Extract the text part after the letter (e.g., "A) Electric field" -> "Electric field")
                option_text_match = re.match(r'^[A-D]\)\s*(.+)', correct_option_text)
                if option_text_match:
                    correct_text_only = option_text_match.group(1).strip()
                    
                    print(f"   Correct option text: '{correct_text_only}'")
                    
                    # Check if student's answer contains the correct option text
                    # Use fuzzy matching - check if key words from correct answer appear in student answer
                    correct_words = set(word.strip() for word in correct_text_only.split() if len(word.strip()) > 2)
                    student_words = set(word.strip() for word in student_normalized.split() if len(word.strip()) > 2)
                    
                    if correct_words:
                        word_overlap = len(correct_words.intersection(student_words))
                        overlap_ratio = word_overlap / len(correct_words)
                        
                        print(f"   Text matching - Correct words: {correct_words}")
                        print(f"   Text matching - Student words: {student_words}")
                        print(f"   Text matching - Overlap ratio: {overlap_ratio}")
                        
                        # Consider it correct if significant word overlap (>= 60%) or exact substring match
                        text_match = (overlap_ratio >= 0.6 or 
                                    correct_text_only in student_normalized or
                                    student_normalized in correct_text_only)
                        
                        if text_match:
                            print(f"   ✅ Text content match found!")
                            return True
        
        # Strategy 3: Fallback - direct string matching
        fallback_match = (correct_normalized in student_normalized or 
                         student_normalized in correct_normalized or
                         student_normalized == correct_normalized)
        
        print(f"   🔄 Fallback match: {fallback_match}")
        return fallback_match
    
    else:
        # For short answer and essay, use improved keyword matching
        import re
        
        # Normalize text: lowercase, remove punctuation, split into words
        def normalize_text(text):
            # Remove punctuation and extra spaces
            cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
            return set(word.strip() for word in cleaned.split() if len(word.strip()) > 2)
        
        correct_keywords = normalize_text(correct_answer)
        student_keywords = normalize_text(student_answer)
        
        if not correct_keywords:
            return False
        
        # Calculate overlap
        overlap = len(correct_keywords.intersection(student_keywords))
        overlap_ratio = overlap / len(correct_keywords)
        
        # Also check for key concept matches (more lenient)
        key_concepts = []
        for word in correct_keywords:
            if len(word) > 4:  # Focus on longer, more meaningful words
                key_concepts.append(word)
        
        concept_matches = 0
        if key_concepts:
            for concept in key_concepts:
                if any(concept in student_word or student_word in concept for student_word in student_keywords):
                    concept_matches += 1
            concept_ratio = concept_matches / len(key_concepts)
        else:
            concept_ratio = overlap_ratio
        
        # Consider correct if:
        # - Good keyword overlap (>= 30%) OR
        # - Good concept matching (>= 40%) OR  
        # - High exact overlap (>= 25%)
        return overlap_ratio >= 0.25 or concept_ratio >= 0.3 or overlap_ratio >= 0.4


async def _evaluate_answer_with_openai(
    student_answer: str, 
    correct_answer: str, 
    question_text: str, 
    question_explanation: str,
    material_context: str = "",
    question_type: str = "short_answer",
    question_options: List[str] = None
) -> Dict[str, Any]:
    """
    Evaluate a student's answer using OpenAI with robust retry logic.
    
    This function uses OpenAI to compare the student's answer against the proposed
    solution with multiple retry attempts and fallback strategies.
    
    Args:
        student_answer: The student's answer text
        correct_answer: The proposed solution/correct answer
        question_text: The original question text
        question_explanation: Explanation of the correct answer
        material_context: Context from the study materials (optional)
        question_type: Type of question for context
        
    Returns:
        Dict containing:
            - score: Float between 1.0 and 10.0
            - feedback: String with detailed feedback
            - is_correct: Boolean for backward compatibility
    """
    
    # First, try improved simple evaluation for immediate backup
    simple_result = _evaluate_answer(
        student_answer.lower().strip(), 
        correct_answer.lower().strip(), 
        question_type,
        question_options or []
    )
    
    # Binary scoring for objective questions, nuanced for subjective ones
    if question_type in ["multiple_choice", "true_false"]:
        fallback_score = 10.0 if simple_result else 0.0
        fallback_feedback = f"{'Correct' if simple_result else 'Incorrect'} answer for {question_type.replace('_', ' ')} question."
    else:
        fallback_score = 8.5 if simple_result else 4.5
        fallback_feedback = f"Smart evaluation completed. Answer appears {'correct' if simple_result else 'incorrect'} based on content analysis."
    
    fallback_response = {
        "score": fallback_score,
        "feedback": fallback_feedback,
        "is_correct": simple_result
    }
    
    # Create a comprehensive prompt for evaluation based on question type
    if question_type in ["multiple_choice", "true_false"]:
        options_text = ""
        if question_options:
            options_text = f"\nOPTIONS: {', '.join(question_options)}"
        
        prompt = f"""
You are an expert academic examiner. Evaluate this {question_type.replace('_', ' ')} question.

QUESTION: {question_text}{options_text}
CORRECT ANSWER: {correct_answer}
STUDENT ANSWER: {student_answer}
EXPLANATION: {question_explanation}

SCORING RULES FOR {question_type.upper()}:
- If the student selected the correct answer (either by letter like "A" or by typing the full text): Score = 10.0
- If the student selected an incorrect answer: Score = 0.0
- No partial credit for objective questions
- Accept both letter answers ("A", "B", "C", "D") and full text answers

For multiple choice, the student might answer with:
1. Just the letter: "A", "B", "C", or "D"
2. The full option text: e.g., if option A is "Electric field", they might type "Electric field"
3. Partial text that clearly indicates the correct option

Check if the student's answer matches the correct option in any of these formats.

Respond with JSON only:
{{"score": 10.0, "feedback": "Correct! The student selected the right answer.", "reasoning": "Student chose the correct option"}}
"""
    else:
        prompt = f"""
You are an expert academic examiner. Evaluate this student's answer on a scale of 1-10.

QUESTION TYPE: {question_type}
QUESTION: {question_text}

CORRECT ANSWER: {correct_answer}
STUDENT ANSWER: {student_answer}

EXPLANATION: {question_explanation}

For short answers and essays: Evaluate conceptual understanding and key points covered.

SCORING:
- 9-10: Excellent (comprehensive, accurate understanding)
- 7-8: Good (mostly correct with good understanding)
- 5-6: Satisfactory (basic understanding with some gaps)
- 3-4: Needs improvement (limited understanding, some errors)
- 1-2: Poor (significant misunderstanding or major errors)

Respond with JSON only:
{{"score": 8.0, "feedback": "Your detailed feedback here", "reasoning": "Brief explanation"}}
"""

    # Check if OpenAI client is available
    if not client:
        print("❌ OpenAI client not available, using enhanced simple evaluation")
        return fallback_response
    
    # Try multiple models with retry logic
    models_to_try = [
        {"model": "gpt-4o-mini", "params": {"max_tokens": 800, "temperature": 0.2}},
        {"model": "gpt-3.5-turbo", "params": {"max_tokens": 800, "temperature": 0.2}},
        {"model": "gpt-4o", "params": {"max_tokens": 800, "temperature": 0.2}}
    ]
    
    for attempt, model_config in enumerate(models_to_try):
        try:
            print(f"🤖 Attempt {attempt + 1}: Trying OpenAI model {model_config['model']} for scoring...")
            
            response = client.chat.completions.create(
                model=model_config["model"],
                messages=[{"role": "user", "content": prompt}],
                **model_config["params"]
            )
            
            response_content = response.choices[0].message.content.strip()
            print(f"📝 OpenAI Response ({model_config['model']}): {response_content[:200]}...")
            
            # Multiple JSON extraction strategies
            json_content = None
            
            # Strategy 1: Find JSON block
            if '{' in response_content and '}' in response_content:
                start_idx = response_content.find('{')
                end_idx = response_content.rfind('}') + 1
                json_content = response_content[start_idx:end_idx]
            
            # Strategy 2: Try parsing the whole response
            if not json_content:
                json_content = response_content
                
            # Strategy 3: Extract from markdown code blocks
            if '```json' in response_content:
                start = response_content.find('```json') + 7
                end = response_content.find('```', start)
                if end > start:
                    json_content = response_content[start:end].strip()
            
            if json_content:
                try:
                    parsed_response = json.loads(json_content)
                    
                    # Extract and validate data
                    score = float(parsed_response.get("score", 5.0))
                    score = max(1.0, min(10.0, score))
                    
                    # Enforce binary scoring for objective questions
                    if question_type in ["multiple_choice", "true_false"]:
                        # For objective questions: round to nearest 0 or 10
                        score = 10.0 if score >= 5.0 else 0.0
                        is_correct = score >= 10.0
                    else:
                        # For subjective questions: keep nuanced scoring
                        is_correct = score >= 6.0
                    
                    feedback = parsed_response.get("feedback", "OpenAI evaluation completed.")
                    reasoning = parsed_response.get("reasoning", "")
                    
                    if reasoning:
                        feedback += f"\n\nReasoning: {reasoning}"
                    
                    result = {
                        "score": score,
                        "feedback": feedback,
                        "is_correct": is_correct
                    }
                    
                    print(f"✅ OpenAI evaluation successful with {model_config['model']}: Score {score}/10, Correct: {result['is_correct']}")
                    return result
                    
                except json.JSONDecodeError as parse_error:
                    print(f"⚠️ JSON parsing failed for {model_config['model']}: {parse_error}")
                    print(f"Raw content: {json_content}")
                    continue
            else:
                print(f"⚠️ No JSON content found in {model_config['model']} response")
                continue
                
        except Exception as api_error:
            print(f"❌ OpenAI API error with {model_config['model']}: {str(api_error)}")
            continue
    
    # If all OpenAI attempts failed, use enhanced simple evaluation
    print(f"🔄 All OpenAI attempts failed, using enhanced simple evaluation")
    print(f"🎯 Simple evaluation result: {'CORRECT' if simple_result else 'INCORRECT'}")
    
    return fallback_response

@router.post("/session/{session_id}/followup")
async def generate_followup_question(
    session_id: int,
    request: FollowUpRequest,
    db: Session = Depends(get_database_session)
):
    """
    Generate a follow-up question based on student's answer.
    
    This endpoint uses OpenAI to generate contextual follow-up questions
    when the student's answer needs clarification or deeper exploration.
    
    Args:
        session_id: ID of the exam session
        request: Follow-up question request
        db: Database session
        
    Returns:
        dict: Generated follow-up question
        
    Raises:
        HTTPException: If session not found or generation fails
    """
    try:
        # Get exam session
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        # Get original question
        questions = session.questions_data or []
        original_question = None
        for q in questions:
            if q['id'] == request.question_id:
                original_question = q
                break
        
        if not original_question:
            raise HTTPException(status_code=404, detail="Original question not found")
        
        # Get material for context
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        
        # Create prompt for follow-up question
        prompt = f"""
You are an expert examiner conducting an oral exam. A student has just answered a question,
and you need to ask a follow-up question to probe deeper into their understanding.

SUBJECT: {material.subject if material else 'General'}

ORIGINAL QUESTION: {original_question['text']}

CORRECT ANSWER: {original_question['correct_answer']}

STUDENT'S ANSWER: {request.student_answer}

CONTEXT: {request.context or 'No additional context'}

Generate a thoughtful follow-up question that:
1. Probes deeper into the student's understanding
2. Tests whether they truly understand the concept or just memorized it
3. Is related to the original question but explores a different aspect
4. Is appropriate for the academic level and subject
5. Can be answered in 1-3 sentences

Respond with a JSON object in this format:
{{
    "followup_question": "Your follow-up question here",
    "purpose": "Brief explanation of what this question tests",
    "expected_answer_type": "short_answer"
}}
"""
        
        # Call OpenAI API with gpt-4o-mini for better performance
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert academic examiner skilled at asking probing follow-up questions."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.7
        )
        
        # Parse response
        response_content = response.choices[0].message.content
        
        try:
            # Extract JSON from response
            start_idx = response_content.find('{')
            end_idx = response_content.rfind('}') + 1
            json_content = response_content[start_idx:end_idx]
            
            followup_data = json.loads(json_content)
            
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail="Failed to parse follow-up question response"
            )
        
        return {
            "exam_session_id": session_id,
            "original_question_id": request.question_id,
            "followup_question": followup_data.get("followup_question"),
            "purpose": followup_data.get("purpose"),
            "expected_answer_type": followup_data.get("expected_answer_type", "short_answer"),
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate follow-up question: {str(e)}"
        )

@router.get("/session/{session_id}/progress")
async def get_exam_progress(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get detailed progress information for an exam session.
    
    Args:
        session_id: ID of the exam session
        db: Database session
        
    Returns:
        dict: Detailed progress and performance information
        
    Raises:
        HTTPException: If session not found
    """
    try:
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        # Get material info
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        
        questions = session.questions_data or []
        answers = session.answers_data or []
        
        # Calculate statistics
        total_questions = len(questions)
        answered_questions = len(answers)
        correct_answers = sum(1 for a in answers if a.get('is_correct', False))
        
        accuracy = (correct_answers / answered_questions) if answered_questions > 0 else 0
        progress_percentage = (answered_questions / total_questions) if total_questions > 0 else 0
        
        # Time statistics
        total_time = sum(a.get('time_taken', 0) for a in answers)
        avg_time_per_question = total_time / answered_questions if answered_questions > 0 else 0
        
        # Difficulty breakdown
        difficulty_stats = {}
        for i, answer in enumerate(answers):
            if i < len(questions):
                diff_level = questions[i].get('difficulty_level', 3)
                if diff_level not in difficulty_stats:
                    difficulty_stats[diff_level] = {"total": 0, "correct": 0}
                difficulty_stats[diff_level]["total"] += 1
                if answer.get('is_correct', False):
                    difficulty_stats[diff_level]["correct"] += 1
        
        return {
            "exam_session_id": session_id,
            "material_title": material.title if material else "Unknown",
            "status": session.status,
            "progress": {
                "total_questions": total_questions,
                "answered_questions": answered_questions,
                "remaining_questions": total_questions - answered_questions,
                "progress_percentage": round(progress_percentage * 100, 1)
            },
            "performance": {
                "correct_answers": correct_answers,
                "accuracy_percentage": round(accuracy * 100, 1),
                "total_time_seconds": total_time,
                "average_time_per_question": round(avg_time_per_question, 1)
            },
            "difficulty_breakdown": difficulty_stats,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get exam progress: {str(e)}"
        )

@router.post("/session/{session_id}/complete")
async def complete_exam_session(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Manually complete an exam session.
    
    This endpoint allows early completion of an exam session and
    triggers the final scoring calculation.
    
    Args:
        session_id: ID of the exam session to complete
        db: Database session
        
    Returns:
        dict: Completion confirmation and basic score
        
    Raises:
        HTTPException: If session not found or already completed
    """
    try:
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        if session.status == ExamStatus.COMPLETED.value:
            raise HTTPException(
                status_code=400,
                detail="Exam session is already completed"
            )
        
        # Update session status
        session.status = ExamStatus.COMPLETED.value
        session.end_time = datetime.utcnow()
        
        # Calculate basic score
        answers = session.answers_data or []
        total_answered = len(answers)
        correct_answers = sum(1 for a in answers if a.get('is_correct', False))
        
        if total_answered > 0:
            basic_score = (correct_answers / total_answered) * 10  # Scale to 0-10
        else:
            basic_score = 0
        
        session.final_score = basic_score
        
        db.commit()
        
        # Generate conversation log file
        try:
            log_file_path = await _generate_conversation_log(session, db)
        except Exception as log_error:
            print(f"Warning: Failed to generate conversation log: {log_error}")
            log_file_path = None

        return {
            "message": "Exam session completed successfully",
            "exam_session_id": session_id,
            "status": session.status,
            "basic_score": round(basic_score, 2),
            "questions_answered": total_answered,
            "correct_answers": correct_answers,
            "completion_time": session.end_time.isoformat(),
            "conversation_log_file": log_file_path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete exam session: {str(e)}"
        )

async def _generate_conversation_log(session: ExamSessionDB, db: Session) -> str:
    """
    Generate a conversation log file for the completed exam session.
    
    Format: Question 1, Student Answer, Proposed Solution, Question 2, etc.
    
    Args:
        session: Completed exam session
        db: Database session
        
    Returns:
        str: Path to the generated log file
        
    Raises:
        Exception: If log generation fails due to data issues or file operations
    """
    try:
        # Get material info with error handling
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        if not material:
            print(f"Warning: Material not found for session {session.id}")
        
        questions = session.questions_data or []
        if not questions:
            raise ValueError(f"No questions data found for session {session.id}")
        
        # Get answers from both session data and individual answers table
        session_answers = session.answers_data or []
        individual_answers = db.query(AnswerDB).filter(AnswerDB.exam_session_id == session.id).all()
        
        # Create a comprehensive answers dictionary for efficient lookup
        # Priority: individual database records over session data (more reliable)
        answers_dict = {}
        
        # First, add session answers as fallback
        for session_answer in session_answers:
            if 'question_id' in session_answer:
                answers_dict[session_answer['question_id']] = {
                    "question_id": session_answer['question_id'],
                    "answer": session_answer.get('answer', ''),
                    "confidence_level": session_answer.get('confidence_level'),
                    "time_taken": session_answer.get('time_taken'),
                    "is_correct": session_answer.get('is_correct', False),
                    "score": session_answer.get('score', 0),
                    "source": "session"
                }
        
        # Then, override with individual database records (higher priority)
        for answer_db in individual_answers:
            answers_dict[answer_db.question_id] = {
                "question_id": answer_db.question_id,
                "answer": answer_db.answer_text or '',
                "confidence_level": answer_db.confidence_level,
                "time_taken": answer_db.time_taken,
                "is_correct": answer_db.is_correct,
                "score": answer_db.score,
                "feedback": answer_db.feedback,  # Add missing feedback field
                "source": "database"
            }
    
        # Create logs directory if it doesn't exist
        logs_dir = Path("exam_logs")
        logs_dir.mkdir(exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        material_name = material.title.replace(" ", "_").replace("/", "_") if material else "unknown"
        filename = f"exam_session_{session.id}_{material_name}_{timestamp}.txt"
        file_path = logs_dir / filename
        
        # Generate conversation log content
        log_content = []
        log_content.append(f"EXAM CONVERSATION LOG")
        log_content.append(f"=" * 50)
        log_content.append(f"Session ID: {session.id}")
        log_content.append(f"Material: {material.title if material else 'Unknown'}")
        log_content.append(f"Subject: {material.subject if material else 'Unknown'}")
        log_content.append(f"Start Time: {session.start_time}")
        log_content.append(f"End Time: {session.end_time}")
        log_content.append(f"Final Score: {session.final_score or 0}/10")
        log_content.append(f"Questions Answered: {len(answers_dict)}/{len(questions)}")
        log_content.append(f"=" * 50)
        log_content.append("")
        
        # Process each question and answer pair
        for i, question in enumerate(questions):
            question_num = i + 1
            log_content.append(f"Question {question_num}:")
            log_content.append(question.get('text', 'Question text not available'))
            log_content.append("")
            
            # Find corresponding answer using efficient dictionary lookup
            question_id = question.get('id')
            answer_data = answers_dict.get(question_id) if question_id else None
            
            if answer_data:
                log_content.append(f"Student Answer:")
                log_content.append(answer_data['answer'])
                log_content.append("")
                
                log_content.append(f"Proposed Solution:")
                log_content.append(question.get('correct_answer', 'Solution not available'))
                log_content.append("")
                
                if question.get('explanation'):
                    log_content.append(f"Explanation:")
                    log_content.append(question['explanation'])
                    log_content.append("")
                
                # Add answer evaluation
                is_correct = answer_data.get('is_correct', False)
                score = answer_data.get('score', 0)
                time_taken = answer_data.get('time_taken', 0)
                confidence = answer_data.get('confidence_level', 0)
                
                log_content.append(f"Answer Evaluation:")
                log_content.append(f"- Correct: {'Yes' if is_correct else 'No'}")
                log_content.append(f"- Score: {score}/10.0")
                if time_taken:
                    log_content.append(f"- Time Taken: {time_taken} seconds")
                if confidence:
                    log_content.append(f"- Student Confidence: {confidence}/5")
                
                # Add data source for debugging
                source = answer_data.get('source', 'unknown')
                log_content.append(f"- Data Source: {source}")
                
                # Add AI feedback if available
                feedback = answer_data.get('feedback', '')
                if feedback and feedback.strip() and 'unavailable' not in feedback.lower():
                    log_content.append("")
                    log_content.append(f"AI Feedback:")
                    log_content.append(feedback)
                
            else:
                log_content.append(f"Student Answer: [Not answered]")
                log_content.append("")
                log_content.append(f"Proposed Solution:")
                log_content.append(question.get('correct_answer', 'Solution not available'))
            
            log_content.append("")
            log_content.append("-" * 30)
            log_content.append("")
        
        # Add final summary
        if answers_dict:
            answered_questions = list(answers_dict.values())
            correct_count = sum(1 for a in answered_questions if a.get('is_correct', False))
            accuracy = (correct_count / len(answered_questions)) * 100
            
            log_content.append("EXAM SUMMARY")
            log_content.append("-" * 20)
            log_content.append(f"Total Questions: {len(questions)}")
            log_content.append(f"Questions Answered: {len(answers_dict)}")
            log_content.append(f"Correct Answers: {correct_count}")
            log_content.append(f"Accuracy: {accuracy:.1f}%")
            log_content.append(f"Final Score: {(session.final_score or 0):.2f}/10")
        else:
            log_content.append("EXAM SUMMARY")
            log_content.append("-" * 20)
            log_content.append(f"Total Questions: {len(questions)}")
            log_content.append(f"Questions Answered: 0")
            log_content.append(f"No answers recorded")
        
        # Write to file with error handling
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(log_content))
        except IOError as e:
            raise Exception(f"Failed to write conversation log to file: {str(e)}")
        
        return str(file_path)
    
    except Exception as e:
        # Log the error and re-raise with more context
        print(f"Error generating conversation log for session {session.id}: {str(e)}")
        raise Exception(f"Failed to generate conversation log: {str(e)}")

@router.get("/session/{session_id}/results")
async def get_session_results(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get complete exam session results with questions and answers.
    
    This endpoint returns all session data for displaying results,
    including questions, answers, scores, and AI feedback.
    
    Args:
        session_id: ID of the exam session
        db: Database session
        
    Returns:
        dict: Complete session data with questions and answers
        
    Raises:
        HTTPException: If session not found
    """
    try:
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        # Get material info
        material = db.query(MaterialDB).filter(MaterialDB.id == session.material_id).first()
        
        return {
            "exam_session_id": session.id,
            "material_title": material.title if material else "Unknown",
            "material_subject": material.subject if material else "Unknown",
            "status": session.status,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "questions_data": session.questions_data or [],
            "answers_data": session.answers_data or [],
            "final_score": session.final_score,
            "score_breakdown": session.score_breakdown
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get session results: {str(e)}"
        )

@router.get("/session/{session_id}/conversation-log")
async def generate_conversation_log(
    session_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Generate and download a conversation log file for an exam session.
    
    This endpoint creates a text file containing the complete conversation
    in the format: Question 1, Student Answer, Proposed Solution, Question 2, etc.
    
    Args:
        session_id: ID of the exam session
        db: Database session
        
    Returns:
        dict: Information about the generated log file
        
    Raises:
        HTTPException: If session not found or log generation fails
    """
    try:
        session = db.query(ExamSessionDB).filter(ExamSessionDB.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Exam session not found")
        
        # Generate the conversation log
        log_file_path = await _generate_conversation_log(session, db)
        
        return {
            "message": "Conversation log generated successfully",
            "exam_session_id": session_id,
            "log_file_path": log_file_path,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate conversation log: {str(e)}"
        ) 