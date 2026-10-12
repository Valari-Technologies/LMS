# One Tutor LMS

A complete, production-ready, standalone Learning Management System built as a modular monolith: Spring Boot 3 + PostgreSQL 16+ on the backend, and modern React (Vite) on the frontend.

Every phase defined in the Software Requirements Specification (SRS) and Technical Requirements Document (TRD) is **fully implemented and operational end-to-end**.

---

## 🌟 Key Features

- **Authentication & Security** (Phase 2):
  - Student registration with email verification token lifecycle.
  - JWT Access Tokens (stateless) with rotating, revocable Refresh Tokens.
  - Secure BCrypt password hashing, session revocation on password reset, and role-based access control (`STUDENT`, `ADMIN`).
- **User & Admin Management** (Phase 3):
  - User self-profile update & password change (`/student/profile`).
  - Admin management of students: search, filter by status, view enrollment history & progress, disable/enable accounts (`/admin/students`).
  - Admin account provisioning (`/admin/admins`).
- **Categories & Course Lifecycle** (Phases 4–5):
  - Hierarchical course management: draft, published, and archived states.
  - Automatic version bumping upon modification of published courses.
  - Deep-copy course duplication (sections, contents, and resources).
  - Admin course preview mode (`/admin/courses/:id/preview`).
- **Curriculum & Content Delivery** (Phases 6–7):
  - Modular sections with drag-and-drop or sequential reordering.
  - Multi-format content: video, PDF, document, quiz, external link.
  - Content and sections gated strictly by active enrollment ownership.
  - Downloadable and supplementary resource attachments.
- **Centralized Media Library** (Phase 8):
  - Native file upload with size limits (up to 500MB) and MIME-type validation.
  - Local disk storage with UUID isolation and metadata tracking in PostgreSQL.
  - Direct media streaming endpoint (`/api/v1/media/files/{id}`) supporting range requests.
  - Integrated media picker inside the course section content manager (`/admin/media`).
- **Real-Time Concurrency-Safe Enrollment** (Phase 9):
  - Instant self-enrollment into published courses.
  - Guaranteed duplicate prevention via PostgreSQL partial unique index + transactional application checks.
  - Admin enrollment monitoring table with search and status filtering (`/admin/enrollments`).
- **Intelligent Video Playback & Progress Engine** (Phases 10–11):
  - Debounced video position and percentage persistence (every 10s).
  - Automatic resume-from-last-watched position across devices and browser sessions.
  - 80% completion rule automatically marks content as completed.
  - Explicit manual completion toggle for non-video content (PDFs/articles).
  - Course-level completion percentage dynamically aggregated at read-time.
  - "Continue Learning" banner on the student dashboard.
  - Admin student progress monitoring dashboard (`/admin/progress`).
- **Live Classes & Session Recordings** (Phase 13):
  - Admin scheduling of live sessions with direct meeting links (Zoom, Google Meet, Teams).
  - Ability to attach playback recordings and downloadable assets to completed sessions.
  - Student live classes schedule view with direct "Join Meeting" links and recording replay (`/student/live-classes`).
- **In-App Notification Center** (Phase 14):
  - Real-time notification badge counter and dropdown in the top navigation bar.
  - Dedicated notifications page with mark as read / mark all as read (`/student/notifications`).
  - Auto-dispatch of notifications upon course enrollment and live class updates.
- **Auditing & Admin Analytics** (Phase 15):
  - Comprehensive immutable audit trail for all admin operations (`/admin/audit-logs`).
  - High-level platform KPIs dashboard with quick-action shortcuts (`/admin/dashboard`).

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Java 21 LTS, Spring Boot 3.3.4, Spring Security 6 (JWT + BCrypt), Spring Data JPA, Hibernate 6 |
| **Database** | PostgreSQL 16+ (tested on PostgreSQL 18.6), Flyway Database Migrations |
| **Frontend** | React 18, Vite 5, React Router 6, Axios, Lucide React Icons |
| **Styling** | Modern Responsive Vanilla CSS Design System with Glassmorphism, Dark Mode accents, and Flex/Grid layouts |
| **API Docs** | Swagger UI / OpenAPI 3 |

---

## 🚀 How to Run the Application

### 1. Prerequisites
- **Java 21 LTS** (JDK)
- **Node.js 18+** & npm
- **PostgreSQL 16+** (native service running on `localhost:5432` or via Docker)
- **Maven** (optional, wrapper/command line `mvn`)

### 2. Database Setup
Create the PostgreSQL database and user:
```sql
CREATE USER onetutor WITH PASSWORD 'onetutor_dev_password';
CREATE DATABASE onetutor OWNER onetutor;
GRANT ALL PRIVILEGES ON DATABASE onetutor TO onetutor;
```
*(Flyway automatically applies all schema migrations on application startup.)*

### 3. Start the Backend
```bash
cd backend
mvn spring-boot:run
```
The backend will boot up at **`http://localhost:8080`**.
- Swagger UI Documentation: `http://localhost:8080/swagger-ui.html`
- Health Check: `http://localhost:8080/actuator/health`

### 4. Start the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start at **`http://localhost:5173`**.

---

## 🔑 Default Credentials (Development)

| Role | Email | Password |
|---|---|---|
| **System Admin** | `admin@onetutor.local` | `Admin@12345` |
| **Student** | Register via `http://localhost:5173/register` *(email verification link prints directly to backend console log in dev)* | Chosen during registration |

---

## 📁 Repository Structure

```
onetutor/
├── backend/
│   ├── src/main/java/com/onetutor/
│   │   ├── admin/          # Admin controllers (Dashboard, Users, Enrollments, Progress, Live)
│   │   ├── audit/          # Audit logging entity, repository, service & controller
│   │   ├── auth/           # JWT auth, tokens, security filters & auth controller
│   │   ├── categories/     # Category management
│   │   ├── common/         # Envelope DTOs, exceptions, email service
│   │   ├── config/         # SecurityConfig, DataSeeder, WebMvcConfig
│   │   ├── courses/        # Course entity, lifecycle, duplication & catalog
│   │   ├── enrollment/     # Enrollment entity, concurrency checks & service
│   │   ├── live/           # Live sessions & recordings module
│   │   ├── media/          # LocalStorageService, MediaAsset & streaming controller
│   │   ├── notifications/  # Notification entity, repository, service & controller
│   │   ├── progress/       # Progress tracking, 80% rule & resume engine
│   │   ├── sections/       # Section & content hierarchical management
│   │   └── users/          # User entity, repository, service & profile controller
│   └── src/main/resources/
│       ├── db/migration/   # Flyway V1, V2, V3 migrations
│       └── application.yml # Unified configuration
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API clients for every domain
│   │   ├── app/            # App.jsx, router configuration & routes
│   │   ├── auth/           # AuthContext, TokenStorage, route guards
│   │   ├── components/     # AppLayout, Navbar, ConfirmModal, SectionManager
│   │   ├── pages/          # Admin, Student, and Public views
│   │   └── styles/         # Modern design tokens & global CSS
├── docs/
│   ├── api.md              # Complete REST endpoint specifications
│   ├── requirements-traceability.md # 100% completed requirements matrix
│   └── TRD.md              # Technical Requirements & Architecture Document
└── README.md
```
