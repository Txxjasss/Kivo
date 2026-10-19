from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, get_db
from app.routes import projects, scope, changes
from app.services.ollama_client import check_ollama_status
import uuid
from datetime import datetime

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    await init_db()
    
    # Auto-seed sample demo projects if database is empty
    async for db in get_db():
        cursor = await db.execute("SELECT COUNT(*) as count FROM projects")
        row = await cursor.fetchone()
        if row and row["count"] == 0:
            now = datetime.utcnow().isoformat()
            demo_project_id = str(uuid.uuid4())
            await db.execute("""
                INSERT INTO projects (id, name, client_name, client_email, hourly_rate, currency, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """, (
                demo_project_id,
                "Fintech Mobile App MVP",
                "Apex Financial Labs",
                "sarah@apexfinance.io",
                140.0,
                "USD",
                now,
                now
            ))

            baseline_id = str(uuid.uuid4())
            await db.execute("""
                INSERT INTO scope_baselines (id, project_id, raw_brief, summary, total_estimated_hours, total_baseline_price, disclaimer, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                baseline_id,
                demo_project_id,
                "Build a modern iOS/Android fintech mobile MVP with biometric auth, Plaid banking connectivity, transaction list with spending charts, and dark mode UI.",
                "Production-ready mobile banking MVP covering onboarding, Plaid Link, biometric security, and responsive transaction dashboard.",
                68.0,
                9520.0,
                "Non-binding estimate only. Not a legally binding contract or guaranteed delivery timeline.",
                now
            ))

            sample_items = [
                ("requirement", "Biometric Authentication & JWT Session Flow", "FaceID/TouchID native fallback with encrypted keychain refresh token storage.", "medium", 10.0, 16.0, 12.0, 0),
                ("requirement", "Plaid Link & Bank Account Aggregation", "Integration with Plaid sandbox/production to link checking and savings accounts.", "high", 16.0, 24.0, 20.0, 1),
                ("requirement", "Transaction History & Category Breakdown", "Paginated virtualized list with monthly breakdown charts and search filter.", "medium", 12.0, 18.0, 16.0, 2),
                ("requirement", "Push Notification Architecture", "Firebase Cloud Messaging setup for balance alerts and security notifications.", "low", 6.0, 10.0, 8.0, 3),
                ("requirement", "Offline Cache & Sync Engine", "SQLite/WatermelonDB local cache with background sync upon reconnect.", "high", 10.0, 16.0, 12.0, 4),
                ("assumption", "API Endpoint Readiness", "Client provides documented staging REST/GraphQL APIs with Swagger definitions.", "low", 0, 0, 0, 5),
                ("assumption", "Plaid Developer Subscription", "Client maintains active Plaid developer plan and pays API fees directly.", "low", 0, 0, 0, 6),
                ("exclusion", "Financial Advisory Algorithms", "No automated investment rebalancing or robo-advising calculations included.", "low", 0, 0, 0, 7),
                ("exclusion", "KYC Document Verification", "Integration with Persona/Jumio for passport photo scanning is excluded from MVP.", "low", 0, 0, 0, 8),
                ("clarification", "Does the backend already handle automated ACH transfer scheduling?", "Required to determine if in-app fund transfers should be scoped.", "medium", 0, 0, 0, 9)
            ]

            for cat, title, desc, comp, mi, ma, su, idx in sample_items:
                it_id = str(uuid.uuid4())
                await db.execute("""
                    INSERT INTO scope_items (id, scope_baseline_id, category, title, description, complexity, estimated_hours_min, estimated_hours_max, suggested_hours, order_index)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (it_id, baseline_id, cat, title, desc, comp, mi, ma, su, idx))

            await db.commit()
        break
    yield

app = FastAPI(
    title="Kivo Scope Engine API",
    description="Local-first AI-powered scope & change management for senior freelancers",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(scope.router)
app.include_router(changes.router)

@app.get("/api/health")
async def health_check():
    ollama_health = await check_ollama_status()
    return {
        "status": "healthy",
        "service": "kivo-backend",
        "timestamp": datetime.utcnow().isoformat(),
        "ollama": ollama_health
    }
