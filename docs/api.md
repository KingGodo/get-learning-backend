# GetLeaning Backend API Documentation

Base URL: `http://localhost:4000/api/v1`

All successful responses follow:

```json
{
  "success": true,
  "data": {}
}
```

All error responses follow:

```json
{
  "success": false,
  "message": "Human readable error",
  "errors": [
    { "field": "email", "message": "Valid email is required" }
  ]
}
```

`errors` is included for validation failures (`422`).

---

## Authentication

Protected routes require:

```http
Authorization: Bearer <jwt_token>
```

JWT payload contains: `userId`, `role` (`TEACHER` | `STUDENT` | `ADMIN`), `schoolId` (may be `null` until a student joins a class).

### Seeded system admin

After running `npm run prisma:seed`:

| Field | Value |
|-------|-------|
| Email | `admin@getleaning.local` |
| Password | `Admin@12345` |
| Role | `ADMIN` |

Login with `POST /auth/login`. Credentials can be changed via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` before seeding.

The seed is idempotent (safe to re-run). It upserts the admin (including password refresh), ensures the admin has a school + teacher profile so `TEACHER | ADMIN` routes work, and upserts default subjects: MATH, ENG, SCI, GEO, HIST, ICT.

---

## 1. Health

### `GET /health`

Public. Checks API availability.

**Response `200`**

```json
{
  "success": true,
  "message": "GetLeaning API is running"
}
```

---

## 2. Auth

### `POST /auth/register/teacher`

Creates a school + teacher account and returns a JWT.

**Body (JSON)**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| firstName | string | yes | |
| middleName | string | no | |
| lastName | string | yes | |
| email | string | yes | unique |
| phoneNumber | string | yes | min 7 |
| password | string | yes | min 8 |
| gender | enum | yes | `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY` |
| dateOfBirth | ISO datetime | no | e.g. `2000-01-15T00:00:00.000Z` |
| schoolName | string | yes | |
| schoolEmail | string | yes | |
| schoolPhone | string | yes | |
| schoolAddress | string | yes | |
| schoolCity | string | yes | |
| schoolProvince | string | yes | |
| schoolWebsite | url | no | |
| qualification | string | no | |
| department | string | no | |
| bio | string | no | |

**Response `201`**

Returns `token`, `user`, `teacher`, `school`.

---

### `POST /auth/register/student`

Creates a student account and returns a JWT. School is assigned later when the student joins a class.

**Body (JSON)**

| Field | Type | Required |
|-------|------|----------|
| firstName | string | yes |
| middleName | string | no |
| lastName | string | yes |
| email | string | yes |
| phoneNumber | string | yes |
| password | string | yes |
| gender | enum | yes |
| dateOfBirth | ISO datetime | no |
| guardianName | string | yes |
| guardianPhone | string | yes |
| guardianEmail | string | no |
| emergencyContact | string | no |

**Response `201`**

Returns `token`, `user`, `student`.

---

### `POST /auth/login`

**Body**

```json
{
  "email": "jane.teacher@example.com",
  "password": "password123"
}
```

**Response `200`**

Returns `token` and `user` (includes `teacher` / `student` / `school` when present).

---

### `GET /auth/me`

Auth required.

Returns the current user profile with role-specific relations.

---

## 3. Schools

### `GET /schools/code/:code`

Public. Lookup school by code (e.g. `SCH-MJD433`).

### `GET /schools/me`

Auth: `TEACHER` | `ADMIN`

Returns the authenticated user's school.

### `PATCH /schools/me`

Auth: `TEACHER` | `ADMIN`

**Body** (at least one field)

| Field | Type |
|-------|------|
| name | string |
| email | string |
| phoneNumber | string |
| website | url \| null |
| address | string |
| city | string |
| province | string |
| country | string |
| logo | url \| null |

---

## 4. Subjects

All subject routes require authentication.

### `GET /subjects`

List all subjects (global catalog).

### `GET /subjects/:id`

Get one subject.

### `POST /subjects`

Auth: `TEACHER` | `ADMIN`

```json
{
  "name": "Mathematics",
  "code": "MATH",
  "description": "Core maths"
}
```

`code` is normalized to uppercase.

### `PATCH /subjects/:id`

Auth: `TEACHER` | `ADMIN`

Partial update. At least one field required.

### `DELETE /subjects/:id`

Auth: `TEACHER` | `ADMIN`

Fails if the subject is used by any class.

---

## 5. Classes

All class routes require authentication.

### `GET /classes`

- Teacher: classes they teach  
- Student: classes they joined  

### `POST /classes`

Auth: `TEACHER` | `ADMIN`

```json
{
  "subjectId": "cuid...",
  "name": "Form 3A Mathematics",
  "description": "Optional",
  "academicYear": 2026,
  "semester": 1
}
```

Creates class + assigns teacher as `PRIMARY`. Returns a unique `classCode`.

### `POST /classes/join`

Auth: `STUDENT`

```json
{
  "classCode": "K3RKRBYC"
}
```

Also sets the student's `schoolId` from the class school if missing.

**Response `200`**

Returns `enrollment` and a fresh `token` (JWT is re-issued so `schoolId` stays in sync).

### `GET /classes/:id`

Auth required. Must be teacher of the class or enrolled student.

Includes teachers, active students, subject.

### `PATCH /classes/:id`

Auth: `TEACHER` | `ADMIN` (must own class)

Updatable: `name`, `description`, `academicYear`, `semester`, `status` (`ACTIVE` \| `ARCHIVED`), `subjectId`.

### `DELETE /classes/:id`

Auth: `TEACHER` | `ADMIN` (must own class)

---

## 6. Assignments

All assignment routes require authentication.

File uploads use `multipart/form-data`. Allowed types: PDF, DOC, DOCX (max 10MB). Field name: `attachment`.

### `GET /assignments`

Query (optional):

| Param | Type | Notes |
|-------|------|-------|
| classId | string | filter by class |

- Teacher: their assignments  
- Student: published/closed assignments for enrolled classes (includes own submission summary)

### `POST /assignments`

Auth: `TEACHER` | `ADMIN`

`multipart/form-data` or JSON.

| Field | Type | Required |
|-------|------|----------|
| classId | string | yes |
| title | string | yes |
| description | string | yes |
| instructions | string | no |
| dueDate | ISO datetime | yes |
| totalMarks | number | yes |
| allowLateSubmission | boolean | no (default `false`) |
| status | enum | no (`DRAFT`, `PUBLISHED`, `CLOSED`; default `DRAFT`) |
| attachment | file | no |

### `GET /assignments/:id`

Teachers see all submissions. Students cannot view drafts.

### `PATCH /assignments/:id`

Auth: `TEACHER` | `ADMIN` (owner)

Supports optional new `attachment` file (attachment-only updates are allowed).

### `DELETE /assignments/:id`

Auth: `TEACHER` | `ADMIN` (owner)

---

## 7. Submissions

All submission routes require authentication.

### `GET /submissions`

Query (optional):

| Param | Type |
|-------|------|
| assignmentId | string |

- Teacher: submissions for their assignments  
- Student: their own submissions  

### `POST /submissions`

Auth: `STUDENT`

`multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| assignmentId | string | yes |
| attachment | file (PDF/DOC/DOCX) | yes |

Rules:
- Assignment must be `PUBLISHED`
- Student must be enrolled
- Late submissions only if `allowLateSubmission` is true
- Replacing an existing submission is allowed before due date (or late if allowed)
- Status set to `SUBMITTED` or `LATE`

If Supabase is configured, files are uploaded to the storage bucket and a public URL is returned.

If Supabase is **not** configured, files are saved under the local `uploads/` directory and served at `/uploads/...` (set `PUBLIC_APP_URL` for absolute URLs, e.g. `http://localhost:4000/uploads/...`).

### `GET /submissions/:id`

Auth required. Teacher (assignment owner) or submitting student only.

### `PATCH /submissions/:id/grade`

Auth: `TEACHER` | `ADMIN` (assignment owner)

**Body (JSON)**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| score | integer | yes | `0` … assignment `totalMarks` |
| feedback | string | no | max 5000 chars |

Sets status to `GRADED`, records `gradedById` and `gradedAt`.

**Response `200`**

Returns the graded submission with assignment, student, and grader info.

---

## 8. Dashboard

### `GET /dashboard`

Auth required.

**Admin response (system owner)**

| Field | Description |
|-------|-------------|
| totalSchools | All schools on the platform |
| totalTeachers | All teacher profiles |
| totalStudents | All student profiles |
| totalClasses | Active classes |
| totalSubjects | Subject catalog size |
| totalAssignments | All assignments |
| pendingGrading | Submissions awaiting grade (`SUBMITTED` / `LATE`) |
| schools | All schools on the platform (with user/class counts) |
| recentTeachers | Latest 5 teachers |
| recentSubmissions | Latest 5 submissions across the platform |
| upcomingDeadlines | Next 5 published due dates |

**Teacher response**

| Field | Description |
|-------|-------------|
| totalClasses | Count of classes taught |
| totalAssignments | Count of assignments created |
| recentSubmissions | Latest 5 submissions |
| upcomingDeadlines | Next 5 published upcoming due dates |

**Student response**

| Field | Description |
|-------|-------------|
| joinedClasses | Count of active enrollments |
| activeAssignments | Count of published assignments |
| upcomingDeadlines | Next 5 due dates |
| recentSubmissions | Latest 5 of their submissions |

---

## Validation summary

Request validation is done with **Zod** in each module (`*.schema.ts`) via the `validate` middleware.

Validated layers:
- **body** — create/update/login/register/join/submit payloads
- **params** — `:id`, `:code`
- **query** — `classId`, `assignmentId`

Invalid input returns `422` with field-level `errors`.

---

## Common HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Business rule violation |
| 401 | Missing/invalid token |
| 403 | Authenticated but not allowed |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already registered) |
| 422 | Validation failed |
| 500 | Server error |

---

## Example flow (MVP)

1. Teacher registers → gets token + school  
2. Teacher creates subject  
3. Teacher creates class → share `classCode`  
4. Student registers → gets token  
5. Student joins class with `classCode`  
6. Teacher creates/publishes assignment  
7. Student submits PDF/DOCX  
8. Teacher grades submission via `PATCH /submissions/:id/grade`  
9. Teacher lists submissions / opens attachment URL  
10. Both call `/dashboard` for overview stats  

---

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PUBLIC_APP_URL` | Absolute API origin for local file URLs (optional) |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `SEED_ADMIN_EMAIL` | Seed admin email (default `admin@getleaning.local`) |
| `SEED_ADMIN_PASSWORD` | Seed admin password (default `Admin@12345`) |
| `SUPABASE_URL` | Storage project URL (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage service key (optional) |
| `SUPABASE_STORAGE_BUCKET` | Bucket name (default `lms-files`) |

Copy `.env.example` to `.env` and fill in values.
