"""
DevNet StudyLab - Lab Engine
FastAPI service providing mock Cisco APIs and exercise grading.
"""

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from mock_apis.meraki.app import router as meraki_router
from mock_apis.catalyst.app import router as catalyst_router
from mock_apis.webex.app import router as webex_router
from grader.python_grader import grade_submission
from mock_apis.standalone import ALLOWED_ORIGINS

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DevNet StudyLab - Lab Engine",
    description="Mock Cisco APIs and exercise grading for DevNet certification study",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "lab-engine",
        "version": "1.0.0",
        "mock_apis": ["meraki", "catalyst-center", "webex"],
    }


# ---------------------------------------------------------------------------
# Exercise router
# ---------------------------------------------------------------------------

exercises_router = APIRouter(prefix="/api/v1/exercises", tags=["exercises"])

# In-memory store (replaced by a real DB in production)
EXERCISES: dict = {
    "ex-001": {
        "id": "ex-001",
        "title": "List Meraki Organizations",
        "description": "Use the Meraki Dashboard API to retrieve all organizations.",
        "difficulty": "beginner",
        "api": "meraki",
        "hints": [
            "Use GET /api/v1/organizations",
            "Include the X-Cisco-Meraki-API-Key header",
        ],
        "expected_output_contains": "DevNet Sandbox",
    },
    "ex-002": {
        "id": "ex-002",
        "title": "Authenticate to Catalyst Center",
        "description": "Obtain a token from Catalyst Center using Basic authentication.",
        "difficulty": "beginner",
        "api": "catalyst-center",
        "hints": [
            "POST to /dna/system/api/v1/auth/token",
            "Use Basic auth with admin/admin credentials",
        ],
        "expected_output_contains": "Token",
    },
    "ex-003": {
        "id": "ex-003",
        "title": "Send a Webex Message",
        "description": "Post a message to a Webex room using the Webex REST API.",
        "difficulty": "beginner",
        "api": "webex",
        "hints": [
            "POST to /v1/messages",
            "Include roomId and text in the JSON body",
        ],
        "expected_output_contains": "created",
    },
}


@exercises_router.get("")
async def list_exercises():
    return {"exercises": list(EXERCISES.values())}


@exercises_router.get("/{exercise_id}")
async def get_exercise(exercise_id: str):
    exercise = EXERCISES.get(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise


# ---------------------------------------------------------------------------
# Grade router
# ---------------------------------------------------------------------------

grade_router = APIRouter(prefix="/api/v1/grade", tags=["grading"])


class GradeRequest(BaseModel):
    exercise_id: str
    code: str
    language: str = "python"


class GradeResponse(BaseModel):
    passed: bool
    output: str
    errors: str
    score: float
    exercise_id: str
    feedback: Optional[str] = None


@grade_router.post("", response_model=GradeResponse)
async def grade(request: GradeRequest):
    exercise = EXERCISES.get(request.exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    expected_contains = exercise.get("expected_output_contains", "")

    result = grade_submission(
        code=request.code,
        expected_output_contains=expected_contains,
    )

    feedback = None
    if result["passed"]:
        feedback = "Great work! Your solution produces the expected output."
    elif result["errors"]:
        feedback = "Your code raised an error. Check the traceback for details."
    else:
        feedback = (
            "Your code ran but the output does not match what the exercise expects. "
            "Review the exercise hints and try again."
        )

    return GradeResponse(
        passed=result["passed"],
        output=result["output"],
        errors=result["errors"],
        score=result["score"],
        exercise_id=request.exercise_id,
        feedback=feedback,
    )


# ---------------------------------------------------------------------------
# Sandbox router
# ---------------------------------------------------------------------------

sandbox_router = APIRouter(prefix="/api/v1/sandbox", tags=["sandbox"])


class SandboxRunRequest(BaseModel):
    code: str
    language: str = "python"
    timeout: int = 10


class SandboxRunResponse(BaseModel):
    output: str
    errors: str
    exit_code: int


@sandbox_router.post("/run", response_model=SandboxRunResponse)
async def sandbox_run(request: SandboxRunRequest):
    """Execute arbitrary code in a sandboxed subprocess (for practice)."""
    result = grade_submission(
        code=request.code,
        expected_output_contains="",
        timeout=request.timeout,
    )
    return SandboxRunResponse(
        output=result["output"],
        errors=result["errors"],
        exit_code=0 if not result["errors"] else 1,
    )


# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------

app.include_router(exercises_router)
app.include_router(grade_router)
app.include_router(sandbox_router)

# Mount mock API sub-applications
app.include_router(meraki_router, prefix="/mock/meraki", tags=["mock-meraki"])
app.include_router(catalyst_router, prefix="/mock/catalyst", tags=["mock-catalyst"])
app.include_router(webex_router, prefix="/mock/webex", tags=["mock-webex"])
