"""
Upload Router

This module handles file upload functionality for study materials.
It supports various file formats and extracts text content for question generation.

Author: AI Assistant
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
import os
import uuid
import aiofiles
from datetime import datetime
from typing import Optional
import PyPDF2
import docx
from io import BytesIO

# Local imports
from database import get_database_session
from models import MaterialDB, MaterialUpload, QuestionDB, ExamSessionDB, AnswerDB

router = APIRouter()

# Supported file types
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.doc'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def save_uploaded_file(upload_file: UploadFile) -> str:
    """
    Save uploaded file to the uploads directory.
    
    This function generates a unique filename and saves the uploaded file
    to the designated uploads directory.
    
    Args:
        upload_file: The uploaded file from FastAPI
        
    Returns:
        str: The file path where the file was saved
        
    Raises:
        HTTPException: If file saving fails
    """
    try:
        # Generate unique filename
        file_extension = os.path.splitext(upload_file.filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join("uploads", unique_filename)
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as buffer:
            content = await upload_file.read()
            await buffer.write(content)
            
        return file_path
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text content from PDF file.
    
    This function uses PyPDF2 to extract text from PDF files.
    It handles multiple pages and concatenates the content.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        str: Extracted text content
        
    Raises:
        Exception: If PDF parsing fails
    """
    try:
        text_content = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
        return text_content.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")

def extract_text_from_docx(file_path: str) -> str:
    """
    Extract text content from DOCX file.
    
    This function uses python-docx to extract text from Word documents.
    It processes all paragraphs and maintains document structure.
    
    Args:
        file_path: Path to the DOCX file
        
    Returns:
        str: Extracted text content
        
    Raises:
        Exception: If DOCX parsing fails
    """
    try:
        doc = docx.Document(file_path)
        text_content = ""
        for paragraph in doc.paragraphs:
            text_content += paragraph.text + "\n"
        return text_content.strip()
    except Exception as e:
        raise Exception(f"Failed to extract text from DOCX: {str(e)}")

def extract_text_from_txt(file_path: str) -> str:
    """
    Extract text content from TXT file.
    
    This function reads plain text files with proper encoding handling.
    
    Args:
        file_path: Path to the TXT file
        
    Returns:
        str: Extracted text content
        
    Raises:
        Exception: If file reading fails
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read().strip()
    except UnicodeDecodeError:
        # Try with different encoding if UTF-8 fails
        try:
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read().strip()
        except Exception as e:
            raise Exception(f"Failed to read text file: {str(e)}")
    except Exception as e:
        raise Exception(f"Failed to extract text from TXT: {str(e)}")

def extract_text_content(file_path: str, file_extension: str) -> str:
    """
    Extract text content from uploaded file based on file type.
    
    This function routes to the appropriate text extraction method
    based on the file extension.
    
    Args:
        file_path: Path to the uploaded file
        file_extension: File extension (e.g., '.pdf', '.docx')
        
    Returns:
        str: Extracted text content
        
    Raises:
        HTTPException: If file type is unsupported or extraction fails
    """
    try:
        if file_extension == '.pdf':
            return extract_text_from_pdf(file_path)
        elif file_extension in ['.docx', '.doc']:
            return extract_text_from_docx(file_path)
        elif file_extension == '.txt':
            return extract_text_from_txt(file_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_extension}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

@router.post("/material")
async def upload_material(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    subject: str = Form(...),
    db: Session = Depends(get_database_session)
):
    """
    Upload study material and extract text content.
    
    This endpoint handles file upload, validates the file type and size,
    extracts text content, and stores the material information in the database.
    
    Args:
        file: The uploaded file
        title: Title of the material
        description: Optional description
        subject: Academic subject
        db: Database session
        
    Returns:
        dict: Material information including ID and extracted text preview
        
    Raises:
        HTTPException: For various validation and processing errors
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 10MB")
    
    # Reset file pointer for saving
    await file.seek(0)
    
    try:
        # Save file
        file_path = await save_uploaded_file(file)
        
        # Extract text content
        text_content = extract_text_content(file_path, file_extension)
        
        if not text_content or len(text_content.strip()) < 50:
            # Clean up file if text extraction yields insufficient content
            os.remove(file_path)
            raise HTTPException(
                status_code=400, 
                detail="Insufficient text content extracted from file"
            )
        
        # Create database entry
        material_db = MaterialDB(
            title=title,
            description=description,
            subject=subject,
            file_path=file_path,
            file_type=file_extension,
            content_text=text_content
        )
        
        db.add(material_db)
        db.commit()
        db.refresh(material_db)
        
        # Return material information with text preview
        text_preview = text_content[:500] + "..." if len(text_content) > 500 else text_content
        
        return {
            "id": material_db.id,
            "title": material_db.title,
            "description": material_db.description,
            "subject": material_db.subject,
            "file_type": material_db.file_type,
            "upload_time": material_db.upload_time,
            "text_preview": text_preview,
            "text_length": len(text_content),
            "message": "Material uploaded and processed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file if database operation fails
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process material: {str(e)}")

@router.get("/materials")
async def list_materials(
    subject: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_database_session)
):
    """
    List uploaded materials with optional filtering.
    
    This endpoint retrieves a list of uploaded materials with pagination
    and optional filtering by subject.
    
    Args:
        subject: Optional subject filter
        limit: Maximum number of materials to return
        offset: Number of materials to skip (for pagination)
        db: Database session
        
    Returns:
        dict: List of materials with pagination info
    """
    try:
        query = db.query(MaterialDB)
        
        if subject:
            query = query.filter(MaterialDB.subject.ilike(f"%{subject}%"))
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination and get results
        materials = query.offset(offset).limit(limit).all()
        
        # Format results
        materials_list = []
        for material in materials:
            materials_list.append({
                "id": material.id,
                "title": material.title,
                "description": material.description,
                "subject": material.subject,
                "file_type": material.file_type,
                "upload_time": material.upload_time,
                "text_length": len(material.content_text) if material.content_text else 0
            })
        
        return {
            "materials": materials_list,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve materials: {str(e)}")

@router.get("/material/{material_id}")
async def get_material(
    material_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Get detailed information about a specific material.
    
    This endpoint retrieves complete information about a material,
    including the full text content.
    
    Args:
        material_id: ID of the material
        db: Database session
        
    Returns:
        dict: Complete material information
        
    Raises:
        HTTPException: If material not found
    """
    try:
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        return {
            "id": material.id,
            "title": material.title,
            "description": material.description,
            "subject": material.subject,
            "file_type": material.file_type,
            "upload_time": material.upload_time,
            "content_text": material.content_text,
            "text_length": len(material.content_text) if material.content_text else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve material: {str(e)}")

@router.delete("/material/{material_id}")
async def delete_material(
    material_id: int,
    db: Session = Depends(get_database_session)
):
    """
    Delete a material and all its associated data (cascade delete).
    
    This endpoint removes a material from the database along with all associated
    questions, exam sessions, answers, and deletes the file from the filesystem.
    The deletion follows this order to maintain referential integrity:
    1. Delete all answers associated with exam sessions of this material
    2. Delete all exam sessions associated with this material
    3. Delete all questions associated with this material
    4. Delete the material file from filesystem
    5. Delete the material from database
    
    Args:
        material_id: ID of the material to delete
        db: Database session
        
    Returns:
        dict: Deletion confirmation with counts of deleted records
        
    Raises:
        HTTPException: If material not found or deletion fails
    """
    try:
        # Check if material exists
        material = db.query(MaterialDB).filter(MaterialDB.id == material_id).first()
        
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        material_title = material.title
        deleted_counts = {
            "answers": 0,
            "exam_sessions": 0,
            "questions": 0,
            "material": 1
        }
        
        # Step 1: Get all exam sessions for this material
        exam_sessions = db.query(ExamSessionDB).filter(ExamSessionDB.material_id == material_id).all()
        exam_session_ids = [session.id for session in exam_sessions]
        
        # Step 2: Delete all answers associated with exam sessions of this material
        if exam_session_ids:
            answers_deleted = db.query(AnswerDB).filter(AnswerDB.exam_session_id.in_(exam_session_ids)).delete(synchronize_session=False)
            deleted_counts["answers"] = answers_deleted
        
        # Step 3: Delete all exam sessions associated with this material
        exam_sessions_deleted = db.query(ExamSessionDB).filter(ExamSessionDB.material_id == material_id).delete(synchronize_session=False)
        deleted_counts["exam_sessions"] = exam_sessions_deleted
        
        # Step 4: Delete all questions associated with this material
        questions_deleted = db.query(QuestionDB).filter(QuestionDB.material_id == material_id).delete(synchronize_session=False)
        deleted_counts["questions"] = questions_deleted
        
        # Step 5: Delete file from filesystem
        if os.path.exists(material.file_path):
            os.remove(material.file_path)
        
        # Step 6: Delete the material from database
        db.delete(material)
        
        # Commit all changes
        db.commit()
        
        return {
            "message": f"Material '{material_title}' and all associated data deleted successfully",
            "deleted_id": material_id,
            "deleted_counts": deleted_counts,
            "total_records_deleted": sum(deleted_counts.values())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete material: {str(e)}") 