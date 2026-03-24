# LMSPRO – Client-Facing Project Document

## Overview
LMSPRO is a modern Learning Management System that lets organizations publish courses, sell access, deliver secure video lessons, track learner progress, and issue certificates. It consists of:
- Backend: Node.js (Express) with MongoDB for APIs, auth, payments, progress, and media ([server.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/server.js)).
- Frontend: React + TypeScript + Vite for a fast, responsive UI ([main.tsx](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/frontend/src/main.tsx)).

## Key Capabilities
- User auth with JWT (student/admin) and password reset via email.
- Course catalog with categories, sections, lessons, quizzes, and reviews.
- Secure video delivery via S3 with token-gated streaming and optional HLS transcoding.
- Payments through Razorpay with server-side verification.
- Progress tracking, notes, timestamps, and completion certificates.
- Admin dashboard to manage users, courses, categories, media, and settings.

## Architecture
- API base: `/api/*` served by Express ([server.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/server.js#L120-L129)).
- Frontend SPA consumes REST APIs from the backend ([lib/api.ts](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/frontend/src/lib/api.ts)).
- Database: MongoDB using Mongoose models (e.g., [Course.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/models/Course.js), [User.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/models/User.js)).
- Storage: AWS S3 for thumbnails and lesson videos, with a local fallback for thumbnails.

## Core Domains
### Authentication
- Endpoints under `/api/auth` handle register, login, me, reset password ([auth.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/routes/auth.js)).
- JWT-based auth and role checks via middleware ([auth.js middleware](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/middleware/auth.js)).

### Courses & Categories
- CRUD and publishing via `/api/courses`, categories via `/api/categories` (admin-protected).
- Course schema supports sections, lessons, quizzes, announcements ([Course.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/models/Course.js#L31-L79)).

### Enrollment & Payments
- Create Razorpay order and verify signature on payment success ([enrollments.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/routes/enrollments.js#L40-L87), [L89-L144](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/routes/enrollments.js#L89-L144)).
- On verification, create Enrollment and initialize Progress.

### Progress & Certificates
- Track lesson completion, timestamps, notes, quiz submissions under `/api/progress`.
- Issue course completion certificates under `/api/certificates`.

### Media & Video
- Thumbnails upload to S3 or local fallback ([upload.js thumbnail](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/routes/upload.js#L71-L124)).
- Video upload to S3, stream via signed endpoints that validate auth and enrollment ([stream](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/routes/upload.js#L176-L219), [proxy/video](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/routes/upload.js#L250-L299)).
- Optional HLS transcoding pipeline using FFmpeg and S3 ([transcoder.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/services/transcoder.js)).

## Frontend Highlights
- Pages include Courses, Course Detail, Lesson Viewer, Payments, Profile, Certificates, Admin dashboards, and more ([pages](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/frontend/src/pages)).
- Reusable UI using shadcn and Radix primitives ([components/ui](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/frontend/src/components/ui)).
- Data fetching with React Query; forms with React Hook Form + Zod validators.

## Security Model
- JWT auth for API access; role-based guards for admin endpoints.
- CORS allows only configured client origins ([server.js CORS](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/server.js#L50-L70)).
- Secure streaming: checks Referer/Origin, validates token, and verifies enrollment before serving video.
- Helmet headers and rate-limiting applied globally.

## Configuration
- Environment variables loaded in backend ([config.js](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/src/config.js)):
  - MongoDB URI, JWT secret/expiry, CLIENT_URL
  - SMTP (for password reset), AWS S3 keys/region/bucket
  - Razorpay key/secret
- See sample env file ([.env.example](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/.env.example)).

## Typical User Journeys
1) Discover & Buy
   - Browse courses, open course detail, start checkout.
   - Server creates Razorpay order; user completes payment; server verifies and enrolls.
2) Learn
   - Access lesson player; secure stream validates enrollment before delivering video.
   - Mark lessons complete, add notes, resume with timestamps.
3) Complete & Certify
   - Take quizzes, reach completion criteria, download certificate.
4) Admin
   - Create categories/courses, upload media, publish, manage users and enrollments.

## Deployment & Running
- Development:
  - Backend: `npm run dev` in `backend` ([package.json](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/backend/package.json#L6-L10))
  - Frontend: `npm run dev` in `frontend` ([package.json](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/frontend/package.json#L6-L14))
  - Root simultaneous dev: `npm run dev` ([root package.json](file:///c:/Users/Admin/Desktop/New%20folder/LMSPRO/package.json#L4-L8))
- Production:
  - Set env vars, build frontend, run backend `npm start` with a process manager and MongoDB/S3/Razorpay/SMTP configured.

## Limitations & Next Steps
- Payments currently Razorpay only (INR). Consider adding Stripe/PayPal for broader reach.
- Video HLS requires S3 and FFmpeg-compatible environment; consider a dedicated media worker.
- Add rate plans, coupons, and content drip as advanced features.
- Expand test coverage on both backend and frontend.

---
Point-of-contact summary:
- Tech stack: Node.js, Express, MongoDB, React, TypeScript, Vite, AWS S3, Razorpay.
- Primary value: Sell courses, deliver secure streaming, track learning, issue certificates.

