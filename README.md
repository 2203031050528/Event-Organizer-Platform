# Event Organizer Platform

A high-performance, full-scale **Online Event Management Platform** inspired by **Townscript**, designed for modern event businesses. This platform enables users to discover, book, and attend events, while providing organizers with a premium, glassmorphic dashboard to manage registrations, ticketing, and attendee engagement.

---

## 🌟 Key Features

### 👤 Attendees
- **Discovery**: Search and filter events by city, category, date, and price.
- **Dynamic Search**: High-performance hero search with real-time suggestions.
- **Easy Booking**: Seamless multi-step checkout with coupon support and automatic pricing.
- **Transport & Logistics**: Select and book event transportation during the registration process.
- **E-Tickets**: Receive QR-coded tickets via email (PDF) with the ability to download from the profile.
- **Verification**: Built-in QR scanner for organizers to check in attendees at the venue.
- **Wishlist & Reviews**: Save favorite events and leave feedback after the event.

### 🤝 Vendors & Sponsors
- **Vendor Dashboard**: Dedicated portals for vendors to register, manage services, and receive bookings from organizers.
- **Sponsorship Portal**: Streamlined application process for brands to sponsor events and track their visibility.

### 🏢 Organizers (Premium Dashboard)
- **Glassmorphic UI**: Sleek, modern dashboard with dark theme and interactive analytics.
- **Event Lifecycle**: Create, edit, publish, or cancel events with banner uploads via Cloudinary.
- **Ticket Management**: Define multiple ticket tiers (General, VIP, etc.) with custom pricing and quantity limits.
- **Sales Tracking & Reports**: Real-time overview of ticket sales, revenue, and attendee lists with detailed analytics.
- **Budget & Financials**: Comprehensive budget tracking, expense management, and financial reporting.
- **Sponsor & Vendor Management**: Manage sponsor applications, track sponsorships, and discover/book vendors for your events.
- **Discounts & Add-ons**: Create custom discount codes (coupons) and sell event add-ons/merchandise.
- **Forms & Surveys**: Build custom registration forms and post-event surveys to gather attendee feedback.
- **Certificate Distribution**: Automatically generate and distribute branded PDF certificates with QR verification for participants, speakers, and volunteers.
- **Communication**: Email Blast system to send bulk updates or announcements to all registered attendees.
- **Agenda Manager**: Build and manage detailed event schedules and sessions.

### �️ Administrators
- **Moderation**: Approve or flag events and organizers.
- **User Management**: Comprehensive control over platform users and permissions.
- **Finance**: Track total platform revenue, commission handling, and payments.

---

##  Tech Stack

### Frontend
- **Framework**: React 18 (Vite) with TypeScript
- **Styling**: Tailwind CSS (Glassmorphism & Dark Theme)
- **State/Routing**: React Router 7, Context API
- **Animations**: Framer Motion
- **Icons/UI**: Lucide React, React Icons
- **Charts**: Recharts

### Backend
- **Language**: Python 3.10+
- **Framework**: FastAPI (High-performance, Async)
- **Database**: MongoDB (via Motor Async Driver)
- **PDF/Media**: ReportLab (PDFs), Cloudinary (Images & Certificate storage)
- **Tasks**: Asyncio-based background workers for cleanup and scheduling.
- **Security**: JWT Authentication, Bcrypt password hashing.

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB instance (Local or Atlas)
- Cloudinary Account (for media uploads)
- Razorpay Account (for payments - optional for testing)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Configure your environment variables
uvicorn app.main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Configuration (Environment Variables)

### Backend `.env`
Key variables required for full functionality:
- `MONGO_URI`: Your MongoDB connection string.
- `CLOUDINARY_URL`: Configuration for media storage.
- `SMTP_CONFIG`: Host, Port, User, and Pass for email notifications.
- `RAZORPAY_KEYS`: API keys for payment processing.

*See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for a detailed list.*

---

## 📁 Project Structure

```
Event-Organizer-Platform/
├── backend/
│   ├── app/
│   │   ├── core/           # Configuration & DB connection
│   │   ├── modules/        # Business logic (Auth, Events, Bookings, etc.)
│   │   ├── common/         # Email, PDF, QR utilities
│   │   └── templates/      # Jinja2 Email & PDF templates
│   └── tests/              # Backend test suites
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── layout/         # Public & Organizer layouts
│   │   ├── pages/          # Main application pages
│   │   ├── context/        # Auth & Application state
│   │   └── services/       # API integration layers
└── docs/                   # Extended documentation
```

---

## 📌 Development Status

- [x] MVP Core (Auth, Events, Bookings)
- [x] Organizer Dashboard (Glassmorphism Overhaul)
- [x] QR Code Check-in System
- [x] Certificate Distribution System
- [x] Email Blast & Agenda Tools
- [x] Budget & Financials Tracking
- [x] Sponsor & Vendor Management System
- [x] Discount Engine & Add-ons
- [x] Transport & Logistics Integration
- [x] Custom Forms & Surveys
- [ ] Mobile App Integration (Planned)
- [ ] AI-based Event Recommendations (Planned)

---

## 📄 License

This project is open-source for learning and development purposes.

---

