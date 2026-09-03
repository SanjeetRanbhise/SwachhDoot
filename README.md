# SwachhDoot - Smart Waste Management System

A functional prototype of a smart, location-aware waste management platform connecting citizens, waste management teams, and administrators.

## Features

### For Citizens
- ✅ User registration and login
- ✅ Report garbage complaints with photo upload
- ✅ GPS location capture with manual address override
- ✅ Waste type selection from 16+ categories
- ✅ Track complaint by unique ID
- ✅ View complaint status timeline
- ✅ Submit feedback after complaint resolution

### For Waste Management Team
- ✅ Login and view assigned complaints
- ✅ Accept complaints from nearby locations
- ✅ Update status (Assigned → In Progress → Cleaned)
- ✅ Track complaint progress

### For Administrators
- ✅ Dashboard with complaint statistics
- ✅ View all complaints with filters
- ✅ Assign complaints to collectors
- ✅ Monitor feedback from citizens

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **File Storage**: Local file system (for prototype)

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+

### 1. Database Setup

Create a PostgreSQL database:

```bash
createdb swachhdoot
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Update DB credentials

# Start backend
npm run dev
```

Backend runs on http://localhost:3001

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

Frontend runs on http://localhost:3000

## Demo Accounts

| Email | Role | Status |
|-------|------|--------|
| citizen@swachhdoot.demo | Citizen | Seeded in DB |
| collector@swachhdoot.demo | Collector | Seeded in DB |
| admin@swachhdoot.demo | Admin | Seeded in DB |

Or create new accounts via signup form.

## Complete Workflow

1. **Citizen Reports Complaint**
   - Signup/Login
   - Report garbage with photo
   - Detect GPS location
   - Select waste type
   - Submit → Get ID (SD-2026-XXXXX)

2. **Admin Assigns Collector**
   - Login as admin
   - View dashboard
   - Assign complaint to collector

3. **Collector Updates Status**
   - Accept complaint
   - Start cleaning
   - Mark as cleaned

4. **Citizen Provides Feedback**
   - Track complaint
   - Submit 1-5 star feedback
   - Complaint marked VERIFIED

## API Endpoints

**Auth**
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

**Complaints**
- POST /api/complaints (with file upload)
- GET /api/complaints/:complaintId
- GET /api/complaints
- PUT /api/complaints/:id/status
- PUT /api/complaints/:id/accept

**Admin**
- GET /api/admin/dashboard
- GET /api/admin/complaints
- PUT /api/admin/complaints/:id/assign
- GET /api/admin/collectors

**Collector**
- GET /api/collector/dashboard
- GET /api/collector/complaints

**User**
- GET /api/user/dashboard

**Feedback**
- POST /api/feedback
- GET /api/feedback/admin/all

## Architecture

```
SwachhDoot/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── schema.js
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── complaints.js
│   │       ├── feedback.js
│   │       ├── admin.js
│   │       ├── collector.js
│   │       └── user.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   ├── context/
    │   ├── services/
    │   ├── types/
    │   └── styles/
    └── package.json
```

## Notes

- JWT-based authentication
- React Context for state management
- Tailwind CSS styling
- File upload to local server
- PostgreSQL with connection pooling
- Mock demo data seeded on startup

## Future

- Real-time notifications
- Mobile app
- AI/ML classification
- Cloud storage (S3)
- Advanced analytics
Smart Waste Management System 
