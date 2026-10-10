import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, role):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", json={"role": role}, timeout=15)
    assert r.status_code == 200, f"demo-login {role} failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def teacher(api):
    return _login(api, "Teacher")


@pytest.fixture(scope="session")
def coordinator(api):
    return _login(api, "Coordinator")


@pytest.fixture(scope="session")
def administrator(api):
    return _login(api, "Administrator")


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture
def teacher_h(teacher):
    return _hdr(teacher["token"])


@pytest.fixture
def coord_h(coordinator):
    return _hdr(coordinator["token"])


@pytest.fixture
def admin_h(administrator):
    return _hdr(administrator["token"])
