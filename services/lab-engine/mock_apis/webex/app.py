"""
Mock Webex REST API

Provides realistic endpoints matching the Webex Teams / Messaging API so
students can practice without needing a live Webex environment.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from mock_apis.standalone import make_standalone_app

router = APIRouter()

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

VALID_TOKENS = {
    "NWIzYWJkMzAtODQ2YS00YmE5LTk5MDktZDc5ZTM1Y2IwOTgw",
    "devnet-studylab-webex-token",
}


def _require_bearer(authorization: Optional[str]) -> str:
    """Validate Bearer token and return the token value."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={
                "message": "The request requires a valid access token set in the Authorization header.",
                "errors": [
                    {
                        "description": "The request requires a valid access token set in the Authorization header.",
                    }
                ],
                "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
            },
        )
    return authorization.split(" ", 1)[1]


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

CURRENT_USER = {
    "id": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8xMjM0NTY3ODkw",
    "emails": ["devnet_student@studylab.local"],
    "phoneNumbers": [{"type": "work", "value": "+1 555-0199"}],
    "displayName": "DevNet Student",
    "nickName": "DevNet",
    "firstName": "DevNet",
    "lastName": "Student",
    "avatar": "https://avatar.example.com/devnet_student.png",
    "orgId": "Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi9hYmNk",
    "created": "2025-01-15T08:00:00.000Z",
    "lastModified": "2026-02-20T12:00:00.000Z",
    "lastActivity": "2026-02-27T09:30:00.000Z",
    "status": "active",
    "type": "person",
}

ROOMS: list[dict] = [
    {
        "id": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
        "title": "DevNet Study Group",
        "type": "group",
        "isLocked": False,
        "lastActivity": "2026-02-27T08:30:00.000Z",
        "creatorId": CURRENT_USER["id"],
        "created": "2025-06-01T10:00:00.000Z",
        "ownerId": CURRENT_USER["id"],
        "isPublic": False,
        "isAnnouncementOnly": False,
    },
    {
        "id": "Y2lzY29zcGFyazovL3VzL1JPT00vZmVkY2JhOTg3NjU0",
        "title": "Network Automation Lab",
        "type": "group",
        "isLocked": False,
        "lastActivity": "2026-02-26T17:45:00.000Z",
        "creatorId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS85ODc2NTQzMjEw",
        "created": "2025-09-10T14:00:00.000Z",
        "ownerId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS85ODc2NTQzMjEw",
        "isPublic": False,
        "isAnnouncementOnly": False,
    },
    {
        "id": "Y2lzY29zcGFyazovL3VzL1JPT00vMTExMjIyMzMzNDQ0",
        "title": "Cisco API Workshop",
        "type": "group",
        "isLocked": False,
        "lastActivity": "2026-02-25T11:20:00.000Z",
        "creatorId": CURRENT_USER["id"],
        "created": "2026-01-05T09:00:00.000Z",
        "ownerId": CURRENT_USER["id"],
        "isPublic": False,
        "isAnnouncementOnly": False,
    },
]

_ROOMS_BY_ID = {r["id"]: r for r in ROOMS}

MESSAGES: dict[str, list[dict]] = {
    "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1": [
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNnMDAxMDAx",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
            "roomType": "group",
            "text": "Welcome to the DevNet Study Group! Let's share resources here.",
            "personId": CURRENT_USER["id"],
            "personEmail": "devnet_student@studylab.local",
            "created": "2025-06-01T10:05:00.000Z",
        },
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNnMDAxMDAy",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
            "roomType": "group",
            "text": "Has anyone finished the Meraki API lab? I need help with authentication.",
            "personId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS85ODc2NTQzMjEw",
            "personEmail": "alice.network@studylab.local",
            "created": "2026-02-27T08:15:00.000Z",
        },
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNnMDAxMDAz",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
            "roomType": "group",
            "text": "Yes! You need to pass the API key in the X-Cisco-Meraki-API-Key header.",
            "personId": CURRENT_USER["id"],
            "personEmail": "devnet_student@studylab.local",
            "created": "2026-02-27T08:30:00.000Z",
        },
    ],
    "Y2lzY29zcGFyazovL3VzL1JPT00vZmVkY2JhOTg3NjU0": [
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNnMDAyMDAx",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vZmVkY2JhOTg3NjU0",
            "roomType": "group",
            "text": "Sharing my Ansible playbook for VLAN automation. Check the attached YAML.",
            "personId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS85ODc2NTQzMjEw",
            "personEmail": "alice.network@studylab.local",
            "created": "2026-02-26T17:45:00.000Z",
        },
    ],
}

MEMBERSHIPS: dict[str, list[dict]] = {
    "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1": [
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAvbWVtMDAxMDAx",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
            "personId": CURRENT_USER["id"],
            "personEmail": "devnet_student@studylab.local",
            "personDisplayName": "DevNet Student",
            "isModerator": True,
            "isMonitor": False,
            "created": "2025-06-01T10:00:00.000Z",
        },
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAvbWVtMDAxMDAy",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
            "personId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS85ODc2NTQzMjEw",
            "personEmail": "alice.network@studylab.local",
            "personDisplayName": "Alice Network",
            "isModerator": False,
            "isMonitor": False,
            "created": "2025-06-02T08:00:00.000Z",
        },
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAvbWVtMDAxMDAz",
            "roomId": "Y2lzY29zcGFyazovL3VzL1JPT00vYWJjZGVmMDEyMzQ1",
            "personId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8xMTExMjIyMjMzMw",
            "personEmail": "bob.devops@studylab.local",
            "personDisplayName": "Bob DevOps",
            "isModerator": False,
            "isMonitor": False,
            "created": "2025-07-15T12:00:00.000Z",
        },
    ],
}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class CreateRoomRequest(BaseModel):
    title: str
    type: str = "group"


class SendMessageRequest(BaseModel):
    roomId: str
    text: Optional[str] = None
    markdown: Optional[str] = None


class AddMembershipRequest(BaseModel):
    roomId: str
    personId: Optional[str] = None
    personEmail: Optional[str] = None
    isModerator: bool = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/v1/people/me")
async def get_me(
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    _require_bearer(authorization)
    return CURRENT_USER


@router.get("/v1/rooms")
async def list_rooms(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    max: int = Query(default=100, alias="max"),
    type: Optional[str] = Query(default=None),
    sortBy: Optional[str] = Query(default=None),
):
    _require_bearer(authorization)
    items = ROOMS
    if type:
        items = [r for r in items if r["type"] == type]
    return {"items": items}


@router.post("/v1/rooms", status_code=201)
async def create_room(
    body: CreateRoomRequest,
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    _require_bearer(authorization)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    new_room = {
        "id": "Y2lzY29zcGFyazovL3VzL1JPT00v" + uuid.uuid4().hex[:12],
        "title": body.title,
        "type": body.type,
        "isLocked": False,
        "lastActivity": now,
        "creatorId": CURRENT_USER["id"],
        "created": now,
        "ownerId": CURRENT_USER["id"],
        "isPublic": False,
        "isAnnouncementOnly": False,
    }
    ROOMS.append(new_room)
    _ROOMS_BY_ID[new_room["id"]] = new_room
    MESSAGES[new_room["id"]] = []
    MEMBERSHIPS[new_room["id"]] = [
        {
            "id": "Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAv" + uuid.uuid4().hex[:12],
            "roomId": new_room["id"],
            "personId": CURRENT_USER["id"],
            "personEmail": CURRENT_USER["emails"][0],
            "personDisplayName": CURRENT_USER["displayName"],
            "isModerator": True,
            "isMonitor": False,
            "created": now,
        }
    ]
    return new_room


@router.get("/v1/messages")
async def list_messages(
    roomId: str = Query(...),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    max: int = Query(default=50, alias="max"),
):
    _require_bearer(authorization)
    if roomId not in _ROOMS_BY_ID:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Room not found",
                "errors": [{"description": f"Room {roomId} does not exist."}],
                "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
            },
        )
    items = MESSAGES.get(roomId, [])
    return {"items": items[-max:]}


@router.post("/v1/messages", status_code=201)
async def send_message(
    body: SendMessageRequest,
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    _require_bearer(authorization)
    if body.roomId not in _ROOMS_BY_ID:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Room not found",
                "errors": [{"description": f"Room {body.roomId} does not exist."}],
                "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
            },
        )
    if not body.text and not body.markdown:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "text or markdown is required",
                "errors": [
                    {"description": "You must provide either text or markdown content."}
                ],
                "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
            },
        )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    new_message = {
        "id": "Y2lzY29zcGFyazovL3VzL01FU1NBR0Uv" + uuid.uuid4().hex[:12],
        "roomId": body.roomId,
        "roomType": _ROOMS_BY_ID[body.roomId]["type"],
        "text": body.text or "",
        "personId": CURRENT_USER["id"],
        "personEmail": CURRENT_USER["emails"][0],
        "created": now,
    }
    if body.markdown:
        new_message["markdown"] = body.markdown

    MESSAGES.setdefault(body.roomId, []).append(new_message)
    return new_message


@router.get("/v1/memberships")
async def list_memberships(
    roomId: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    max: int = Query(default=100, alias="max"),
):
    _require_bearer(authorization)
    if roomId:
        if roomId not in _ROOMS_BY_ID:
            raise HTTPException(
                status_code=404,
                detail={
                    "message": "Room not found",
                    "errors": [{"description": f"Room {roomId} does not exist."}],
                    "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
                },
            )
        items = MEMBERSHIPS.get(roomId, [])
    else:
        items = [m for members in MEMBERSHIPS.values() for m in members]
    return {"items": items[-max:]}


@router.post("/v1/memberships", status_code=201)
async def add_membership(
    body: AddMembershipRequest,
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    _require_bearer(authorization)
    if body.roomId not in _ROOMS_BY_ID:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Room not found",
                "errors": [{"description": f"Room {body.roomId} does not exist."}],
                "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
            },
        )
    if not body.personId and not body.personEmail:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "personId or personEmail is required",
                "errors": [
                    {"description": "You must provide either personId or personEmail."}
                ],
                "trackingId": "STUDYLAB_MOCK_" + uuid.uuid4().hex[:12],
            },
        )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    person_email = body.personEmail or f"user_{uuid.uuid4().hex[:6]}@studylab.local"
    person_id = body.personId or ("Y2lzY29zcGFyazovL3VzL1BFT1BMRS8" + uuid.uuid4().hex[:12])

    new_membership = {
        "id": "Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAv" + uuid.uuid4().hex[:12],
        "roomId": body.roomId,
        "personId": person_id,
        "personEmail": person_email,
        "personDisplayName": person_email.split("@")[0].replace("_", " ").title(),
        "isModerator": body.isModerator,
        "isMonitor": False,
        "created": now,
    }
    MEMBERSHIPS.setdefault(body.roomId, []).append(new_membership)
    return new_membership


# ---------------------------------------------------------------------------
# Standalone service entrypoint
# ---------------------------------------------------------------------------
# This must stay the LAST thing in the file: it snapshots the router, so a
# route declared below it would be served under /mock/* (main.py includes the
# router later) but be missing from the standalone service. tests/ asserts the
# two expose identical paths.
# `main.py` mounts `router` under /mock/webex; this `app` is what the
# `mock-webex` container serves on its own port.
app = make_standalone_app(
    router,
    title="Mock Webex API",
    description="Webex Teams / Messaging REST API simulator for DevNet study",
)
