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
│   │   ├── app.js               # Express application configuration & healthcheck
│   │   └── server.js            # Server entry point
│   ├── .env.example             # Backend environment template
│   ├── package.json             # Backend dependencies and scripts
│   └── package-lock.json
├── frontend/
│   ├── public/                  # Static assets
│   ├── src/                     # React source components and views
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

6. **Verify Tables in PostgreSQL:**
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

## 🧪 Testing

- **Backend Test Suite (Runs against isolated `sweety_test_db`):**
  ```bash
  npm run backend:test
  # or from backend directory:
  cd backend && npm test
  ```

---

## 🗺 Development Milestones

- [x] **Milestone 1:** Initial repository setup, project structure, dependencies, and environment templates.
- [x] **Milestone 2:** PostgreSQL schema design, database connection pool, and migrations.
- [x] **Milestone 3:** User registration, login with bcrypt, and JWT authentication middleware.
- [ ] **Milestone 4:** Blood glucose readings CRUD API with validation rules & constraints.
- [ ] **Milestone 5:** Reporting engine (Daily, MTD, Previous Month metrics).
- [ ] **Milestone 6:** Seed script with demo user and realistic test data.
- [ ] **Milestone 7:** React frontend UI (Auth, Dashboard, Reading entry, and Reports).
- [ ] **Milestone 8:** Final end-to-end polish, test coverage, and documentation.
