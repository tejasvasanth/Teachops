import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

# ---------- Auth ----------
class TestAuth:
    def test_login_valid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "anjali@teachops.demo", "password": "Demo@12345"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["email"] == "anjali@teachops.demo"
        assert d["user"]["role"] == "teacher"

    def test_login_invalid_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "anjali@teachops.demo", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_demo_login_roles(self):
        for role in ("Teacher", "Coordinator", "Administrator"):
            r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={"role": role}, timeout=15)
            assert r.status_code == 200, r.text
            u = r.json()["user"]
            assert u["role"] == role.lower()

    def test_me(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "teacher"

    def test_me_unauthorised(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- My Day ----------
class TestMyDay:
    def test_my_day_teacher(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/my-day", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "teacher"
        for key in ("timeline", "pending", "leave", "pay"):
            assert key in d
        assert "next" in d

    def test_my_day_coordinator(self, coord_h):
        r = requests.get(f"{BASE_URL}/api/my-day", headers=coord_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "coordinator"
        assert isinstance(d.get("metrics"), list) and len(d["metrics"]) >= 1
        assert "timeline" in d

    def test_my_day_admin(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/my-day", headers=admin_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "administrator"
        assert isinstance(d.get("metrics"), list)


# ---------- Schedule ----------
class TestSchedule:
    def test_schedule_teacher(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/schedule", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "week" in d and "days" in d
        assert len(d["week"]) == 6
        for day in d["week"]:
            assert day["date"] in d["days"]

    def test_schedule_coordinator(self, coord_h):
        r = requests.get(f"{BASE_URL}/api/schedule", headers=coord_h, timeout=15)
        assert r.status_code == 200


# ---------- Sessions / attendance ----------
class TestSessions:
    def _teacher_session(self, teacher_h, editable=False):
        r = requests.get(f"{BASE_URL}/api/schedule", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        candidate = None
        for day in r.json()["days"].values():
            for s in day:
                if not editable:
                    return s["id"]
                # Check record_status by hitting detail
                d = requests.get(f"{BASE_URL}/api/sessions/{s['id']}", headers=teacher_h, timeout=15).json()
                if d.get("record_status") != "Verified":
                    return s["id"]
                candidate = s["id"]
        if candidate:
            return candidate
        pytest.skip("Teacher has no sessions in week")

    def _coord_other_session(self, coord_h, teacher_sid):
        r = requests.get(f"{BASE_URL}/api/schedule", headers=coord_h, timeout=15)
        for day in r.json()["days"].values():
            for s in day:
                if s["id"] != teacher_sid:
                    return s["id"]
        pytest.skip("No alternative session")

    def test_session_roster_count(self, teacher_h):
        sid = self._teacher_session(teacher_h)
        r = requests.get(f"{BASE_URL}/api/sessions/{sid}", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "roster" in d and "session" in d
        # Expect 8 students per batch (seed)
        assert len(d["roster"]) == 8, f"roster size={len(d['roster'])}"

    def test_session_403_for_other_teacher(self, teacher_h, coord_h):
        # Find a session that is NOT teacher Anjali's
        teacher_sid = TestSessions()._teacher_session(teacher_h)
        other_sid = TestSessions()._coord_other_session(coord_h, teacher_sid)
        # Check whether this other session belongs to Anjali
        rc = requests.get(f"{BASE_URL}/api/sessions/{other_sid}", headers=coord_h, timeout=15)
        assert rc.status_code == 200
        if rc.json()["session"].get("id") == teacher_sid:
            pytest.skip("other session not found")
        # Teacher attempting someone else's -> 403 or none
        rt = requests.get(f"{BASE_URL}/api/sessions/{other_sid}", headers=teacher_h, timeout=15)
        assert rt.status_code in (403, 404)
        if rt.status_code == 404:
            pytest.skip("Session not in teacher org - expected 403 ideally")

    def test_submit_requires_all_marked(self, teacher_h):
        sid = TestSessions()._teacher_session(teacher_h, editable=True)
        detail = requests.get(f"{BASE_URL}/api/sessions/{sid}", headers=teacher_h, timeout=15).json()
        roster = detail["roster"]
        # Clear by marking only 1 student
        one = [{"student_id": roster[0]["id"], "code": "P"}]
        requests.post(f"{BASE_URL}/api/sessions/{sid}/attendance",
                      headers=teacher_h, json={"marks": one, "notes": ""}, timeout=15)
        r = requests.post(f"{BASE_URL}/api/sessions/{sid}/submit", headers=teacher_h, timeout=15)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_mark_all_and_submit(self, teacher_h):
        sid = TestSessions()._teacher_session(teacher_h, editable=True)
        detail = requests.get(f"{BASE_URL}/api/sessions/{sid}", headers=teacher_h, timeout=15).json()
        roster = detail["roster"]
        marks = [{"student_id": s["id"], "code": "P"} for s in roster]
        r = requests.post(f"{BASE_URL}/api/sessions/{sid}/attendance",
                          headers=teacher_h, json={"marks": marks, "notes": "all present"}, timeout=15)
        assert r.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/sessions/{sid}/submit", headers=teacher_h, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["status"] == "Completed"


# ---------- Inbox / approvals ----------
class TestInbox:
    def test_teacher_inbox_own_only(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/inbox", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["can_decide"] is False
        assert isinstance(d["items"], list)

    def test_coord_inbox_can_decide(self, coord_h):
        r = requests.get(f"{BASE_URL}/api/inbox", headers=coord_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["can_decide"] is True

    def test_leave_validation(self, teacher_h):
        r = requests.post(f"{BASE_URL}/api/requests/leave", headers=teacher_h,
                          json={"leave_type": "Casual", "start_date": "2026-02-10",
                                "end_date": "2026-02-01", "reason": "test"}, timeout=15)
        assert r.status_code == 400

    def test_leave_create_and_decide_flow(self, teacher_h, coord_h):
        # Create a leave
        r = requests.post(f"{BASE_URL}/api/requests/leave", headers=teacher_h,
                          json={"leave_type": "Casual", "start_date": "2026-02-10",
                                "end_date": "2026-02-10", "reason": "TEST pytest leave"}, timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]

        # Teacher cannot decide
        rt = requests.post(f"{BASE_URL}/api/requests/{rid}/decision", headers=teacher_h,
                           json={"decision": "Approved"}, timeout=15)
        assert rt.status_code == 403

        # Reject without reason -> 400
        rr = requests.post(f"{BASE_URL}/api/requests/{rid}/decision", headers=coord_h,
                           json={"decision": "Rejected", "reason": ""}, timeout=15)
        assert rr.status_code == 400

        # Approve
        ra = requests.post(f"{BASE_URL}/api/requests/{rid}/decision", headers=coord_h,
                           json={"decision": "Approved"}, timeout=15)
        assert ra.status_code == 200
        assert ra.json()["status"] == "Approved"

        # Already decided -> 409
        r9 = requests.post(f"{BASE_URL}/api/requests/{rid}/decision", headers=coord_h,
                           json={"decision": "Approved"}, timeout=15)
        assert r9.status_code == 409

        # Notification created for requester (teacher)
        rn = requests.get(f"{BASE_URL}/api/notifications", headers=teacher_h, timeout=15)
        assert rn.status_code == 200
        titles = [n.get("title", "") for n in rn.json()["items"]]
        assert any("approved" in t.lower() for t in titles)


# ---------- Chat ----------
class TestChat:
    def test_list_conversations(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/conversations", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_message_not_member_404(self, teacher_h, coord_h):
        # Compose by teacher
        c = requests.post(f"{BASE_URL}/api/conversations", headers=teacher_h,
                          json={"to": "Suresh K", "subject": "TEST subj", "text": "hi"}, timeout=15)
        assert c.status_code == 200
        cid = c.json()["id"]
        # Coordinator is not member -> 404
        r = requests.get(f"{BASE_URL}/api/conversations/{cid}/messages", headers=coord_h, timeout=15)
        assert r.status_code == 404

    def test_send_message(self, teacher_h):
        c = requests.post(f"{BASE_URL}/api/conversations", headers=teacher_h,
                          json={"to": "Admin", "subject": "TEST send", "text": "hi"}, timeout=15)
        cid = c.json()["id"]
        r = requests.post(f"{BASE_URL}/api/conversations/{cid}/messages", headers=teacher_h,
                          json={"text": "second"}, timeout=15)
        assert r.status_code == 200
        rm = requests.get(f"{BASE_URL}/api/conversations/{cid}/messages", headers=teacher_h, timeout=15)
        assert rm.status_code == 200
        assert len(rm.json()["messages"]) >= 2


# ---------- Notifications ----------
class TestNotifications:
    def test_read_all(self, teacher_h):
        r = requests.post(f"{BASE_URL}/api/notifications/read-all", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        rr = requests.get(f"{BASE_URL}/api/notifications", headers=teacher_h, timeout=15)
        assert rr.status_code == 200
        assert rr.json()["unread"] == 0


# ---------- Pay ----------
class TestPay:
    def test_pay_list_teacher(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/pay", headers=teacher_h, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert isinstance(items, list)

    def test_pay_detail_self(self, teacher_h):
        r = requests.get(f"{BASE_URL}/api/pay", headers=teacher_h, timeout=15)
        items = r.json()["items"]
        if not items:
            pytest.skip("No payslips")
        pid = items[0]["id"]
        rd = requests.get(f"{BASE_URL}/api/pay/{pid}", headers=teacher_h, timeout=15)
        assert rd.status_code == 200

    def test_pay_detail_cross_teacher_forbidden(self, teacher_h, admin_h):
        # Admin can see all; pick a payslip not belonging to teacher
        ra = requests.get(f"{BASE_URL}/api/pay", headers=admin_h, timeout=15)
        rt = requests.get(f"{BASE_URL}/api/pay", headers=teacher_h, timeout=15)
        teacher_ids = {p["id"] for p in rt.json()["items"]}
        other = next((p for p in ra.json()["items"] if p["id"] not in teacher_ids), None)
        if not other:
            pytest.skip("No other teacher payslip")
        r = requests.get(f"{BASE_URL}/api/pay/{other['id']}", headers=teacher_h, timeout=15)
        assert r.status_code == 403
