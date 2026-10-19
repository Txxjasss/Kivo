import os
import aiosqlite
from typing import AsyncGenerator

DB_PATH = os.environ.get("KIVO_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "kivo.db"))

async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        yield db

async def init_db():
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        
        # Projects table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                client_name TEXT NOT NULL,
                client_email TEXT DEFAULT '',
                hourly_rate REAL NOT NULL DEFAULT 120.0,
                currency TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Scope Baselines table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scope_baselines (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                raw_brief TEXT NOT NULL,
                summary TEXT NOT NULL,
                total_estimated_hours REAL NOT NULL DEFAULT 0.0,
                total_baseline_price REAL NOT NULL DEFAULT 0.0,
                disclaimer TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        """)

        # Scope Items (requirements, assumptions, exclusions, clarifications)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scope_items (
                id TEXT PRIMARY KEY,
                scope_baseline_id TEXT NOT NULL,
                category TEXT NOT NULL, -- requirement, assumption, exclusion, clarification
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                complexity TEXT NOT NULL DEFAULT 'medium',
                estimated_hours_min REAL NOT NULL DEFAULT 0.0,
                estimated_hours_max REAL NOT NULL DEFAULT 0.0,
                suggested_hours REAL NOT NULL DEFAULT 0.0,
                order_index INTEGER NOT NULL DEFAULT 0,
                provenance TEXT NOT NULL DEFAULT 'explicit', -- explicit (client-stated) vs suggested (ai-inferred)
                FOREIGN KEY (scope_baseline_id) REFERENCES scope_baselines(id) ON DELETE CASCADE
            );
        """)

        # Migrate existing scope_items table if provenance column does not exist
        cursor = await db.execute("PRAGMA table_info(scope_items);")
        columns = [row["name"] for row in await cursor.fetchall()]
        if "provenance" not in columns:
            await db.execute("ALTER TABLE scope_items ADD COLUMN provenance TEXT NOT NULL DEFAULT 'explicit';")

        # Change Requests (scope creep proposals)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS change_requests (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                client_message TEXT NOT NULL,
                ai_analysis TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, approved, rejected, superseded
                calculated_hours REAL NOT NULL DEFAULT 0.0,
                calculated_cost REAL NOT NULL DEFAULT 0.0,
                hourly_rate_applied REAL NOT NULL DEFAULT 0.0,
                share_token TEXT UNIQUE NOT NULL,
                client_feedback TEXT DEFAULT '',
                client_action_at TEXT,
                disclaimer TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        """)

        # Change Request Items
        await db.execute("""
            CREATE TABLE IF NOT EXISTS change_items (
                id TEXT PRIMARY KEY,
                change_request_id TEXT NOT NULL,
                title TEXT NOT NULL,
                impact_type TEXT NOT NULL, -- new_feature, scope_expansion, out_of_scope
                reasoning TEXT NOT NULL,
                estimated_hours REAL NOT NULL DEFAULT 0.0,
                FOREIGN KEY (change_request_id) REFERENCES change_requests(id) ON DELETE CASCADE
            );
        """)

        await db.commit()
