# MedTrack — Medical Shop Khata Ledger & Counter POS

**MedTrack** is a digital khata (ledger) management and counter billing system designed for retail pharmacies. Engineered for counter speed, it tracks customer medicine purchases, maintains mathematically derived zero-error due balances, and replaces physical credit registers with sub-2-second customer phone lookups.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Clients["Frontend Applications"]
        Web["Web Countertop Client (React 18 + Vite + Tailwind CSS)"]
        Mobile["Mobile Android App (React Native Expo + Local SQLite)"]
    end

    subgraph AuthLayer["Authentication (Supabase Auth)"]
        SupabaseAuth["Supabase Email OTP Engine"]
        SessionStore["Local Storage / SecureStore Session"]
    end

    subgraph ServerLayer["Backend API (Node.js & Express)"]
        APIRouter["Express REST API (Port 4000)"]
        AuthGuard["JWT Verification Middleware"]
        PDFKit["Thermal PDF Bill Generator"]
        BackupService["Automated Daily DB Backup Service"]
    end

    subgraph DatabaseLayer["Data Persistence"]
        PostgresDB[("Supabase Cloud PostgreSQL")]
        SQLiteDB[("Local SQLite WAL Engine (better-sqlite3)")]
        ShopProfileTab[("shop_profile Table (8 Fields)")]
        CustomersTab[("customers (soft-delete with deleted_at)")]
    end

    Web -->|"Email OTP Sign In"| SupabaseAuth
    Mobile -->|"Email OTP Sign In"| SupabaseAuth
    SupabaseAuth -->|"Session Token"| SessionStore
    Web -->|"Bearer JWT Authorization"| AuthGuard
    AuthGuard --> APIRouter
    APIRouter --> PDFKit
    APIRouter --> BackupService
    APIRouter --> PostgresDB
    APIRouter --> SQLiteDB
    Mobile -->|"Offline-First Direct Access"| SQLiteDB
    PostgresDB --- CustomersTab
    PostgresDB --- ShopProfileTab
```

---

## 🚀 Key System Features

- **Phone-Number-First Customer Search**:
  - Auto-focused search bar on load (`/` global shortcut).
  - Instant phone lookup (< 2s) with fallback name and village search.
  - Excludes soft-deleted customers by default (`WHERE deleted_at IS NULL`).
- **Soft-Delete with Recycle Bin**:
  - Customer deletion sets `deleted_at` timestamp rather than hard-deleting records.
  - Confirmation dialog alerts if the customer has outstanding dues.
  - Dedicated **Recycle Bin** screen displays soft-deleted customers with **Restore** (clears `deleted_at`) and **Delete Permanently** (cascades ledger entries).
- **Percentage-Based Discount Engine**:
  - Each medicine purchase line item supports an individual **Discount %** field (0–100).
  - Calculated formula: `netTotal = price - (price * discountPercent / 100)`, clamped between ₹0 and the original price.
  - Live auto-summed bill total and persisted database records reflect post-discount amounts.
- **Shop & Pharmacist Profile**:
  - Dedicated `shop_profile` table storing Shop Name, Form 20B License, Form 21B License, Shop License Validity, Shop Phone, Pharmacist Name, Pharmacist Phone, and Pharmacist License Validity.
  - Display-only validity dates show a muted `(Expired)` indicator if past due, with zero popups or disruptive alerts.
- **Email OTP Authentication (Supabase Auth)**:
  - Passwordless, secure email OTP login using Supabase Auth.
  - No SMS provider (Twilio) required.
  - Session persistence verified across both Web and Mobile client frontends.
- **Zero-Error Due Accounting**:
  - Customer due is strictly computed on read: $\text{Due} = \sum (\text{entries.due\_amount}) - \sum (\text{payments.amount})$.
  - Never stored as an editable column.

---

## 🔒 Input Validation Rules

| Field Name | Target Entity / Route | Format / Validation Rule | Length / Value Limits | Behavior on Failure |
|---|---|---|---|---|
| `phone_number` | `customers`, `/api/customers` | 10 Indian digits, starts with 6-9: `^[6-9]\d{9}$` (non-digits stripped) | Exactly 10 digits | Returns `400: Valid 10-digit mobile number required` |
| `name` | `customers`, `/api/customers` | String, trimmed | 2 to 100 characters | Returns `400: Customer name must be 2-100 characters` |
| `village` | `customers`, `/api/customers` | String, optional | Max 100 characters | Truncated / rejected if too long |
| `address` | `customers`, `/api/customers` | String, optional | Max 255 characters | Optional text note |
| `medicine_name`| `entry_medicine`, `/api/entries`| String, non-empty | 1 to 150 characters | Rejected if blank |
| `price` | `entry_medicine`, `/api/entries`| Numeric, non-negative | ₹0.00 to ₹999,999.00 | Clamped / rejects negative values |
| `discount_percent`| `entry_medicine`, `/api/entries`| Numeric (0–100) | Clamped between 0% and 100% | Negative becomes 0, >100 becomes 100 |
| `total_amount` | `entries`, `/api/entries` | Numeric, post-discount sum | >= ₹0.00 | Auto-calculated |
| `amount_paid` | `entries`, `payments` | Numeric, non-negative | ₹0.00 to ₹999,999.00 | Rejects negative values |
| `note` | `payments`, `/api/payments` | String, optional | Max 255 characters | Stored as text note |
| `license_20b` | `shop_profile` | String (Alphanumeric/slashes) | Max 50 characters | Optional |
| `license_21b` | `shop_profile` | String (Alphanumeric/slashes) | Max 50 characters | Optional |
| `validity dates` | `shop_profile` | Date format: `YYYY-MM-DD` | Valid calendar date | Checked against current timestamp |

---

## 📡 Complete REST API Reference & Sample JSON Responses

### 1. System & Health

#### `GET /api/health`
Checks server uptime and authentication provider status.
```json
{
  "status": "ok",
  "timestamp": "2026-09-25T07:15:00.000Z",
  "auth": "supabase-jwt"
}
```

#### `GET /api/config`
Retrieves countertop store metadata.
```json
{
  "shop": {
    "name": "MedTrack Medical & General Store",
    "tagline": "Trusted Care & Healthcare Essentials",
    "address": "Main Road, Opp. Primary Health Center",
    "city": "Nizampet, Hyderabad",
    "phone": "+91 98765 43210",
    "dlNo": "DL-20B/21B-54892",
    "gstin": "36AABCM1234F1Z8"
  },
  "systemTime": "2026-09-25T07:15:00.000Z",
  "status": "online"
}
```

---

### 2. Customers & Recycle Bin

#### `GET /api/customers/search?q=98480`
Searches active customers by phone, name, or village (excludes soft-deleted).
```json
[
  {
    "customer_id": 1,
    "phone_number": "9848012345",
    "name": "Ramesh Kumar",
    "village": "Nizampet",
    "address": "Plot 42, Near Water Tank",
    "total_due": 450.00,
    "last_visit": "2026-09-24T14:30:00.000Z",
    "deleted_at": null
  }
]
```

#### `GET /api/customers/:id`
Retrieves detailed khata profile with derived total due and visit records.
```json
{
  "customer_id": 1,
  "phone_number": "9848012345",
  "name": "Ramesh Kumar",
  "village": "Nizampet",
  "address": "Plot 42, Near Water Tank",
  "total_due": 450.00,
  "deleted_at": null,
  "entries": [
    {
      "entry_id": 101,
      "entry_date": "2026-09-24T14:30:00.000Z",
      "total_amount": 550.00,
      "amount_paid": 100.00,
      "due_amount": 450.00,
      "medicines": [
        {
          "medicine_name": "Amoxicillin 500mg",
          "price": 95.00,
          "original_price": 100.00,
          "discount_percent": 5
        }
      ]
    }
  ],
  "payments": []
}
```

#### `POST /api/customers`
Registers a new customer.
```json
// Request Body
{
  "name": "Suresh Reddy",
  "phone_number": "9848099999",
  "village": "Miyapur",
  "address": "Flat 302, Sri Sai Nilayam"
}

// Response (201 Created)
{
  "customer_id": 2,
  "name": "Suresh Reddy",
  "phone_number": "9848099999",
  "village": "Miyapur",
  "address": "Flat 302, Sri Sai Nilayam",
  "total_due": 0.00,
  "deleted_at": null
}
```

#### `DELETE /api/customers/:id` (Soft Delete)
Marks customer as soft-deleted by setting `deleted_at`.
```json
// Response (200 OK)
{
  "success": true,
  "message": "Customer moved to recycle bin",
  "customer_id": 2,
  "deleted_at": "2026-09-25T07:18:22.000Z"
}
```

#### `GET /api/customers/deleted` (Recycle Bin)
Lists all soft-deleted customers available for restoration or hard deletion.
```json
[
  {
    "customer_id": 2,
    "phone_number": "9848099999",
    "name": "Suresh Reddy",
    "village": "Miyapur",
    "address": "Flat 302, Sri Sai Nilayam",
    "total_due": 0.00,
    "deleted_at": "2026-09-25T07:18:22.000Z"
  }
]
```

#### `POST /api/customers/:id/restore`
Restores soft-deleted customer back to active ledger.
```json
// Response (200 OK)
{
  "success": true,
  "message": "Customer restored successfully",
  "customer_id": 2
}
```

#### `DELETE /api/customers/:id/permanent` (Permanent Hard Delete)
Permanently deletes customer and cascades related purchase and payment records.
```json
// Response (200 OK)
{
  "success": true,
  "message": "Customer and associated records permanently deleted",
  "customer_id": 2
}
```

---

### 3. Purchases & Percentage Discount Engine

#### `POST /api/entries`
Creates a counter purchase entry with line-item percentage discounts.
```json
// Request Body
{
  "customer_id": 1,
  "medicines": [
    {
      "medicine_name": "Paracetamol 650mg",
      "price": 95.00,
      "original_price": 100.00,
      "discount_percent": 5
    },
    {
      "medicine_name": "Cetirizine 10mg",
      "price": 45.00,
      "original_price": 50.00,
      "discount_percent": 10
    }
  ],
  "total_amount": 140.00,
  "amount_paid": 40.00
}

// Response (201 Created)
{
  "success": true,
  "entry_id": 102,
  "customer_id": 1,
  "total_amount": 140.00,
  "amount_paid": 40.00,
  "due_amount": 100.00,
  "entry_date": "2026-09-25T07:20:00.000Z"
}
```

---

### 4. Payments & Settlements

#### `POST /api/payments`
Records a payment to reduce customer outstanding due.
```json
// Request Body
{
  "customer_id": 1,
  "amount": 100.00,
  "note": "Paid via PhonePe / UPI"
}

// Response (201 Created)
{
  "success": true,
  "payment_id": 51,
  "customer_id": 1,
  "amount": 100.00,
  "pay_date": "2026-09-25T07:22:00.000Z",
  "remaining_due": 450.00
}
```

---

### 5. Shop & Pharmacist Profile

#### `GET /api/shop-profile`
Retrieves store credentials and pharmacist details.
```json
{
  "id": 1,
  "shop_name": "MedTrack Medical & General Store",
  "license_20b": "20B/HYD/2024/0981",
  "license_21b": "21B/HYD/2024/0982",
  "shop_license_validity": "2028-12-31",
  "shop_phone": "+91 98765 43210",
  "pharmacist_name": "Rama Venkata Charan",
  "pharmacist_phone": "9848012345",
  "pharmacist_license_validity": "2029-06-30",
  "updated_at": "2026-09-25T07:00:00.000Z"
}
```

#### `PUT /api/shop-profile`
Updates store and pharmacist credentials.
```json
// Request Body
{
  "shop_name": "MedTrack Pharmacy & Health Hub",
  "license_20b": "20B/HYD/2024/0981",
  "license_21b": "21B/HYD/2024/0982",
  "shop_license_validity": "2028-12-31",
  "shop_phone": "+91 98765 43210",
  "pharmacist_name": "Rama Venkata Charan",
  "pharmacist_phone": "9848012345",
  "pharmacist_license_validity": "2029-06-30"
}

// Response (200 OK)
{
  "success": true,
  "profile": {
    "id": 1,
    "shop_name": "MedTrack Pharmacy & Health Hub",
    "license_20b": "20B/HYD/2024/0981",
    "license_21b": "21B/HYD/2024/0982",
    "shop_license_validity": "2028-12-31",
    "shop_phone": "+91 98765 43210",
    "pharmacist_name": "Rama Venkata Charan",
    "pharmacist_phone": "9848012345",
    "pharmacist_license_validity": "2029-06-30"
  }
}
```

---

### 6. Reports & Analytics

#### `GET /api/reports/dues`
Aggregated store receivables report excluding soft-deleted accounts.
```json
{
  "total_dues": 450.00,
  "debtor_count": 1,
  "villages_count": 1,
  "customers": [
    {
      "customer_id": 1,
      "name": "Ramesh Kumar",
      "phone_number": "9848012345",
      "village": "Nizampet",
      "total_due": 450.00,
      "last_visit": "2026-09-24T14:30:00.000Z"
    }
  ]
}
```

---

## ⚙️ Environment Variables Template (`.env.example`)

Copy the template below to `.env`:

```env
# ==============================================================================
# MedTrack Environment Configuration
# ==============================================================================

# Node Runtime
NODE_ENV=development
PORT=4000

# Database Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.vhkhdyraxtfajhfaewun.supabase.co:5432/postgres
# (Or local SQLite file path: file:./server/db/medtrack.sqlite)

# CORS Whitelist (Comma-separated)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:8081,http://localhost:5173

# Supabase Auth & Project Keys
SUPABASE_URL=https://vhkhdyraxtfajhfaewun.supabase.co
SUPABASE_ANON_KEY=sb_publishable_m1St44piDuyUpi8RUv5E0Q_gUd5sW16
SUPABASE_SERVICE_KEY=your_supabase_service_role_secret_key_here

# Auth Enforcer (Set to false for offline/mock development)
REQUIRE_AUTH=false

# Client-Side Variables (Vite & Expo)
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://vhkhdyraxtfajhfaewun.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_m1St44piDuyUpi8RUv5E0Q_gUd5sW16
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api
EXPO_PUBLIC_SUPABASE_URL=https://vhkhdyraxtfajhfaewun.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_m1St44piDuyUpi8RUv5E0Q_gUd5sW16
```

---

## ⚡ Quick Start Instructions

### 1. Start Backend Server
```bash
cd server
npm install
npm start
```

### 2. Start Web Client
```bash
cd client
npm install
npm run dev
```
Open **`http://localhost:3001`** in your browser.

### 3. Start Mobile App
```bash
cd mobile
npm install
npx expo start
```
Press `a` for Android Emulator or scan QR with Expo Go.
