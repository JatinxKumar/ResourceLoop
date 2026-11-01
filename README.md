# ResourceLoop

### Share Resources. Reduce Waste. Build Access.

ResourceLoop is a resource-sharing platform designed for educational institutions, student communities, and organisations. It helps people discover underused equipment and spaces, request access, and manage the borrowing process transparently.

🌐 **Live Demo:** https://resource-loop-three.vercel.app/

💻 **GitHub Repository:** https://github.com/JatinxKumar/ResourceLoop

---

## 🚩 Problem Statement

Institutions and community groups often have equipment, facilities, or spaces that remain underused while other members need access to them.

When resource requests are managed through informal messages or manual records, it becomes difficult to:

- Discover available resources.
- Check resource eligibility.
- Prevent booking conflicts.
- Track booking approvals and status.
- Record item condition during handover and return.
- Maintain accountability for shared resources.

## 💡 Our Solution

ResourceLoop provides a centralized platform for discovering, requesting, and managing shared resources.

Resource owners can list resources, while eligible users can browse listings and request access. Owners can review booking requests, and the platform supports booking status, waitlists, QR-based handover and return, condition reports, and activity history where enabled.

Our goal is to make resource sharing more transparent, accessible, and accountable.

## ✨ Key Features

- **Resource Catalogue:** Browse resources and view their details.
- **Role-Based Views:** Separate experiences for seekers, owners, and administrators.
- **Booking Requests:** Request resources based on eligibility and availability.
- **Eligibility Checks:** Apply resource-specific access requirements.
- **Booking Conflict Prevention:** Check for overlapping reservations.
- **Owner Approval:** Owners can review, approve, or reject requests.
- **Waitlist:** Join a waitlist when a resource is unavailable, where supported.
- **QR-Based Workflow:** Support booking handover and return verification.
- **Condition Reports:** Record resource condition during handover and return.
- **Activity History:** Maintain records of relevant actions.

> Feature availability depends on the current deployed build and configuration. Only enabled and tested workflows should be considered available.

## 👥 User Roles

| Role | Description |
|---|---|
| Seeker | Discovers resources and submits eligible booking requests. |
| Owner | Lists and manages resources and reviews booking requests. |
| Administrator | Uses administrative views and permissions provided by the application. |

## 🔄 How ResourceLoop Works

1. A user opens the resource catalogue.
2. The user selects a resource and checks its details and availability.
3. The user submits a booking request if eligible.
4. The resource owner reviews the request.
5. The user checks the updated booking status.
6. Where enabled, QR verification supports handover and return.
7. Condition reports and activity history help maintain accountability.

The exact waitlist allocation and priority behaviour depends on the live implementation. No automatic first-come-first-served rule is claimed here.

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Access Control | Row Level Security (RLS) |
| Database Operations | PostgreSQL Functions / Supabase RPC |
| Hosting | Vercel |

### Architecture Overview

- **React** provides the user interface.
- **TypeScript** supports type-safe application development.
- **Vite** provides the frontend development and build environment.
- **Tailwind CSS** is used for responsive styling.
- **Supabase** provides authentication, database, and storage services.
- **PostgreSQL** stores application data.
- **RLS policies and database functions** help enforce data access and important operations.
- **Vercel** hosts the deployed application.

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project

### 1. Clone the Repository

```bash
git clone https://github.com/JatinxKumar/ResourceLoop.git
```

### 2. Navigate to the Project

```bash
cd ResourceLoop
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

Add your Supabase project configuration using the exact variable names documented in `.env.example`.

> **Important:** Never commit private keys, service-role keys, passwords, or other secrets to GitHub.

### 5. Configure the Database

Use the SQL migration files inside the `supabase/` directory to configure the database.

Apply migrations in the intended order and ensure the required authentication, RLS policies, and database functions are configured.

### 6. Start the Development Server

```bash
npm run dev
```

### 7. Build for Production

```bash
npm run build
```

## 🔐 Security Considerations

- Sensitive credentials must never be exposed in frontend code.
- Supabase RLS policies should protect user and booking data.
- Authorization should be enforced at the database/backend layer, not only through frontend visibility.
- Demonstrations should use fictional or test data.
- QR verification supports the handover process but does not replace appropriate supervision.

## 🧪 Testing and Demo

**Live Application:** https://resource-loop-three.vercel.app/

Suggested demonstration flow:

1. Open the resource catalogue.
2. Review resource details and eligibility requirements.
3. Submit a booking request using an eligible account.
4. Review the request from the owner interface.
5. Check booking status and waitlist behaviour.
6. Test QR handover and return if enabled.
7. Review condition reports and activity history.

> Some workflows may require an authenticated account.

## 👨‍💻 Team

| Member | Role | Contribution |
|---|---|---|
| Jatin Kumar | Frontend Developer | React, TypeScript, Vite and Tailwind CSS interface; resource catalogue and detail pages; seeker, owner and administrator views; responsive design; frontend integration with Supabase. |
| Vinayak Sharma | Backend Developer | Supabase backend, PostgreSQL database design, authentication and authorization, RLS policies, database RPC functions, booking logic, storage integration and backend testing. |

> Each member's contribution should reflect the work they personally completed.

## 🤖 AI and External Services

- **Runtime AI/ML:** The core ResourceLoop workflow does not depend on an AI model or prompt-based agent workflow.
- **Database and Authentication:** Supabase.
- **Hosting:** Vercel.
- **QR Functionality:** Implemented using the QR library included in the project dependencies.

Development assistance tools, if used, should be disclosed accurately in the hackathon submission.

## 🔮 Future Improvements

Potential future improvements include:

- Stronger organisation and membership verification.
- Booking notifications and reminders.
- Dispute and incident management.
- Improved accessibility and onboarding.
- Resource usage analytics and reporting.
- Institution-specific eligibility and allocation policies.

> These are future improvements unless already implemented and tested.

---

<p align="center">Made with ❤️ by Jatin Kumar & Vinayak Sharma</p>
