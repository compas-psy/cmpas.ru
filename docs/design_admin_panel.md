# Admin Panel Design Document

## 1. Overview
A secure, hidden administration interface for `cmpas.ru` to manage users, monitor system health, and handle future support requests.

## 2. Security & Access
*   **Obfuscated URL**: The access path will be dynamic, configured via `ADMIN_PATH` env var (e.g., `/compass-control-x7z`).
*   **Authentication**:
    *   Uses **NextAuth v5 Credentials Provider** (Email/Password).
    *   Separate from the user's Yandex/MagicLink flow to ensure admin access even if external providers fail.
    *   **Role-Based Access Control (RBAC)**: Only users with `role: "ADMIN"` can access.
*   **Scan Protection**:
    *   `robots.txt` Disallow rule.
    *   `X-Robots-Tag: noindex, nofollow` header only on admin routes.

## 3. Features

### 3.1 Dashboard (Health & specific Monitoring)
*   **System Stats** (Server Side):
    *   CPU Load (Real-time).
    *   RAM Usage (Free/Used).
    *   Uptime.
*   **Database Health**: Simple ping/connection check to Postgres.
*   **Business Metrics**: Total Users, New Signups (Last 24h).

### 3.2 User Management
*   **List View**: Searchable table of users.
*   **Actions**:
    *   View Details.
    *   Edit Role (Promote/Demote).
    *   Delete User (Soft delete or Hard delete).
    *   Manually Create User.

### 3.3 Tech Support (Stub)
*   Placeholder for managing tickets/inquires.

## 4. Technical Implementation

### 4.1 Database Schema Updates
*   Update `User` model:
    *   Add `password String?` (hashed with `bcryptjs`).
    *   Ensure `role` enum is strictly typed.

### 4.2 Application Architecture
*   **Route**: `src/app/[adminPath]/layout.tsx` (Dynamic segment handled via Middleware or just a fixed secret folder alias in `next.config` rewrites? *Decision: Dynamic folder is hard in Next.js App Router for security. Better to use a specific hardcoded obscure folder name in the codebase, e.g., `src/app/super-panel`, and use Middleware to rewrite the public URL if needed, OR just match the folder name to the ENV.* -> *Simplest*: Name the folder `src/app/super-admin` and tell user to rename it if leaked, or just use a fixed "obscure" name).
*   **Libraries**:
    *   `recharts`: For load graphs.
    *   `systeminformation`: For fetching server metrics.
    *   `bcryptjs`: For password hashing.
    *   `zod`: For admin form validation.

## 5. UI/UX
*   **Theme**: Distinct from the main site (e.g., Dark Mode by default or a "Dense" information density) to avoid confusion.
*   **Sidebar**: Collapsible navigation.

## 6. Deployment
*   Requires `ADMIN_PATH` (if using rewrites) and `ADMIN_SECRET_KEY` (if creating initial admin).
*   **Bootstrap**: A script `npm run seed:admin` to create the first admin user securely.
