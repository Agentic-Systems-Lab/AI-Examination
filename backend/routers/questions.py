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

# Initialize OpenAI client (lazy initialization)
def get_openai_client():
    """Get OpenAI client with proper error handling."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        raise HTTPException(
            status_code=500, 
            detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
        )
    return OpenAI(api_key=api_key)

def create_question_generation_prompt(content: str, num_questions: int, 
                                    question_types: List[QuestionType], 
                                    difficulty_level: int, subject: str,
                                    document_type: str = "study_material") -> str:
    """
    Create a comprehensive prompt for OpenAI question generation.
    
    This function constructs a detailed prompt that instructs OpenAI
    to generate questions based on the provided content and parameters.
    
    Args:
        content: The content from the uploaded material
        num_questions: Number of questions to generate
        question_types: Types of questions to generate
        difficulty_level: Difficulty level (1-5)
        subject: Academic subject
        document_type: Type of document (study_material, assignment, thesis, paper)
        
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
    
    # Map document types to readable labels
    document_type_labels = {
        "study_material": "study material",
        "assignment": "assignment",
        "thesis": "thesis",
        "paper": "academic paper"
    }
    content_label = document_type_labels.get(document_type, "content")
    
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

{content_label.upper()}:
{content}

🔢 COUNT VERIFICATION: Before responding, count your questions to ensure you have exactly {num_questions} items in the JSON array.

REQUIREMENTS:
1. ✅ EXACTLY {num_questions} questions (count them!)
2. Questions must be directly related to the provided {content_label}
3. Each question should test understanding of key concepts
4. Provide clear, unambiguous questions
5. For multiple choice: include exactly 4 options with only one correct answer
6. For all question types: provide a comprehensive explanation of the correct answer
7. The questions are all short essay questions.
8. Ensure questions test different aspects of the {content_label} (facts, concepts, applications)

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
    Generate questions using OpenAI API based on uploaded content.
    
    This function sends a request to OpenAI API to generate questions
    based on the provided material and converts the response to Question objects.
    
    Args:
        material: The uploaded material from database
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
            subject=material.subject,
            document_type=material.document_type
        )
        
        # Call OpenAI API with gpt-4o-mini for better performance and larger context
        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert academic examiner. Generate high-quality exam questions based on uploaded content."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=4000,
            temperature=0.2
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
    Save generated questions to a formatted text file for backup/export.
    
    Args:
        questions: List of generated questions
        material: The source material information
        
    Returns:
        str: File path where questions were saved
        
    Raises:
        Exception: If file writing fails
    """
    # Create filename
    safe_title = "".join(c for c in material.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"questions_{safe_title}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    file_path = os.path.join("questions", filename)
    
    # Ensure questions directory exists
    os.makedirs("questions", exist_ok=True)
    
    # Write questions to file
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
        
        return file_path
        
    except Exception as e:
        raise Exception(f"Failed to save questions to file: {str(e)}")

@router.post("/generate")
async def generate_questions(
    request: QuestionRequest,
    db: Session = Depends(get_database_session)
):
    """
    Generate questions from uploaded material using OpenAI API.
    
    This endpoint generates questions based on uploaded material,
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
        
        # Save questions to text file for backup/export (non-critical)
        file_path = None
        try:
            file_path = save_questions_to_file(questions, material)
        except Exception as file_error:
            print(f"Warning: Failed to create backup text file: {file_error}")
        
        return {
            "message": "Questions generated successfully",
            "material_id": material.id,
            "material_title": material.title,
            "questions_generated": len(questions),
            "questions": [q.dict() for q in saved_questions],
            "file_path": file_path
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
