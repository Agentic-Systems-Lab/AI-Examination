"""
Questions Router

This module handles question generation using OpenAI API and manages
question storage and retrieval functionality.

Author: AI Assistant
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from openai import OpenAI
import os
import json
from typing import List, Dict, Any
from datetime import datetime
import re

# Local imports
from database import get_database_session
from models import (
    QuestionRequest, Question, QuestionDB, MaterialDB, 
    QuestionType
)

router = APIRouter()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def create_question_generation_prompt(content: str, num_questions: int, 
                                    question_types: List[QuestionType], 
                                    difficulty_level: int, subject: str) -> str:
    """
    Create a comprehensive prompt for OpenAI question generation.
    
    This function constructs a detailed prompt that instructs OpenAI
    to generate questions based on the provided content and parameters.
    
    Args:
        content: The study material content
        num_questions: Number of questions to generate
        question_types: Types of questions to generate
        difficulty_level: Difficulty level (1-5)
        subject: Academic subject
        
    Returns:
        str: Complete prompt for OpenAI API
    """
    difficulty_descriptions = {
        1: "Very Easy (basic recall and recognition)",
        2: "Easy (simple comprehension and application)",
        3: "Medium (analysis and synthesis)",
        4: "Hard (evaluation and complex application)",
        5: "Very Hard (advanced critical thinking and integration)"
    }
    
    types_description = []
    for qtype in question_types:
        if qtype == QuestionType.MULTIPLE_CHOICE:
            types_description.append("multiple choice questions with 4 options (A, B, C, D)")
        elif qtype == QuestionType.SHORT_ANSWER:
            types_description.append("short answer questions requiring 1-3 sentences")
        elif qtype == QuestionType.ESSAY:
            types_description.append("essay questions requiring detailed explanations")
        elif qtype == QuestionType.TRUE_FALSE:
            types_description.append("true/false questions with explanations")
    
    prompt = f"""
🎯 CRITICAL INSTRUCTION: You MUST generate EXACTLY {num_questions} questions. No more, no less!

You are an expert academic examiner creating questions for a {subject} exam.

⚠️ MANDATORY REQUIREMENT: Generate precisely {num_questions} questions at difficulty level {difficulty_level} ({difficulty_descriptions[difficulty_level]}).

Question types to include: {', '.join(types_description)}

STUDY MATERIAL:
{content}

🔢 COUNT VERIFICATION: Before responding, count your questions to ensure you have exactly {num_questions} items in the JSON array.

REQUIREMENTS:
1. ✅ EXACTLY {num_questions} questions (count them!)
2. Questions must be directly related to the provided material
3. Each question should test understanding of key concepts
4. Provide clear, unambiguous questions
5. For multiple choice: include exactly 4 options with only one correct answer
6. For all question types: provide a comprehensive explanation of the correct answer
7. Distribute questions evenly across the requested types
8. Ensure questions test different aspects of the material (facts, concepts, applications)

OUTPUT FORMAT (JSON):
{{
    "questions": [
        // MUST contain exactly {num_questions} question objects
        {{
            "text": "Question text here",
            "type": "multiple_choice|short_answer|essay|true_false",
            "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"] (only for multiple choice),
            "correct_answer": "Correct answer here",
            "explanation": "Detailed explanation of why this is correct",
            "difficulty_level": {difficulty_level}
        }}
        // Continue until you have EXACTLY {num_questions} questions
    ]
}}

⚠️ FINAL CHECK: Verify your "questions" array contains exactly {num_questions} items before responding.

Generate exactly {num_questions} questions now:
"""
    return prompt

async def generate_questions_with_openai(material: MaterialDB, request: QuestionRequest) -> List[Question]:
    """
    Generate questions using OpenAI API based on study material.
    
    This function sends a request to OpenAI API to generate questions
    based on the provided material and converts the response to Question objects.
    
    Args:
        material: The study material from database
        request: Question generation request parameters
        
    Returns:
        List[Question]: Generated questions
        
    Raises:
        HTTPException: If OpenAI API call fails or response is invalid
    """
    try:
        # Create prompt
        prompt = create_question_generation_prompt(
            content=material.content_text,
            num_questions=request.num_questions,
            question_types=request.question_types,
            difficulty_level=request.difficulty_level,
            subject=material.subject
        )
        
        # Call OpenAI API with gpt-4o-mini for better performance and larger context
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert academic examiner. Generate high-quality exam questions based on study materials."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=4000,
            temperature=0.7
        )
        
        # Parse response
        response_content = response.choices[0].message.content
        
        # Extract JSON from response
        try:
            # Find JSON content in the response
            start_idx = response_content.find('{')
            end_idx = response_content.rfind('}') + 1
            json_content = response_content[start_idx:end_idx]
            
            parsed_response = json.loads(json_content)
            questions_data = parsed_response.get("questions", [])
            
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500, 
                detail="Failed to parse OpenAI response as JSON"
            )
        
        # Convert to Question objects
        questions = []
        for q_data in questions_data:
            question = Question(
                text=q_data.get("text", ""),
                type=QuestionType(q_data.get("type", "short_answer")),
                options=q_data.get("options"),
                correct_answer=q_data.get("correct_answer", ""),
                explanation=q_data.get("explanation", ""),
                difficulty_level=q_data.get("difficulty_level", request.difficulty_level)
            )
            questions.append(question)
        
        if not questions:
            raise HTTPException(
                status_code=500,
                detail="No questions generated by OpenAI"
            )
        
        return questions
        
    except Exception as e:
        if "openai" in str(e).lower():
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API error: {str(e)}"
            )
        elif isinstance(e, HTTPException):
            raise
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Question generation failed: {str(e)}"
            )

def save_questions_to_file(questions: List[Question], material: MaterialDB) -> str:
    """
    Save generated questions to a formatted text file with validation.
    
    This function creates a well-formatted text file containing all the generated
    questions with answers and explanations, and validates the file was written correctly.
    
    Args:
        questions: List of generated questions
        material: The source material information
        
    Returns:
        str: File path where questions were saved
        
    Raises:
        Exception: If file writing fails or validation fails
    """
    # Create filename
    safe_title = "".join(c for c in material.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"questions_{safe_title}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    file_path = os.path.join("questions", filename)
    
    # Ensure questions directory exists
    os.makedirs("questions", exist_ok=True)
    
    # Write questions to file with detailed error handling
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"EXAM QUESTIONS\n")
            f.write(f"{'=' * 50}\n\n")
            f.write(f"Material: {material.title}\n")
            f.write(f"Subject: {material.subject}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total Questions: {len(questions)}\n\n")
            f.write(f"{'=' * 50}\n\n")
            
            for i, question in enumerate(questions, 1):
                f.write(f"QUESTION {i}\n")
                f.write(f"Type: {question.type.value.replace('_', ' ').title()}\n")
                f.write(f"Difficulty: {question.difficulty_level}/5\n\n")
                f.write(f"{question.text}\n\n")
                
                if question.options:
                    for j, option in enumerate(question.options):
                        f.write(f"{chr(65+j)}) {option}\n")
                    f.write("\n")
                
                f.write(f"CORRECT ANSWER:\n{question.correct_answer}\n\n")
                
                if question.explanation:
                    f.write(f"EXPLANATION:\n{question.explanation}\n\n")
                
                f.write(f"{'-' * 40}\n\n")
        
        # Validate the file was written correctly
        _validate_question_file(file_path, len(questions))
        
        return file_path
        
    except Exception as e:
        # Clean up failed file if it exists
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise Exception(f"Failed to save questions to file: {str(e)}")


def _validate_question_file(file_path: str, expected_questions: int) -> None:
    """
    Validate that a question file was written correctly.
    
    Args:
        file_path: Path to the file to validate
        expected_questions: Expected number of questions
        
    Raises:
        Exception: If validation fails
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check file is not empty
        if not content.strip():
            raise Exception("File is empty")
        
        # Count question headers
        question_count = content.count('QUESTION ')
        if question_count != expected_questions:
            raise Exception(f"Expected {expected_questions} questions, found {question_count}")
        
        # Check for truncation indicators
        if not content.endswith('\n\n') and not content.endswith('--\n'):
            raise Exception("File appears to be truncated")
            
    except Exception as e:
        raise Exception(f"File validation failed: {str(e)}")


def regenerate_question_file_from_db(material_id: int, db: Session) -> str:
    """
    Regenerate question file from database to ensure synchronization.
    
    This function fetches all questions for a material from the database
    and creates a new text file, ensuring database-file consistency.
    
    Args:
        material_id: ID of the material to regenerate questions for
        db: Database session
        
    Returns:
        str: Path to the regenerated file
        
    Raises:
        HTTPException: If material not found or no questions exist
    """
    from models import MaterialDB, QuestionDB
    
    # Get material
    material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    # Get all questions from database
    questions_db = db.query(QuestionDB).filter(
        QuestionDB.material_id == material_id
    ).order_by(QuestionDB.id).all()
    
    if not questions_db:
        raise HTTPException(status_code=404, detail="No questions found for this material")
    
    # Convert to Question objects
    questions = []
    for q_db in questions_db:
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
    
    # Save to file with validation
    file_path = save_questions_to_file(questions, material)
    
    return file_path

@router.post("/generate")
async def generate_questions(
    request: QuestionRequest,
    db: Session = Depends(get_database_session)
):
    """
    Generate questions from uploaded material using OpenAI API.
    
    This endpoint generates questions based on study material,
    saves them to the database and creates a text file export.
    
    Args:
        request: Question generation request
        db: Database session
        
    Returns:
        dict: Generated questions and file information
        
    Raises:
        HTTPException: If material not found or generation fails
    """
    try:
        # Get material from database
        material = db.query(MaterialDB).filter(MaterialDB.id == request.material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Check if material has sufficient content
        if not material.content_text or len(material.content_text.strip()) < 100:
            raise HTTPException(
                status_code=400, 
                detail="Material content is too short for question generation"
            )
        
        # Generate questions using OpenAI
        questions = await generate_questions_with_openai(material, request)
        
        # Save questions to database
        saved_questions = []
        for question in questions:
            question_db = QuestionDB(
                material_id=material.id,
                text=question.text,
                type=question.type.value,
                options=question.options,
                correct_answer=question.correct_answer,
                explanation=question.explanation,
                difficulty_level=question.difficulty_level
            )
            db.add(question_db)
            db.flush()  # Get the ID without committing
            
            # Add ID to question object
            question.id = question_db.id
            saved_questions.append(question)
        
        db.commit()
        
        # Save questions to text file with validation
        try:
            file_path = save_questions_to_file(questions, material)
            file_available = True
            file_message = "Text file created successfully"
        except Exception as file_error:
            print(f"Warning: Failed to create text file: {file_error}")
            file_path = None
            file_available = False
            file_message = f"Questions saved to database successfully. Text file creation failed: {str(file_error)}"
        
        return {
            "message": "Questions generated successfully",
            "material_id": material.id,
            "material_title": material.title,
            "questions_generated": len(questions),
            "questions": [q.dict() for q in saved_questions],
            "file_path": file_path,
            "file_available": file_available,
            "file_message": file_message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Question generation failed: {str(e)}"
        )

@router.get("/material/{material_id}")
async def get_questions_by_material(
    material_id: int,
    question_type: QuestionType = None,
    difficulty_level: int = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_database_session)
):
    """
    Get questions for a specific material with optional filtering.
    
    This endpoint retrieves questions associated with a material,
    with optional filtering by type and difficulty.
    
    Args:
        material_id: ID of the material
        question_type: Optional question type filter
        difficulty_level: Optional difficulty filter
        limit: Maximum number of questions to return
        offset: Number of questions to skip
        db: Database session
        
    Returns:
        dict: List of questions with pagination info
        
    Raises:
        HTTPException: If material not found
    """
    try:
        # Verify material exists
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Build query
        query = db.query(QuestionDB).filter(QuestionDB.material_id == material_id)
        
        if question_type:
            query = query.filter(QuestionDB.type == question_type.value)
        
        if difficulty_level:
            query = query.filter(QuestionDB.difficulty_level == difficulty_level)
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        questions_db = query.offset(offset).limit(limit).all()
        
        # Convert to response format
        questions = []
        for q_db in questions_db:
            questions.append({
                "id": q_db.id,
                "text": q_db.text,
                "type": q_db.type,
                "options": q_db.options,
                "correct_answer": q_db.correct_answer,
                "explanation": q_db.explanation,
                "difficulty_level": q_db.difficulty_level,
                "created_time": q_db.created_time
            })
        
        return {
            "material_id": material_id,
            "material_title": material.title,
            "questions": questions,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve questions: {str(e)}"
        )

@router.get("/{question_id}")
async def get_question(
    question_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get a specific question by ID.
    
    Args:
        question_id: ID of the question
        db: Database session
        
    Returns:
        dict: Question details
        
    Raises:
        HTTPException: If question not found
    """
    try:
        question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        return {
            "id": question.id,
            "material_id": question.material_id,
            "text": question.text,
            "type": question.type,
            "options": question.options,
            "correct_answer": question.correct_answer,
            "explanation": question.explanation,
            "difficulty_level": question.difficulty_level,
            "created_time": question.created_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve question: {str(e)}"
        )

@router.put("/{question_id}")
async def update_question(
    question_id: int,
    question_update: Question,
    db: Session = Depends(get_database_session)
):
    """
    Update a specific question.
    
    Args:
        question_id: ID of the question to update
        question_update: Updated question data
        db: Database session
        
    Returns:
        dict: Updated question data
        
    Raises:
        HTTPException: If question not found or update fails
    """
    try:
        question_db = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
        
        if not question_db:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Update question fields
        question_db.text = question_update.text
        question_db.type = question_update.type.value if hasattr(question_update.type, 'value') else question_update.type
        question_db.options = question_update.options
        question_db.correct_answer = question_update.correct_answer
        question_db.explanation = question_update.explanation
        question_db.difficulty_level = question_update.difficulty_level
        
        db.commit()
        db.refresh(question_db)
        
        return {
            "id": question_db.id,
            "material_id": question_db.material_id,
            "text": question_db.text,
            "type": question_db.type,
            "options": question_db.options,
            "correct_answer": question_db.correct_answer,
            "explanation": question_db.explanation,
            "difficulty_level": question_db.difficulty_level,
            "created_time": question_db.created_time,
            "message": "Question updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update question: {str(e)}"
        )

@router.delete("/{question_id}")
async def delete_question(
    question_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Delete a specific question.
    
    Args:
        question_id: ID of the question to delete
        db: Database session
        
    Returns:
        dict: Deletion confirmation
        
    Raises:
        HTTPException: If question not found
    """
    try:
        question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        db.delete(question)
        db.commit()
        
        return {
            "message": "Question deleted successfully",
            "deleted_id": question_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete question: {str(e)}"
        ) 

@router.post("/bulk-update")
async def bulk_update_questions(
    request: dict,
    db: Session = Depends(get_database_session)
):
    """
    Bulk update and delete questions for a material.
    
    This endpoint handles multiple operations in a single transaction:
    - Updates existing questions
    - Deletes specified questions
    - Regenerates the questions file to maintain sync
    
    Args:
        request: Dictionary containing material_id, updates, and deletes arrays
        db: Database session
        
    Returns:
        dict: Summary of operations performed
        
    Raises:
        HTTPException: If material not found or operations fail
    """
    try:
        material_id = request.get('material_id')
        updates = request.get('updates', [])
        deletes = request.get('deletes', [])
        
        if not material_id:
            raise HTTPException(status_code=400, detail="material_id is required")
        
        # Verify material exists
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        updated_count = 0
        deleted_count = 0
        errors = []
        
        # Process updates
        for update_data in updates:
            try:
                question_id = update_data.get('id')
                if not question_id:
                    continue
                    
                question_db = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
                if question_db:
                    question_db.text = update_data.get('text', question_db.text)
                    question_db.type = update_data.get('type', question_db.type)
                    question_db.options = update_data.get('options', question_db.options)
                    question_db.correct_answer = update_data.get('correct_answer', question_db.correct_answer)
                    question_db.explanation = update_data.get('explanation', question_db.explanation)
                    question_db.difficulty_level = update_data.get('difficulty_level', question_db.difficulty_level)
                    updated_count += 1
            except Exception as e:
                errors.append(f"Failed to update question {question_id}: {str(e)}")
        
        # Process deletions
        for question_id in deletes:
            try:
                question_db = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
                if question_db:
                    db.delete(question_db)
                    deleted_count += 1
            except Exception as e:
                errors.append(f"Failed to delete question {question_id}: {str(e)}")
        
        # Commit all changes
        db.commit()
        
        # Regenerate questions file to ensure sync
        try:
            regenerate_question_file_from_db(material_id, db)
        except Exception as e:
            # Log error but don't fail the entire operation
            print(f"Warning: Failed to regenerate question file: {str(e)}")
        
        return {
            "message": "Bulk operations completed",
            "material_id": material_id,
            "updated_count": updated_count,
            "deleted_count": deleted_count,
            "total_operations": updated_count + deleted_count,
            "errors": errors if errors else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to perform bulk operations: {str(e)}"
        )

@router.post("/material/{material_id}")
async def create_question(
    material_id: int,
    question_data: Question,
    db: Session = Depends(get_database_session)
):
    """
    Create a new question for a specific material.
    
    This endpoint allows adding individual questions manually to existing materials.
    The question will be added to the database and the questions file will be updated.
    
    Args:
        material_id: ID of the material to add the question to
        question_data: Question object containing all question details
        db: Database session
        
    Returns:
        dict: Created question data with assigned ID
        
    Raises:
        HTTPException: If material not found or question creation fails
    """
    try:
        # Verify material exists
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Create new question in database
        new_question = QuestionDB(
            material_id=material_id,
            text=question_data.text,
            type=question_data.type.value,
            options=question_data.options,
            correct_answer=question_data.correct_answer,
            explanation=question_data.explanation,
            difficulty_level=question_data.difficulty_level
        )
        
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        
        # Convert to response format
        created_question = Question(
            id=new_question.id,
            text=new_question.text,
            type=QuestionType(new_question.type),
            options=new_question.options,
            correct_answer=new_question.correct_answer,
            explanation=new_question.explanation,
            difficulty_level=new_question.difficulty_level
        )
        
        # Try to regenerate the questions file to keep it in sync
        try:
            regenerate_question_file_from_db(material_id, db)
        except Exception as e:
            # Log the error but don't fail the question creation
            print(f"Warning: Failed to regenerate questions file after adding question: {e}")
        
        return {
            "message": "Question created successfully",
            "question": created_question.dict(),
            "material_id": material_id,
            "material_title": material.title
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create question: {str(e)}"
        )

@router.get("/material/{material_id}/count")
async def get_question_count(
    material_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get the count of questions for a specific material.
    
    This endpoint provides diagnostic information about how many questions
    are currently stored in the database for a material.
    
    Args:
        material_id: ID of the material
        db: Database session
        
    Returns:
        dict: Question count information
        
    Raises:
        HTTPException: If material not found
    """
    try:
        # Verify material exists
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Count questions in database
        question_count = db.query(QuestionDB).filter(
            QuestionDB.material_id == material_id
        ).count()
        
        # Get question types breakdown
        questions = db.query(QuestionDB).filter(
            QuestionDB.material_id == material_id
        ).all()
        
        type_breakdown = {}
        for q in questions:
            q_type = q.type
            type_breakdown[q_type] = type_breakdown.get(q_type, 0) + 1
        
        return {
            "material_id": material_id,
            "material_title": material.title,
            "total_questions": question_count,
            "type_breakdown": type_breakdown,
            "message": f"Found {question_count} questions in database"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get question count: {str(e)}"
        )

@router.get("/file/{material_title}")
async def get_questions_from_file(
    material_title: str,
    db: Session = Depends(get_database_session)
):
    """
    Load questions directly from the generated questions text file.
    
    This endpoint reads questions from the text file and returns only
    the question text and options (without answers) for exam purposes.
    
    Args:
        material_title: Title of the material to find questions file
        db: Database session
        
    Returns:
        dict: List of questions with options (no answers revealed)
        
    Raises:
        HTTPException: If file not found or parsing fails
    """
    try:
        # Find the most recent questions file for this material
        questions_dir = "questions"
        if not os.path.exists(questions_dir):
            raise HTTPException(status_code=404, detail="Questions directory not found")
        
        # Look for files matching the material title
        matching_files = []
        safe_title = "".join(c for c in material_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        
        for filename in os.listdir(questions_dir):
            if filename.startswith(f"questions_{safe_title}") and filename.endswith(".txt"):
                file_path = os.path.join(questions_dir, filename)
                matching_files.append((filename, file_path, os.path.getmtime(file_path)))
        
        if not matching_files:
            raise HTTPException(
                status_code=404, 
                detail=f"No questions file found for material: {material_title}"
            )
        
        # Get the most recent file
        latest_file = max(matching_files, key=lambda x: x[2])
        file_path = latest_file[1]
        
        # Parse the questions file
        questions = []
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split content into question blocks
        question_blocks = content.split('QUESTION ')
        
        for block in question_blocks[1:]:  # Skip the header block
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue
                
            # Extract question number and details
            question_num = lines[0].strip()
            question_text = ""
            options = []
            reading_question = False
            reading_options = False
            
            for line in lines[1:]:
                line = line.strip()
                
                # Skip metadata lines
                if line.startswith('Type:') or line.startswith('Difficulty:'):
                    continue
                    
                # Stop at correct answer section
                if line.startswith('CORRECT ANSWER:'):
                    break
                    
                # Start reading question text
                if not reading_question and not line.startswith('Type:') and not line.startswith('Difficulty:') and line:
                    reading_question = True
                    question_text = line
                    continue
                
                # Continue reading question or start reading options
                if reading_question:
                    if line.startswith(('A)', 'B)', 'C)', 'D)')):
                        reading_options = True
                        options.append(line)
                    elif line and not reading_options:
                        question_text += " " + line
                
                # Continue reading options
                if reading_options and line.startswith(('A)', 'B)', 'C)', 'D)')):
                    if line not in options:  # Avoid duplicates
                        options.append(line)
            
            # Add question if we have valid content
            if question_text.strip() and len(options) >= 2:
                questions.append({
                    "id": len(questions) + 1,
                    "text": question_text.strip(),
                    "type": "multiple_choice",
                    "options": options,
                    "difficulty_level": 3  # Default difficulty
                })
        
        if not questions:
            raise HTTPException(
                status_code=400, 
                detail="No valid questions found in file"
            )
        
        return {
            "material_title": material_title,
            "questions": questions,
            "total_count": len(questions),
            "file_path": file_path,
            "message": f"Loaded {len(questions)} questions from file"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load questions from file: {str(e)}"
        )


@router.post("/material/{material_id}/regenerate-file")
async def regenerate_question_file(
    material_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Regenerate question text file from database to ensure synchronization.
    
    This endpoint fetches all questions for a material from the database
    and creates a new text file, ensuring database-file consistency.
    Useful when text files become corrupted, truncated, or out of sync.
    
    Args:
        material_id: ID of the material to regenerate questions for
        db: Database session
        
    Returns:
        dict: Regeneration result with file information
        
    Raises:
        HTTPException: If material not found or no questions exist
    """
    try:
        file_path = regenerate_question_file_from_db(material_id, db)
        
        # Get material info for response
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        
        # Count questions in database
        question_count = db.query(QuestionDB).filter(
            QuestionDB.material_id == material_id
        ).count()
        
        return {
            "message": "Question file regenerated successfully from database",
            "material_id": material_id,
            "material_title": material.title,
            "questions_count": question_count,
            "file_path": file_path,
            "regenerated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate question file: {str(e)}"
        )


@router.get("/material/{material_id}/sync-status")
async def check_database_file_sync(
    material_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Check synchronization status between database and text files.
    
    This endpoint compares the number of questions in the database
    with the most recent text file to identify sync issues.
    
    Args:
        material_id: ID of the material to check
        db: Database session
        
    Returns:
        dict: Synchronization status information
        
    Raises:
        HTTPException: If material not found
    """
    try:
        # Get material
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Count questions in database
        db_question_count = db.query(QuestionDB).filter(
            QuestionDB.material_id == material_id
        ).count()
        
        # Find most recent question file
        import glob
        safe_title = "".join(c for c in material.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        pattern = f"questions/questions_{safe_title}_*.txt"
        files = glob.glob(pattern)
        
        file_status = {}
        if files:
            # Get most recent file
            most_recent_file = max(files, key=os.path.getmtime)
            
            try:
                with open(most_recent_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                file_question_count = content.count('QUESTION ')
                file_size = os.path.getsize(most_recent_file)
                
                file_status = {
                    "file_path": most_recent_file,
                    "questions_in_file": file_question_count,
                    "file_size_bytes": file_size,
                    "file_exists": True,
                    "last_modified": datetime.fromtimestamp(os.path.getmtime(most_recent_file)).isoformat()
                }
            except Exception as e:
                file_status = {
                    "file_path": most_recent_file,
                    "error": f"Failed to read file: {str(e)}",
                    "file_exists": True,
                    "questions_in_file": 0
                }
        else:
            file_status = {
                "file_exists": False,
                "questions_in_file": 0,
                "file_path": None
            }
        
        # Determine sync status
        is_synced = file_status.get("questions_in_file", 0) == db_question_count
        
        return {
            "material_id": material_id,
            "material_title": material.title,
            "database": {
                "questions_count": db_question_count
            },
            "file": file_status,
            "is_synchronized": is_synced,
            "sync_status": "✓ Synchronized" if is_synced else "✗ Out of sync",
            "recommendation": "No action needed" if is_synced else "Regenerate file from database"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check sync status: {str(e)}"
        ) 