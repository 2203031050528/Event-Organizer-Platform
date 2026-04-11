import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthContext";

import Home from "./pages/Home";
import EventDetail from "./pages/EventDetail";
import Login from "./pages/Login";
import CreateEvent from "./pages/CreateEvent";
import ApplyOrganizer from "./pages/ApplyOrganizer";
import VendorRegister from "./pages/VendorRegister";
import VendorDashboard from "./pages/VendorDashboard";

import UserProfile from "./pages/UserProfile";
import MyBookings from "./pages/MyBookings";
import MyWishlist from "./pages/MyWishlist";
import MyEvents from "./pages/MyEvents";
import EventFeedback from "./pages/EventFeedback";

import OrganizerDashboard from "./pages/OrganizerDashboard";
import ManageEvent from "./pages/organizer/ManageEvent";
import EditEvent from "./pages/organizer/EditEvent";
import EventBookings from "./pages/organizer/EventBookings";
import BrowseVendors from "./pages/organizer/BrowseVendors";
import Financials from "./pages/organizer/Financials";
import Budget from "./pages/organizer/Budget";
import Reports from "./pages/organizer/Reports";
import ManageSponsors from "./pages/organizer/ManageSponsors";

import AdminDashboard from "./pages/admin/AdminDashboard";
import VerifyCertificate from "./pages/VerifyCertificate";

import ProtectedRoute from "./components/ProtectedRoute";
import PublicLayout from "./layout/PublicLayout";

const App = () => {
  const { user } = useAuth();

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            borderRadius: "12px",
            padding: "14px 18px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            border: "1px solid var(--glass-border)",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "#f1f5f9" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" },
          },
        }}
      />
      <Routes>
        {/* ================= AUTH ================= */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />

        {/* ================= PUBLIC ================= */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/event/:id" element={<EventDetail />} />

          <Route
            path="/create-event"
            element={
              <ProtectedRoute>
                <CreateEvent />
              </ProtectedRoute>
            }
          />

          {/* ================= USER ================= */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id/feedback"
            element={
              <ProtectedRoute>
                <EventFeedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <ProtectedRoute>
                <MyWishlist />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/apply-organizer" element={<ApplyOrganizer />} />
        <Route path="/vendor/register" element={<VendorRegister />} />

        {/* ================= VENDOR ================= */}
        <Route
          path="/vendor/dashboard"
          element={
            <ProtectedRoute role="VENDOR">
              <VendorDashboard />
            </ProtectedRoute>
          }
        />

        {/* ================= PUBLIC CERT VERIFY ================= */}
        <Route path="/verify-certificate/:id" element={<VerifyCertificate />} />

        {/* ================= ORGANIZER ================= */}
        <Route
          path="/organizer/events"
          element={
            <ProtectedRoute role="ORGANIZER">
              <MyEvents />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:id"
          element={
            <ProtectedRoute role="ORGANIZER">
              <ManageEvent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:id/edit"
          element={
            <ProtectedRoute role="ORGANIZER">
              <EditEvent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/dashboard/*"
          element={
            <ProtectedRoute role="ORGANIZER">
              <OrganizerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:eventId/bookings"
          element={
            <ProtectedRoute role="ORGANIZER">
              <EventBookings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:eventId/vendors"
          element={
            <ProtectedRoute role="ORGANIZER">
              <BrowseVendors />
            </ProtectedRoute>
          }
        />


        <Route
          path="/organizer/events/:id/financials"
          element={
            <ProtectedRoute role="ORGANIZER">
              <Financials />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:id/budget"
          element={
            <ProtectedRoute role="ORGANIZER">
              <Budget />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:id/reports"
          element={
            <ProtectedRoute role="ORGANIZER">
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organizer/events/:id/sponsors"
          element={
            <ProtectedRoute role="ORGANIZER">
              <ManageSponsors />
            </ProtectedRoute>
          }
        />

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
};

export default App;
