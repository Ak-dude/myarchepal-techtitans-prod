"""
Firebase Admin SDK — shared singleton instance.

Reads FIREBASE_SERVICE_ACCOUNT_JSON from the environment (full JSON string,
never a file path — Vercel filesystem is ephemeral).

Used by export.py and notify.py.
"""

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger("archepal.services.fb_admin")

# api/.env for backend secrets, then project root .env for shared vars
_here = Path(__file__).resolve()
load_dotenv(_here.parents[1] / ".env")   # api/.env
load_dotenv(_here.parents[2] / ".env")   # project root .env (won't override already-set vars)

import firebase_admin  # noqa: E402
from firebase_admin import auth as fb_auth, credentials  # noqa: E402
from firebase_admin import firestore as fb_firestore  # noqa: E402

_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. "
            "Add the full service-account JSON as a single-line string in your "
            "api/.env file (local) or Vercel Environment Variables (production)."
        )

    cred_dict = json.loads(sa_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(
        cred,
        {"storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "")},
    )
    _initialized = True
    logger.info("Firebase Admin SDK initialized (project: %s)", cred_dict.get("project_id", "unknown"))


def get_db():
    """Return a Firestore Admin client."""
    _ensure_initialized()
    return fb_firestore.client()


def verify_id_token(token: str) -> dict:
    """
    Verify a Firebase ID token.
    Returns the decoded token claims dict (includes 'uid').
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    _ensure_initialized()
    return fb_auth.verify_id_token(token)
