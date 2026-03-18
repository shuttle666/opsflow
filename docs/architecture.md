# Architecture

## Overview
OpsFlow is a modular monolith system using a full-stack JavaScript architecture.

## Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- TanStack Query (server state)

## Backend
- Express
- TypeScript
- Prisma ORM

## Database
- PostgreSQL

## Development Environment
- Docker Compose
  - client
  - server
  - postgres

## Architecture Style
- Modular monolith
- Feature-driven development

## System Domains (High-Level Design)

The system is divided into several core domains to reflect real-world service operations workflows.

---

### Customer Portal

Customers can:
- Register / login
- Create service requests
- Upload images and descriptions
- View quotes
- Track job status
- Communicate via messaging
- Submit feedback

AI Enhancements:
- Parse natural language input into structured data
- Extract service type, location, time preference, urgency
- Generate structured job requests automatically

---

### Business Admin Dashboard

Admins can:
- Manage team members
- Configure services and pricing
- Review incoming jobs
- Assign jobs to staff
- Monitor performance metrics

AI Enhancements:
- Generate quote suggestions
- Summarize job details
- Draft customer replies

---

### Staff Portal

Staff can:
- View assigned jobs
- Update job status
- Upload images
- Submit completion reports
- Track work details

---

### Multi-Tenant SaaS Layer

Core capabilities:
- Data isolation per tenant
- Independent configuration per business
- Separate users and staff per tenant

---

### AI Capability Layer

AI is embedded into workflows rather than acting as a standalone chatbot.

Core capabilities:
- Intake parser (convert user input into structured data)
- Quote assistant
- Response drafting
- Job insights

Future extensions:
- Similar job retrieval (embedding-based)
- Knowledge-based Q&A (RAG)

---

### Platform-Level Engineering Capabilities

- Authentication and authorization
- File upload system
- Background jobs
- Notifications
- API rate limiting
- Error monitoring
