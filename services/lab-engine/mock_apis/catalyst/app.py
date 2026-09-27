"""
Mock Cisco Catalyst Center (DNA Center) API

Provides realistic endpoints matching the Catalyst Center Intent API so
students can practice without needing a live controller.
"""

import base64
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from mock_apis.standalone import make_standalone_app

router = APIRouter()

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

VALID_CREDENTIALS = {"admin": "admin", "devnetuser": "Cisco123!"}
VALID_TOKENS = {
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.studylab-mock-catalyst-token",
    "devnet-studylab-catalyst-token",
}


def _require_token(token: Optional[str]) -> None:
    """Validate that the X-Auth-Token header is present."""
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"response": {"errorCode": "UNAUTHORIZED", "message": "Missing X-Auth-Token header"}},
        )


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

DEVICES = [
    {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "hostname": "cat9300-floor1.studylab.local",
        "managementIpAddress": "10.10.20.51",
        "platformId": "C9300-24T",
        "softwareVersion": "17.9.4a",
        "softwareType": "IOS-XE",
        "role": "ACCESS",
        "upTime": "72 days, 14:22:33",
        "serialNumber": "FCW2214L0VK",
        "macAddress": "00:1e:bd:c4:22:01",
        "lastUpdateTime": 1708934400000,
        "lastUpdated": "2026-02-26 10:00:00",
        "reachabilityStatus": "Reachable",
        "reachabilityFailureReason": "",
        "collectionStatus": "Managed",
        "collectionInterval": "Global Default",
        "family": "Switches and Hubs",
        "type": "Cisco Catalyst 9300 Switch",
        "location": None,
        "instanceTenantId": "602befa4e5a4a700c5e5a6a1",
        "instanceUuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    },
    {
        "id": "7ca72f87-1234-4abc-def0-123456789abc",
        "hostname": "cat9300-floor2.studylab.local",
        "managementIpAddress": "10.10.20.52",
        "platformId": "C9300-48P",
        "softwareVersion": "17.9.4a",
        "softwareType": "IOS-XE",
        "role": "ACCESS",
        "upTime": "72 days, 14:22:11",
        "serialNumber": "FCW2214L0VL",
        "macAddress": "00:1e:bd:c4:22:02",
        "lastUpdateTime": 1708934400000,
        "lastUpdated": "2026-02-26 10:00:00",
        "reachabilityStatus": "Reachable",
        "reachabilityFailureReason": "",
        "collectionStatus": "Managed",
        "collectionInterval": "Global Default",
        "family": "Switches and Hubs",
        "type": "Cisco Catalyst 9300 Switch",
        "location": None,
        "instanceTenantId": "602befa4e5a4a700c5e5a6a1",
        "instanceUuid": "7ca72f87-1234-4abc-def0-123456789abc",
    },
    {
        "id": "a1b2c3d4-5678-9abc-def0-a1b2c3d4e5f6",
        "hostname": "isr4451-edge.studylab.local",
        "managementIpAddress": "10.10.20.1",
        "platformId": "ISR4451-X/K9",
        "softwareVersion": "17.6.5",
        "softwareType": "IOS-XE",
        "role": "BORDER ROUTER",
        "upTime": "120 days, 03:45:12",
        "serialNumber": "FTX2237A0RH",
        "macAddress": "00:1e:bd:d5:33:01",
        "lastUpdateTime": 1708934400000,
        "lastUpdated": "2026-02-26 10:00:00",
        "reachabilityStatus": "Reachable",
        "reachabilityFailureReason": "",
        "collectionStatus": "Managed",
        "collectionInterval": "Global Default",
        "family": "Routers",
        "type": "Cisco ISR 4451-X Integrated Services Router",
        "location": None,
        "instanceTenantId": "602befa4e5a4a700c5e5a6a1",
        "instanceUuid": "a1b2c3d4-5678-9abc-def0-a1b2c3d4e5f6",
    },
    {
        "id": "b2c3d4e5-6789-abcd-ef01-b2c3d4e5f6a7",
        "hostname": "cat9800-wlc.studylab.local",
        "managementIpAddress": "10.10.20.60",
        "platformId": "C9800-L-F-K9",
        "softwareVersion": "17.9.3",
        "softwareType": "IOS-XE",
        "role": "ACCESS",
        "upTime": "45 days, 08:12:44",
        "serialNumber": "FCW2352B0Q1",
        "macAddress": "00:1e:bd:e6:44:01",
        "lastUpdateTime": 1708934400000,
        "lastUpdated": "2026-02-26 10:00:00",
        "reachabilityStatus": "Reachable",
        "reachabilityFailureReason": "",
        "collectionStatus": "Managed",
        "collectionInterval": "Global Default",
        "family": "Wireless Controller",
        "type": "Cisco Catalyst 9800-L Wireless Controller",
        "location": None,
        "instanceTenantId": "602befa4e5a4a700c5e5a6a1",
        "instanceUuid": "b2c3d4e5-6789-abcd-ef01-b2c3d4e5f6a7",
    },
    {
        "id": "c3d4e5f6-789a-bcde-f012-c3d4e5f6a7b8",
        "hostname": "cat9500-core.studylab.local",
        "managementIpAddress": "10.10.20.10",
        "platformId": "C9500-24Y4C",
        "softwareVersion": "17.9.4a",
        "softwareType": "IOS-XE",
        "role": "DISTRIBUTION",
        "upTime": "180 days, 22:10:55",
        "serialNumber": "FCW2352C0R2",
        "macAddress": "00:1e:bd:f7:55:01",
        "lastUpdateTime": 1708934400000,
        "lastUpdated": "2026-02-26 10:00:00",
        "reachabilityStatus": "Reachable",
        "reachabilityFailureReason": "",
        "collectionStatus": "Managed",
        "collectionInterval": "Global Default",
        "family": "Switches and Hubs",
        "type": "Cisco Catalyst 9500 Switch",
        "location": None,
        "instanceTenantId": "602befa4e5a4a700c5e5a6a1",
        "instanceUuid": "c3d4e5f6-789a-bcde-f012-c3d4e5f6a7b8",
    },
]

_DEVICES_BY_ID = {d["id"]: d for d in DEVICES}

SITES = {
    "response": [
        {
            "id": "d7a8b9c0-1234-5678-9abc-d7a8b9c0e1f2",
            "name": "Global",
            "parentId": None,
            "additionalInfo": [
                {"nameSpace": "Location", "attributes": {"type": "area"}}
            ],
        },
        {
            "id": "e8b9c0d1-2345-6789-abcd-e8b9c0d1f2a3",
            "name": "StudyLab Campus",
            "parentId": "d7a8b9c0-1234-5678-9abc-d7a8b9c0e1f2",
            "additionalInfo": [
                {"nameSpace": "Location", "attributes": {"type": "area"}}
            ],
        },
        {
            "id": "f9c0d1e2-3456-789a-bcde-f9c0d1e2a3b4",
            "name": "Building A",
            "parentId": "e8b9c0d1-2345-6789-abcd-e8b9c0d1f2a3",
            "additionalInfo": [
                {
                    "nameSpace": "Location",
                    "attributes": {
                        "type": "building",
                        "address": "500 Terry A Francine Blvd, San Francisco, CA",
                        "latitude": "37.7697",
                        "longitude": "-122.3933",
                    },
                }
            ],
        },
        {
            "id": "a0d1e2f3-4567-89ab-cdef-a0d1e2f3b4c5",
            "name": "Floor 1",
            "parentId": "f9c0d1e2-3456-789a-bcde-f9c0d1e2a3b4",
            "additionalInfo": [
                {
                    "nameSpace": "Location",
                    "attributes": {
                        "type": "floor",
                        "rfModel": "Cubes And Walled Offices",
                    },
                }
            ],
        },
        {
            "id": "b1e2f3a4-5678-9abc-def0-b1e2f3a4c5d6",
            "name": "Floor 2",
            "parentId": "f9c0d1e2-3456-789a-bcde-f9c0d1e2a3b4",
            "additionalInfo": [
                {
                    "nameSpace": "Location",
                    "attributes": {
                        "type": "floor",
                        "rfModel": "Cubes And Walled Offices",
                    },
                }
            ],
        },
    ]
}

HOSTS = {
    "response": [
        {
            "id": "aabbccdd-1111-2222-3333-aabbccddee01",
            "hostType": "WIRED",
            "hostIp": "10.10.20.100",
            "hostMac": "aa:bb:cc:dd:ee:01",
            "hostName": "DESKTOP-LAB01",
            "connectedNetworkDeviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "connectedNetworkDeviceIpAddress": "10.10.20.51",
            "connectedInterfaceName": "GigabitEthernet1/0/5",
            "vlanId": "10",
            "subType": "UNKNOWN",
            "lastUpdated": "2026-02-26 10:05:00",
            "healthScore": [{"healthType": "OVERALL", "reason": "", "score": 10}],
        },
        {
            "id": "aabbccdd-1111-2222-3333-aabbccddee02",
            "hostType": "WIRELESS",
            "hostIp": "10.10.20.101",
            "hostMac": "aa:bb:cc:dd:ee:02",
            "hostName": "iPhone-DevNet",
            "connectedNetworkDeviceId": "b2c3d4e5-6789-abcd-ef01-b2c3d4e5f6a7",
            "connectedNetworkDeviceIpAddress": "10.10.20.60",
            "connectedInterfaceName": "WLC-VLAN20",
            "vlanId": "20",
            "subType": "Apple-iPhone",
            "lastUpdated": "2026-02-26 10:03:00",
            "healthScore": [{"healthType": "OVERALL", "reason": "", "score": 8}],
            "ssid": "StudyLab-Corp",
            "frequency": "5.0",
        },
        {
            "id": "aabbccdd-1111-2222-3333-aabbccddee03",
            "hostType": "WIRED",
            "hostIp": "10.10.20.150",
            "hostMac": "aa:bb:cc:dd:ee:03",
            "hostName": "PRINTER-FL1",
            "connectedNetworkDeviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "connectedNetworkDeviceIpAddress": "10.10.20.51",
            "connectedInterfaceName": "GigabitEthernet1/0/12",
            "vlanId": "30",
            "subType": "UNKNOWN",
            "lastUpdated": "2026-02-26 09:55:00",
            "healthScore": [{"healthType": "OVERALL", "reason": "", "score": 10}],
        },
    ]
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/dna/system/api/v1/auth/token")
async def authenticate(request: Request):
    """Authenticate and return a JWT-style token. Requires HTTP Basic auth."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(
            status_code=401,
            detail={
                "response": {
                    "errorCode": "UNAUTHORIZED",
                    "message": "Authorization header with Basic credentials required",
                }
            },
        )

    try:
        decoded = base64.b64decode(auth_header.split(" ", 1)[1]).decode()
        username, password = decoded.split(":", 1)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail={
                "response": {
                    "errorCode": "UNAUTHORIZED",
                    "message": "Invalid Basic auth encoding",
                }
            },
        )

    if VALID_CREDENTIALS.get(username) != password:
        raise HTTPException(
            status_code=401,
            detail={
                "response": {
                    "errorCode": "UNAUTHORIZED",
                    "message": "Invalid username or password",
                }
            },
        )

    return {
        "Token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.studylab-mock-catalyst-token"
    }


@router.get("/dna/intent/api/v1/network-device")
async def list_devices(
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
):
    _require_token(x_auth_token)
    return {"response": DEVICES, "version": "1.0"}


@router.get("/dna/intent/api/v1/network-device/{device_id}")
async def get_device(
    device_id: str,
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
):
    _require_token(x_auth_token)
    device = _DEVICES_BY_ID.get(device_id)
    if not device:
        raise HTTPException(
            status_code=404,
            detail={
                "response": {
                    "errorCode": "RESOURCE_NOT_FOUND",
                    "message": f"Device with id {device_id} not found",
                    "detail": "The requested resource was not found",
                }
            },
        )
    return {"response": device, "version": "1.0"}


@router.get("/dna/intent/api/v1/network-health")
async def network_health(
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    timestamp: Optional[str] = None,
):
    _require_token(x_auth_token)
    return {
        "response": [
            {
                "healthScore": 92,
                "totalCount": 5,
                "goodCount": 4,
                "fairCount": 1,
                "badCount": 0,
                "unmonCount": 0,
                "healthDistir498": None,
                "time": datetime.now(timezone.utc).isoformat(),
                "category": "ACCESS",
            },
        ],
        "healthDistributeDetails": {
            "totalCount": 5,
            "goodPercentage": 80,
            "badPercentage": 0,
            "fairPercentage": 20,
            "unmonPercentage": 0,
            "goodCount": 4,
            "badCount": 0,
            "fairCount": 1,
            "unmonCount": 0,
            "kpiMetrics": [
                {"key": "FLAVOR_FLAVOR_2", "value": "92"},
                {"key": "FLAVOR_FLAVOR_3", "value": "88"},
            ],
        },
        "version": "1.0",
    }


@router.get("/dna/intent/api/v1/site")
async def list_sites(
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
):
    _require_token(x_auth_token)
    return SITES


@router.get("/dna/intent/api/v1/host")
async def list_hosts(
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
):
    _require_token(x_auth_token)
    return HOSTS


# ---------------------------------------------------------------------------
# Standalone service entrypoint
# ---------------------------------------------------------------------------
# This must stay the LAST thing in the file: it snapshots the router, so a
# route declared below it would be served under /mock/* (main.py includes the
# router later) but be missing from the standalone service. tests/ asserts the
# two expose identical paths.
# `main.py` mounts `router` under /mock/catalyst; this `app` is what the
# `mock-catalyst` container serves on its own port.
app = make_standalone_app(
    router,
    title="Mock Cisco Catalyst Center API",
    description="Catalyst Center (DNA Center) Intent API simulator for DevNet study",
)
