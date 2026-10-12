# API Documentation

Base path: `/api/v1`. All responses use the standard envelope (`ApiResponse<T>` / `ApiError`) described in SRS section 42. Full interactive Swagger UI is available at `http://localhost:8080/swagger-ui.html`.

Status legend: ✅ Implemented and operational.

---

## Authentication (`/auth`) — ✅

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | /auth/register | none | `{name, email, password}` | Creates student account; sends verification email |
| GET | /auth/verify-email | none | `?token=` | Activates account |
| POST | /auth/login | none | `{email, password}` | Returns `{accessToken, refreshToken, expiresIn, user}` |
| POST | /auth/refresh | none | `{refreshToken}` | Rotates refresh token |
| POST | /auth/logout | none | `{refreshToken}` | Revokes refresh token |
| POST | /auth/forgot-password | none | `{email}` | Always 200, sends reset token |
| POST | /auth/reset-password | none | `{token, newPassword}` | Single-use token, resets password |

---

## Users (`/users`, `/admin/students`, `/admin/admins`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /users/me | Authenticated | Caller's own profile and summary |
| PUT | /users/me | Authenticated | Update name, profile image, or password |
| GET | /admin/students | ADMIN | Search/filter students with pagination (`?search=&status=`) |
| GET | /admin/students/{id} | ADMIN | Get student details, enrollment history, and progress |
| POST | /admin/students/{id}/disable | ADMIN | Soft-disables student login & active access |
| POST | /admin/students/{id}/enable | ADMIN | Re-enables student account |
| GET | /admin/admins | ADMIN | List all admin accounts |
| POST | /admin/admins | ADMIN | Create new admin (`{name, email, password}`) |

---

## Categories (`/categories`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /categories | Public | Paginated, supports `?search=` |
| GET | /categories/{id} | Public | Get single category |
| POST | /categories | ADMIN | Create category (`{name, description}`) |
| PUT | /categories/{id} | ADMIN | Edit category details |
| POST | /categories/{id}/archive | ADMIN | Archived categories rejected on course create/update |
| POST | /categories/{id}/unarchive | ADMIN | Restores archived category back to active status |

---

## Courses (`/courses`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /courses | Public | Published only, supports `?search=&categoryId=` |
| GET | /courses/admin/all | ADMIN | All courses across all statuses with pagination |
| GET | /courses/{id} | Public/ADMIN | Public sees published only; admin sees any status |
| GET | /courses/{id}/preview | ADMIN | Admin preview mode with full syllabus |
| POST | /courses | ADMIN | Creates new course draft |
| PUT | /courses/{id} | ADMIN | Edits course; bumps version if published |
| POST | /courses/{id}/publish | ADMIN | Publishes course (requires ≥ 1 section) |
| POST | /courses/{id}/unpublish | ADMIN | Reverts published course back to draft |
| POST | /courses/{id}/archive | ADMIN | Archives course; enrolled students retain access |
| POST | /courses/{id}/unarchive | ADMIN | Restores archived course back to draft status |
| POST | /courses/{id}/duplicate | ADMIN | Deep-copies course structure into new draft |

---

## Sections & Content (`/sections`, `/contents`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /courses/{courseId}/sections | ADMIN / Enrolled | Fetch all sections in course |
| POST | /courses/{courseId}/sections | ADMIN | Add section (`{title, description, orderIndex}`) |
| PUT | /sections/{id} | ADMIN | Update section title/description |
| DELETE | /sections/{id} | ADMIN | Soft-archives if contains content, hard-deletes if empty |
| POST | /courses/{courseId}/sections/reorder | ADMIN | Body `{orderedIds:[...]}` reorders sections |
| GET | /sections/{sectionId}/contents | ADMIN / Enrolled | Fetch contents in section |
| GET | /contents/{id} | ADMIN / Enrolled | Returns content; updates last-accessed for student |
| POST | /sections/{sectionId}/contents | ADMIN | Add content (`{title, contentType, mediaReference, ...}`) |
| PUT | /contents/{id} | ADMIN | Update content details |
| DELETE | /contents/{id} | ADMIN | Soft-archives content (never hard-deleted) |
| POST | /sections/{sectionId}/contents/reorder | ADMIN | Reorders contents within section |
| POST | /contents/{id}/resources | ADMIN | Adds downloadable/supplementary resource |

---

## Media Library (`/admin/media`, `/media/files`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /admin/media/upload | ADMIN | Multipart file upload (max 500MB, validates video/pdf/image) |
| GET | /admin/media | ADMIN | List uploaded assets (`?search=`, paginated) |
| GET | /admin/media/{id} | ADMIN | Fetch metadata for media asset |
| DELETE | /admin/media/{id} | ADMIN | Delete media file from disk and database |
| GET | /media/files/{id} | Public | Stream media content with range support & correct MIME headers |

---

## Enrollment & Admin Progress (`/courses/{id}/enroll`, `/my-courses`, `/admin/enrollments`, `/admin/progress`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /courses/{id}/enroll | STUDENT | Immediate enrollment; concurrency-safe duplicate prevention |
| GET | /my-courses | STUDENT | Paginated list of enrolled courses with completion stats |
| GET | /admin/enrollments | ADMIN | Search & filter all enrollments (`?search=&status=`) |
| GET | /admin/enrollments/by-course/{courseId} | ADMIN | All enrollments for a specific course |
| GET | /admin/enrollments/by-student/{studentId} | ADMIN | All enrollments for a specific student |
| GET | /admin/progress | ADMIN | Student course progress & completion monitoring (`?search=`) |

---

## Progress Engine (`/my-progress`, `/courses/{id}/progress`, `/contents/{id}/progress`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /my-progress | STUDENT | "Continue Learning" most recent content resume point |
| GET | /courses/{courseId}/progress | STUDENT | Aggregated course & section completion percentages |
| GET | /contents/{contentId}/progress | STUDENT | Current content watch time, percent, and completed flag |
| PUT | /contents/{contentId}/progress | STUDENT | Save video progress (`{videoPosition, progressPercent}`) |
| POST | /contents/{contentId}/complete | STUDENT | Mark non-video content as completed |

---

## Live Sessions & Recordings (`/admin/live-sessions`, `/live-sessions`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /admin/live-sessions | ADMIN | List all live sessions with course name & recordings |
| POST | /admin/live-sessions | ADMIN | Schedule live session (`{courseId, title, meetingLink, startTime, ...}`) |
| PUT | /admin/live-sessions/{id} | ADMIN | Update session details or mark completed/cancelled |
| DELETE | /admin/live-sessions/{id} | ADMIN | Cancel live session |
| POST | /admin/live-sessions/{id}/recordings | ADMIN | Attach recording URL to completed session |
| GET | /live-sessions | Authenticated | List upcoming live classes for student's enrolled courses |
| GET | /live-sessions/{id} | Authenticated | Get session details & attached playback recordings |

---

## Notifications (`/notifications`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /notifications | Authenticated | Paginated user notifications |
| GET | /notifications/unread-count | Authenticated | Live unread counter for navigation bell badge |
| PUT | /notifications/{id}/read | Authenticated | Mark individual notification as read |
| PUT | /notifications/read-all | Authenticated | Mark all notifications as read |

---

## Admin Dashboard & Audit Logs (`/admin/dashboard`, `/admin/audit-logs`) — ✅

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /admin/dashboard | ADMIN | Real-time platform KPIs (students, courses, enrollments, audit) |
| GET | /admin/audit-logs | ADMIN | Read-only audit trails (`?entityType=`, paginated) |
