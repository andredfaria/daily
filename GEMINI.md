# GEMINI.md - BillSync Project Context

## Project Overview
**BillSync** is a personal bill management and notification system designed to eliminate missed payment deadlines. It features proactive WhatsApp alerts with payment data (PIX keys or Boleto codes) and allows users to confirm payments directly through WhatsApp or a web dashboard.

### Core Architecture
- **Frontend**: React 18, Vite (Port 3000), TypeScript, TailwindCSS. Proxies `/api` to `http://localhost:4000`.
- **Backend**: Node.js, Express (Port 4000), currently in early development.
- **Database**: PostgreSQL (planned via Supabase).
- **Automation**: n8n (planned/self-hosted) for workflow orchestration.
- **WhatsApp Gateway**: WAHA (planned/self-hosted) for WhatsApp integration.
- **Infrastructure**: Docker-compose, Nginx, Easypanel.

### Key Features (Implementation Status)
- **Frontend**: Substantially complete UI (Dashboard, Bill Form, History, Config).
- **Backend**: Early stage, only health check implemented.
- **Integrations**: PRD-ready for n8n + WAHA, but logic not yet implemented in the API.

---

## Directory Structure
- `src/`: React frontend source code.
- `backend/`: Node.js/Express API source code.
- `database/`: SQL migrations and schema definitions.
- `docs/`: Technical specifications and deployment plans.
- `PRD-v2.md`: Primary reference for product requirements and business logic.
- `FUNCIONALIDADES.md`: Detailed functional descriptions for each module.

---

## Building and Running

### Frontend (Root)
1.  **Install dependencies**: `npm install`
2.  **Run development server**: `npm run dev` (Starts on `http://localhost:3000`)
3.  **Build for production**: `npm run build`

### Backend
1.  **Navigate to backend**: `cd backend`
2.  **Install dependencies**: `npm install`
3.  **Run development server**: `npm run dev` (Starts on `http://localhost:4000`)
4.  **Build for production**: `npm run build`

### Infrastructure (Docker)
1.  **Start all services**: `docker-compose up -d --build`

---

## Development Conventions

### Coding Standards
- **Language**: TypeScript for both Frontend and Backend.
- **Styling**: TailwindCSS for the UI.
- **Dates**: Use `date-fns` for date manipulations (prefer `pt-BR` locale).
- **API Communication**: Use `axios` (defined in `src/api/client.ts`) with standardized error handling.

### Core Business Rules (Refer to PRD-v2.md)
- **Recurrence Logic**: Handle invalid days (e.g., Feb 31st) by using the last valid day of the month.
- **Notification Scheduling**: Two alerts per occurrence (X days before and on the due date).
- **Payment Confirmation**: Marking an occurrence as paid must cancel any scheduled notifications.
- **WhatsApp Identification**: Match incoming WhatsApp messages to users via their registered phone number.
- **Source of Truth**: All business logic must reside in the Backend, not in n8n.
