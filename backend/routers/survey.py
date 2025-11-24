from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from datetime import datetime

router = APIRouter()

class SurveyResponse(BaseModel):
    fairness_rating: int
    ai_accuracy_rating: int
    comments: str
    session_id: int = None
    question_number: int = None  # Optional: for per-question surveys

SURVEY_FILE = "survey_results.json"

@router.post("/")
async def submit_survey(response: SurveyResponse):
    """
    Submit user feedback for the exam session.
    Appends the feedback to a JSON file.
    """
    try:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "session_id": response.session_id,
            "question_number": response.question_number,  # None for overall exam survey
            "fairness_rating": response.fairness_rating,
            "ai_accuracy_rating": response.ai_accuracy_rating,
            "comments": response.comments,
            "survey_type": "question" if response.question_number is not None else "exam"
        }
        
        existing_data = []
        if os.path.exists(SURVEY_FILE):
            try:
                with open(SURVEY_FILE, "r") as f:
                    existing_data = json.load(f)
            except json.JSONDecodeError:
                existing_data = []
        
        if not isinstance(existing_data, list):
            existing_data = []
            
        existing_data.append(entry)
        
        with open(SURVEY_FILE, "w") as f:
            json.dump(existing_data, f, indent=2)
            
        return {"status": "success", "message": "Survey submitted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")

