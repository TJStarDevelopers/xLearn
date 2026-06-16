# security_spec.md

## 1. Data Invariants
- **User profiles:** A user profile at `users/{userId}` can only be created or modified by the user with matching UID (`request.auth.uid == userId`). The email can be any length but is capped at 128 characters.
- **Plans:** A plan at `plans/{planId}` is exclusively owned by the creator (`userId`). Every plan's `userId` must strictly match the creator's logged-in `request.auth.uid`. A plan can only be deleted, get, list under the same ownership.
- **Sessions:** Sessions are sub-resources nested under `plans/{planId}/sessions/{sessionId}`. Only the authenticated owner of the parent plan can read, list, create, or update sessions. Non-owners are completely locked out.
- **Diagnostics/Analytics:** Cached AI coaching diagnostics at `users/{userId}/analytics/{analyticsId}` are private. Access is limited to the account owner (`userId`). No external reading or editing is permitted.
- **Strict Timestamps & Formats:** All primary timestamps must use `request.time`. All IDs must adhere to standard alphanumeric and dash/underscore characters (`isValidId()`).

---

## 2. The "Dirty Dozen" Malicious Payloads

### Payload 1: Identity Spoofing (Save User Profile under another UID)
- **Path:** `users/victim_user_123`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE / UPDATE`
- **Payload:**
  ```json
  {
    "uid": "victim_user_123",
    "email": "victim@gmail.com",
    "displayName": "Victim User"
  }
  ```
- **Reason to fail:** Blocked because `userId` ("victim_user_123") !== `request.auth.uid` ("attacker_uid").

### Payload 2: Plan Ownership Hijack (Create plan for someone else)
- **Path:** `plans/plan_attacker_456`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE`
- **Payload:**
  ```json
  {
    "id": "plan_attacker_456",
    "userId": "victim_uid",
    "topic": "Victim Topic Learn",
    "timeframe": "1 week",
    "type": "skill",
    "completed": false,
    "currentSessionNumber": 1,
    "totalSessions": 5,
    "createdAt": "2026-06-16T12:00:00Z"
  }
  ```
- **Reason to fail:** Blocked because the payload lists `userId: "victim_uid"`, whereas `request.auth.uid` is `"attacker_uid"`. Both must align.

### Payload 3: Shadow Keys Attack (Injecting extra system override fields on Plan creation)
- **Path:** `plans/plan_spoof_789`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE`
- **Payload:**
  ```json
  {
    "id": "plan_spoof_789",
    "userId": "attacker_uid",
    "topic": "Topic Learn",
    "timeframe": "1 week",
    "type": "skill",
    "completed": true,
    "currentSessionNumber": 100,
    "totalSessions": 5,
    "createdAt": "2026-06-16T12:00:00Z",
    "isSystemAdminOverridePrivilege": true
  }
  ```
- **Reason to fail:** Exact map key checks (`data.keys().size()` constraint) will prevent the injection of unexpected "Shadow Keys" on creation.

### Payload 4: Invalid Plan Type Injection
- **Path:** `plans/plan_invalid_type`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE`
- **Payload:**
  ```json
  {
    "id": "plan_invalid_type",
    "userId": "attacker_uid",
    "topic": "Hacker Lesson",
    "timeframe": "1 week",
    "type": "malicious_type_unallowed",
    "completed": false,
    "currentSessionNumber": 1,
    "totalSessions": 5,
    "createdAt": "2026-06-16T12:00:00Z"
  }
  ```
- **Reason to fail:** Restricted plan type list (`['skill', 'academic', 'hobby', 'curiosity']`) rejects random values.

### Payload 5: Session Injection under Victim Plan (Master Gate failure)
- **Path:** `plans/victim_plan_999/sessions/attacker_sub_session_321`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE`
- **Payload:**
  ```json
  {
    "id": "attacker_sub_session_321",
    "planId": "victim_plan_999",
    "title": "Malicious Sub Session",
    "order": 1,
    "status": "unlocked"
  }
  ```
- **Reason to fail:** The Master Gate fetch `get(/databases/$(database)/documents/plans/$(planId))` will confirm the victim plan's `userId` matches "attacker_uid". Since it does not, access is denied.

### Payload 6: Unlocked Skipping (Shortcut Status Validation during session completion)
- **Path:** `plans/my_plan_777/sessions/session_locked_nodes`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `UPDATE`
- **Payload:**
  ```json
  {
    "status": "completed",
    "summary": "Skip",
    "notes": "Skip all study"
  }
  ```
- **Reason to fail:** State update is restricted by allowed operations blocks.

### Payload 7: Denial of Wallet (Poisonous ID Injection)
- **Path:** `plans/plan_very_large_junk_id_greater_than_128_chars_aaaaaaaaaaaaaaaa`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE`
- **Payload:** (standard structure)
- **Reason to fail:** Guarded by `isValidId(planId)` which caps ID limits and validates naming regex.

### Payload 8: Immutable Field Tampering (Alter the plan owner or createdAt time after creation)
- **Path:** `plans/my_plan`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `UPDATE`
- **Payload:**
  ```json
  {
    "userId": "victim_uid"
  }
  ```
- **Reason to fail:** Blocked because the immutable validation ensures `incoming().userId == existing().userId`.

### Payload 9: PII Blanket Read (Scan other users' profiles via generic lists)
- **Path:** `users` query
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `LIST`
- **Payload:** query other users' emails/displayNames
- **Reason to fail:** Access to user profiles is strictly restricted to owned paths (`isOwner(userId)`). No list queries are permitted on the core `/users` collection at all.

### Payload 10: Unauthorized Analytics Write
- **Path:** `users/victim_user/analytics/data`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE / UPDATE`
- **Payload:**
  ```json
  {
    "totalPlans": 1,
    "completedPlans": 1,
    "totalQuizzesTaken": 100,
    "averageQuizScore": 100,
    "strengths": ["Spoofed Strengths"]
  }
  ```
- **Reason to fail:** Blocked because `isOwner(userId)` fails on "victim_user" path.

### Payload 11: Spoofed Score Insertion on Quiz Completion
- **Path:** `plans/my_plan/sessions/my_session`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `UPDATE`
- **Payload:**
  ```json
  {
    "quizScore": 999999,
    "quizCompleted": true
  }
  ```
- **Reason to fail:** Rejected by `isValidSession()` which enforces that if `quizScore` is present, it must fit coordinate boundaries (e.g., `quizScore >= 0 && quizScore <= 5`).

### Payload 12: Orphaned Session creation with invalid parent
- **Path:** `plans/non_existent_plan_888/sessions/my_session`
- **User Auth:** `request.auth.uid = "attacker_uid"`
- **Operation:** `CREATE`
- **Payload:** (valid session structure)
- **Reason to fail:** The Master Gate rule fetches `/plans/non_existent_plan_888` using `get()`. Since the plan does not exist, the `get()` call evaluates to null / fails, rejecting the write.

---

## 3. Test Runner Overview (Pseudocode structure)
Tests are structured as follows:
```typescript
import { assertFails, assertSucceeds, initializeTestApp } from "@firebase/rules-unit-testing";

// Suite 1: Identity integrity
it("blocks attacker from writing victim user profile", async () => { ... });

// Suite 2: Plans ownership
it("blocks attacker from creating plans for someone else", async () => { ... });

// Suite 3: Sessions ownership
it("blocks attacker from inserting sessions under someone else's plan", async () => { ... });
```
