from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from datetime import datetime

router = APIRouter()

from typing import Optional

class SurveyResponse(BaseModel):
    fairness_rating: int
    ai_accuracy_rating: int
    comments: str
    session_id: Optional[int] = None
    question_number: Optional[int] = None  # Optional: for per-question surveys
    email: Optional[str] = None  # Student email

SURVEY_FILE = "survey_results.json"

from typing import List, Union

@router.post("/")
async def submit_survey(response: Union[SurveyResponse, List[SurveyResponse]]):
    """
    Submit user feedback for the exam session.
    Appends the feedback to a JSON file.
    Supports both single entry and batch submission.
    """
    try:
        # Normalize input to list
        responses = response if isinstance(response, list) else [response]
        
        new_entries = []
        for resp in responses:
            entry = {
                "timestamp": datetime.now().isoformat(),
                "session_id": resp.session_id,
                "question_number": resp.question_number,  # None for overall exam survey
                "fairness_rating": resp.fairness_rating,
                "ai_accuracy_rating": resp.ai_accuracy_rating,
                "comments": resp.comments,
                "email": resp.email,
                "survey_type": "question" if resp.question_number is not None else "exam"
            }
            new_entries.append(entry)
        
        existing_data = []
        if os.path.exists(SURVEY_FILE):
            try:
                with open(SURVEY_FILE, "r") as f:
                    existing_data = json.load(f)
            except json.JSONDecodeError:
                existing_data = []
        
        if not isinstance(existing_data, list):
            existing_data = []
            
        existing_data.extend(new_entries)
        
        with open(SURVEY_FILE, "w") as f:
            json.dump(existing_data, f, indent=2)
            
        return {"status": "success", "message": f"{len(new_entries)} survey(s) submitted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")

