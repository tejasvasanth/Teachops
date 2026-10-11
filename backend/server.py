"""TeachOps API — teacher management & operations.

Single-file FastAPI + MongoDB (Motor) backend. JWT email/password auth,
role-scoped data (administrator / coordinator / teacher), and an idempotent,
clearly-labelled demo seed so every screen reads from one connected dataset.
"""
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone, date

import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("teachops")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "teachops-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_EXPIRE_DAYS = 14
DEMO_MODE = os.environ.get("DEMO_MODE", "true").lower() == "true"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TeachOps API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

IST = timezone(timedelta(hours=5, minutes=30))


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "org": user.get("organisation_id"),
        "exp": now_utc() + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    err = HTTPException(status_code=401, detail="Invalid or expired session")
    if cred is None:
        raise err
    try:
        data = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise err
    user = await db.users.find_one({"id": data.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise err
    return user


def require(*roles):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user
    return dep


def initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def fmt_long_date(dt: datetime) -> str:
    # %-d is glibc-only and raises ValueError on Windows.
    return f"{dt.strftime('%A')}, {dt.day} {dt.strftime('%B')}"


def fmt_short_date(d: date) -> str:
    return f"{d.day} {d.strftime('%b')}"


def leave_span(days: list[date]) -> str:
    ordered = sorted(set(days))
    if not ordered:
        return ""
    ranges: list[tuple[date, date]] = []
    start = prev = ordered[0]
    for day in ordered[1:]:
        if day == prev + timedelta(days=1):
            prev = day
            continue
        ranges.append((start, prev))
        start = prev = day
    ranges.append((start, prev))
    parts = []
    for first, last in ranges:
        if first == last:
            parts.append(fmt_short_date(first))
        else:
            parts.append(f"{fmt_short_date(first)} to {fmt_short_date(last)}")
    label = ", ".join(parts)
    if len(ordered) > 1 and len(label) > 48:
        return f"{len(ordered)} days, {fmt_short_date(ordered[0])} to {fmt_short_date(ordered[-1])}"
    return label


def greeting_for(now: datetime, first_name: str) -> str:
    hour = now.hour
    if hour < 12:
        hello = "Good morning"
    elif hour < 17:
        hello = "Good afternoon"
    else:
        hello = "Good evening"
    return f"{hello}, {first_name}"


# --------------------------------------------------------------------------- #
# models
# --------------------------------------------------------------------------- #
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DemoLoginIn(BaseModel):
    role: str  # Teacher | Coordinator | Administrator


class AttendanceMark(BaseModel):
    student_id: str
    code: str  # P | A | L | E


class SaveAttendanceIn(BaseModel):
    marks: list[AttendanceMark] = []
    notes: str | None = None


class LeaveRequestIn(BaseModel):
    leave_type: str
    start_date: str | None = None
    end_date: str | None = None
    dates: list[str] | None = None
    reason: str


class LessonPlanIn(BaseModel):
    objective: str = ""
    activities: str = ""
    materials: str = ""
    homework: str = ""


class ExpenseIn(BaseModel):
    travel_date: str
    origin: str
    destination: str
    amount: int
    purpose: str


class DecisionIn(BaseModel):
    decision: str  # Approved | Rejected | Changes Requested
    reason: str | None = None


class MessageIn(BaseModel):
    text: str


class ComposeIn(BaseModel):
    to: str
    subject: str
    text: str
    official: bool = True


# --------------------------------------------------------------------------- #
# auth routes
# --------------------------------------------------------------------------- #
@api.get("/")
async def root():
    return {"app": "TeachOps", "demo_mode": DEMO_MODE}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": make_token(user), "user": _public_user(user)}


DEMO_ROLE_EMAIL = {
    "Teacher": "anjali@teachops.demo",
    "Coordinator": "suresh@teachops.demo",
    "Administrator": "meenakshi@teachops.demo",
}


@api.post("/auth/demo-login")
async def demo_login(body: DemoLoginIn):
    if not DEMO_MODE:
        raise HTTPException(status_code=403, detail="Demo login is disabled in production")
    email = DEMO_ROLE_EMAIL.get(body.role)
    if not email:
        raise HTTPException(status_code=400, detail="Unknown demo role")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not seeded")
    return {"token": make_token(user), "user": _public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return _public_user(user)


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "role_label": user.get("role_label", user["role"].title()),
        "centre": user.get("centre_name"),
        "organisation": user.get("organisation_name"),
        "organisation_id": user.get("organisation_id"),
        "initials": initials(user["name"]),
    }


# --------------------------------------------------------------------------- #
# My Day
# --------------------------------------------------------------------------- #
def _session_card(s: dict) -> dict:
    return {
        "id": s["id"],
        "title": s["title"],
        "start": s["start"],
        "end": s["end"],
        "where": f"{s['batch_code']} · {s['centre_name']} · {s['room']}",
        "centre_name": s["centre_name"],
        "status": s["status"],
        "status_kind": s["status_kind"],
        "note": s.get("note"),
        "date": s["date"],
    }


def _today_str() -> str:
    return datetime.now(IST).date().isoformat()


async def _week_dates() -> list[str]:
    today = datetime.now(IST).date()
    monday = today - timedelta(days=today.weekday())
    return [(monday + timedelta(days=i)).isoformat() for i in range(6)]


@api.get("/my-day")
async def my_day(user: dict = Depends(get_current_user)):
    today = _today_str()
    role = user["role"]
    now_hm = datetime.now(IST).strftime("%H:%M")

    if role == "teacher":
        cur = db.sessions.find(
            {"organisation_id": user["organisation_id"], "teacher_id": user["id"], "date": today},
            {"_id": 0},
        ).sort("start", 1)
        sessions = [s async for s in cur]
        timeline = [_session_card(s) for s in sessions]
        upcoming = [s for s in sessions if s["end"] > now_hm and s["status_kind"] != "bad"]
        next_card = _session_card(upcoming[0]) if upcoming else (timeline[0] if timeline else None)

        bal = await db.leave_balances.find_one({"teacher_id": user["id"]}, {"_id": 0})
        payslip = await db.payslips.find_one(
            {"teacher_id": user["id"], "status": "Paid"}, {"_id": 0}, sort=[("period_order", -1)]
        )
        pending = []
        rec = await db.sessions.find_one(
            {"teacher_id": user["id"], "record_status": "Attendance submitted"}, {"_id": 0}
        )
        if rec:
            pending.append({
                "title": f"Session note for {rec['title']}",
                "sub": "Attendance submitted",
                "tag": "Due today",
                "kind": "warn",
                "session_id": rec["id"],
            })
        follow = await db.students.find_one({"follow_up": True, "organisation_id": user["organisation_id"]}, {"_id": 0})
        if follow:
            enr = await db.enrolments.find_one({"student_id": follow["id"], "organisation_id": user["organisation_id"]}, {"_id": 0})
            follow_session = None
            if enr:
                follow_session = await db.sessions.find_one(
                    {"batch_id": enr["batch_id"], "teacher_id": user["id"], "date": today},
                    {"_id": 0, "id": 1},
                )
            pending.append({
                "title": f"Follow up with {follow['guardian_name']}",
                "sub": f"{follow['name']} · absent twice this week",
                "tag": "Open",
                "kind": "n",
                "session_id": follow_session["id"] if follow_session else None,
            })

        classes = []
        async for b in db.batches.find(
            {"organisation_id": user["organisation_id"], "class_teacher_id": user["id"]},
            {"_id": 0, "id": 1, "code": 1, "programme": 1, "centre_name": 1},
        ):
            students = await db.enrolments.count_documents({"batch_id": b["id"]})
            classes.append({
                "id": b["id"],
                "code": b["code"],
                "programme": b["programme"],
                "centre": b["centre_name"],
                "students": students,
            })

        return {
            "role": "teacher",
            "greeting": greeting_for(datetime.now(IST), user["name"].split()[0]),
            "date_label": fmt_long_date(datetime.now(IST)),
            "next": next_card,
            "timeline": timeline,
            "pending": pending,
            "leave": bal,
            "pay": payslip,
            "classes": classes,
        }

    org = user["organisation_id"]
    is_coord = role == "coordinator"
    centre_filter = {"centre_id": user.get("centre_id")} if is_coord else {}
    base = {"organisation_id": org, **centre_filter}

    week = await _week_dates()
    week_q = {**base, "date": {"$in": week}}
    scheduled = await db.sessions.count_documents(week_q)
    conducted = await db.sessions.count_documents({**week_q, "status_kind": "ok"})
    unassigned = await db.sessions.count_documents({**week_q, "teacher_id": None})
    missing = await db.sessions.count_documents({**week_q, "record_status": {"$in": ["Attendance submitted", "Not started"]}})
    pending_approvals = await db.approval_requests.count_documents(_inbox_query(user))
    subs = await db.approval_requests.count_documents({**base, "kind": "Substitution", "status": "Pending"})

    today_cur = db.sessions.find({**base, "date": today}, {"_id": 0}).sort("start", 1)
    today_sessions = [_session_card(s) async for s in today_cur]

    metrics = [
        {"key": "scheduled", "label": "Classes conducted vs scheduled", "value": f"{conducted} / {scheduled}", "sub": "This week", "filter": "schedule"},
        {"key": "approvals", "label": "Pending approvals", "value": pending_approvals, "sub": "Leave, plans, corrections", "filter": "inbox"},
        {"key": "unassigned", "label": "Sessions without a teacher", "value": unassigned, "sub": "This week", "filter": "schedule"},
        {"key": "missing", "label": "Missing attendance or records", "value": missing, "sub": "This week", "filter": "schedule"},
        {"key": "subs", "label": "Substitution requests", "value": subs, "sub": "Open", "filter": "inbox"},
    ]
    return {
        "role": role,
        "greeting": user.get("centre_name") if is_coord else user.get("organisation_name"),
        "date_label": fmt_long_date(datetime.now(IST)),
        "metrics": metrics,
        "timeline": today_sessions,
    }


# --------------------------------------------------------------------------- #
# Schedule
# --------------------------------------------------------------------------- #
@api.get("/schedule")
async def schedule(user: dict = Depends(get_current_user)):
    week = await _week_dates()
    q = {"organisation_id": user["organisation_id"], "date": {"$in": week}}
    if user["role"] == "teacher":
        q["teacher_id"] = user["id"]
    elif user["role"] == "coordinator" and user.get("centre_id"):
        q["centre_id"] = user["centre_id"]
    cur = db.sessions.find(q, {"_id": 0}).sort([("date", 1), ("start", 1)])
    days: dict[str, list] = {d: [] for d in week}
    conflicts = []
    async for s in cur:
        days[s["date"]].append(_session_card(s))
        if s["status_kind"] == "warn" and s.get("conflict"):
            conflicts.append({"date": s["date"], "title": s["title"], "detail": s.get("note")})
    labels = []
    for d in week:
        dt = date.fromisoformat(d)
        labels.append({"date": d, "dow": dt.strftime("%a"), "dom": dt.day})
    return {"week": labels, "days": days, "today": _today_str(), "conflicts": conflicts}


# --------------------------------------------------------------------------- #
# Session / attendance workspace
# --------------------------------------------------------------------------- #
async def _visible_session(sid: str, user: dict) -> tuple[dict, bool]:
    s = await db.sessions.find_one({"id": sid, "organisation_id": user["organisation_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    batch = await db.batches.find_one({"id": s["batch_id"]}, {"_id": 0, "class_teacher_id": 1})
    teaches = s.get("teacher_id") == user["id"]
    class_teacher = bool(batch and batch.get("class_teacher_id") == user["id"])
    if user["role"] == "teacher" and not teaches and not class_teacher:
        raise HTTPException(status_code=403, detail="Not your session")
    return s, user["role"] != "teacher" or teaches


def _blank_plan() -> dict:
    return {"objective": "", "activities": "", "materials": "", "homework": "", "status": "Draft", "review_note": ""}


@api.get("/sessions/{sid}")
async def get_session(sid: str, user: dict = Depends(get_current_user)):
    s, editable = await _visible_session(sid, user)
    enrolled = db.enrolments.find({"batch_id": s["batch_id"]}, {"_id": 0})
    roster = []
    async for e in enrolled:
        st = await db.students.find_one({"id": e["student_id"]}, {"_id": 0})
        if st:
            roster.append(st)
    roster.sort(key=lambda x: x["name"])
    att = await db.student_attendance.find_one({"session_id": sid}, {"_id": 0}) or {"marks": {}, "notes": ""}
    return {
        "session": _session_card(s),
        "record_status": s.get("record_status", "Not started"),
        "roster": [{"id": r["id"], "name": r["name"], "initials": initials(r["name"])} for r in roster],
        "marks": att.get("marks", {}),
        "notes": att.get("notes", ""),
        "history": s.get("history", []),
        "editable": editable,
    }


@api.get("/sessions/{sid}/lesson")
async def get_lesson(sid: str, user: dict = Depends(get_current_user)):
    s, editable = await _visible_session(sid, user)
    plan = await db.lesson_plans.find_one({"session_id": sid}, {"_id": 0}) or _blank_plan()
    return {"session": _session_card(s), "plan": plan, "editable": editable and plan.get("status") in ("Draft", "Changes requested")}


@api.put("/sessions/{sid}/lesson")
async def save_lesson(sid: str, body: LessonPlanIn, user: dict = Depends(get_current_user)):
    s, editable = await _visible_session(sid, user)
    if not editable:
        raise HTTPException(status_code=403, detail="Only the session teacher can edit this plan")
    existing = await db.lesson_plans.find_one({"session_id": sid}, {"_id": 0})
    if existing and existing.get("status") in ("Submitted", "Approved"):
        raise HTTPException(status_code=409, detail="This plan is locked until a coordinator asks for changes")
    status = existing.get("status") if existing else "Draft"
    if status not in ("Draft", "Changes requested"):
        status = "Draft"
    doc = {
        "id": existing["id"] if existing else new_id(),
        "organisation_id": user["organisation_id"],
        "session_id": sid,
        "teacher_id": s.get("teacher_id") or user["id"],
        "title": s.get("title"),
        "objective": body.objective.strip(),
        "activities": body.activities.strip(),
        "materials": body.materials.strip(),
        "homework": body.homework.strip(),
        "status": status,
        "review_note": existing.get("review_note", "") if existing else "",
        "updated_at": now_utc().isoformat(),
    }
    await db.lesson_plans.update_one({"session_id": sid}, {"$set": doc}, upsert=True)
    return {"plan": doc, "editable": True}


@api.post("/sessions/{sid}/lesson/submit")
async def submit_lesson(sid: str, user: dict = Depends(get_current_user)):
    s, editable = await _visible_session(sid, user)
    if not editable:
        raise HTTPException(status_code=403, detail="Only the session teacher can submit this plan")
    plan = await db.lesson_plans.find_one({"session_id": sid}, {"_id": 0})
    if not plan or not plan.get("objective") or not plan.get("activities"):
        raise HTTPException(status_code=400, detail="Add an objective and the activities before submitting")
    if plan.get("status") in ("Submitted", "Approved"):
        raise HTTPException(status_code=409, detail="This plan is already with your coordinator")
    reviewer = await _reviewer_for(user)
    when = fmt_short_date(date.fromisoformat(s["date"])) if s.get("date") else ""
    doc = {
        "id": new_id(),
        "organisation_id": user["organisation_id"],
        "centre_id": s.get("centre_id") or user.get("centre_id"),
        "kind": "Lesson plan",
        "title": f"Lesson plan: {s.get('title')}",
        "detail": f"{when} · {plan['objective'][:180]}",
        "requester_id": user["id"],
        "requester_name": user["name"],
        "requester_initials": initials(user["name"]),
        "reviewer_name": reviewer["name"] if reviewer else "Administrator",
        "status": "Pending",
        "session_id": sid,
        "lesson_id": plan["id"],
        "created_at": now_utc().isoformat(),
        "history": [{"at": now_utc().isoformat(), "by": user["name"], "what": "Submitted"}],
    }
    await db.approval_requests.insert_one(doc)
    await db.lesson_plans.update_one({"session_id": sid}, {"$set": {"status": "Submitted", "review_note": ""}})
    plan["status"] = "Submitted"
    plan["review_note"] = ""
    return {"plan": plan, "request_id": doc["id"]}


MARK_LABEL = {"P": "Present", "A": "Absent", "L": "Late", "E": "Excused"}


def _can_open_class(user: dict, batch: dict) -> bool:
    if user["role"] in ("administrator", "owner"):
        return batch.get("organisation_id") == user["organisation_id"]
    if user["role"] == "coordinator":
        return batch.get("centre_id") == user.get("centre_id")
    return batch.get("class_teacher_id") == user["id"]


@api.get("/classes/{bid}")
async def get_class(bid: str, user: dict = Depends(get_current_user)):
    batch = await db.batches.find_one({"id": bid, "organisation_id": user["organisation_id"]}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Class not found")
    if not _can_open_class(user, batch):
        raise HTTPException(status_code=403, detail="Not your class")

    today = _today_str()
    week = await _week_dates()
    roster = []
    async for e in db.enrolments.find({"batch_id": bid}, {"_id": 0}):
        st = await db.students.find_one({"id": e["student_id"]}, {"_id": 0})
        if st:
            roster.append(st)
    roster.sort(key=lambda x: x["name"])

    sessions = [
        s
        async for s in db.sessions.find(
            {"batch_id": bid, "date": {"$in": week}},
            {"_id": 0},
        ).sort([("date", 1), ("start", 1)])
    ]
    marks_by_session: dict[str, dict] = {}
    for s in sessions:
        att = await db.student_attendance.find_one({"session_id": s["id"]}, {"_id": 0, "marks": 1})
        marks_by_session[s["id"]] = (att or {}).get("marks", {})

    students = []
    absent_today = 0
    unmarked_today = 0
    today_sessions = [s for s in sessions if s["date"] == today]
    for st in roster:
        week_marks = []
        today_code = None
        for s in sessions:
            code = marks_by_session.get(s["id"], {}).get(st["id"])
            if not code:
                continue
            week_marks.append(code)
            if s["date"] == today:
                today_code = code
        if today_sessions and today_code == "A":
            absent_today += 1
        if today_sessions and not today_code:
            unmarked_today += 1
        students.append({
            "id": st["id"],
            "name": st["name"],
            "initials": initials(st["name"]),
            "follow_up": bool(st.get("follow_up")),
            "today": today_code,
            "today_label": MARK_LABEL.get(today_code, "Not marked"),
            "absent_this_week": week_marks.count("A"),
            "late_this_week": week_marks.count("L"),
        })

    teacher = None
    if batch.get("class_teacher_id"):
        teacher = await db.users.find_one({"id": batch["class_teacher_id"]}, {"_id": 0, "name": 1})

    return {
        "id": batch["id"],
        "code": batch["code"],
        "programme": batch["programme"],
        "centre": batch["centre_name"],
        "room": batch.get("room"),
        "class_teacher": teacher["name"] if teacher else None,
        "students": students,
        "absent_today": absent_today,
        "unmarked_today": unmarked_today,
        "has_class_today": bool(today_sessions),
        "sessions": [_session_card(s) for s in sessions],
    }


@api.post("/sessions/{sid}/attendance")
async def save_attendance(sid: str, body: SaveAttendanceIn, user: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if user["role"] == "teacher" and s.get("teacher_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your session")
    if s.get("record_status") == "Verified":
        raise HTTPException(status_code=409, detail="Record is verified. Request a correction to edit.")
    marks = {m.student_id: m.code for m in body.marks}
    await db.student_attendance.update_one(
        {"session_id": sid},
        {"$set": {"session_id": sid, "marks": marks, "notes": body.notes or "", "updated_at": now_utc().isoformat(), "updated_by": user["name"]}},
        upsert=True,
    )
    await db.sessions.update_one({"id": sid}, {"$set": {"record_status": "In progress", "status": "In Progress", "status_kind": "n"}})
    return {"ok": True, "marked": len(marks)}


@api.post("/sessions/{sid}/submit")
async def submit_session(sid: str, user: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if user["role"] == "teacher" and s.get("teacher_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your session")
    att = await db.student_attendance.find_one({"session_id": sid}, {"_id": 0})
    enrolled = await db.enrolments.count_documents({"batch_id": s["batch_id"]})
    marked = len(att.get("marks", {})) if att else 0
    if marked < enrolled:
        raise HTTPException(status_code=400, detail=f"Mark attendance for all {enrolled} students first ({marked} marked)")
    hist = s.get("history", [])
    hist.append({"at": now_utc().isoformat(), "by": user["name"], "what": "Submitted session record"})
    await db.sessions.update_one(
        {"id": sid},
        {"$set": {"record_status": "Completed", "status": "Completed", "status_kind": "ok", "history": hist}},
    )
    return {"ok": True, "status": "Completed"}


# --------------------------------------------------------------------------- #
# Inbox / approvals
# --------------------------------------------------------------------------- #
def _inbox_query(user: dict) -> dict:
    base = {"organisation_id": user["organisation_id"], "status": "Pending"}
    if user["role"] == "coordinator" and user.get("centre_id"):
        base["centre_id"] = user["centre_id"]
    return base


@api.get("/inbox")
async def inbox(user: dict = Depends(get_current_user)):
    if user["role"] == "teacher":
        cur = db.approval_requests.find({"requester_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    else:
        q = {"organisation_id": user["organisation_id"]}
        if user["role"] == "coordinator" and user.get("centre_id"):
            q["centre_id"] = user["centre_id"]
        cur = db.approval_requests.find(q, {"_id": 0}).sort([("status", 1), ("created_at", -1)])
    items = [r async for r in cur]
    return {"items": items, "can_decide": user["role"] in ("coordinator", "administrator", "owner")}


async def _reviewer_for(user: dict):
    if user["role"] != "administrator":
        found = await db.users.find_one(
            {
                "organisation_id": user["organisation_id"],
                "role": "coordinator",
                "centre_id": user.get("centre_id"),
                "id": {"$ne": user["id"]},
            },
            {"_id": 0},
        )
        if found:
            return found
    return await db.users.find_one(
        {"organisation_id": user["organisation_id"], "role": "administrator", "id": {"$ne": user["id"]}},
        {"_id": 0},
    )


def _leave_days(body: LeaveRequestIn) -> list[date]:
    if body.dates:
        try:
            days = [date.fromisoformat(d) for d in body.dates]
        except ValueError:
            raise HTTPException(status_code=400, detail="Choose valid leave dates")
        if not days:
            raise HTTPException(status_code=400, detail="Select at least one day")
        return sorted(set(days))
    if not body.start_date or not body.end_date:
        raise HTTPException(status_code=400, detail="Select at least one day")
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    start = date.fromisoformat(body.start_date)
    end = date.fromisoformat(body.end_date)
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


@api.post("/requests/leave")
async def create_leave(body: LeaveRequestIn, user: dict = Depends(get_current_user)):
    days = _leave_days(body)
    reviewer = await _reviewer_for(user)
    iso_days = [d.isoformat() for d in days]
    doc = {
        "id": new_id(),
        "organisation_id": user["organisation_id"],
        "centre_id": user.get("centre_id"),
        "kind": "Leave",
        "title": f"{body.leave_type} leave, {leave_span(days)}",
        "detail": body.reason,
        "requester_id": user["id"],
        "requester_name": user["name"],
        "requester_initials": initials(user["name"]),
        "reviewer_name": reviewer["name"] if reviewer else "Administrator",
        "status": "Pending",
        "start_date": iso_days[0],
        "end_date": iso_days[-1],
        "dates": iso_days,
        "leave_type": body.leave_type,
        "created_at": now_utc().isoformat(),
        "history": [{"at": now_utc().isoformat(), "by": user["name"], "what": "Requested"}],
    }
    await db.approval_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/requests/{rid}/decision")
async def decide(rid: str, body: DecisionIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("coordinator", "administrator", "owner"):
        raise HTTPException(status_code=403, detail="Not authorised to decide")
    req = await db.approval_requests.find_one({"id": rid, "organisation_id": user["organisation_id"]})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "coordinator" and user.get("centre_id") and req.get("centre_id") not in (None, user["centre_id"]):
        raise HTTPException(status_code=403, detail="Not your centre")
    if req["status"] != "Pending":
        raise HTTPException(status_code=409, detail="Already processed")
    if body.decision == "Rejected" and not (body.reason and body.reason.strip()):
        raise HTTPException(status_code=400, detail="A reason is required to reject")
    hist = req.get("history", [])
    hist.append({"at": now_utc().isoformat(), "by": user["name"], "what": body.decision, "reason": body.reason})
    await db.approval_requests.update_one(
        {"id": rid},
        {"$set": {"status": body.decision, "decided_by": user["name"], "decided_at": now_utc().isoformat(), "decision_reason": body.reason, "history": hist}},
    )
    if req.get("lesson_id"):
        plan_status = "Approved" if body.decision == "Approved" else "Changes requested"
        await db.lesson_plans.update_one(
            {"id": req["lesson_id"]},
            {"$set": {"status": plan_status, "review_note": (body.reason or "").strip()}},
        )
    await db.notifications.insert_one({
        "id": new_id(),
        "user_id": req["requester_id"],
        "title": f"{req['kind']} {body.decision.lower()}",
        "detail": req["title"] + (f" · {body.reason}" if body.reason else ""),
        "unread": True,
        "action": "inbox",
        "created_at": now_utc().isoformat(),
    })
    return {"ok": True, "status": body.decision}


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #
@api.get("/conversations")
async def conversations(user: dict = Depends(get_current_user)):
    cur = db.conversations.find({"member_ids": user["id"]}, {"_id": 0}).sort("updated_at", -1)
    out = []
    async for c in cur:
        last = await db.messages.find_one({"conversation_id": c["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        unread = await db.messages.count_documents({"conversation_id": c["id"], "read_by": {"$ne": user["id"]}, "sender_id": {"$ne": user["id"]}})
        out.append({
            "id": c["id"],
            "title": c["title"],
            "subtitle": c.get("subtitle", ""),
            "official": c.get("official", False),
            "last": {"sender": last["sender_name"], "text": last["text"]} if last else None,
            "unread": unread,
        })
    return {"items": out}


@api.get("/conversations/{cid}/messages")
async def conversation_messages(cid: str, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": cid, "member_ids": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    cur = db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", 1)
    msgs = []
    async for m in cur:
        msgs.append({
            "id": m["id"],
            "sender_name": m["sender_name"],
            "text": m["text"],
            "mine": m["sender_id"] == user["id"],
            "time": _reltime(m["created_at"]),
        })
    await db.messages.update_many({"conversation_id": cid, "read_by": {"$ne": user["id"]}}, {"$addToSet": {"read_by": user["id"]}})
    return {"conversation": {"id": c["id"], "title": c["title"], "subtitle": c.get("subtitle", ""), "official": c.get("official", False)}, "messages": msgs}


@api.post("/conversations/{cid}/messages")
async def post_message(cid: str, body: MessageIn, user: dict = Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Write a message first")
    c = await db.conversations.find_one({"id": cid, "member_ids": user["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    doc = {
        "id": new_id(),
        "conversation_id": cid,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "text": body.text.strip(),
        "read_by": [user["id"]],
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one({"id": cid}, {"$set": {"updated_at": now_utc().isoformat()}})
    return {"ok": True}


@api.post("/conversations")
async def compose(body: ComposeIn, user: dict = Depends(get_current_user)):
    if not body.subject.strip() or not body.text.strip():
        raise HTTPException(status_code=400, detail="Add a subject and a message")
    member_ids = await _compose_members(user, body.to)
    cid = new_id()
    await db.conversations.insert_one({
        "id": cid,
        "organisation_id": user["organisation_id"],
        "title": body.subject.strip(),
        "subtitle": body.to,
        "official": body.official,
        "type": "group" if len(member_ids) > 2 else "direct",
        "member_ids": member_ids,
        "created_by": user["id"],
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.messages.insert_one({
        "id": new_id(),
        "conversation_id": cid,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "text": body.text.strip(),
        "read_by": [user["id"]],
        "created_at": now_utc().isoformat(),
    })
    for mid in member_ids:
        if mid == user["id"]:
            continue
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": mid,
            "title": f"New message: {body.subject.strip()}",
            "detail": f"{user['name']} · {body.text.strip()[:80]}",
            "unread": True,
            "action": "chat",
            "created_at": now_utc().isoformat(),
        })
    return {"ok": True, "id": cid}


async def _compose_members(user: dict, to: str) -> list[str]:
    """Add people the composer actually addressed.

    Match the full name (or the administration office / a centre group).
    A partial label that does not contain a full name stays a private note
    so the sender is the only member.
    """
    ids = [user["id"]]
    needle = (to or "").lower()
    centre_group = "centre" in needle and "group" in needle
    cur = db.users.find(
        {"organisation_id": user["organisation_id"]},
        {"_id": 0, "id": 1, "name": 1, "role": 1, "centre_name": 1},
    )
    async for other in cur:
        if other["id"] in ids:
            continue
        name = (other.get("name") or "").lower()
        centre = (other.get("centre_name") or "").lower()
        if name and name in needle:
            ids.append(other["id"])
        elif "administration" in needle and other.get("role") == "administrator":
            ids.append(other["id"])
        elif centre_group and centre and centre in needle:
            ids.append(other["id"])
    return ids


def _reltime(iso: str) -> str:
    try:
        t = datetime.fromisoformat(iso)
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return t.astimezone(IST).strftime("%H:%M")
    except Exception:
        return ""


# --------------------------------------------------------------------------- #
# Notifications
# --------------------------------------------------------------------------- #
@api.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    cur = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    items = [n async for n in cur]
    return {"items": items, "unread": sum(1 for n in items if n.get("unread"))}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"unread": False}})
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Pay & leave
# --------------------------------------------------------------------------- #
@api.get("/pay")
async def pay(user: dict = Depends(get_current_user)):
    if user["role"] == "teacher":
        cur = db.payslips.find({"teacher_id": user["id"]}, {"_id": 0}).sort("period_order", -1)
    else:
        cur = db.payslips.find({"organisation_id": user["organisation_id"]}, {"_id": 0}).sort("period_order", -1)
    return {"items": [p async for p in cur]}


async def _payslip_for(pid: str, user: dict) -> dict:
    p = await db.payslips.find_one({"id": pid, "organisation_id": user["organisation_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Statement not found")
    if user["role"] == "teacher" and p["teacher_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your statement")
    return p


def _pdf_escape(text: str) -> str:
    raw = str(text).replace("₹", "Rs ").encode("latin-1", "replace").decode("latin-1")
    return raw.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def statement_pdf(p: dict) -> bytes:
    rows = [
        "TeachOps salary statement",
        p.get("teacher_name") or "",
        p.get("period") or "",
        "",
        f"Net payable  {str(p.get('net_display', '')).replace('₹', 'Rs ')}",
        f"Paid {p.get('paid_on', '')}    Bank ref {p.get('reference', '')}",
        "",
        "Calculation",
    ]
    for line in p.get("lines") or []:
        amount = str(line.get("amount", "")).replace("₹", "")
        rows.append(f"{line.get('label', '')}    Rs {amount}")
    rows += ["", "Payment status is recorded by finance. TeachOps does not transfer money.", "Demo statement."]
    commands = ["BT", "/F1 12 Tf", "50 780 Td", "16 TL"]
    for row in rows:
        commands.append(f"({_pdf_escape(row)}) Tj")
        commands.append("T*")
    commands.append("ET")
    stream = "\n".join(commands).encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return bytes(out)


@api.get("/pay/{pid}")
async def pay_detail(pid: str, user: dict = Depends(get_current_user)):
    return await _payslip_for(pid, user)


@api.get("/pay/{pid}/pdf")
async def pay_pdf(pid: str, user: dict = Depends(get_current_user)):
    p = await _payslip_for(pid, user)
    filename = f"TeachOps-{(p.get('period') or 'statement').replace(' ', '-')}.pdf"
    return Response(
        content=statement_pdf(p),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/expenses")
async def list_expenses(user: dict = Depends(get_current_user)):
    cur = db.approval_requests.find(
        {"requester_id": user["id"], "kind": "Expense"},
        {"_id": 0},
    ).sort("created_at", -1)
    return {"items": [r async for r in cur]}


@api.post("/requests/expense")
async def create_expense(body: ExpenseIn, user: dict = Depends(get_current_user)):
    origin = body.origin.strip()
    destination = body.destination.strip()
    purpose = body.purpose.strip()
    if not origin or not destination or not purpose:
        raise HTTPException(status_code=400, detail="Add the route and a short purpose")
    if body.amount < 1 or body.amount > 50000:
        raise HTTPException(status_code=400, detail="Enter an amount between 1 and 50,000")
    try:
        day = date.fromisoformat(body.travel_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Choose a travel date")
    if day > datetime.now(IST).date():
        raise HTTPException(status_code=400, detail="Travel date cannot be in the future")
    reviewer = await _reviewer_for(user)
    doc = {
        "id": new_id(),
        "organisation_id": user["organisation_id"],
        "centre_id": user.get("centre_id"),
        "kind": "Expense",
        "title": f"Travel claim, ₹{body.amount:,}",
        "detail": f"{fmt_short_date(day)} · {origin} to {destination} · {purpose}",
        "requester_id": user["id"],
        "requester_name": user["name"],
        "requester_initials": initials(user["name"]),
        "reviewer_name": reviewer["name"] if reviewer else "Administrator",
        "status": "Pending",
        "amount": body.amount,
        "travel_date": body.travel_date,
        "created_at": now_utc().isoformat(),
        "history": [{"at": now_utc().isoformat(), "by": user["name"], "what": "Submitted"}],
    }
    await db.approval_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/leave/balances")
async def leave_balances(user: dict = Depends(get_current_user)):
    bal = await db.leave_balances.find_one({"teacher_id": user["id"]}, {"_id": 0})
    return bal or {"casual": 0, "sick": 0, "training": 0}


# --------------------------------------------------------------------------- #
# Teachers directory (coordinator / admin)
# --------------------------------------------------------------------------- #
@api.get("/teachers")
async def teachers(user: dict = Depends(require("coordinator", "administrator", "owner"))):
    week = await _week_dates()
    q = {"organisation_id": user["organisation_id"], "role": "teacher"}
    if user["role"] == "coordinator" and user.get("centre_id"):
        q["centre_id"] = user["centre_id"]
    cur = db.users.find(q, {"_id": 0, "password_hash": 0}).sort("name", 1)
    out = []
    async for t in cur:
        count = await db.sessions.count_documents({"teacher_id": t["id"], "date": {"$in": week}})
        out.append({"id": t["id"], "name": t["name"], "initials": initials(t["name"]), "centre": t.get("centre_name"), "status": t.get("teacher_status", "active"), "subject": t.get("subject", ""), "weekly_sessions": count})
    return {"items": out}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Seed
# --------------------------------------------------------------------------- #
CLASS_TEACHERS = {
    "6A": "Anjali Pillai",
    "6B": "Lakshmi Raman",
    "6C": "Ramesh Gopal",
    "6D": "Priya Shankar",
    "7A": "Divya Menon",
    "7C": "Deepa Nair",
    "8A": "Karthik Iyer",
    "8C": "Sneha Rao",
    "8D": "Gopal Varma",
}


async def ensure_class_teachers():
    for code, name in CLASS_TEACHERS.items():
        teacher = await db.users.find_one(
            {"name": name, "role": "teacher"},
            {"_id": 0, "id": 1, "organisation_id": 1},
        )
        if not teacher:
            continue
        await db.batches.update_many(
            {"code": code, "organisation_id": teacher["organisation_id"]},
            {"$set": {"class_teacher_id": teacher["id"]}},
        )


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.student_attendance.create_index("session_id", unique=True)
    existing = await db.organisations.find_one({"seed": True})
    if existing:
        logger.info("TeachOps demo seed already present")
    else:
        logger.info("Seeding TeachOps demo data ...")
        import seed_data
        await seed_data.run(db, hash_pw)
        logger.info("TeachOps demo seed complete")
    await ensure_class_teachers()


@app.on_event("shutdown")
async def shutdown():
    client.close()
