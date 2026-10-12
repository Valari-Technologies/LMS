# Requirements Traceability

Format: Requirement ID | Feature | Backend | Frontend | DB | API | Status

## AUTH — ✅ All Implemented

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| AUT-001 | User registration with email verification | `AuthService.register` / `verifyEmail` | `RegisterPage`, `VerifyEmailPage` | users, email_verification_tokens | POST /auth/register, GET /auth/verify-email | ✅ Implemented |
| AUT-002 | Email/password login with JWT access + refresh token | `AuthService.login` | `LoginPage`, `AuthContext` | users, refresh_tokens | POST /auth/login | ✅ Implemented |
| AUT-003 | Token refresh & token rotation | `AuthService.refresh` | `client.js` axios interceptor | refresh_tokens | POST /auth/refresh | ✅ Implemented |
| AUT-004 | Logout with token invalidation | `AuthService.logout` | `AuthContext.logout`, Navbar | refresh_tokens | POST /auth/logout | ✅ Implemented |
| AUT-005 | Password reset flow | `AuthService.forgotPassword`, `resetPassword` | `ForgotPasswordPage`, `ResetPasswordPage` | password_reset_tokens | POST /auth/forgot-password, /auth/reset-password | ✅ Implemented |

## USERS

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| USR-001 | Get & update own profile / password | `UserService.updateProfile` | `StudentProfilePage`, `AuthContext` | users | GET /users/me, PUT /users/me | ✅ Implemented |
| USR-002 | Admin: list/search/disable/enable students | `AdminUserController`, `UserService` | `AdminStudentsPage` | users | GET /admin/students, POST /admin/students/{id}/disable\|enable | ✅ Implemented |
| USR-003 | Admin: create/list admins | `AdminUserController`, `UserService` | `AdminAdminsPage` | users | GET /admin/admins, POST /admin/admins | ✅ Implemented |

## CATEGORIES

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| CAT-001 | Create/edit/archive/list/search category | `CategoryService`/`CategoryController` | `AdminCategoriesPage` | categories | /categories* | ✅ Implemented |
| CAT-002 | Archived category unselectable for courses | `CategoryService.assertSelectable` | course form surfaces 400 | categories, courses | enforced in POST/PUT /courses | ✅ Implemented |

## COURSES

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| CRS-001 | Create course (draft) | `CourseService.create` | `AdminCourseFormPage` | courses | POST /courses | ✅ Implemented |
| CRS-002 | Edit course, version bump if published | `CourseService.update` | `AdminCourseFormPage` | courses | PUT /courses/{id} | ✅ Implemented |
| CRS-003 | Publish / unpublish / archive | `CourseService.publish/unpublish/archive` | `AdminCoursesPage` action buttons | courses | POST /courses/{id}/publish\|unpublish\|archive | ✅ Implemented |
| CRS-004 | Duplicate course (deep copy, new draft) | `CourseService.duplicate` | `AdminCoursesPage` "Duplicate" button | courses, sections, contents, resources | POST /courses/{id}/duplicate | ✅ Implemented |
| CRS-005 | Preview (any status, admin only) | `CourseService.preview` | `AdminCoursePreviewPage` | courses | GET /courses/{id}/preview | ✅ Implemented |
| CRS-006 | Public catalog: browse/search/filter published courses | `CourseRepository.findPublished*` | `CourseCatalogPage` | courses | GET /courses | ✅ Implemented |
| CRS-007 | Course details (pre-enrollment) | `CourseService.getDetail` | `CourseDetailsPage` | courses | GET /courses/{id} | ✅ Implemented |
| CRS-008 | Admin course listing (all statuses) | `CourseService.adminList` | `AdminCoursesPage` | courses | GET /courses/admin/all | ✅ Implemented |

## SECTIONS / CONTENT / RESOURCES

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| SEC-001 | CRUD + reorder sections | `SectionService`/`SectionController` | `AdminSectionManager` | sections | /sections*, /courses/{id}/sections* | ✅ Implemented |
| SEC-002 | Section access gated by enrollment | `SectionController.assertCanView` | `LearningPage` | enrollments | enforced on GET | ✅ Implemented |
| CNT-001 | CRUD + reorder content, archive-not-delete | `ContentService`/`ContentController` | `AdminSectionManager` | contents | /contents*, /sections/{id}/contents* | ✅ Implemented |
| CNT-002 | Content access gated by enrollment | `ContentController.assertCanView` | `LearningPage` | enrollments | enforced on GET | ✅ Implemented |
| CNT-003 | Resources on content & media library picker | `ContentService.addResource` | `AdminSectionManager`, `LearningPage` | resources | POST /contents/{id}/resources | ✅ Implemented |

## MEDIA

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| MED-001 | Storage abstraction (validate/upload/stream/delete) | `LocalStorageService`, `MediaService` | `AdminMediaPage` | media_assets | GET /media/files/{id} | ✅ Implemented |
| MED-002 | Media library UI + upload & copy URL endpoint | `MediaController` | `AdminMediaPage`, `AdminSectionManager` | media_assets | POST /admin/media/upload, GET/DELETE /admin/media | ✅ Implemented |

## ENROLLMENT

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| ENR-001 | Self-enroll, immediate full access | `EnrollmentService.enroll` | `CourseDetailsPage` | enrollments | POST /courses/{id}/enroll | ✅ Implemented |
| ENR-002 | Prevent duplicate active enrollment (incl. concurrent) | DB partial unique index + `DataIntegrityViolationException` | `CourseDetailsPage` button state | enrollments | same endpoint | ✅ Implemented |
| ENR-003 | My Courses | `EnrollmentService.myCourses` | `MyCoursesPage` | enrollments | GET /my-courses | ✅ Implemented |
| ENR-004 | Admin: view enrollments & progress monitoring | `AdminEnrollmentController`, `AdminProgressController` | `AdminEnrollmentsPage`, `AdminProgressPage` | enrollments, progress | GET /admin/enrollments, GET /admin/progress | ✅ Implemented |
| ENR-005 | Enrollment history preserved (never hard-deleted) | No delete path exposed | Admin history tables | enrollments | — | ✅ Implemented |

## PROGRESS

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| PRG-001 | Persist video position + percent, debounced | `ProgressService.updateProgress` | `LearningPage` (10s debounce, resume via `onLoadedMetadata`) | progress | PUT /contents/{id}/progress | ✅ Implemented |
| PRG-002 | 80% completion rule | `ProgressService.applyCompletionRule` | reflected via `completed` badge | progress | same endpoint | ✅ Implemented |
| PRG-003 | Explicit completion for non-video content | `ProgressService.markComplete` | "Mark as complete" button | progress | POST /contents/{id}/complete | ✅ Implemented |
| PRG-004 | Course/section progress, derived not stored | `ProgressService.getCourseProgress` | `LearningPage` sidebar bar, `MyCoursesPage` | progress | GET /courses/{id}/progress | ✅ Implemented |
| PRG-005 | Continue Learning | `ProgressService.continueLearning` | `StudentDashboard` | progress | GET /my-progress | ✅ Implemented |
| PRG-006 | Progress survives refresh/logout/login/device change | Server-side PostgreSQL persistence | Cross-device verified | progress | — | ✅ Implemented |

## LIVE SESSIONS & RECORDINGS

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| LIVE-001 | Admin: schedule & manage live classes | `LiveSessionService`, `AdminLiveSessionController` | `AdminLiveSessionsPage` | live_sessions | POST/PUT/DELETE /admin/live-sessions* | ✅ Implemented |
| LIVE-002 | Admin: attach recordings to sessions | `LiveSessionService.attachRecording` | `AdminLiveSessionsPage` recording modal | session_recordings | POST /admin/live-sessions/{id}/recordings | ✅ Implemented |
| LIVE-003 | Student: view upcoming live classes & join meeting | `LiveSessionController.listUpcoming` | `StudentLiveClassesPage`, `StudentDashboard` | live_sessions | GET /live-sessions | ✅ Implemented |
| LIVE-004 | Student: access session recordings | `LiveSessionController.get` | `StudentLiveClassesPage` playback | session_recordings | GET /live-sessions/{id} | ✅ Implemented |

## NOTIFICATIONS

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| NOT-001 | System notification dispatch on enrollment & live sessions | `NotificationService.sendNotification` | Triggered automatically on events | notifications | Internal service call | ✅ Implemented |
| NOT-002 | Student: view notifications & unread badge count | `NotificationController` | `Navbar` bell icon + dropdown, `StudentNotificationsPage` | notifications | GET /notifications, /unread-count | ✅ Implemented |
| NOT-003 | Student: mark notification as read / mark all as read | `NotificationController.markAsRead / markAllAsRead` | `StudentNotificationsPage` & dropdown | notifications | PUT /notifications/{id}/read, /read-all | ✅ Implemented |

## AUDIT LOGGING & DASHBOARD

| ID | Feature | Backend | Frontend | DB | API | Status |
|---|---|---|---|---|---|---|
| AUD-001 | Structured audit logging for admin actions | `AuditService.log` | Automatic backend interception | audit_logs | — | ✅ Implemented |
| AUD-002 | Admin: audit log viewer with entity type filter | `AuditLogController` | `AdminAuditLogsPage` | audit_logs | GET /admin/audit-logs | ✅ Implemented |
| DSH-001 | Admin: Dashboard platform KPIs & quick action portal | `AdminDashboardController` | `AdminDashboard` | users, courses, enrollments, audit_logs | GET /admin/dashboard | ✅ Implemented |

---

## Summary of Completed Scope
All 17 SRS phases are **100% complete**:
1. Standalone modular monolith architecture in Spring Boot 3 + PostgreSQL.
2. Complete JWT Authentication with refresh rotation, email verification, and BCrypt password encryption.
3. User & Admin Management with student disable/enable, student detail drawer, and admin creation.
4. Category & Course Management with full lifecycle, version bump on publish, duplication, and admin preview mode.
5. Section & Content hierarchy with reordering, gating by active enrollment, and media attachments.
6. Centralized Media Library with drag-and-drop file upload, size/type validation, disk storage, and direct streaming endpoint.
7. Real-Time Concurrency-Safe Enrollment with PostgreSQL partial unique constraints.
8. Learning Progress Engine with video timestamp resumption, 80% completion rule, derived aggregation, and Continue Learning resume.
9. Live Classes & Session Recordings with admin scheduling and student join/watch capabilities.
10. In-App Notification System with bell icon badge, dropdown, and dedicated notifications page.
11. Admin Audit Trail with filtering and real-time dashboard analytics.
12. Responsive, glassmorphism UI with modern design system and zero compiler or lint errors.
