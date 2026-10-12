package com.onetutor.config;

import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import com.onetutor.users.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the dev admin account on first startup using the real
 * PasswordEncoder bean, so the stored hash always matches the app's
 * current hashing configuration (see V2 migration comment).
 *
 * Disabled outside dev/test profiles — production admin creation
 * should go through POST /api/v1/admin/admins by an existing admin.
 */
@Component
@Profile({"dev", "default", "test"})
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;

    private final com.onetutor.courses.repository.CourseRepository courseRepository;
    private final com.onetutor.categories.repository.CategoryRepository categoryRepository;
    private final com.onetutor.sections.repository.SectionRepository sectionRepository;
    private final com.onetutor.contents.repository.ContentRepository contentRepository;
    private final com.onetutor.enrollment.repository.EnrollmentRepository enrollmentRepository;
    private final com.onetutor.reviews.repository.CourseReviewRepository reviewRepository;

    public DataSeeder(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       @Value("${app.seed.admin-email}") String adminEmail,
                       @Value("${app.seed.admin-password}") String adminPassword,
                       com.onetutor.courses.repository.CourseRepository courseRepository,
                       com.onetutor.categories.repository.CategoryRepository categoryRepository,
                       com.onetutor.sections.repository.SectionRepository sectionRepository,
                       com.onetutor.contents.repository.ContentRepository contentRepository,
                       com.onetutor.enrollment.repository.EnrollmentRepository enrollmentRepository,
                       com.onetutor.reviews.repository.CourseReviewRepository reviewRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.courseRepository = courseRepository;
        this.categoryRepository = categoryRepository;
        this.sectionRepository = sectionRepository;
        this.contentRepository = contentRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.reviewRepository = reviewRepository;
    }

    @Override
    public void run(String... args) {
        User admin = userRepository.findByEmail(adminEmail).orElseGet(() -> {
            User a = new User();
            a.setName("Super Admin");
            a.setEmail(adminEmail);
            a.setPasswordHash(passwordEncoder.encode(adminPassword));
            a.setRole(UserRole.super_admin);
            a.setStatus(UserStatus.active);
            a.setEmailVerified(true);
            userRepository.save(a);
            log.info("Seeded dev super admin account: {}", adminEmail);
            return a;
        });
        if (admin != null && (admin.getRole() == UserRole.admin || admin.getRole() == null)) {
            admin.setRole(UserRole.super_admin);
            admin.setName("Super Admin");
            userRepository.save(admin);
            log.info("Updated existing admin account to Super Admin: {}", adminEmail);
        }

        User student = userRepository.findByEmail("student@onetutor.local").orElseGet(() -> {
            User s = new User();
            s.setName("Alex Student");
            s.setEmail("student@onetutor.local");
            s.setPasswordHash(passwordEncoder.encode("Student@12345"));
            s.setRole(UserRole.student);
            s.setStatus(UserStatus.active);
            s.setEmailVerified(true);
            s.setLastActiveAt(java.time.Instant.now().minus(java.time.Duration.ofMinutes(15)));
            userRepository.save(s);
            log.info("Seeded dev student account: student@onetutor.local (password: Student@12345)");
            return s;
        });

        // Backfill lastActiveAt for existing users if null
        userRepository.findAll().forEach(u -> {
            if (u.getLastActiveAt() == null) {
                u.setLastActiveAt(u.getCreatedAt() != null ? u.getCreatedAt() : java.time.Instant.now());
                userRepository.save(u);
            }
        });

        User creator = userRepository.findByEmail("creator@onetutor.local").orElseGet(() -> {
            User c = new User();
            c.setName("Content Creator");
            c.setEmail("creator@onetutor.local");
            c.setPasswordHash(passwordEncoder.encode("Creator@12345"));
            c.setRole(UserRole.content_creator);
            c.setStatus(UserStatus.active);
            c.setEmailVerified(true);
            c.setLastActiveAt(java.time.Instant.now());
            userRepository.save(c);
            log.info("Seeded dev content creator account: creator@onetutor.local (password: Creator@12345)");
            return c;
        });

        // Ensure category exists
        com.onetutor.categories.entity.Category category = categoryRepository.findAll().stream().findFirst().orElseGet(() -> {
            com.onetutor.categories.entity.Category cat = new com.onetutor.categories.entity.Category();
            cat.setName("Web Development");
            cat.setDescription("Full Stack, Frontend and Backend Development");
            cat.setStatus(com.onetutor.categories.entity.CategoryStatus.active);
            return categoryRepository.save(cat);
        });

        // Ensure at least one published course exists with curriculum
        if (courseRepository.findPublished(org.springframework.data.domain.PageRequest.of(0, 1)).isEmpty()) {
            com.onetutor.courses.entity.Course course = courseRepository.findAll().stream().findFirst().orElseGet(() -> {
                com.onetutor.courses.entity.Course c = new com.onetutor.courses.entity.Course();
                c.setName("MERN Full Stack Development");
                c.setShortDesc("Master MongoDB, Express, React, and Node.js with real-world projects.");
                c.setDescription("Complete hands-on masterclass covering full stack architecture from frontend to cloud deployment.");
                c.setCategory(category);
                c.setLevel("Beginner to Intermediate");
                c.setDuration("40 Hours");
                c.setLanguage("English");
                c.setCreatedBy(admin);
                return courseRepository.save(c);
            });

            if (sectionRepository.countByCourseId(course.getId()) == 0) {
                com.onetutor.sections.entity.Section sec1 = new com.onetutor.sections.entity.Section();
                sec1.setCourse(course);
                sec1.setTitle("Introduction & Environment Setup");
                sec1.setDescription("Kickstart your development workflow.");
                sec1.setDisplayOrder(0);
                sec1.setStatus(com.onetutor.sections.entity.SectionStatus.active);
                sectionRepository.save(sec1);

                com.onetutor.contents.entity.Content c1 = new com.onetutor.contents.entity.Content();
                c1.setSection(sec1);
                c1.setTitle("Welcome to MERN Full Stack");
                c1.setContentType(com.onetutor.contents.entity.ContentType.VIDEO);
                c1.setMediaReference("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
                c1.setDisplayOrder(0);
                contentRepository.save(c1);

                com.onetutor.sections.entity.Section sec2 = new com.onetutor.sections.entity.Section();
                sec2.setCourse(course);
                sec2.setTitle("Modern React 18 & State Architecture");
                sec2.setDescription("Learn hooks, Context API, and state patterns.");
                sec2.setDisplayOrder(1);
                sec2.setStatus(com.onetutor.sections.entity.SectionStatus.active);
                sectionRepository.save(sec2);

                com.onetutor.contents.entity.Content c2 = new com.onetutor.contents.entity.Content();
                c2.setSection(sec2);
                c2.setTitle("Hooks, Context & Component Patterns");
                c2.setContentType(com.onetutor.contents.entity.ContentType.VIDEO);
                c2.setMediaReference("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4");
                c2.setDisplayOrder(0);
                contentRepository.save(c2);
            }

            course.setStatus(com.onetutor.courses.entity.CourseStatus.published);
            courseRepository.save(course);
            log.info("Ensured course '{}' is published with active sections.", course.getName());

            // Ensure student is enrolled in the published course
            if (enrollmentRepository.findByStudentIdAndCourseId(student.getId(), course.getId()).isEmpty()) {
                com.onetutor.enrollment.entity.Enrollment enr = new com.onetutor.enrollment.entity.Enrollment();
                enr.setStudent(student);
                enr.setCourse(course);
                enr.setStatus(com.onetutor.enrollment.entity.EnrollmentStatus.active);
                enrollmentRepository.save(enr);
                log.info("Enrolled student '{}' into course '{}'.", student.getEmail(), course.getName());
            }
        }

        // Seed sample student ratings and comments if none exist
        if (reviewRepository.count() == 0) {
            java.util.List<com.onetutor.courses.entity.Course> courses = courseRepository.findAll();
            if (!courses.isEmpty()) {
                com.onetutor.courses.entity.Course firstCourse = courses.get(0);

                // Student 1 (Alex Student) review
                com.onetutor.reviews.entity.CourseReview r1 = new com.onetutor.reviews.entity.CourseReview();
                r1.setCourse(firstCourse);
                r1.setUser(student);
                r1.setRating(5);
                r1.setComment("Outstanding course structure! The live examples and deep-dive architectural explanations made complex concepts feel very straightforward.");
                reviewRepository.save(r1);

                // Student 2 (Priya Sharma)
                User student2 = userRepository.findByEmail("priya@onetutor.local").orElseGet(() -> {
                    User s = new User();
                    s.setName("Priya Sharma");
                    s.setEmail("priya@onetutor.local");
                    s.setPasswordHash(passwordEncoder.encode("Student@12345"));
                    s.setRole(UserRole.student);
                    s.setStatus(UserStatus.active);
                    s.setEmailVerified(true);
                    s.setLastActiveAt(java.time.Instant.now().minus(java.time.Duration.ofHours(2)));
                    return userRepository.save(s);
                });
                com.onetutor.reviews.entity.CourseReview r2 = new com.onetutor.reviews.entity.CourseReview();
                r2.setCourse(firstCourse);
                r2.setUser(student2);
                r2.setRating(5);
                r2.setComment("The hands-on projects and video playback quality are stellar. One of the best tech learning resources I have ever experienced.");
                reviewRepository.save(r2);

                // Student 3 (Rohan Verma)
                User student3 = userRepository.findByEmail("rohan@onetutor.local").orElseGet(() -> {
                    User s = new User();
                    s.setName("Rohan Verma");
                    s.setEmail("rohan@onetutor.local");
                    s.setPasswordHash(passwordEncoder.encode("Student@12345"));
                    s.setRole(UserRole.student);
                    s.setStatus(UserStatus.active);
                    s.setEmailVerified(true);
                    s.setLastActiveAt(java.time.Instant.now().minus(java.time.Duration.ofDays(1)));
                    return userRepository.save(s);
                });
                com.onetutor.reviews.entity.CourseReview r3 = new com.onetutor.reviews.entity.CourseReview();
                r3.setCourse(firstCourse);
                r3.setUser(student3);
                r3.setRating(4);
                r3.setComment("Comprehensive coverage of modern enterprise patterns. Clear, direct to the point, and highly practical.");
                reviewRepository.save(r3);

                log.info("Seeded initial course reviews with ratings and comments for course '{}'.", firstCourse.getName());
            }
        }
    }
}
