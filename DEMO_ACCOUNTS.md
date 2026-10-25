# SIDEQUEST Demo Accounts & Credentials

The following pre-configured demo identities are available in development for testing each user role and permission level.

> **Security Note:** These accounts and passwords are for development and evaluation only. They must never be used in a production environment.

---

## 1. Platform Admin Account
Has full system-wide access to moderation queues, listing approvals/rejections, reporting oversight, audit logs, and verified event imports.

- **Email:** `admin@sidequest.in`
- **Password:** `SidequestAdmin@2026`
- **Role:** `admin`
- **Name:** Aditi Sharma (Admin)
- **Organization:** SIDEQUEST Platform Trust & Safety

---

## 2. Verified Organiser Accounts
Can create, publish, edit, unpublish, and cancel events, manage ticket tiers and capacity, download attendee CSV reports, and scan/check-in attendee QR tickets.

### Organiser 1 (Bengaluru Tech & AI Community)
- **Email:** `tech.events@bangalore.in`
- **Password:** `OrganizerPass@2026`
- **Role:** `organizer`
- **Name:** Vikramaditya Rao

### Organiser 2 (Mumbai Youth Arts & Cultural Guild)
- **Email:** `culturals@mumbai-fests.org`
- **Password:** `OrganizerPass@2026`
- **Role:** `organizer`
- **Name:** Shalini Deshpande

### Organiser 3 (Delhi Outdoor & Community Circle)
- **Email:** `adventures@delhicommunity.in`
- **Password:** `OrganizerPass@2026`
- **Role:** `organizer`
- **Name:** Rishi Vohra

---

## 3. Buyer / Explorer Accounts
Can browse events without login, register/login, purchase paid tickets in Sandbox mode or RSVP for free tickets, view and download QR code tickets under `/bookings`, submit reviews, save events, create quest chains, and submit trust & safety reports.

- **Password (all explorers):** `ExplorerPass@2026`

| Name | Email Address | Role | Initial Seeded Bookings |
| :--- | :--- | :--- | :--- |
| **Aarav Sharma** | `aarav.sharma@example.in` | `explorer` | Bengaluru Tech Summit (Checked-in) |
| **Priya Patel** | `priya.patel@example.in` | `explorer` | Mood Indigo IIT Bombay (Confirmed) |
| **Rohan Mehta** | `rohan.mehta@example.in` | `explorer` | PyCon India 2026 (Confirmed) |
| **Ananya Iyer** | `ananya.iyer@example.in` | `explorer` | MindSpark COEP Pune (Confirmed) |
| **Kabir Verma** | `kabir.verma@example.in` | `explorer` | — |
| **Neha Nair** | `neha.nair@example.in` | `explorer` | — |
| **Vikram Singh** | `vikram.singh@example.in` | `explorer` | — |
| **Tanvi Joshi** | `tanvi.joshi@example.in` | `explorer` | — |
| **Aditya Deshmukh** | `aditya.deshmukh@example.in` | `explorer` | — |
| **Riya Sen** | `riya.sen@example.in` | `explorer` | — |

---

## Repeatable Database Management Commands

```bash
# Safely reset development database (backs up first, preserves genuine users, seeds verified India events and demo accounts)
npm run db:reset:dev

# Idempotently seed or update verified India events catalogue without touching user accounts
npm run db:seed

# Idempotently seed or refresh demo accounts and sample bookings
npm run db:seed:demo
```

