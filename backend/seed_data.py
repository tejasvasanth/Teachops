"""TeachOps demo seed — one fictional Chennai arts-and-learning organisation.

Clearly labelled demo data. Everything is anchored to the *current* week so
My Day, Schedule, Attendance, Pay, Chat and Inbox always have live content.
Fictional Indian names, INR, Asia/Kolkata.
"""
import uuid
from datetime import datetime, timedelta, timezone, date

IST = timezone(timedelta(hours=5, minutes=30))
PASSWORD = "Demo@12345"


def nid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _week():
    today = datetime.now(IST).date()
    monday = today - timedelta(days=today.weekday())
    return [monday + timedelta(days=i) for i in range(6)]  # Mon..Sat


STUDENT_FIRST = [
    "Aarav", "Diya", "Ishaan", "Kavya", "Meera", "Nikhil", "Priya", "Rohan",
    "Ananya", "Vihaan", "Saanvi", "Arjun", "Myra", "Advait", "Aadya", "Reyansh",
    "Ira", "Kabir", "Anika", "Vivaan", "Navya", "Aryan", "Pari", "Dhruv",
]
STUDENT_LAST = [
    "Menon", "Raghavan", "Krishnan", "Subramanian", "Venkatesh", "Iyer",
    "Natarajan", "Balaji", "Pillai", "Nair", "Rao", "Sundaram",
]

TEACHERS = [
    ("Anjali Pillai", "anjali@teachops.demo", "Adyar", "Theatre & Expression"),
    ("Lakshmi Raman", "lakshmi@teachops.demo", "Adyar", "Mathematics"),
    ("Karthik Iyer", "karthik@teachops.demo", "Adyar", "Science"),
    ("Deepa Nair", "deepa@teachops.demo", "Adyar", "English"),
    ("Ramesh Gopal", "ramesh@teachops.demo", "Velachery", "Mathematics"),
    ("Sneha Rao", "sneha@teachops.demo", "Velachery", "Science"),
    ("Vijay Kumar", "vijay@teachops.demo", "Velachery", "Theatre & Expression"),
    ("Divya Menon", "divya@teachops.demo", "Velachery", "English"),
    ("Arun Prasad", "arun@teachops.demo", "T. Nagar", "Art Studio"),
    ("Priya Shankar", "priyas@teachops.demo", "T. Nagar", "Mathematics"),
    ("Gopal Varma", "gopal@teachops.demo", "T. Nagar", "Science"),
    ("Nandini Rajan", "nandini@teachops.demo", "T. Nagar", "Improv & Expression"),
]

PROGRAMMES = [
    "Grade 6 Mathematics", "Grade 7 English", "Grade 8 Science",
    "Theatre Foundations", "Improv and Expression", "Art Studio",
]


async def run(db, hash_pw):
    week = _week()
    today = datetime.now(IST).date()
    feature_day = today if today.weekday() <= 5 else week[0]
    pw = hash_pw(PASSWORD)

    org_id = nid()
    org_name = "Chennai Arts and Learning"
    await db.organisations.insert_one({
        "id": org_id, "name": org_name, "seed": True,
        "timezone": "Asia/Kolkata", "currency": "INR", "primary_colour": "#3B82F6",
        "created_at": now_iso(),
    })

    centres = {}
    for cname in ["Adyar", "Velachery", "T. Nagar"]:
        cid = nid()
        centres[cname] = cid
        await db.centres.insert_one({"id": cid, "organisation_id": org_id, "name": cname, "created_at": now_iso()})

    prog_ids = {}
    for p in PROGRAMMES:
        pid = nid()
        prog_ids[p] = pid
        await db.programmes.insert_one({"id": pid, "organisation_id": org_id, "name": p, "created_at": now_iso()})

    # ---- users: coordinator, administrator, teachers ----
    coordinator_id = nid()
    await db.users.insert_one({
        "id": coordinator_id, "organisation_id": org_id, "organisation_name": org_name,
        "email": "suresh@teachops.demo", "password_hash": pw, "name": "Suresh Kannan",
        "role": "coordinator", "role_label": "Centre Coordinator",
        "centre_id": centres["Adyar"], "centre_name": "Adyar", "created_at": now_iso(),
    })
    admin_id = nid()
    await db.users.insert_one({
        "id": admin_id, "organisation_id": org_id, "organisation_name": org_name,
        "email": "meenakshi@teachops.demo", "password_hash": pw, "name": "Meenakshi Sundaram",
        "role": "administrator", "role_label": "Administrator",
        "centre_id": None, "centre_name": None, "created_at": now_iso(),
    })

    teacher_ids = {}
    for name, email, centre, subject in TEACHERS:
        tid = nid()
        teacher_ids[name] = tid
        await db.users.insert_one({
            "id": tid, "organisation_id": org_id, "organisation_name": org_name,
            "email": email, "password_hash": pw, "name": name, "role": "teacher",
            "role_label": "Teacher", "centre_id": centres[centre], "centre_name": centre,
            "subject": subject, "teacher_status": "active", "created_at": now_iso(),
        })
    anjali_id = teacher_ids["Anjali Pillai"]

    # ---- students (120) ----
    student_ids = []
    rohan_id = None
    i = 0
    for f in STUDENT_FIRST:
        for ln in STUDENT_LAST[: (6 if i % 2 == 0 else 4)]:
            if len(student_ids) >= 120:
                break
            sid = nid()
            name = f"{f} {ln}"
            follow = (name == "Rohan Balaji")
            await db.students.insert_one({
                "id": sid, "organisation_id": org_id, "name": name,
                "guardian_name": f"{ln} family", "guardian_phone": "+91 90000 0000" + str(i % 10),
                "follow_up": follow, "created_at": now_iso(),
            })
            if follow:
                rohan_id = sid
            student_ids.append(sid)
            i += 1
    if rohan_id is None:
        rohan_id = student_ids[7]
        await db.students.update_one({"id": rohan_id}, {"$set": {"follow_up": True, "name": "Rohan Balaji", "guardian_name": "Balaji family"}})

    # ---- batches ----
    # Anjali's three feature batches (match prototype vibe)
    feature = [
        ("6A", "Grade 6 Mathematics", "Adyar", "Room 2", "09:00", "10:00"),
        ("TF-2", "Theatre Foundations", "Adyar", "Studio", "11:00", "12:15"),
        ("8B", "Grade 8 Science", "Velachery", "Room 4", "14:30", "15:30"),
    ]
    batch_meta = []  # (batch_id, code, programme, centre, room, start, end, teacher_id, days)
    student_cursor = 0

    def take_students(n):
        nonlocal student_cursor
        chunk = student_ids[student_cursor:student_cursor + n]
        student_cursor += n
        if len(chunk) < n:
            chunk = chunk + student_ids[: (n - len(chunk))]
        return chunk

    other_day = week[(feature_day.weekday() + 2) % 6].isoformat() if feature_day.weekday() <= 3 else week[0].isoformat()
    for code, prog, centre, room, start, end in feature:
        bid = nid()
        enr = take_students(8)
        # ensure Rohan is in 6A
        if code == "6A" and rohan_id not in enr:
            enr[0] = rohan_id
        await db.batches.insert_one({
            "id": bid, "organisation_id": org_id, "code": code, "programme": prog,
            "centre_id": centres[centre], "centre_name": centre, "room": room,
            "teacher_id": anjali_id,
            "class_teacher_id": anjali_id if code == "6A" else None,
            "created_at": now_iso(),
        })
        for s in enr:
            await db.enrolments.insert_one({"id": nid(), "batch_id": bid, "student_id": s, "organisation_id": org_id})
        batch_meta.append((bid, code, prog, centre, room, start, end, anjali_id,
                           [feature_day.isoformat(), other_day]))

    # remaining batches for the other 11 teachers
    extra_specs = [
        ("7C", "Grade 7 English", "Deepa Nair", "Room 1", "10:00", "11:00"),
        ("IE-1", "Improv and Expression", "Nandini Rajan", "Hall", "15:00", "16:30"),
        ("AS-3", "Art Studio", "Arun Prasad", "Room 5", "10:00", "12:00"),
        ("6B", "Grade 6 Mathematics", "Lakshmi Raman", "Room 3", "09:00", "10:00"),
        ("8A", "Grade 8 Science", "Karthik Iyer", "Lab", "11:00", "12:00"),
        ("6C", "Grade 6 Mathematics", "Ramesh Gopal", "Room 2", "09:30", "10:30"),
        ("8C", "Grade 8 Science", "Sneha Rao", "Lab 2", "13:00", "14:00"),
        ("TF-1", "Theatre Foundations", "Vijay Kumar", "Studio B", "16:00", "17:15"),
        ("7A", "Grade 7 English", "Divya Menon", "Room 6", "09:00", "10:00"),
        ("6D", "Grade 6 Mathematics", "Priya Shankar", "Room 7", "11:00", "12:00"),
        ("8D", "Grade 8 Science", "Gopal Varma", "Lab 3", "14:00", "15:00"),
        ("IE-2", "Improv and Expression", "Nandini Rajan", "Hall", "17:00", "18:00"),
    ]
    dow_cycle = [[0, 2], [1, 3], [2, 4], [0, 4], [1, 5], [3, 5]]
    for idx, (code, prog, tname, room, start, end) in enumerate(extra_specs):
        bid = nid()
        tid = teacher_ids[tname]
        tuser = await db.users.find_one({"id": tid}, {"_id": 0})
        centre = tuser["centre_name"]
        enr = take_students(8)
        await db.batches.insert_one({
            "id": bid, "organisation_id": org_id, "code": code, "programme": prog,
            "centre_id": centres[centre], "centre_name": centre, "room": room,
            "teacher_id": tid,
            "class_teacher_id": tid if code in {"6B", "6C", "6D", "7A", "7C", "8A", "8C", "8D"} else None,
            "created_at": now_iso(),
        })
        for s in enr:
            await db.enrolments.insert_one({"id": nid(), "batch_id": bid, "student_id": s, "organisation_id": org_id})
        days = [week[d].isoformat() for d in dow_cycle[idx % len(dow_cycle)]]
        batch_meta.append((bid, code, prog, centre, room, start, end, tid, days))

    # ---- sessions for the week ----
    todays = today.isoformat()
    feat_iso = feature_day.isoformat()
    session_seq = 0
    for bid, code, prog, centre, room, start, end, tid, days in batch_meta:
        for d in days:
            session_seq += 1
            sid = nid()
            is_feature_batch = code in ("6A", "TF-2", "8B")
            doc = {
                "id": sid, "organisation_id": org_id, "batch_id": bid, "batch_code": code,
                "title": prog, "centre_id": centres[centre], "centre_name": centre, "room": room,
                "date": d, "start": start, "end": end, "teacher_id": tid,
                "conflict": False, "history": [], "created_at": now_iso(),
            }
            # feature batches on the feature day -> crafted statuses
            if is_feature_batch and d == feat_iso:
                if code == "6A":
                    doc.update(status="Attendance submitted", status_kind="warn",
                               record_status="Attendance submitted", note="Attendance submitted at 10:05")
                elif code == "TF-2":
                    doc.update(status="Next", status_kind="n", record_status="Not started")
                else:  # 8B travel conflict
                    doc.update(status="Travel buffer: 30 min needed, 15 min planned",
                               status_kind="warn", record_status="Not started", conflict=True,
                               note="Grade 8 Science starts 15 minutes after leaving Adyar. Move it to 14:45 or assign a substitute.")
            else:
                dd = date.fromisoformat(d)
                if dd < today:
                    if session_seq % 5 == 0:
                        doc.update(status="Needs Review", status_kind="warn",
                                   record_status="Attendance submitted", note="Session note not yet filed")
                    else:
                        doc.update(status="Verified", status_kind="ok", record_status="Verified")
                        doc["history"] = [{"at": now_iso(), "by": "Coordinator", "what": "Verified record"}]
                elif d == todays:
                    doc.update(status="Scheduled", status_kind="n", record_status="Not started")
                else:
                    doc.update(status="Scheduled", status_kind="n", record_status="Not started")
            # one unassigned session this week for the admin metric
            if code == "IE-2" and dd_after(d, today):
                doc["teacher_id"] = None
                doc.update(status="Needs teacher", status_kind="warn")
            await db.sessions.insert_one(doc)

    # ---- leave balances ----
    for name, tid in teacher_ids.items():
        await db.leave_balances.insert_one({
            "teacher_id": tid, "organisation_id": org_id,
            "casual": 6 if name == "Anjali Pillai" else 8,
            "sick": 4 if name == "Anjali Pillai" else 6,
            "training": 2, "resets": "1 April",
        })

    # ---- payslips (September paid, August paid) for all teachers ----
    for period_order, (label, net, lines, ref) in enumerate([
        ("August 2026", 31200, [
            {"label": "Base: 39 sessions × ₹800", "amount": "31,200"},
        ], "ending 4471"),
        ("September 2026", 33600, [
            {"label": "Base: 36 sessions × ₹800", "amount": "28,800"},
            {"label": "Substitution: 4 sessions × ₹900", "amount": "3,600"},
            {"label": "Travel claim, approved", "amount": "1,200"},
        ], "ending 4471"),
    ]):
        for name, tid in teacher_ids.items():
            amt = net if name == "Anjali Pillai" else net - 2000 + (hash(name) % 4000)
            await db.payslips.insert_one({
                "id": nid(), "organisation_id": org_id, "teacher_id": tid, "teacher_name": name,
                "period": label, "period_order": period_order, "net": amt,
                "net_display": f"₹{amt:,.0f}", "status": "Paid",
                "paid_on": "30 " + label.split()[0][:3], "reference": ref,
                "lines": lines if name == "Anjali Pillai" else [{"label": f"Base: sessions this period", "amount": f"{amt:,.0f}"}],
                "created_at": now_iso(),
            })

    # salary credited notification for Anjali
    await db.notifications.insert_one({
        "id": nid(), "user_id": anjali_id, "title": "September salary credited",
        "detail": "₹33,600 · recorded 30 Sep by Finance", "unread": True,
        "action": "pay", "created_at": now_iso(),
    })

    # ---- approval requests (inbox) ----
    adyar = centres["Adyar"]
    reqs = [
        {"kind": "Leave", "title": "Casual leave, 8 Oct",
         "detail": "Family event; Lakshmi R. can cover both classes",
         "requester_id": teacher_ids["Lakshmi Raman"], "requester_name": "Lakshmi Raman",
         "centre_id": adyar, "status": "Pending"},
        {"kind": "Attendance correction", "title": "Attendance correction, 6A",
         "detail": "Marked Rohan absent; he arrived at 09:20",
         "requester_id": anjali_id, "requester_name": "Anjali Pillai",
         "centre_id": adyar, "status": "Pending"},
        {"kind": "Lesson plan", "title": "Lesson plan: Mask work",
         "detail": "Needs coordinator review",
         "requester_id": teacher_ids["Lakshmi Raman"], "requester_name": "Lakshmi Raman",
         "centre_id": adyar, "status": "Pending"},
        {"kind": "Substitution", "title": "Substitution, Wed Theatre Foundations",
         "detail": "Cover needed; Lakshmi R. available",
         "requester_id": teacher_ids["Karthik Iyer"], "requester_name": "Karthik Iyer",
         "centre_id": adyar, "status": "Pending"},
        {"kind": "Leave", "title": "Sick leave, 12 Sep",
         "detail": "Medical appointment", "requester_id": anjali_id, "requester_name": "Anjali Pillai",
         "centre_id": adyar, "status": "Approved", "decided_by": "Suresh Kannan",
         "decision_reason": None},
    ]
    for r in reqs:
        r.update({
            "id": nid(), "organisation_id": org_id,
            "requester_initials": _init(r["requester_name"]),
            "reviewer_name": "Suresh Kannan",
            "created_at": now_iso(),
            "history": [{"at": now_iso(), "by": r["requester_name"], "what": "Requested"}],
        })
        await db.approval_requests.insert_one(r)

    # ---- conversations ----
    # Official thread: Revised timetable (Anjali + Admin + Coordinator)
    c1 = nid()
    await db.conversations.insert_one({
        "id": c1, "organisation_id": org_id, "title": "Revised timetable, Term 3",
        "subtitle": "", "official": True, "type": "direct",
        "member_ids": [anjali_id, admin_id, coordinator_id],
        "created_by": admin_id, "created_at": now_iso(), "updated_at": now_iso(),
    })
    msgs1 = [
        (admin_id, "Meenakshi Sundaram", "Term 3 timetables are final. Please check your Wednesday and Thursday slots and reply here by Friday if anything clashes."),
        (anjali_id, "Anjali Pillai", "Wednesday Theatre Foundations overlaps with my Velachery class. Could we move it to 11:30?"),
        (admin_id, "Meenakshi Sundaram", "Noted. I will raise it with Suresh and confirm in this thread."),
    ]
    for j, (sidr, sname, text) in enumerate(msgs1):
        read = [sidr]
        await db.messages.insert_one({
            "id": nid(), "conversation_id": c1, "sender_id": sidr, "sender_name": sname,
            "text": text, "read_by": read,
            "created_at": (datetime.now(timezone.utc) - timedelta(minutes=(len(msgs1) - j) * 20)).isoformat(),
        })

    # Group: Adyar centre (Anjali + Suresh + Lakshmi + Karthik)
    c2 = nid()
    await db.conversations.insert_one({
        "id": c2, "organisation_id": org_id, "title": "Adyar centre",
        "subtitle": "Group · 9 members", "official": False, "type": "group",
        "member_ids": [anjali_id, coordinator_id, teacher_ids["Lakshmi Raman"], teacher_ids["Karthik Iyer"]],
        "created_by": coordinator_id, "created_at": now_iso(), "updated_at": now_iso(),
    })
    await db.messages.insert_one({
        "id": nid(), "conversation_id": c2, "sender_id": coordinator_id, "sender_name": "Suresh Kannan",
        "text": "Studio is booked for rehearsals on Friday afternoon. Plan indoor sessions in Room 2.",
        "read_by": [coordinator_id, anjali_id],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    })

    # Announcement: organisation-wide (official)
    c3 = nid()
    await db.conversations.insert_one({
        "id": c3, "organisation_id": org_id, "title": "Organisation announcements",
        "subtitle": "Official · everyone", "official": True, "type": "announcement",
        "member_ids": [anjali_id, coordinator_id, admin_id] + list(teacher_ids.values()),
        "created_by": admin_id, "created_at": now_iso(), "updated_at": now_iso(),
    })
    await db.messages.insert_one({
        "id": nid(), "conversation_id": c3, "sender_id": admin_id, "sender_name": "Meenakshi Sundaram",
        "text": "September pay periods are now locked and marked paid. Statements are available under Me → Pay.",
        "read_by": [admin_id],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
    })

    # chat reply notification for Anjali
    await db.notifications.insert_one({
        "id": nid(), "user_id": anjali_id, "title": "New reply: Revised timetable, Term 3",
        "detail": "Meenakshi S. · just now", "unread": True,
        "action": "chat", "created_at": now_iso(),
    })


def dd_after(d: str, today: date) -> bool:
    return date.fromisoformat(d) > today


def _init(name: str) -> str:
    parts = [p for p in name.split() if p]
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()
