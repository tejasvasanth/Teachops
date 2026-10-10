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
    start_date: str
    end_date: str
    reason: str


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
            pending.append({"title": f"Session note for {rec['title']}", "sub": "Attendance submitted", "tag": "Due today", "kind": "warn"})
        follow = await db.students.find_one({"follow_up": True, "organisation_id": user["organisation_id"]}, {"_id": 0})
        if follow:
            pending.append({"title": f"Follow up with {follow['guardian_name']}", "sub": f"{follow['name']} · absent twice this week", "tag": "Open", "kind": "n"})

        return {
            "role": "teacher",
            "greeting": f"Good morning, {user['name'].split()[0]}",
            "date_label": datetime.now(IST).strftime("%A, %-d %B"),
            "next": next_card,
            "timeline": timeline,
            "pending": pending,
            "leave": bal,
            "pay": payslip,
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
        "date_label": datetime.now(IST).strftime("%A, %-d %B"),
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
@api.get("/sessions/{sid}")
async def get_session(sid: str, user: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid, "organisation_id": user["organisation_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if user["role"] == "teacher" and s.get("teacher_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your session")
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


@api.post("/requests/leave")
async def create_leave(body: LeaveRequestIn, user: dict = Depends(get_current_user)):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    reviewer = await db.users.find_one(
        {"organisation_id": user["organisation_id"], "role": "coordinator", "centre_id": user.get("centre_id")},
        {"_id": 0},
    ) or await db.users.find_one({"organisation_id": user["organisation_id"], "role": "administrator"}, {"_id": 0})

    def fmt(d):
        return date.fromisoformat(d).strftime("%-d %b")

    span = fmt(body.start_date) if body.start_date == body.end_date else f"{fmt(body.start_date)} to {fmt(body.end_date)}"
    doc = {
        "id": new_id(),
        "organisation_id": user["organisation_id"],
        "centre_id": user.get("centre_id"),
        "kind": "Leave",
        "title": f"{body.leave_type} leave, {span}",
        "detail": body.reason,
        "requester_id": user["id"],
        "requester_name": user["name"],
        "requester_initials": initials(user["name"]),
        "reviewer_name": reviewer["name"] if reviewer else "Administrator",
        "status": "Pending",
        "start_date": body.start_date,
        "end_date": body.end_date,
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
    cid = new_id()
    await db.conversations.insert_one({
        "id": cid,
        "organisation_id": user["organisation_id"],
        "title": body.subject.strip(),
        "subtitle": body.to,
        "official": body.official,
        "type": "direct",
        "member_ids": [user["id"]],
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
    return {"ok": True, "id": cid}


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


@api.get("/pay/{pid}")
async def pay_detail(pid: str, user: dict = Depends(get_current_user)):
    p = await db.payslips.find_one({"id": pid, "organisation_id": user["organisation_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Statement not found")
    if user["role"] == "teacher" and p["teacher_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your statement")
    return p


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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Seed
# --------------------------------------------------------------------------- #
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.student_attendance.create_index("session_id", unique=True)
    existing = await db.organisations.find_one({"seed": True})
    if existing:
        logger.info("TeachOps demo seed already present")
        return
    logger.info("Seeding TeachOps demo data ...")
    import seed_data
    await seed_data.run(db, hash_pw)
    logger.info("TeachOps demo seed complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
