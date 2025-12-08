from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import json
import os
from datetime import datetime

router = APIRouter()

from typing import Optional


class SurveyResponse(BaseModel):
    """
    Survey response model.

    All visible survey fields are required:
      - fairness_rating
      - ai_accuracy_rating
      - comments (must be non-empty)

    Optional metadata fields are:
      - session_id
      - question_number
      - email
      - legi_number
    """

    fairness_rating: int = Field(..., ge=1, le=5)
    ai_accuracy_rating: int = Field(..., ge=1, le=5)
    comments: str = Field(..., min_length=1)
    session_id: Optional[int] = None
    question_number: Optional[int] = None  # Optional: for per-question surveys
    email: Optional[str] = None  # Student email
    legi_number: Optional[str] = None  # Student Legi-Number

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
                "legi_number": resp.legi_number,
                "survey_type": "question" if resp.question_number is not None else "exam"
            }
            new_entries.append(entry)
        
        existing_data = []
        # if os.path.exists(SURVEY_FILE):
        #     try:
        #         with open(SURVEY_FILE, "r") as f:
        #             existing_data = json.load(f)
        #     except json.JSONDecodeError:
        #         existing_data = []
        
        # if not isinstance(existing_data, list):
        #     existing_data = []
            
        # existing_data.extend(new_entries)
        
        with open(resp.legi_number+'.json', "w") as f:
            json.dump(new_entries, f, indent=2)
            
        return {"status": "success", "message": f"{len(new_entries)} survey(s) submitted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")

