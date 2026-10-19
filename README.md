# BayFlow — Auto Repair Shop Operating System

> **A production-grade, multi-tenant workshop operating system purpose-built for Pakistan’s automotive repair industry.**

BayFlow streamlines the entire lifecycle of an automotive repair workshop—from online customer appointment booking and real-time step-by-step vehicle tracking to role-based Point-of-Sale (POS) stations, itemized estimate approval, procurement with inventory stock-allocation, atomic Quality Control (QC) loops, and an AI-powered voice receptionist.

---

## 🚀 Key Highlights & Architectural Strengths

- **Strict 17-Status Finite State Machine**: Exactly models the real-world garage repair workflow with zero forbidden skips or illegal jumps.
- **Failed QC Rework Loop**: Failed inspections transition `QC_IN_PROGRESS -> IN_REPAIR` while generating an immutable `QCIssue` defect log.
- **Customer-Only Financial Authority**: Moving from `AWAITING_CUSTOMER -> ESTIMATE_APPROVED / ESTIMATE_REJECTED` is strictly restricted to the vehicle owner. Service Advisors cannot override.
- **Pre-Repair Cancellation & Inventory Protection**: Cancellations are permitted strictly before `IN_REPAIR` and automatically release allocated stock back to inventory. Any cancellation attempt once the vehicle enters repair throws an HTTP 409 Conflict.
- **Multi-Tenant Shop Isolation**: Cross-tenant data isolation strictly enforced via `verifyTenantAccess`. Staff members of Workshop A receive HTTP 403 `CROSS_TENANT_ACCESS_DENIED` if attempting any action on Workshop B bookings.
- **Full Pakistan Localization**:
  - Currency: Pakistani Rupees (PKR / ₨) across all invoices, estimates, and catalogs.
  - Tax: Configurable, optional, default 0% (in line with local workshop taxation models).
  - Vehicle License Plates: Standard provincial formats (e.g. `LEA-21-4892`, `ICT-23-7744`, `KHI-19-9021`) rendered in monospace.
  - Phone Format: Pakistani mobile numbers (`+92 300 1234567`).
  - Cities: Pre-seeded with flagship hubs in Lahore, Karachi, and Islamabad.
- **Bonus: OpenRouter AI Front Desk**:
  - Live conversational assistant with server-side tool calling (`find_customer`, `get_bookings`, `get_estimate`).
  - 20-second unanswered Service Advisor alert with animated countdown and automatic pickup.
  - Browser Web Speech API: Voice synthesis playback and microphone speech recognition.
  - Automatic post-call transcription, executive summary generation, and actionable `AITask` dispatching.

---

## 🔄 17-Status Booking Lifecycle & State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Customer books slot
    PENDING --> CONFIRMED: Service Advisor confirms
    CONFIRMED --> ASSIGNED: Assign Technician
    ASSIGNED --> INSPECTING: Tech begins inspection
    INSPECTING --> ESTIMATE_REVIEW: Assigned Tech finishes diagnosis
    ESTIMATE_REVIEW --> AWAITING_CUSTOMER: SA sends estimate (PKR)
    AWAITING_CUSTOMER --> ESTIMATE_REJECTED: Customer declines estimate
    ESTIMATE_REJECTED --> ESTIMATE_REVIEW: SA revises quotation (Rev +1)
    AWAITING_CUSTOMER --> ESTIMATE_APPROVED: Customer approves estimate
    ESTIMATE_APPROVED --> PARTS_PENDING: Parts Person reviews parts
    PARTS_PENDING --> PARTS_READY: In-stock parts allocated
    PARTS_PENDING --> PARTS_ORDERED: Purchase Order created
    PARTS_ORDERED --> PARTS_ORDERED: Partial shipment receipt
    PARTS_ORDERED --> PARTS_READY: Complete PO received
    PARTS_READY --> IN_REPAIR: Tech starts mechanical repair
    IN_REPAIR --> QC_PENDING: Tech finishes repairs
    QC_PENDING --> QC_IN_PROGRESS: QC Inspector claims job
    QC_IN_PROGRESS --> IN_REPAIR: QC Failed (Creates QCIssue defect)
    QC_IN_PROGRESS --> READY_FOR_PICKUP: QC Passed (30-pt checklist)
    READY_FOR_PICKUP --> COMPLETED: Customer or SA confirms pickup
    COMPLETED --> [*]

    state PreRepairCancellation {
        PENDING --> CANCELLED: Allowed (releases parts)
        CONFIRMED --> CANCELLED: Allowed
        ASSIGNED --> CANCELLED: Allowed
        INSPECTING --> CANCELLED: Allowed
        ESTIMATE_REVIEW --> CANCELLED: Allowed
        AWAITING_CUSTOMER --> CANCELLED: Allowed
        ESTIMATE_APPROVED --> CANCELLED: Allowed
        PARTS_PENDING --> CANCELLED: Allowed
        PARTS_ORDERED --> CANCELLED: Allowed
        PARTS_READY --> CANCELLED: Allowed
    }
```

> **Cancellation Boundary Rule**: Cancellation is legally prohibited once the vehicle status reaches `IN_REPAIR`. Attempting to cancel during `IN_REPAIR`, `QC_PENDING`, `QC_IN_PROGRESS`, `READY_FOR_PICKUP`, or `COMPLETED` throws an HTTP 409 Conflict.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16 (App Router with Turbopack) |
| **Language** | TypeScript 5 (Strict Mode) |
| **Styling** | Vanilla Tailwind CSS (Custom Warm Workshop Palette) |
| **Typography** | Bricolage Grotesque (Headings), Manrope (Body), JetBrains Mono (Plates/Numbers) |
| **Database** | PostgreSQL via Neon Serverless Postgres |
| **ORM** | Prisma 5.22.0 (with direct connection pooling for migrations) |
| **Authentication** | JWT stored in httpOnly, secure cookies (`bayflow_token`) with role claims |
| **State & Polling** | TanStack React Query (7-second real-time polling on tracker and POS queues) |
| **AI Integration** | OpenRouter (`anthropic/claude-3.5-sonnet`) with local intelligent fallback |
| **Voice / Speech** | Web Speech API (`SpeechSynthesis` & `webkitSpeechRecognition`) |
| **Testing** | Vitest with 58 automated unit and full-lifecycle integration tests |

---

## 👥 Demo Staff & Customer Accounts

All demo accounts share the password: **`bayflow2026`**. On the `/login` screen, click any demo account pill to instantly pre-fill credentials.

| Role | Email | Password | Access & Responsibilities |
|---|---|---|---|
| **Workshop Owner** | `owner@bayflow.pk` | `bayflow2026` | Multi-shop switcher, team roster management, services catalog, branch creation |
| **Service Advisor** | `sa.lahore@bayflow.pk` | `bayflow2026` | Vehicle intake, technician assignment, itemized estimate generation, handover |
| **Master Technician**| `tech.lahore@bayflow.pk` | `bayflow2026` | Diagnosis, inspection notes submission, repair tracker, QC submission & rework |
| **Parts Manager** | `parts.lahore@bayflow.pk`| `bayflow2026` | Inventory queue, stock allocation, purchase orders, partial/full receipt |
| **QC Inspector** | `qc.lahore@bayflow.pk` | `bayflow2026` | Atomic job claim lock, 30-point safety checklist, pass/fail defect loop |
| **Customer** | `customer@bayflow.pk` | `bayflow2026` | Appointment booking, real-time vehicle tracker, estimate approval, pickup confirm |

---

## 💻 POS Stations Overview

1. **Service Advisor Station** (`/pos/service-advisor`):
   - Real-time intake queue with 7-second live polling.
   - Slot confirmation (`PENDING -> CONFIRMED`).
   - Master technician assignment modal (`CONFIRMED -> ASSIGNED`).
   - Dynamic itemized quotation builder with server-side labor and parts calculation in PKR.
   - Vehicle handover and payment settlement (`READY_FOR_PICKUP -> COMPLETED`).

2. **Master Technician Station** (`/pos/technician`):
   - Diagnosis queue: claims vehicle inspection (`ASSIGNED -> INSPECTING`).
   - Inspection findings submission (`INSPECTING -> ESTIMATE_REVIEW`).
   - Mechanical repair execution (`PARTS_READY -> IN_REPAIR`).
   - QC queue submission (`IN_REPAIR -> QC_PENDING`).
   - Displays QC failure punchlists prominently when rework is required.

3. **Parts Specialist Station** (`/pos/parts`):
   - Parts fulfillment queue for approved repair jobs (`ESTIMATE_APPROVED -> PARTS_PENDING`).
   - One-click in-stock parts allocation (`PARTS_PENDING -> PARTS_READY`).
   - Supplier Purchase Order generation for missing parts (`PARTS_PENDING -> PARTS_ORDERED`).
   - Receiving shipments: partial receipt keeps order open; complete receipt advances vehicle to `PARTS_READY`.

4. **QC Inspector Station** (`/pos/qc`):
   - Quality inspection queue (`QC_PENDING`).
   - Atomic job claim lock via database transaction (`QC_PENDING -> QC_IN_PROGRESS`).
   - 30-point interactive inspection checklist.
   - Inspection pass (`QC_IN_PROGRESS -> READY_FOR_PICKUP`).
   - Inspection fail loop: requires defect title & punchlist description, creates immutable `QCIssue`, and loops back to technician (`QC_IN_PROGRESS -> IN_REPAIR`).

5. **AI Front Desk & Automated Dispatch** (`/pos/ai-logs`):
   - Accessible via the "AI Reception" badge from any station or navbar.
   - Interactive 20-second unattended SA trigger bar with automatic pickup.
   - Web Speech voice synthesis and microphone input.
   - Real-time tool-calling querying live Prisma records (`find_customer`, `get_bookings`, `get_estimate`).
   - Automatic call logging (`AICallLog`) and punchlist task generation (`AITask`).

---

## 🧪 Testing Suite (58 Tests Passing)

BayFlow features an automated Vitest test suite validating:
- The full 17-status finite state machine and role transitions.
- Multi-tenant data isolation and cross-tenant access rejection (HTTP 403).
- Strict pre-repair vs. post-repair cancellation rules (HTTP 409).
- Atomic inventory release upon pre-repair cancellation.
- Defect logging on QC failure loops (`QCIssue`).
- AI Front Desk tool execution against live Prisma database models.

To run the test suite:
```bash
npm test -- --run
```

```text
 ✓ src/lib/__tests__/full-flow-lifecycle.test.ts (29 tests)
 ✓ src/lib/__tests__/booking-state-machine.test.ts (22 tests)
 ✓ src/lib/__tests__/ai-tools.test.ts (3 tests)
 ✓ src/lib/__tests__/tenant-guard.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  58 passed (58)
```

---

## 📦 Setup & Local Installation

### Prerequisites
- Node.js 18+ or 20+
- A Neon PostgreSQL database instance (or local PostgreSQL)

### 1. Clone & Install Dependencies
```bash
cd bayflow
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your database connection strings:
```env
# PostgreSQL / Neon Database Connection Strings
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT Authentication Secret
JWT_SECRET="bayflow_super_secret_jwt_key_2026_production_at_least_32_chars"
JWT_EXPIRES_IN="7d"

# App URL
CLIENT_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# OpenRouter AI Front Desk (Optional, fallback provided)
OPENROUTER_API_KEY=""
OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"
```

### 3. Generate Prisma Client & Run Migrations
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Seed Database with Pakistani Workshops & Sample Data
```bash
npx prisma db seed
```
This populates:
- 3 Pakistani workshops (BayFlow Central Lahore, Karachi Hub, Islamabad Twin Cities).
- Complete staff roster with realistic Pakistani credentials.
- 10+ standard mechanical, electrical, and maintenance services in PKR.
- 15+ inventory parts with OEM SKUs and stock counts.
- 14 days of calendar booking slots.
- Active demo booking `BF-2026-1001` (2021 Honda Civic, plate `LEA-21-4892`).

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Verification & Demonstration Paths

- **Public Landing Page**: [http://localhost:3000/](http://localhost:3000/)
- **Workshop Directory**: [http://localhost:3000/shops](http://localhost:3000/shops)
- **5-Step Booking Wizard**: [http://localhost:3000/book](http://localhost:3000/book)
- **Customer Vehicle Live Tracker**: [http://localhost:3000/track/BF-2026-1001](http://localhost:3000/track/BF-2026-1001)
- **Staff Login (Click-to-Fill)**: [http://localhost:3000/login](http://localhost:3000/login)
- **Service Advisor Station**: [http://localhost:3000/pos/service-advisor](http://localhost:3000/pos/service-advisor)
- **Master Technician Station**: [http://localhost:3000/pos/technician](http://localhost:3000/pos/technician)
- **Parts Specialist Station**: [http://localhost:3000/pos/parts](http://localhost:3000/pos/parts)
- **QC Inspector Station**: [http://localhost:3000/pos/qc](http://localhost:3000/pos/qc)
- **Owner Management Dashboard**: [http://localhost:3000/owner](http://localhost:3000/owner)
- **AI Front Desk Center**: [http://localhost:3000/pos/ai-logs](http://localhost:3000/pos/ai-logs)

---

## 🛡️ License & Compliance

Designed and built for the National Web Development Hackathon. All rights reserved.
