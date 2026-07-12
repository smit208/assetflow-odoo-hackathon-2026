# AssetFlow — Enterprise Asset Management System

> Built for Odoo Hackathon 2026 | React + Supabase (PostgreSQL) | Live ERP

AssetFlow is a full-stack enterprise resource planning system for managing organizational assets — from registration and allocation to maintenance, auditing, and resource booking — with real-time data, role-based access control, and conflict-aware workflows.

---

## Live Demo

**URL:** [https://assetflow-odoo-hackathon-2026.vercel.app](https://assetflow-odoo-hackathon-2026.vercel.app)

**Quick login credentials:**
| Role | Email | Password |
|---|---|---|
| Admin | admin@assetflow.com | admin123 |
| Asset Manager | manager@assetflow.com | manager123 |
| Employee | employee@assetflow.com | employee123 |

---

## Problem Statement

Organizations struggle to track physical assets (laptops, vehicles, rooms, equipment) across departments. Key pain points:

- No visibility into who holds what asset at any time
- Maintenance requests go untracked, assets sit broken
- Double-booking of shared resources (meeting rooms, projectors)
- Audit cycles are manual and asset loss goes undetected
- No structured transfer process between employees

**AssetFlow solves all of the above in one unified system.**

---

## Core Features

### 1. Role-Based Access Control
- **Admin** — Full access: org setup, role assignment, audit management
- **Asset Manager** — Approve allocations, maintenance, transfers
- **Department Head** — View department assets and raise requests
- **Employee** — View allocated assets, raise maintenance requests, book resources

### 2. Organization Setup
- Department hierarchy with parent-child relationships (e.g., Backend Team under Engineering)
- Active/Inactive department toggle (soft disable, never deletes)
- Category management with custom dynamic fields per category (Electronics: Warranty Period, Vehicles: Next Service Mileage)
- Employee role escalation — only Admin can promote/demote roles

### 3. Asset Registry
- Sequential asset tagging: **AF-0001, AF-0002, ...** (not random UUIDs)
- QR code auto-generated on registration
- `is_bookable` flag — if checked, asset appears in the Resource Booking calendar
- Full lifecycle states: Available, Allocated, Reserved, Under Maintenance, Lost, Retired

### 4. Allocation and Transfer Engine
- Asset Manager allocates available assets to employees
- **Conflict detection:** if asset is already held, UI explicitly shows:
  > "Currently held by Arjun Mehta" + [Request Transfer] button
- Clicking Request Transfer writes a row to `transfer_requests` with status `requested`
- Asset Managers approve/reject transfers

### 5. Resource Booking with Overlap Detection
- 7-day visual heatmap showing booked/available slots (08:00–20:00)
- Overlap validation formula enforced in PostgreSQL:
  ```
  StartA < EndB  AND  EndA > StartB
  ```
- A booking for 09:30–10:30 fails if 09:00–10:00 is taken; 10:00–11:00 succeeds

### 6. Maintenance Lifecycle with Approval Gate
- Any employee can raise a maintenance request
- **Asset status does NOT change on submission** — it stays Available/Allocated
- Only when an Asset Manager explicitly clicks **Approved** does the asset flip to `Under Maintenance`
- On resolution, asset automatically returns to `Available`
- Kanban board: Pending → Approved → Technician Assigned → In Progress → Resolved

### 7. Audit Cycle with Batch Close
- Auditors mark each asset as **Verified**, **Missing**, or **Damaged**
- On "Close Cycle":
  - Cycle row is locked (`status: closed`)
  - All `missing` items get a batch SQL update: `UPDATE assets SET status = 'lost'`
  - Discrepancy report shows exactly which assets were marked lost and why

### 8. Reports and Analytics
- Live charts: activity timeline (area), asset status distribution (pie), assets by category (bar)
- **Department Risk Index** — weighted formula:
  ```
  Risk = (allocated/total × 40) + (maintenance/total × 30) + (overdue/total × 20) + (lost/total × 10)
  ```

### 9. Notifications
- In-app notification panel with unread badge
- Mark individual notifications read or mark all as read
- Notifications triggered on: allocation, maintenance approval/rejection, booking confirmation, transfer request, audit discrepancy

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Vanilla CSS |
| State Management | Zustand |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Row Level Security |
| Charts | Recharts |
| Icons | Lucide React |
| QR Codes | qrcode (npm) |
| Deployment | Vercel |

---

## Database Schema

Key tables and their relationships:

```
profiles          — users with role, department, status
departments       — hierarchy via parent_department_id, head_user_id
asset_categories  — custom_field_name per category type
assets            — tag (AF-0001), status, is_bookable, current_holder_id
allocations       — from_user_id, to_user_id, asset_id, status, expected_return_date
transfer_requests — from_user_id, to_user_id, asset_id, status (requested/approved)
bookings          — resource_asset_id, booked_by_user_id, start_time, end_time
maintenance_requests — asset_id, raised_by, status, approved_by
audit_cycles      — scope_department_id, status (open/closed)
audit_items       — asset_id, cycle_id, verification (verified/missing/damaged)
notifications     — user_id, type, message, is_read
activity_log      — actor_id, action, entity_type, entity_id, metadata
company_settings  — join_code, company_name
```

---

## Running Locally

```bash
# Clone
git clone https://github.com/your-team/assetflow-odoo-hackathon-2026.git
cd assetflow-odoo-hackathon-2026

# Install
npm install

# Environment — create .env file
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Dev server
npm run dev

# Production build
npm run build
```

**Supabase setup:** Run the SQL migration in `supabase/schema.sql` in your Supabase SQL editor to create all tables and RLS policies.

---

## Team

| Name | Role | Branch |
|---|---|---|
| Smit | Backend Schema + DB Design | `feature/smit-backend-schema` |
| Meshwa | Dashboard UI + Analytics | `feature/meshwa-dashboard-ui` |
| Ridham | Allocation + Transfer Module | `feature/ridham-allocation-module` |
| Pal | Audit + Reports | `feature/pal-audit-reports` |

---

## Architecture Decisions

**Why Supabase over a custom backend?**
Supabase gives us PostgreSQL with RLS (row-level security) built in, real-time subscriptions, and Auth — all without writing a Node/Express server. Every query is a direct DB call, which means zero API latency overhead for a 24-hour hackathon.

**Why Zustand over Redux?**
Minimal boilerplate, zero config, and the auth store + notification store needed are small enough that Redux would be over-engineering.

**Why not Odoo's own framework?**
The problem statement asked for a working system, not an Odoo module. Building in React+Supabase let us ship all 8 modules with live data in the time constraint.

---

## License

MIT
