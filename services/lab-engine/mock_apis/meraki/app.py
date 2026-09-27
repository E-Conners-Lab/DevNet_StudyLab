"""
Mock Meraki Dashboard API v1

Provides realistic endpoints matching the Meraki Dashboard API so students
can practice without needing a live Meraki environment.
"""

from fastapi import APIRouter, Header, HTTPException, Body
from typing import Optional
from datetime import datetime, timezone

from mock_apis.standalone import make_standalone_app

router = APIRouter()

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

VALID_API_KEYS = {
    "6bec40cf957de430a6f1f2baa056b99a4fac9ea0",
    "devnet-studylab-meraki-key",
}


def _require_api_key(api_key: Optional[str]) -> None:
    """Validate that the Meraki API key header is present."""
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail={
                "errors": ["Missing API key. Please include X-Cisco-Meraki-API-Key header."]
            },
        )


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

ORGANIZATIONS = [
    {
        "id": "549236",
        "name": "DevNet Sandbox",
        "url": "https://n18.meraki.com/o/549236/manage/organization/overview",
        "api": {"enabled": True},
        "licensing": {"model": "co-term"},
        "cloud": {"region": {"name": "North America"}},
    },
    {
        "id": "682154",
        "name": "StudyLab Corp",
        "url": "https://n18.meraki.com/o/682154/manage/organization/overview",
        "api": {"enabled": True},
        "licensing": {"model": "per-device"},
        "cloud": {"region": {"name": "North America"}},
    },
]

NETWORKS = {
    "549236": [
        {
            "id": "L_636248610738797898",
            "organizationId": "549236",
            "name": "DevNet Sandbox ALWAYS ON",
            "productTypes": ["appliance", "switch", "wireless"],
            "timeZone": "America/Los_Angeles",
            "tags": ["sandbox", "always-on"],
            "enrollmentString": None,
            "notes": "Always-on sandbox for DevNet learning",
            "isBoundToConfigTemplate": False,
        },
        {
            "id": "L_636248610738799012",
            "organizationId": "549236",
            "name": "Main Office",
            "productTypes": ["appliance", "switch", "wireless"],
            "timeZone": "America/New_York",
            "tags": ["production"],
            "enrollmentString": None,
            "notes": "Primary office network",
            "isBoundToConfigTemplate": False,
        },
        {
            "id": "L_636248610738800345",
            "organizationId": "549236",
            "name": "Branch - Chicago",
            "productTypes": ["appliance", "wireless"],
            "timeZone": "America/Chicago",
            "tags": ["branch"],
            "enrollmentString": None,
            "notes": "Chicago branch office",
            "isBoundToConfigTemplate": True,
        },
    ],
    "682154": [
        {
            "id": "L_783491027461003782",
            "organizationId": "682154",
            "name": "StudyLab HQ",
            "productTypes": ["appliance", "switch", "wireless"],
            "timeZone": "America/Denver",
            "tags": ["hq", "production"],
            "enrollmentString": None,
            "notes": "StudyLab headquarters network",
            "isBoundToConfigTemplate": False,
        },
        {
            "id": "L_783491027461005219",
            "organizationId": "682154",
            "name": "Lab Network",
            "productTypes": ["switch", "wireless"],
            "timeZone": "America/Denver",
            "tags": ["lab", "testing"],
            "enrollmentString": None,
            "notes": "Internal testing lab",
            "isBoundToConfigTemplate": False,
        },
        {
            "id": "L_783491027461006544",
            "organizationId": "682154",
            "name": "Remote Site - Austin",
            "productTypes": ["appliance", "wireless"],
            "timeZone": "America/Chicago",
            "tags": ["branch", "remote"],
            "enrollmentString": None,
            "notes": "Austin remote office",
            "isBoundToConfigTemplate": True,
        },
    ],
}

_ALL_NETWORKS = {n["id"]: n for nets in NETWORKS.values() for n in nets}

DEVICES = {
    "L_636248610738797898": [
        {
            "serial": "Q2QN-9J8L-SLPD",
            "name": "MX67-Sandbox-Appliance",
            "mac": "e0:55:3d:17:c4:22",
            "model": "MX67",
            "networkId": "L_636248610738797898",
            "firmware": "MX 18.107.2",
            "lanIp": "10.10.10.1",
            "tags": ["appliance", "sandbox"],
            "address": "500 Terry A Francine Blvd, San Francisco, CA 94158",
            "lat": 37.7697,
            "lng": -122.3933,
        },
        {
            "serial": "Q2HP-F5K5-R88R",
            "name": "MS225-Sandbox-Switch",
            "mac": "e0:55:3d:23:a1:09",
            "model": "MS225-24P",
            "networkId": "L_636248610738797898",
            "firmware": "MS 15.21.1",
            "lanIp": "10.10.10.2",
            "tags": ["switch", "sandbox"],
            "address": "500 Terry A Francine Blvd, San Francisco, CA 94158",
            "lat": 37.7697,
            "lng": -122.3933,
        },
        {
            "serial": "Q2MD-BHHS-5FDL",
            "name": "MR46-Sandbox-AP-01",
            "mac": "e0:55:3d:35:67:ab",
            "model": "MR46",
            "networkId": "L_636248610738797898",
            "firmware": "MR 30.5",
            "lanIp": "10.10.10.10",
            "tags": ["wireless", "sandbox", "floor-1"],
            "address": "500 Terry A Francine Blvd, San Francisco, CA 94158",
            "lat": 37.7697,
            "lng": -122.3933,
        },
        {
            "serial": "Q2MD-CJKP-7GHW",
            "name": "MR46-Sandbox-AP-02",
            "mac": "e0:55:3d:35:68:cd",
            "model": "MR46",
            "networkId": "L_636248610738797898",
            "firmware": "MR 30.5",
            "lanIp": "10.10.10.11",
            "tags": ["wireless", "sandbox", "floor-2"],
            "address": "500 Terry A Francine Blvd, San Francisco, CA 94158",
            "lat": 37.7697,
            "lng": -122.3933,
        },
    ],
    "L_636248610738799012": [
        {
            "serial": "Q2QN-4K2M-VNRT",
            "name": "MX68-MainOffice",
            "mac": "e0:55:3d:18:b5:33",
            "model": "MX68",
            "networkId": "L_636248610738799012",
            "firmware": "MX 18.107.2",
            "lanIp": "192.168.1.1",
            "tags": ["appliance", "production"],
            "address": "123 Main St, New York, NY 10001",
            "lat": 40.7128,
            "lng": -74.0060,
        },
        {
            "serial": "Q2HP-G6L7-T99S",
            "name": "MS225-MainOffice-Sw1",
            "mac": "e0:55:3d:24:b2:10",
            "model": "MS225-48LP",
            "networkId": "L_636248610738799012",
            "firmware": "MS 15.21.1",
            "lanIp": "192.168.1.2",
            "tags": ["switch", "production"],
            "address": "123 Main St, New York, NY 10001",
            "lat": 40.7128,
            "lng": -74.0060,
        },
        {
            "serial": "Q2MD-DLMN-8HJX",
            "name": "MR56-MainOffice-AP1",
            "mac": "e0:55:3d:36:78:bc",
            "model": "MR56",
            "networkId": "L_636248610738799012",
            "firmware": "MR 30.5",
            "lanIp": "192.168.1.20",
            "tags": ["wireless", "production"],
            "address": "123 Main St, New York, NY 10001",
            "lat": 40.7128,
            "lng": -74.0060,
        },
        {
            "serial": "Q2MD-EMOP-9JKY",
            "name": "MR46-MainOffice-AP2",
            "mac": "e0:55:3d:36:79:de",
            "model": "MR46",
            "networkId": "L_636248610738799012",
            "firmware": "MR 30.5",
            "lanIp": "192.168.1.21",
            "tags": ["wireless", "production"],
            "address": "123 Main St, New York, NY 10001",
            "lat": 40.7128,
            "lng": -74.0060,
        },
    ],
}

_ALL_DEVICES = {d["serial"]: d for devs in DEVICES.values() for d in devs}

CLIENTS = {
    "L_636248610738797898": [
        {
            "id": "k74272e",
            "mac": "22:33:44:55:66:01",
            "description": "Elliot-MacBook",
            "ip": "10.10.10.100",
            "vlan": 1,
            "switchport": "3",
            "status": "Online",
            "firstSeen": "2025-01-15T08:30:00Z",
            "lastSeen": "2026-02-27T14:22:00Z",
            "manufacturer": "Apple",
            "os": "macOS",
            "user": "elliot",
            "ssid": None,
        },
        {
            "id": "k74273f",
            "mac": "22:33:44:55:66:02",
            "description": "Lab-Server-01",
            "ip": "10.10.10.50",
            "vlan": 10,
            "switchport": "8",
            "status": "Online",
            "firstSeen": "2024-11-01T10:00:00Z",
            "lastSeen": "2026-02-27T14:20:00Z",
            "manufacturer": "Dell",
            "os": "Linux",
            "user": None,
            "ssid": None,
        },
        {
            "id": "k74274g",
            "mac": "22:33:44:55:66:03",
            "description": "iPhone-DevNet",
            "ip": "10.10.10.105",
            "vlan": 20,
            "switchport": None,
            "status": "Online",
            "firstSeen": "2025-06-20T12:00:00Z",
            "lastSeen": "2026-02-27T13:55:00Z",
            "manufacturer": "Apple",
            "os": "iOS",
            "user": "guest",
            "ssid": "Sandbox-WiFi",
        },
    ],
}

SWITCH_PORTS = {
    "Q2HP-F5K5-R88R": [
        {
            "portId": "1",
            "name": "Uplink to MX67",
            "tags": ["uplink"],
            "enabled": True,
            "poeEnabled": False,
            "type": "trunk",
            "vlan": 1,
            "allowedVlans": "all",
            "isolationEnabled": False,
            "rstpEnabled": True,
            "stpGuard": "disabled",
            "linkNegotiation": "Auto negotiate",
            "portScheduleId": None,
            "udld": "Alert only",
            "accessPolicyType": "Open",
        },
        {
            "portId": "2",
            "name": "Server VLAN 10",
            "tags": ["server"],
            "enabled": True,
            "poeEnabled": False,
            "type": "access",
            "vlan": 10,
            "allowedVlans": "10",
            "isolationEnabled": False,
            "rstpEnabled": True,
            "stpGuard": "disabled",
            "linkNegotiation": "Auto negotiate",
            "portScheduleId": None,
            "udld": "Alert only",
            "accessPolicyType": "Open",
        },
        {
            "portId": "3",
            "name": "Workstation Port",
            "tags": ["workstation"],
            "enabled": True,
            "poeEnabled": True,
            "type": "access",
            "vlan": 1,
            "allowedVlans": "1",
            "isolationEnabled": False,
            "rstpEnabled": True,
            "stpGuard": "disabled",
            "linkNegotiation": "Auto negotiate",
            "portScheduleId": None,
            "udld": "Alert only",
            "accessPolicyType": "Open",
        },
        {
            "portId": "4",
            "name": "AP Port",
            "tags": ["wireless"],
            "enabled": True,
            "poeEnabled": True,
            "type": "trunk",
            "vlan": 1,
            "allowedVlans": "1,20",
            "isolationEnabled": False,
            "rstpEnabled": True,
            "stpGuard": "disabled",
            "linkNegotiation": "Auto negotiate",
            "portScheduleId": None,
            "udld": "Alert only",
            "accessPolicyType": "Open",
        },
    ],
}

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/api/v1/organizations")
async def list_organizations(
    x_cisco_meraki_api_key: Optional[str] = Header(None, alias="X-Cisco-Meraki-API-Key"),
):
    _require_api_key(x_cisco_meraki_api_key)
    return ORGANIZATIONS


@router.get("/api/v1/organizations/{org_id}/networks")
async def list_networks(
    org_id: str,
    x_cisco_meraki_api_key: Optional[str] = Header(None, alias="X-Cisco-Meraki-API-Key"),
):
    _require_api_key(x_cisco_meraki_api_key)
    networks = NETWORKS.get(org_id)
    if networks is None:
        raise HTTPException(status_code=404, detail={"errors": ["Organization not found"]})
    return networks


@router.get("/api/v1/networks/{network_id}/devices")
async def list_devices(
    network_id: str,
    x_cisco_meraki_api_key: Optional[str] = Header(None, alias="X-Cisco-Meraki-API-Key"),
):
    _require_api_key(x_cisco_meraki_api_key)
    if network_id not in _ALL_NETWORKS:
        raise HTTPException(status_code=404, detail={"errors": ["Network not found"]})
    return DEVICES.get(network_id, [])


@router.get("/api/v1/networks/{network_id}/clients")
async def list_clients(
    network_id: str,
    x_cisco_meraki_api_key: Optional[str] = Header(None, alias="X-Cisco-Meraki-API-Key"),
    timespan: int = 86400,
    perPage: int = 10,
):
    _require_api_key(x_cisco_meraki_api_key)
    if network_id not in _ALL_NETWORKS:
        raise HTTPException(status_code=404, detail={"errors": ["Network not found"]})
    return CLIENTS.get(network_id, [])


@router.get("/api/v1/devices/{serial}/switchPorts")
async def list_switch_ports(
    serial: str,
    x_cisco_meraki_api_key: Optional[str] = Header(None, alias="X-Cisco-Meraki-API-Key"),
):
    _require_api_key(x_cisco_meraki_api_key)
    if serial not in _ALL_DEVICES:
        raise HTTPException(status_code=404, detail={"errors": ["Device not found"]})
    device = _ALL_DEVICES[serial]
    if "MS" not in device["model"]:
        raise HTTPException(
            status_code=400,
            detail={"errors": ["This endpoint is only available for switch devices"]},
        )
    return SWITCH_PORTS.get(serial, [])


@router.put("/api/v1/devices/{serial}")
async def update_device(
    serial: str,
    body: dict = Body(...),
    x_cisco_meraki_api_key: Optional[str] = Header(None, alias="X-Cisco-Meraki-API-Key"),
):
    _require_api_key(x_cisco_meraki_api_key)
    if serial not in _ALL_DEVICES:
        raise HTTPException(status_code=404, detail={"errors": ["Device not found"]})

    device = _ALL_DEVICES[serial]

    # Allow updating name and tags
    if "name" in body:
        device["name"] = body["name"]
    if "tags" in body:
        device["tags"] = body["tags"]
    if "address" in body:
        device["address"] = body["address"]
    if "notes" in body:
        device["notes"] = body.get("notes", "")

    return device


# ---------------------------------------------------------------------------
# Standalone service entrypoint
# ---------------------------------------------------------------------------
# This must stay the LAST thing in the file: it snapshots the router, so a
# route declared below it would be served under /mock/* (main.py includes the
# router later) but be missing from the standalone service. tests/ asserts the
# two expose identical paths.
# `main.py` mounts `router` under /mock/meraki; this `app` is what the
# `mock-meraki` container serves on its own port.
app = make_standalone_app(
    router,
    title="Mock Meraki Dashboard API",
    description="Meraki Dashboard API v1 simulator for DevNet certification study",
)
