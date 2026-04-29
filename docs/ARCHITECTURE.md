`# Architecture Overview

The **Event Organizer Platform** is built with a modern, decoupled architecture to ensure scalability and ease of maintenance.

## System Design

The platform consists of three main layers:
1.  **Frontend (React/Vite)**: A high-interactive single-page application (SPA) that handles the user interface and interacts with the backend via RESTful APIs.
2.  **Backend (FastAPI)**: A high-performance, asynchronous REST API built with Python, handling authentication, business logic, and integrations.
3.  **Database (MongoDB)**: A NoSQL database for flexible and scalable storage of event data, user profiles, bookings, and certificates.

---

## Technical Components

### Frontend Architecture
- **Vite**: Rapid development and building for modern web apps.
- **Context API & Hooks**: Centralized state management for authentication and session context.
- **React Router Dom (v7)**: Manages all routing, including protected routes for organizers and admins.
- **Tailwind CSS & Glassmorphism**: A custom styling layer that implements the platform's sleek dark theme and transparent, blurring "glass" cards.
- **Lucide Icons & Framer Motion**: Provides interactive icons and smooth micro-animations across the UI.

### Backend Architecture (Modular Design)
The backend is structured into domain-driven modules:
- **`app/main.py`**: Initialization, global middlewares (CORS), and router registration.
- **`app/core/`**: Critical infrastructure code, including database drivers (Motor/Asyncio) and global configuration.
- **`app/modules/`**: Contains sub-packages for each business domain (Auth, Events, Bookings, Certificates, etc.). Each module typically includes:
    -   `models.py`: MongoDB collection definitions (Pydantic models).
    -   `routes.py`: API endpoints for the domain.
    -   `service.py` (optional): Encapsulated business logic and external integrations.
- **`app/common/utils/`**: Shared utility functions for PDF generation, QR code rendering, and SMTP email delivery.

---

## Key Data Flows

### Booking & Ticketing
1.  Attendee selects tickets and clicks "Book Now".
2.  Frontend requests the backend to create a booking session.
3.  Backend creates a Razorpay Order and returns it to the frontend.
4.  After successful payment, the backend receives a webhook or direct notification.
5.  Backend generates a PDF ticket with a unique QR code, saves it, and emails it to the attendee.

### Certificate Generation
1.  Organizer clicks "Generate Certificates" for an event.
2.  Backend fetches all registered participants.
3.  For each participant, a customized PDF is generated using **ReportLab**.
4.  A verification QR code is embedded in the PDF.
5.  Certificates are uploaded to **Cloudinary** for persistent hosting.
6.  The secure URL is stored in the database for the user to download.

### QR Code Check-In
1.  Attendee presents their E-ticket QR code at the event.
2.  Organizer uses the dashboard's built-in QR scanner (via `html5-qrcode`).
3.  Scanner extracts the booking ID and calls the backend verification endpoint.
4.  Backend updates the attendee's check-in status in real-time.

---

## Core Integrations

- **Cloudinary**: Real-time image uploading and processing for event banners and certificates.
- **Razorpay**: Secure payment processing for ticket sales.
- **SMTP (AIOSMTPLIB)**: Asynchronous email delivery for tickets, certificates, and alerts.
- **ReportLab**: Programmatic PDF layout generation for tickets and certificates.

---
**This architecture ensures the platform can handle thousands of concurrent bookings and registrations effortlessly.**
`