import pytest
import os
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ollama" in data
    assert data["service"] == "kivo-backend"

def test_extract_scope_empty_fails(client):
    response = client.post("/api/scope/extract", json={"brief_text": "   ", "hourly_rate": 100})
    assert response.status_code == 400
    assert "cannot be empty" in response.json()["detail"]

def test_extract_scope_valid(client):
    brief = "Build an MVP web app with OAuth login, stripe billing checkout, and user profile management."
    response = client.post("/api/scope/extract", json={"brief_text": brief, "hourly_rate": 125.0})
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "requirements" in data
    assert len(data["requirements"]) > 0
    assert data["total_suggested_hours"] > 0
    assert data["suggested_price"] > 0
    assert "disclaimer" in data
    assert "Non-binding estimate" in data["disclaimer"]

def test_projects_crud(client):
    # 1. Create project
    create_payload = {
        "name": "Acme SaaS Portal",
        "client_name": "Acme Corp",
        "client_email": "hello@acme.com",
        "hourly_rate": 130.0,
        "currency": "USD"
    }
    create_resp = client.post("/api/projects", json=create_payload)
    assert create_resp.status_code == 200
    project = create_resp.json()
    project_id = project["id"]
    assert project["name"] == "Acme SaaS Portal"
    assert project["hourly_rate"] == 130.0

    # 2. List projects
    list_resp = client.get("/api/projects")
    assert list_resp.status_code == 200
    projects_list = list_resp.json()
    assert any(p["id"] == project_id for p in projects_list)

    # 3. Save baseline scope
    baseline_payload = {
        "project_id": project_id,
        "raw_brief": "Core dashboard and auth",
        "summary": "Core baseline scope",
        "hourly_rate": 130.0,
        "items": [
            {
                "category": "requirement",
                "title": "Auth Setup",
                "description": "Supabase or OAuth integration",
                "complexity": "medium",
                "estimated_hours_min": 6.0,
                "estimated_hours_max": 10.0,
                "suggested_hours": 8.0,
                "order_index": 0
            },
            {
                "category": "assumption",
                "title": "Client keys ready",
                "description": "Client provides OAuth client secret",
                "complexity": "low",
                "estimated_hours_min": 0,
                "estimated_hours_max": 0,
                "suggested_hours": 0,
                "order_index": 1
            }
        ]
    }
    base_resp = client.post(f"/api/projects/{project_id}/baseline", json=baseline_payload)
    assert base_resp.status_code == 200
    assert base_resp.json()["status"] == "success"

    # 4. Fetch project details
    detail_resp = client.get(f"/api/projects/{project_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["project"]["id"] == project_id
    assert detail["baseline"]["total_estimated_hours"] == 8.0
    assert detail["baseline"]["total_baseline_price"] == 1040.0 # 8 * 130.0
    assert len(detail["items"]) == 2
