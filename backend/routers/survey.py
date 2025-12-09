from typing import List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_database_session
from models import SurveyResponseDB

router = APIRouter()


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

@router.post("/")
async def submit_survey(
    response: Union[SurveyResponse, List[SurveyResponse]],
    db: Session = Depends(get_database_session)
):
    """
    Submit user feedback for the exam session.

    Persists the feedback to the database instead of a JSON file.
    Supports both single entry and batch submission.
    """
    try:
        responses = response if isinstance(response, list) else [response]

        for resp in responses:
            survey_entry = SurveyResponseDB(
                session_id=resp.session_id,
                question_number=resp.question_number,
                fairness_rating=resp.fairness_rating,
                ai_accuracy_rating=resp.ai_accuracy_rating,
                comments=resp.comments,
                email=resp.email,
                legi_number=resp.legi_number,
                survey_type="question" if resp.question_number is not None else "exam",
            )
            db.add(survey_entry)

        db.commit()

        return {
            "status": "success",
            "message": f"{len(responses)} survey(s) submitted successfully",
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save survey: {str(e)}")

