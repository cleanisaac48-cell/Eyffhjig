# Full-Stack Dating Platform - Takeyours

## Overview

Takeyours is a comprehensive full-stack dating platform designed to facilitate meaningful connections through a verified user system. The application features a multi-step verification process, media-rich user profiles, subscription-based premium features, and real-time messaging capabilities. The platform emphasizes security and authenticity by requiring identity verification before approval.

The system follows a progressive user journey from registration through identity verification, personal information collection, preference setting, and final approval before accessing the main platform features. Premium users gain access to advanced messaging and matching capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend utilizes vanilla HTML, CSS, and JavaScript with a multi-page application (MPA) structure. Key architectural decisions include:

- **Static File Serving**: Simple HTML/CSS/JS files served directly without a frontend framework
- **JWT Token-Based Authentication**: Tokens stored in localStorage for session management
- **Progressive User Flow**: Multi-step onboarding process (identity → personal → preferences → approval)
- **Responsive Design**: Mobile-first CSS approach with flexible layouts
- **Media Upload Handling**: Direct file uploads with preview functionality for images and videos

### Backend Architecture
The backend is built with Node.js and Express, implementing a RESTful API design:

- **Express.js Server**: Main application server handling HTTP requests
- **Modular Route Structure**: Organized routes for authentication, user management, admin functions, and file uploads
- **JWT Authentication**: Stateless authentication using JSON Web Tokens
- **File Upload Processing**: Multer middleware for handling multipart form data
- **Email Service Integration**: Nodemailer for OTP verification and notifications

### Data Storage Solutions
The application uses a hybrid approach for data persistence:

- **Supabase (PostgreSQL)**: Primary database for user data, preferences, admin records, and application state
- **Cloudinary**: Cloud-based media storage for profile photos, videos, and identity documents
- **In-Memory OTP Storage**: Temporary storage for one-time passwords with expiration handling

### Authentication and Authorization
Multi-layered security approach:

- **Email-Based OTP Verification**: Two-factor authentication for account registration
- **JWT Token System**: Secure token-based session management with expiration
- **Role-Based Access Control**: Separate admin and user authentication flows
- **Progressive Access Gates**: Step-by-step verification required before platform access

### External Service Integrations
The platform integrates several third-party services:

- **Supabase**: Database hosting and management
- **Cloudinary**: Media storage and transformation services
- **Gmail SMTP**: Email delivery for OTP verification
- **Firebase Admin SDK**: Additional authentication and notification services

## External Dependencies

- **@supabase/supabase-js**: Database client for PostgreSQL operations
- **express**: Web application framework for Node.js
- **multer**: Middleware for handling file uploads
- **cloudinary**: Cloud-based image and video management
- **nodemailer**: Email sending capabilities for OTP verification
- **bcrypt**: Password hashing for secure authentication
- **jsonwebtoken**: JWT token generation and verification
- **cors**: Cross-origin resource sharing middleware
- **pg**: PostgreSQL client for direct database operations
- **firebase-admin**: Firebase services integration
- **winston**: Logging framework for application monitoring
- **uuid**: Unique identifier generation
- **dotenv**: Environment variable management

The system architecture prioritizes security, scalability, and user experience while maintaining simplicity in deployment and maintenance. The separation of concerns between frontend and backend allows for independent scaling and updates.