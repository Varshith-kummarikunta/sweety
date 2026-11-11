# Sweety – Blood Glucose Tracker

A full-stack blood glucose tracking web application developed for the **Junior Full Stack Developer** assessment at **Kenpath**.

Sweety allows registered users to record, track, and analyze their blood glucose readings across standardized daily slots, calculate critical glycemic statistics, and generate structured daily and monthly summary reports.

---

## 🛠 Tech Stack

- **Frontend:** React with Vite (JavaScript)
- **Backend:** Node.js with Express (JavaScript)
- **Database:** PostgreSQL (using native `pg` client)
- **Authentication:** Password hashing with `bcrypt`, stateless session tokens with `jsonwebtoken` (JWT)
- **Testing:** Jest and Supertest
- **Language:** JavaScript (CommonJS on backend, ES Modules on frontend)

---

## 📁 Repository Structure

```text
sweety/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js            # PostgreSQL connection pool & env resolution
│   │   ├── controllers/
│   │   │   ├── authController.js   # Registration, login, profile (/me)
│   │   │   ├── readingController.js # CRUD for readings with locking & constraints
│   │   │   └── reportController.js  # Daily, MTD, and previous-month metrics
│   │   ├── db/
│   │   │   ├── schema.sql       # PostgreSQL DDL with UUIDs, indexes & constraints
│   │   │   ├── migrate.js       # Migration execution script
│   │   │   ├── seed.js          # Seed script with demo user & realistic sample data
│   │   │   ├── check.js         # Connection diagnostics
│   │   │   └── verify_milestone2.js # Schema constraint verification suite
│   │   ├── middleware/
│   │   │   └── authMiddleware.js # JWT verification & user context injection
│   │   ├── routes/
│   │   │   ├── authRoutes.js    # /api/auth routes
│   │   │   ├── readingRoutes.js # /api/readings routes
│   │   │   └── reportRoutes.js  # /api/reports routes
│   │   ├── app.js               # Express application configuration & healthcheck
│   │   └── server.js            # Server entry point
│   ├── tests/                   # Jest + Supertest test suites (57 tests)
│   │   ├── auth.test.js
│   │   ├── readings.test.js
│   │   └── reports.test.js
│   ├── .env.example             # Backend environment template
│   ├── package.json             # Backend dependencies and scripts
│   └── package-lock.json
├── frontend/
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Alert.jsx        # Dismissible status banner (success/error/info)
│   │   │   ├── Navbar.jsx       # Header with user badge, navigation & logout
│   │   │   ├── ReadingItem.jsx  # Individual reading card with slot badge & actions
│   │   │   ├── ReadingModal.jsx # Add/Edit modal with validation & slot options
│   │   │   └── StatCard.jsx     # Glycemic metric summary cards
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Auth state, session persistence & profile loading
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx     # Registration & Login with demo quick-fill
│   │   │   ├── DashboardPage.jsx # Daily view, metric cards, reading list & CRUD
│   │   │   └── ReportsPage.jsx  # Daily, MTD & previous-month reporting tabs
│   │   ├── services/
│   │   │   └── api.js           # Centralized API client with JWT interception
│   │   ├── App.jsx              # Main application shell & view navigation
│   │   ├── App.css              # Healthcare-themed responsive styling
│   │   ├── index.css            # Base typography & layout variables
│   │   └── main.jsx             # React DOM entry point
│   ├── tests/
│   │   └── user_journey.test.js # End-to-end user journey tests (16 journeys)
│   ├── index.html               # Vite HTML entry point
│   ├── vite.config.js           # Vite configuration
│   ├── .env.example             # Frontend environment template
│   ├── package.json             # Frontend dependencies and scripts
│   └── package-lock.json
├── .gitignore                   # Root ignore rules (node_modules, .env, build output)
├── package.json                 # Root convenience scripts
└── README.md                    # Project documentation
```

---

## 📋 Assessment Requirements Summary

1. **Authentication:** User registration and login with secure password hashing (`bcrypt`) and JWT authentication.
2. **Access Control:** Strict row-level data isolation — users can only view and mutate their own readings.
3. **Reading CRUD:** Full create, read, update, and delete operations for glucose readings.
4. **Defined Time Slots:** Four slots: `Morning (fasting)`, `After breakfast`, `After lunch`, and `After dinner`.
5. **Validation Rules:**
   - Integer glucose values between **40 and 600 mg/dL**.
   - Maximum 4 readings per user per date.
   - Prevent duplicate slots for the same user on the same date.
   - Strictly reject future dates.
6. **Reporting:**
   - Daily report (with slot-by-slot individual readings).
   - Month-to-date (MTD) report.
   - Previous-month report.
   - Reports compute highest reading, lowest reading, reading count, and average rounded to 1 decimal place.
7. **Quality & Delivery:**
   - Database seed script with demo credentials and sample data.
   - Meaningful unit/integration tests (`Jest` + `Supertest`).
   - Clean, readable JavaScript code with documented assumptions.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v18+ (tested on v20.x)
- **npm:** v9+
- **PostgreSQL:** v14+ (for upcoming database milestones)
- **Git**

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd sweety
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

### Environment Configuration

1. **Backend:**
   Copy `backend/.env.example` to `backend/.env` and update with your local database credentials:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Frontend:**
   Copy `frontend/.env.example` to `frontend/.env`:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

### Database Setup & Migration

1. **Ensure PostgreSQL is running** (v14+ recommended).

2. **Create the PostgreSQL Database:**
   Using `psql`:
   ```bash
   psql -U postgres -c "CREATE DATABASE sweety_db;"
   ```
   Or using `createdb`:
   ```bash
   createdb -U postgres sweety_db
   ```

3. **Configure Environment Variables:**
   Update `backend/.env` with your PostgreSQL user, password, host, and port:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=sweety_db
   DB_USER=postgres
   DB_PASSWORD=your_actual_password_here
   ```

4. **Verify Database Connection:**
   ```bash
   npm run db:check
   # or from backend:
   cd backend && npm run db:check
   ```

5. **Run Schema Migrations:**
   ```bash
   npm run db:migrate
   # or from backend:
   cd backend && npm run db:migrate
   ```

6. **Seed Sample Data (Optional for Demo):**
   ```bash
   npm run db:seed
   # or from backend:
   cd backend && npm run db:seed
   ```

   **Demo Credentials:**
   - **Email:** `demo@sweety.local`
   - **Password:** `SweetyDemo123!`
   
   > ⚠️ **Warning:** Demo credentials are strictly for local development and assessment demonstration. Never use demo passwords in production.

   **What is seeded:**
   - 1 demo user (`Demo User`).
   - 39 realistic blood glucose readings spanning 10 dates across October 2026 (previous month) and November 2026 (current month-to-date).
   - Fully covers all 4 standardized time slots with realistic glycemic values (87–150 mg/dL).
   - Safe and idempotent to run multiple times without creating duplicate records.

7. **Verify Tables in PostgreSQL:**
   Using `psql`:
   ```bash
   psql -U postgres -d sweety_db -c "\dt"
   psql -U postgres -d sweety_db -c "\d users"
   psql -U postgres -d sweety_db -c "\d readings"
   ```

### Running the Application

- **Start Backend API Server:**
  ```bash
  cd backend
  npm run dev
  # Server runs on http://localhost:5000
  # Health check available at http://localhost:5000/api/health
  ```

- **Start Frontend Development Server:**
  ```bash
  cd frontend
  npm run dev
  # Vite dev server runs on http://localhost:5173
  ```

- **Or from the project root:**
  ```bash
  npm run backend:dev
  npm run frontend:dev
  ```

---

## 🔐 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user with name, email, password | No |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user's profile | Yes (`Bearer <token>`) |

---

## 🩸 Blood Glucose Readings Endpoints

All reading endpoints require `Authorization: Bearer <token>`. User data isolation is strictly enforced — users can only view, create, edit, and delete their own readings.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/readings` | Create reading (`reading_date`, `time_slot`, `value`) |
| `GET` | `/api/readings` | List readings for authenticated user (sorted by date & slot) |
| `GET` | `/api/readings/:id` | Get single reading by UUID |
| `PUT` | `/api/readings/:id` | Update reading date, slot, or value |
| `DELETE` | `/api/readings/:id` | Delete reading by UUID |

---

## 📊 Glucose Reporting Endpoints

All reporting endpoints require `Authorization: Bearer <token>`. Calculates highest, lowest, average rounded to 1 decimal place, and count.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/reports/daily?date=YYYY-MM-DD` | Daily summary metrics and individual reading list with slots |
| `GET` | `/api/reports/month-to-date?date=YYYY-MM-DD` | Month-to-date metrics from 1st of month through selected date |
| `GET` | `/api/reports/monthly?date=YYYY-MM-DD` | Previous calendar month summary metrics |

---

## 🧪 Testing

- **Full Project Test Suite (Backend + Frontend):**
  ```bash
  npm test
  ```

- **Backend Test Suite (Runs 57 Jest tests against isolated `sweety_test_db`):**
  ```bash
  npm run backend:test
  # or from backend directory:
  cd backend && npm test
  ```

- **Frontend Test Suite (Runs 16 User Journeys via Node.js native test runner):**
  ```bash
  npm run frontend:test
  # or from frontend directory:
  cd frontend && npm test
  ```

- **Frontend Production Build:**
  ```bash
  npm run frontend:build
  # or from frontend directory:
  cd frontend && npm run build
  ```

---

## 🗺 Development Milestones

- [x] **Milestone 1:** Initial repository setup, project structure, dependencies, and environment templates.
- [x] **Milestone 2:** PostgreSQL schema design, database connection pool, and migrations.
- [x] **Milestone 3:** User registration, login with bcrypt, and JWT authentication middleware.
- [x] **Milestone 4:** Blood glucose readings CRUD API with validation rules & constraints.
- [x] **Milestone 5:** Reporting engine (Daily, MTD, Previous Month metrics).
- [x] **Milestone 6:** Seed script with demo user and realistic test data.
- [x] **Milestone 7:** React frontend UI (Auth, Dashboard, Reading entry, and Reports).
- [ ] **Milestone 8:** Final end-to-end polish, test coverage, and documentation.
