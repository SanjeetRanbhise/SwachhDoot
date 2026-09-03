# SwachhDoot - Complete Setup Guide

## Prerequisites

Make sure you have the following installed:

- **Node.js** 16+ (download from https://nodejs.org/)
- **PostgreSQL** 12+ (download from https://www.postgresql.org/download/)
- **npm** (comes with Node.js)

Check versions:

```bash
node --version
npm --version
psql --version
```

## Step 1: PostgreSQL Database Setup

### Windows

1. **Start PostgreSQL**
   - Open pgAdmin or use Windows Services to start PostgreSQL

2. **Create Database**
   - Open Command Prompt/PowerShell
   - Connect to PostgreSQL:
     ```bash
     psql -U postgres
     ```
   - Create database:
     ```sql
     CREATE DATABASE swachhdoot;
     \quit
     ```

### Mac/Linux

```bash
# Create database
createdb swachhdoot

# Verify
psql -l | grep swachhdoot
```

## Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# The .env file is already configured with default credentials:
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=swachhdoot

# If your PostgreSQL has different credentials, edit .env

# Start the backend server
npm run dev
```

**Expected output:**
```
Server running on port 3001
Database initialized successfully
Database seeded with demo users
```

## Step 3: Frontend Setup

In a NEW terminal window:

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```

**Expected output:**
```
VITE v5.0.0 ready in 123 ms

➜  Local:   http://localhost:3000/
```

## Step 4: Test the Application

1. Open http://localhost:3000 in your browser
2. You should see the SwachhDoot landing page
3. Test the complete workflow:

### Test Workflow

**As a Citizen:**
1. Sign up with email and password
2. Report a garbage complaint:
   - Upload a photo
   - Click "Detect Location" (mock location)
   - Select waste type
   - Add description
   - Submit → Get complaint ID
3. Track complaint using the ID
4. See the status timeline

**As Admin:**
1. Login with admin account
2. View dashboard statistics
3. Click "Assign" on a REPORTED complaint
4. Select a collector and assign

**As Collector:**
1. Login with collector account
2. See assigned complaints
3. Click "Accept Complaint"
4. Update status: "Start Cleaning" → "Mark Cleaned"

**Back as Citizen:**
1. Track the complaint again
2. Once status is "CLEANED", submit feedback
3. Rate 1-5 stars and add comment

## Demo Accounts

**Create New Accounts via Signup:**
- Email: any@example.com
- Password: any password (min 6 chars)
- Role: Choose Citizen or Collector

**Or Use Seeded Demo Accounts** (these have placeholder password hashes):
- citizen@swachhdoot.demo
- collector@swachhdoot.demo
- admin@swachhdoot.demo

## Environment Variables

### Backend (.env)
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=swachhdoot
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
NODE_ENV=development
```

### Frontend (.env)
```
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
```

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Check if database exists: `psql -U postgres -c "SELECT datname FROM pg_database WHERE datname = 'swachhdoot';"`
- Verify credentials in backend/.env

### "Port 3001 already in use"
- Find process: `netstat -ano | findstr :3001` (Windows)
- Kill process or use different port

### "Port 3000 already in use"
- Change Vite port in vite.config.ts: `port: 3001`
- Or kill existing process

### "Module not found"
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

### "Image upload not working"
- Ensure `/backend/uploads` directory exists
- Backend will create it on startup
- Check file permissions

### "Image not displaying"
- Verify image URL in browser: `http://localhost:3001/uploads/[filename]`
- Check if file exists in `/backend/uploads/`

## Building for Production

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
npm run preview
```

## Stopping the Servers

- Frontend: Press `Ctrl+C` in the terminal
- Backend: Press `Ctrl+C` in the terminal

## Testing Different Roles

1. **Open Multiple Browser Windows**
   - Window 1: Logged in as Citizen
   - Window 2: Logged in as Admin
   - Window 3: Logged in as Collector

2. **Use Private/Incognito Mode**
   - Each tab can have different session

3. **Clear Cookies**
   - DevTools → Application → Cookies → Delete all

## Database Inspection

View database contents:

```bash
psql -U postgres -d swachhdoot

# List all tables
\dt

# View users
SELECT id, name, email, role FROM users;

# View complaints
SELECT id, complaint_id, status FROM complaints;

# View feedback
SELECT * FROM feedback;

# Exit
\quit
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Backend won't start | Check .env, ensure PostgreSQL is running |
| No auth/login | Database might not have users, check schema |
| Images not uploading | Check uploads directory permissions |
| GPS location failing | This is mocked in demo, will show mock coordinates |
| API CORS errors | Ensure backend is running on :3001 |

## Next Steps

Once everything is working:

1. Try creating multiple complaints as different citizens
2. Test assignment as admin to multiple collectors
3. Update statuses as collector
4. Submit feedback to complete workflow
5. Check database stats in admin dashboard

## Production Checklist

- [ ] Change JWT_SECRET to strong random value
- [ ] Change DB_PASSWORD to secure password
- [ ] Set NODE_ENV=production
- [ ] Use cloud storage for images (not local filesystem)
- [ ] Setup HTTPS/SSL
- [ ] Add input validation
- [ ] Setup logging and monitoring
- [ ] Add rate limiting
- [ ] Use environment-specific configs

## Support

For issues or questions, refer to:
- README.md - Project overview
- API endpoints documentation in README.md
- Backend routes in `/backend/src/routes/`
- Frontend components in `/frontend/src/pages/`
