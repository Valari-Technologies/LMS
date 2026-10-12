import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ProtectedRoute, AdminRoute, GuestOnlyRoute } from '../routes/guards';
import AdminLayout from '../components/AdminLayout';
import StudentLayout from '../components/StudentLayout';
import FcmNotificationManager from '../components/FcmNotificationManager';

// Auth Pages (kept for specific flows only)
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// Student Pages
import StudentDashboard from '../pages/student/StudentDashboard';
import CourseCatalogPage from '../pages/student/CourseCatalogPage';
import CourseDetailsPage from '../pages/student/CourseDetailsPage';
import MyCoursesPage from '../pages/student/MyCoursesPage';
import LearningPage from '../pages/student/LearningPage';
import StudentLiveClassesPage from '../pages/student/StudentLiveClassesPage';
import StudentNotificationsPage from '../pages/student/StudentNotificationsPage';
import StudentProfilePage from '../pages/student/StudentProfilePage';
import StudentCommunityPage from '../pages/student/StudentCommunityPage';
import AboutPage from '../pages/AboutPage';
import CareersPage from '../pages/CareersPage';
import ContactPage from '../pages/ContactPage';
import BlogPage from '../pages/BlogPage';
import TeachPage from '../pages/TeachPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import TermsPage from '../pages/TermsPage';
import HelpCenterPage from '../pages/HelpCenterPage';
import SystemStatusPage from '../pages/SystemStatusPage';

// Admin Pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminCoursesPage from '../pages/admin/AdminCoursesPage';
import AdminCourseFormPage from '../pages/admin/AdminCourseFormPage';
import AdminCoursePreviewPage from '../pages/admin/AdminCoursePreviewPage';
import AdminCategoriesPage from '../pages/admin/AdminCategoriesPage';
import AdminStudentsPage from '../pages/admin/AdminStudentsPage';
import AdminAdminsPage from '../pages/admin/AdminAdminsPage';
import AdminMediaPage from '../pages/admin/AdminMediaPage';
import AdminLiveSessionsPage from '../pages/admin/AdminLiveSessionsPage';
import AdminEnrollmentsPage from '../pages/admin/AdminEnrollmentsPage';
import AdminProgressPage from '../pages/admin/AdminProgressPage';
import AdminAuditLogsPage from '../pages/admin/AdminAuditLogsPage';
import AdminBannersPage from '../pages/admin/AdminBannersPage';
import AdminPromoBannerPage from '../pages/admin/AdminPromoBannerPage';
import AdminCouponsPage from '../pages/admin/AdminCouponsPage';
import AdminCommunityPage from '../pages/admin/AdminCommunityPage';
import AdminBatchesPage from '../pages/admin/AdminBatchesPage';
import AdminBatchDetailsPage from '../pages/admin/AdminBatchDetailsPage';
import AdminNotificationCenterPage from '../pages/admin/AdminNotificationCenterPage';
import AdminContactMessagesPage from '../pages/admin/AdminContactMessagesPage';
import AdminReviewsPage from '../pages/admin/AdminReviewsPage';
import ContentCreatorDashboard from '../pages/admin/ContentCreatorDashboard';
import LiveClassroomPage from '../pages/LiveClassroomPage';

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) {
    const isStaff = user.role ? ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user.role.toLowerCase()) : false;
    if (isStaff) {
      return <Navigate to="/admin" replace />;
    }
  }
  return <StudentDashboard />;
}

function AuthRedirectRoute({ tab = 'login' }) {
  const { openAuthModal } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirect = searchParams.get('redirect');

  useEffect(() => {
    openAuthModal(tab, redirect);
  }, [tab, redirect, openAuthModal]);

  return <Navigate to={redirect || '/'} replace />;
}

export default function App() {
  const routerBasename = import.meta.env.BASE_URL || '/';

  return (
    <BrowserRouter basename={routerBasename}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
            {/* Public & Student browsing routes within StudentLayout */}
            <Route element={<StudentLayout />}>
              <Route path="/" element={<RootRoute />} />
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/courses" element={<CourseCatalogPage />} />
              <Route path="/student/courses/:id" element={<CourseDetailsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/about-us" element={<AboutPage />} />
              <Route path="/student/about" element={<AboutPage />} />
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/contact-us" element={<ContactPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/teach" element={<TeachPage />} />
              <Route path="/teach-on-onetutor" element={<TeachPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-of-service" element={<TermsPage />} />
              <Route path="/help-center" element={<HelpCenterPage />} />
              <Route path="/system-status" element={<SystemStatusPage />} />

              {/* Protected student routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/student/my-courses" element={<MyCoursesPage />} />
                <Route path="/student/live-classes" element={<StudentLiveClassesPage />} />
                <Route path="/student/notifications" element={<StudentNotificationsPage />} />
                <Route path="/student/profile" element={<StudentProfilePage />} />
                <Route path="/student/community" element={<StudentCommunityPage />} />
                <Route path="/student/community/:courseId" element={<StudentCommunityPage />} />
                <Route path="/student/learn/:courseId" element={<LearningPage />} />
              </Route>
            </Route>

            {/* Floating auth modal triggers — redirect to home and open modal */}
            <Route path="/login" element={<AuthRedirectRoute tab="login" />} />
            <Route path="/register" element={<AuthRedirectRoute tab="register" />} />
            <Route path="/forgot-password" element={<AuthRedirectRoute tab="forgot" />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Dedicated full-screen learning environment */}
            <Route element={<ProtectedRoute />}>
              <Route path="/student/live-classroom/:sessionId" element={<LiveClassroomPage role="student" />} />
            </Route>

            {/* Admin authenticated routes */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/courses" element={<AdminCoursesPage />} />
                <Route path="/admin/courses/create" element={<AdminCourseFormPage />} />
                <Route path="/admin/courses/:id/edit" element={<AdminCourseFormPage />} />
                <Route path="/admin/courses/:id/preview" element={<AdminCoursePreviewPage />} />
                <Route path="/admin/courses/:courseId/batches" element={<AdminBatchesPage />} />
                <Route path="/admin/batches" element={<AdminBatchesPage />} />
                <Route path="/admin/batches/:batchId" element={<AdminBatchDetailsPage />} />
                <Route path="/admin/categories" element={<AdminCategoriesPage />} />
                <Route path="/admin/students" element={<AdminStudentsPage />} />
                <Route path="/admin/admins" element={<AdminAdminsPage />} />
                <Route path="/admin/media" element={<AdminMediaPage />} />
                <Route path="/admin/live-sessions" element={<AdminLiveSessionsPage />} />
                <Route path="/admin/enrollments" element={<AdminEnrollmentsPage />} />
                <Route path="/admin/progress" element={<AdminProgressPage />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
                <Route path="/admin/banners" element={<AdminBannersPage />} />
                <Route path="/admin/promo-banner" element={<AdminPromoBannerPage />} />
                <Route path="/admin/coupons" element={<AdminCouponsPage />} />
                <Route path="/admin/reviews" element={<AdminReviewsPage />} />
                <Route path="/admin/community" element={<AdminCommunityPage />} />
                <Route path="/admin/contact-messages" element={<AdminContactMessagesPage />} />
                <Route path="/admin/notifications" element={<AdminNotificationCenterPage />} />
                <Route path="/admin/creator-dashboard" element={<ContentCreatorDashboard />} />
              </Route>
              {/* Dedicated in-app Live Classroom for Admin */}
              <Route path="/admin/live-classroom/:sessionId" element={<LiveClassroomPage role="admin" />} />
            </Route>


            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <FcmNotificationManager />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
