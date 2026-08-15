"""db.py — Persistente Mandanten- & Instanzen-Verwaltung für die Control Plane."""

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "control_plane.db"


def get_db_connection() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS instances (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,          -- 'gcp_vm' | 'docker_stack'
                status TEXT NOT NULL,        -- 'provisioning' | 'running' | 'stopped' | 'error'
                endpoint_url TEXT NOT NULL,  -- z.B. http://34.123.45.67:8090 oder http://localhost:8190
                backend_url TEXT NOT NULL,   -- z.B. http://34.123.45.67:8091
                zone TEXT DEFAULT '',
                machine_type TEXT DEFAULT '',
                plan TEXT DEFAULT 'sovereign', -- 'sovereign' | 'managed' | 'enterprise'
                git_repo TEXT NOT NULL,
                git_branch TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                metadata_json TEXT DEFAULT '{}'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS instance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                level TEXT DEFAULT 'INFO',
                message TEXT NOT NULL,
                FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
            )
            """
        )
    conn.close()


def create_instance(
    instance_id: str,
    tenant_id: str,
    name: str,
    instance_type: str,
    endpoint_url: str,
    backend_url: str = "",
    zone: str = "",
    machine_type: str = "",
    plan: str = "sovereign",
    git_repo: str = "https://github.com/NextChapterExperts/virgi-platform-dist.git",
    git_branch: str = "main",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    now = time.time()
    conn = get_db_connection()
    with conn:
        conn.execute(
            """
            INSERT INTO instances (
                id, tenant_id, name, type, status, endpoint_url, backend_url,
                zone, machine_type, plan, git_repo, git_branch, created_at, updated_at, metadata_json
            ) VALUES (?, ?, ?, ?, 'provisioning', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                instance_id,
                tenant_id,
                name,
                instance_type,
                endpoint_url,
                backend_url,
                zone,
                machine_type,
                plan,
                git_repo,
                git_branch,
                now,
                now,
                json.dumps(metadata or {}),
            ),
        )
    conn.close()
    return get_instance(instance_id) or {}


def update_instance_status(
    instance_id: str, status: str, endpoint_url: Optional[str] = None, backend_url: Optional[str] = None
) -> None:
    now = time.time()
    conn = get_db_connection()
    with conn:
        if endpoint_url and backend_url:
            conn.execute(
                "UPDATE instances SET status = ?, endpoint_url = ?, backend_url = ?, updated_at = ? WHERE id = ?",
                (status, endpoint_url, backend_url, now, instance_id),
            )
        elif endpoint_url:
            conn.execute(
                "UPDATE instances SET status = ?, endpoint_url = ?, updated_at = ? WHERE id = ?",
                (status, endpoint_url, now, instance_id),
            )
        else:
            conn.execute(
                "UPDATE instances SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, instance_id),
            )
    conn.close()


def get_instance(instance_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM instances WHERE id = ?", (instance_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    res["metadata"] = json.loads(res.get("metadata_json") or "{}")
    return res


def list_instances() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM instances ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    res = []
    for r in rows:
        item = dict(r)
        item["metadata"] = json.loads(item.get("metadata_json") or "{}")
        res.append(item)
    return res


def delete_instance(instance_id: str) -> bool:
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM instance_logs WHERE instance_id = ?", (instance_id,))
        cur = conn.execute("DELETE FROM instances WHERE id = ?", (instance_id,))
        deleted = cur.rowcount > 0
    conn.close()
    return deleted


def append_log(instance_id: str, message: str, level: str = "INFO") -> None:
    conn = get_db_connection()
    with conn:
        conn.execute(
            "INSERT INTO instance_logs (instance_id, timestamp, level, message) VALUES (?, ?, ?, ?)",
            (instance_id, time.time(), level, message),
        )
    conn.close()


def get_logs(instance_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM instance_logs WHERE instance_id = ? ORDER BY id ASC LIMIT ?",
        (instance_id, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]
