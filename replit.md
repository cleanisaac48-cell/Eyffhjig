# Niche – Job-Seeking Platform

## Overview

Niche is a full-stack job-seeking platform that connects skilled professionals with employers through smart profile matching. Built on top of an existing Node.js/Express/Supabase infrastructure that was originally a dating app (Takeyours), Niche repurposes the same schema and infrastructure for the job market.

**Key Features:**
- Role-based registration: Job Seeker or Employer
- Multi-step profile setup (personal info → preferences → admin approval)
- Job seekers upload video introductions and a document vault (CV, degrees, etc.)
- Employers post their company profile and hiring requirements
- Smart bi-directional matching algorithm (8 attributes)
- Seeker dashboard: Companies, Applied, Shortlisted tabs
- Employer dashboard: Applications, Shortlisted, Allowed to Chat tabs
- Premium subscription required for chat activation

## User Flow

1. **Register** → select role (Job Seeker / Employer), email + password
2. **OTP confirmation** → account created with `current_step='personal'`
3. **Login** → redirected to personal.html (identity step is bypassed)
4. **Personal Info** → role-specific form (seeker fields vs employer fields)
5. **Preferences** → seeker job preferences or employer candidate requirements
6. **Admin Review** → `status` changes from `pending` to `approved`/`disapproved`
7. **Dashboard** → role-based tabs with match scores and interaction buttons

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
Vanilla HTML, CSS, and JavaScript multi-page application:
- **JWT Token Authentication**: Tokens stored in localStorage; role decoded from JWT payload
- **Role Detection**: `orientation` column stores `'seeker'` or `'employer'`; JWT includes `role` field
- **Progressive Onboarding**: personal → preferences → submission → dashboard
- **File Upload Flow**: Files uploaded individually to `/api/user/upload-file` (Cloudinary); URLs stored as JSON in DB

### Backend Architecture
Node.js + Express + Supabase + Cloudinary:
- **Auth routes**: `backend/routes/auth.js` – send-otp, verify-otp (stores role), login (includes role in JWT)
- **User routes**: `backend/routes/user.js` – progress, personal, preferences, upload-file
- **Server**: `backend/server.js` – matching logic, interactions, shortlisted-me endpoint
- **Controller**: `backend/controller/userController.js` – savePersonalInfo, savePreferences, uploadSingleFile

### Database Column Repurposing
See `COLUMN_MAPPING.md` for the full mapping. Key repurposings:
- `orientation` → user role ('seeker'/'employer')
- `occupation` → major category / industry
- `employment_type` → sub-major / work mode
- `smoking` → night shift available/required
- `height` → seeker min salary
- `weight` → employer max salary
- `liveness_video_url` → JSON array of seeker video intros
- `id_back_url` → JSON array of seeker document vault
- Preference columns repurposed for job platform filters

### Matching Algorithm
8-attribute score system (100% = perfect match):
1. Work mode preference match
2. Industry/sector match
3. Company size (neutral point)
4. Salary range compatibility
5. Relocation compatibility
6. Night shift compatibility
7. Education level requirement
8. Major category requirement

### Key Files
- `frontend/register.html` – Role selection (Seeker/Employer) + registration form
- `frontend/personal.html` + `personal.js` – Role-based personal info form
- `frontend/preferences.html` + `preferences.js` – Role-based preferences form
- `frontend/dashboard_page.html` + `dashboard_script.js` – Role-based dashboard
- `backend/routes/auth.js` – OTP, registration, login with role
- `backend/routes/user.js` – User profile management + file upload
- `backend/controller/userController.js` – savePersonalInfo, savePreferences, uploadSingleFile
- `backend/server.js` – Matching, interactions, shortlisted-me
- `COLUMN_MAPPING.md` – DB column repurposing reference

## Environment Variables Required
Configure in `backend/.env`:
- `SUPABASE_URL`, `ANON_KEY` – Supabase database
- `JWT_SECRET` – JWT signing key
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` – File hosting
- `SENDGRID_API_KEY`, `EMAIL_USER` – OTP email delivery

## Deployment
- Port 5000, binding 0.0.0.0
- Configured as autoscale deployment on Replit
- Workflow: `node backend/server.js`
