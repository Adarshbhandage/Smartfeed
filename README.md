# 🍽️ SmartFeed AI — Backend API v2

> **Intelligent Mess Management** | Node.js + Express + Firebase + Razorpay + Nodemailer

---

## 📁 Complete File Structure

```
backend/
├── server.js                    ← Express entry point
├── package.json
├── .env.example                 ← Copy → .env and fill in
├── .gitignore
├── firestore.rules              ← Paste in Firebase Console
├── smartfeed-api.js             ← Drop-in frontend helper
│
├── config/
│   ├── firebase.js              ← Firebase Admin SDK
│   ├── razorpay.js              ← Razorpay SDK
│   └── nodemailer.js            ← Gmail SMTP transporter
│
├── middleware/
│   ├── authMiddleware.js        ← JWT Bearer verification
│   ├── adminMiddleware.js       ← Role check (admin/mess_owner)
│   └── errorHandler.js          ← Global error handler
│
├── routes/
│   ├── authRoutes.js            ← /api/auth/*
│   ├── mealRoutes.js            ← /api/meals/*
│   ├── adminRoutes.js           ← /api/admin/*
│   ├── paymentRoutes.js         ← /api/payment/*
│   ├── approvalRoutes.js        ← /api/approval/*
│   ├── studentRoutes.js         ← /api/students/*
│   └── menuRoutes.js            ← /api/menu/*
│
├── controllers/
│   ├── authController.js
│   ├── mealController.js
│   ├── adminController.js
│   ├── paymentController.js
│   ├── approvalController.js
│   ├── studentController.js
│   └── menuController.js
│
└── services/
    ├── authService.js           ← Firebase Auth + JWT
    ├── mealService.js           ← Meal CRUD + cutoff logic
    ├── adminService.js          ← Stats, prediction, waste
    ├── paymentService.js        ← Razorpay order + verify
    ├── approvalService.js       ← Account creation on approval
    ├── emailService.js          ← Styled HTML emails
    ├── studentService.js        ← Student CRUD
    └── menuService.js           ← Daily menu management
```

---

## 🔄 Registration Flow

```
User clicks "Create Account"
        ↓
POST /api/payment/create-order   ← Backend creates ₹1 Razorpay order
        ↓
Razorpay Checkout opens in browser
        ↓
User pays ₹1
        ↓
POST /api/payment/verify         ← Backend verifies HMAC signature
        ↓
Payment saved to Firestore (status: pending_approval)
        ↓
📧 Email sent to admin (adarshbhandage20@gmail.com)
   with [Approve] and [Reject] buttons
        ↓
Admin clicks [Approve]
        ↓
GET /api/approval/action?token=... ← Signed JWT link
        ↓
Firebase Auth account created
Firestore user profile saved (approved: true)
        ↓
📧 Email sent to user with temp password
        ↓
User logs in → JWT issued → Dashboard access
```

---

## ⚙️ Prerequisites

| Tool | Version | Download |
|------|---------|---------|
| Node.js | ≥ 18.0 | [nodejs.org](https://nodejs.org) |
| Firebase Project | Free Spark | [console.firebase.google.com](https://console.firebase.google.com) |
| Razorpay Account | Free | [dashboard.razorpay.com](https://dashboard.razorpay.com) |

---

## 🔥 Step 1: Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it `smartfeed-ai`
2. **Authentication** → Get started → Enable **Email/Password**
3. **Firestore Database** → Create database → Start in test mode → Choose region (`asia-south1` recommended)
4. **Project Settings** → **Service accounts** → **Generate new private key** → Download JSON → rename to `serviceAccountKey.json` → place in `backend/config/`
5. **Project Settings** → **General** → Copy the **Web API Key** → set as `FIREBASE_WEB_API_KEY` in `.env`

---

## 💳 Step 2: Razorpay Setup

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com) (free)
2. Stay in **Test Mode** during development
3. Go to **Settings** → **API Keys** → **Generate Test Key**
4. Copy **Key ID** → set as `RAZORPAY_KEY_ID` in `.env`
5. Copy **Key Secret** → set as `RAZORPAY_KEY_SECRET` in `.env`

> **Note on UPI:** Razorpay handles UPI routing internally. After going live, set up your payout account in the Razorpay dashboard to receive funds to your UPI ID `6361767974@ybl`.

---

## 📧 Step 3: Gmail App Password (Nodemailer)

1. Go to **myaccount.google.com** → **Security**
2. Enable **2-Step Verification** (required)
3. Search for **"App passwords"** → Select app: **Mail** → Generate
4. Copy the 16-character password (spaces don't matter)
5. Set `EMAIL_USER=your_gmail@gmail.com` and `EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx` in `.env`

---

## 🚀 Step 4: Local Setup

```bash
# 1. Navigate to backend folder
cd c:\Smartfeed\backend

# 2. Install all dependencies
npm install

# 3. Copy and fill environment config
copy .env.example .env
# Edit .env with your Firebase, Razorpay, and Gmail values

# 4. Place Firebase service account key
# → config/serviceAccountKey.json

# 5. Start dev server
npm run dev
```

Health check: `GET http://localhost:5000/api/health`

---

## 🗄️ Firestore Collections

### `payments`
```json
{
  "userName": "Ravi Kumar",
  "userEmail": "ravi@example.com",
  "userPhone": "9876543210",
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "abc...",
  "amount": 100,
  "currency": "INR",
  "status": "pending_approval | approved | rejected",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "approvedAt": "2024-01-15T11:00:00.000Z",
  "firebaseUid": "uid_after_approval"
}
```

### `users`
```json
{
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "role": "student | mess_owner",
  "approved": true,
  "paymentId": "firestore_payment_doc_id",
  "createdAt": "2024-01-15T11:00:00.000Z"
}
```

### `students` (mess owner managed)
```json
{
  "name": "Priya Sharma",
  "usn": "1RV21CS043",
  "email": "priya@example.com",
  "phone": "9876543210",
  "addedBy": "admin_uid",
  "active": true,
  "createdAt": "2024-01-15T12:00:00.000Z"
}
```

### `menu`
```json
{
  "date": "2024-01-15",
  "breakfast": ["Idli", "Sambar", "Coconut Chutney"],
  "lunch": ["Rice", "Dal", "Rasam", "Papad"],
  "dinner": ["Chapati", "Paneer Butter Masala", "Curd"],
  "addedBy": "admin_uid"
}
```

---

## 📡 Complete API Reference

Base URL: `http://localhost:5000/api`

> 🔒 = Requires `Authorization: Bearer <token>` header  
> 👑 = Requires admin/mess_owner role

---

### 💳 Payment (`/api/payment`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payment/create-order` | Public | Create ₹1 Razorpay order |
| POST | `/payment/verify` | Public | Verify payment + save pending |
| GET  | `/payment/pending` | 🔒👑 | List pending approvals |

**POST `/payment/verify` body:**
```json
{
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "razorpay_signature": "abc...",
  "userName": "Ravi Kumar",
  "userEmail": "ravi@example.com",
  "userPhone": "9876543210"
}
```

---

### ✅ Approval (`/api/approval`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/approval/action?token=...` | Public | Process email link (returns HTML page) |
| POST | `/approval/approve/:paymentId` | 🔒👑 | Manual approve from dashboard |
| POST | `/approval/reject/:paymentId` | 🔒👑 | Manual reject from dashboard |

---

### 🔑 Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Login → JWT |
| GET  | `/auth/me` | 🔒 | Get own profile |

> **Note:** Signup is removed from auth routes. Account creation now happens only via payment + admin approval flow.

---

### 🍽️ Meals (`/api/meals`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meals/select-meal` | 🔒 | Select meals for today |
| GET  | `/meals/my-meals` | 🔒 | My meal history |
| PUT  | `/meals/update-meal` | 🔒 | Update today's selection |

---

### 🛡️ Admin (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/admin/stats` | 🔒👑 | Today's meal counts |
| GET  | `/admin/users` | 🔒👑 | All users |
| GET  | `/admin/daily-report` | 🔒👑 | Counts per day |
| GET  | `/admin/prediction` | 🔒👑 | AI demand prediction |
| POST | `/admin/add-waste` | 🔒👑 | Log food waste |
| GET  | `/admin/waste` | 🔒👑 | Waste records |

---

### 👨‍🎓 Students (`/api/students`) — Mess Owner

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/students/` | 🔒👑 | Add student manually |
| GET    | `/students/` | 🔒👑 | List all students |
| GET    | `/students/:id` | 🔒👑 | Get one student |
| PUT    | `/students/:id` | 🔒👑 | Edit student |
| DELETE | `/students/:id` | 🔒👑 | Remove student |
| GET    | `/students/:id/meals` | 🔒👑 | Student's meal history |

---

### 🗒️ Menu (`/api/menu`) — Mess Owner

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/menu/` | 🔒👑 | Set menu for a date |
| GET    | `/menu/today` | 🔒 | Today's menu |
| GET    | `/menu/:date` | 🔒 | Menu for a date |
| GET    | `/menu/?from=&to=` | 🔒👑 | Menu range |
| DELETE | `/menu/:date` | 🔒👑 | Delete menu |

---

## 🔗 Frontend Integration

### 1. Add scripts to your HTML

```html
<!-- Razorpay checkout (required for payment) -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>

<!-- SmartFeed API helper -->
<script src="path/to/smartfeed-api.js"></script>
```

### 2. Connect "Create Account" button

```javascript
document.getElementById('create-account-btn').addEventListener('click', async () => {
  const name  = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;

  SmartFeedAPI.payment.initiatePayment(
    { name, email, phone },
    (result) => {
      // Payment successful — now waiting for admin approval
      alert('Payment successful! Your account will be activated after admin approval. Check your email.');
    },
    (error) => {
      alert('Payment failed: ' + error);
    }
  );
});
```

### 3. Connect Login button

```javascript
document.getElementById('login-btn').addEventListener('click', async () => {
  try {
    const email    = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { user } = await SmartFeedAPI.auth.login(email, password);

    // Redirect based on role
    if (user.role === 'mess_owner') {
      window.location.href = '/dashboard-owner.html';
    } else {
      window.location.href = '/dashboard-student.html';
    }
  } catch (err) {
    alert(err.message); // Shows "pending approval" message for unapproved users
  }
});
```

### 4. Load admin dashboard data

```javascript
// On dashboard-owner.html load:
async function loadDashboard() {
  const [stats, students, pendingPayments] = await Promise.all([
    SmartFeedAPI.admin.getStats(),
    SmartFeedAPI.students.getAll(),
    SmartFeedAPI.admin.getPendingPayments(),
  ]);

  // Render stats
  document.getElementById('breakfast-count').textContent = stats.data.totalBreakfast;
  document.getElementById('lunch-count').textContent     = stats.data.totalLunch;
  document.getElementById('dinner-count').textContent    = stats.data.totalDinner;

  // Render student table
  renderStudentTable(students.data);

  // Render pending approvals
  renderPendingApprovals(pendingPayments.data);
}
```

---

## 🚀 Free Deployment (Railway)

1. Push `backend/` to a GitHub repository
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Add all environment variables in Railway's **Variables** tab
4. Update `BACKEND_URL` to your Railway URL (e.g., `https://smartfeed.up.railway.app`)
5. Railway auto-deploys on every git push

> For the service account key: use `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` env vars instead of a JSON file.

---

## 🔐 Create First Admin Account

Since students go through the payment flow, create your admin/mess_owner account manually:

```bash
# Run this one-time script (adjust values) from the backend directory
node -e "
require('dotenv').config();
const { auth, db } = require('./config/firebase');
auth.createUser({ email: 'admin@smartfeed.com', password: 'Admin@123', displayName: 'Mess Admin' })
  .then(u => db.collection('users').doc(u.uid).set({
    name: 'Mess Admin', email: 'admin@smartfeed.com',
    role: 'mess_owner', approved: true, createdAt: new Date().toISOString()
  }))
  .then(() => { console.log('Admin created!'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
"
```

---

*Built with ❤️ for SmartFeed AI — Every Plate Counts 🌿*


> **Intelligent Mess Management System** | Node.js + Express.js + Firebase

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey)](https://expressjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-Admin%20SDK-orange)](https://firebase.google.com)

---

## 📁 Project Structure

```
backend/
├── server.js                    # Entry point
├── package.json
├── .env.example                 # Template for environment variables
├── .gitignore
│
├── config/
│   ├── firebase.js              # Firebase Admin SDK initialisation
│   └── serviceAccountKey.json  # ← You add this (not in git)
│
├── routes/
│   ├── authRoutes.js            # /api/auth/*
│   ├── mealRoutes.js            # /api/meals/*
│   └── adminRoutes.js           # /api/admin/*
│
├── controllers/
│   ├── authController.js
│   ├── mealController.js
│   └── adminController.js
│
├── services/
│   ├── authService.js
│   ├── mealService.js
│   └── adminService.js
│
└── middleware/
    ├── authMiddleware.js        # JWT verification
    ├── adminMiddleware.js       # Role-based access (admin only)
    └── errorHandler.js          # Global error handler
```

---

## ⚙️ Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.0 |
| npm | ≥ 9.0 |
| Firebase Project | Free Spark plan |

---

## 🔥 Step 1: Firebase Setup

### 1.1 Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `smartfeed-ai`
3. Disable Google Analytics (optional) → click **Create project**

### 1.2 Enable Firebase Authentication

1. In the Firebase Console, go to **Authentication** → **Get started**
2. Click **Sign-in method** tab
3. Enable **Email/Password** provider → Save

### 1.3 Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Start in **test mode** (you can add security rules later)
3. Choose your preferred region (e.g., `asia-south1` for India)

### 1.4 Get Admin SDK Service Account Key

1. Go to **Project Settings** (gear icon) → **Service accounts** tab
2. Click **Generate new private key** → Download the JSON file
3. Rename it to `serviceAccountKey.json`
4. Place it in `backend/config/serviceAccountKey.json`
5. **Never commit this file to Git!** (already in `.gitignore`)

### 1.5 Get Web API Key (for login endpoint)

1. Go to **Project Settings** → **General** tab
2. Under **Your apps**, register a Web App if you haven't
3. Copy the `apiKey` value — this is your `FIREBASE_WEB_API_KEY`

---

## 🚀 Step 2: Local Setup & Run

### 2.1 Install Dependencies

```bash
cd c:\Smartfeed\backend
npm install
```

### 2.2 Configure Environment Variables

```bash
# Copy the template
copy .env.example .env
```

Edit `.env` with your values:

```env
PORT=5000
NODE_ENV=development

JWT_SECRET=my_super_secret_key_make_this_long_and_random
JWT_EXPIRES_IN=7d

FIREBASE_SERVICE_ACCOUNT_PATH=./config/serviceAccountKey.json
FIREBASE_WEB_API_KEY=AIzaSy_your_firebase_web_api_key_here

FRONTEND_URL=http://localhost:3000
```

### 2.3 Start Development Server

```bash
npm run dev       # Auto-restarts on file changes (nodemon)
# or
npm start         # Production mode
```

The server starts at: **http://localhost:5000**

Health check: `GET http://localhost:5000/api/health`

---

## 🗄️ Firestore Schema

### Collection: `users`
```json
{
  "uid": "firebase_generated_uid",
  "name": "Ravi Kumar",
  "usn": "1RV21CS042",
  "email": "ravi@example.com",
  "role": "student",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Collection: `meals`
```json
{
  "userId": "firebase_uid",
  "date": "2024-01-15",
  "breakfast": true,
  "lunch": true,
  "dinner": false,
  "createdAt": "2024-01-15T07:45:00.000Z",
  "updatedAt": "2024-01-15T07:45:00.000Z"
}
```
> Document ID format: `{userId}_{date}` (e.g., `abc123_2024-01-15`)  
> Ensures one selection per user per day.

### Collection: `waste`
```json
{
  "date": "2024-01-15",
  "mealType": "lunch",
  "quantity": 12.5,
  "unit": "kg",
  "notes": "Sambar was overcooked, many students skipped",
  "addedBy": "admin_uid",
  "createdAt": "2024-01-15T14:30:00.000Z"
}
```

---

## 🔐 API Reference

Base URL: `http://localhost:5000/api`

> **Authentication**: Protected routes require header:  
> `Authorization: Bearer <your_jwt_token>`

---

### 🔑 Auth Routes

#### `POST /auth/signup`
Register a new user.

**Request Body:**
```json
{
  "name": "Ravi Kumar",
  "usn": "1RV21CS042",
  "email": "ravi@example.com",
  "password": "securepass123",
  "role": "student"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully. Welcome to SmartFeed AI!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "uid": "abc123",
      "name": "Ravi Kumar",
      "usn": "1RV21CS042",
      "email": "ravi@example.com",
      "role": "student"
    }
  }
}
```

---

#### `POST /auth/login`
Login an existing user.

**Request Body:**
```json
{
  "email": "ravi@example.com",
  "password": "securepass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful. Welcome back!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "uid": "abc123",
      "name": "Ravi Kumar",
      "role": "student"
    }
  }
}
```

---

#### `GET /auth/me` 🔒
Get current user profile.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "uid": "abc123",
    "name": "Ravi Kumar",
    "usn": "1RV21CS042",
    "email": "ravi@example.com",
    "role": "student",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### 🍽️ Meal Routes (Protected)

#### `POST /meals/select-meal` 🔒
Select meals for today. Blocked after cutoff time.

| Meal      | Cutoff |
|-----------|--------|
| Breakfast | 8:00 AM IST |
| Lunch     | 10:00 AM IST |
| Dinner    | 5:00 PM IST |

**Request Body:**
```json
{
  "breakfast": true,
  "lunch": true,
  "dinner": false
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Meal selection saved successfully!",
  "data": {
    "id": "abc123_2024-01-15",
    "userId": "abc123",
    "date": "2024-01-15",
    "breakfast": true,
    "lunch": true,
    "dinner": false,
    "createdAt": "2024-01-15T07:45:00.000Z"
  }
}
```

**Cutoff Error (403):**
```json
{
  "success": false,
  "message": "Cutoff time has passed for: breakfast. No changes saved."
}
```

---

#### `GET /meals/my-meals` 🔒
Fetch all meal selections for the logged-in user.

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "abc123_2024-01-15",
      "date": "2024-01-15",
      "breakfast": true,
      "lunch": true,
      "dinner": false
    }
  ]
}
```

---

#### `PUT /meals/update-meal` 🔒
Update today's meal selection. Only works before cutoff.

**Request Body:**
```json
{
  "dinner": true
}
```

---

### 🛡️ Admin Routes (Admin Role Required)

#### `GET /admin/stats` 🔒👑
Today's meal selection counts.

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "totalStudents": 120,
    "totalBreakfast": 98,
    "totalLunch": 115,
    "totalDinner": 87
  }
}
```

---

#### `GET /admin/users` 🔒👑
List all registered users.

---

#### `GET /admin/daily-report` 🔒👑
Meal counts grouped by date.

**Response:**
```json
{
  "success": true,
  "count": 7,
  "data": [
    {
      "date": "2024-01-15",
      "totalBreakfast": 98,
      "totalLunch": 115,
      "totalDinner": 87,
      "totalSelections": 122
    }
  ]
}
```

---

#### `GET /admin/prediction` 🔒👑
AI-predicted food demand for today with 5–10% buffer.

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "generatedAt": "2024-01-15T09:30:00.000Z",
    "note": "Predictions include a 5–10% buffer over actual selections",
    "meals": {
      "breakfast": {
        "actual": 98,
        "predicted": 105,
        "bufferPercent": 7
      },
      "lunch": {
        "actual": 115,
        "predicted": 124,
        "bufferPercent": 8
      },
      "dinner": {
        "actual": 87,
        "predicted": 93,
        "bufferPercent": 7
      }
    }
  }
}
```

---

#### `POST /admin/add-waste` 🔒👑
Log food waste data.

**Request Body:**
```json
{
  "mealType": "lunch",
  "quantity": 12.5,
  "unit": "kg",
  "date": "2024-01-15",
  "notes": "Excess rice prepared"
}
```

---

#### `GET /admin/waste` 🔒👑
Retrieve waste records.
```
GET /admin/waste?from=2024-01-01&to=2024-01-31
```

---

## 📦 Postman Testing

1. Import `postman_collection.json` from this directory into Postman
2. Set environment variable `base_url` = `http://localhost:5000/api`
3. After login, copy the token and set `auth_token` variable
4. All protected routes use `{{auth_token}}` as Bearer token

---

## 🚀 Deployment (Free — Railway)

### Option A: Railway (Recommended)

1. Push your `backend/` folder to a GitHub repository
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repository
4. Add environment variables in Railway's **Variables** tab (all values from `.env`)
5. Railway auto-deploys and gives you a public URL

### Option B: Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo, set **Root Directory** to `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add environment variables in the Render dashboard

### Important for Deployment:
- Upload `serviceAccountKey.json` as a **secret file** (don't put in git)
- OR use the `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` env vars instead
- Set `NODE_ENV=production` in the deployment environment

---

## 🔒 Firestore Security Rules

Add these rules in your Firebase Console → Firestore → Rules tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read their own profile; admins can read all
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // Only writable by Admin SDK (server-side)
    }

    // Meals: users can read/write their own records
    match /meals/{mealId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    // Waste: only accessible server-side (no client access)
    match /waste/{wasteId} {
      allow read, write: if false;
    }
  }
}
```

---

## 🧪 Error Response Format

All errors follow this consistent format:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthenticated (no/invalid token) |
| 403 | Forbidden (wrong role or past cutoff) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate meal selection) |
| 500 | Internal server error |

---

## 🔗 Frontend Integration

To call the API from your existing `index.html` frontend:

```javascript
const API_URL = 'http://localhost:5000/api'; // or your deployed URL

// Login example
async function loginUser(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('sf_token', data.data.token);
    localStorage.setItem('sf_user', JSON.stringify(data.data.user));
  }
  return data;
}

// Authenticated request example
async function selectMeal(breakfast, lunch, dinner) {
  const token = localStorage.getItem('sf_token');
  const response = await fetch(`${API_URL}/meals/select-meal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ breakfast, lunch, dinner })
  });
  return response.json();
}
```

---

*Built with ❤️ for SmartFeed AI — Every Plate Counts 🌿*
