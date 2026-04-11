import { useState } from "react";
import AdminLayout from "./AdminLayout";
import AdminEvents from "./Events";
import Organizers from "./Organizers";
import UsersList from "./UsersList";
import AdminVendors from "./Vendors";
import Analytics from "./Analytics";

function AdminDashboard() {
  const [activeSection, setActiveSection] = useState("events");

  const renderContent = () => {
    switch (activeSection) {
      case "events":
        return <AdminEvents />;
      case "organizers":
        return <Organizers />;
      case "users":
        return <UsersList />;
      case "vendors":
        return <AdminVendors />;
      case "analytics":
        return <Analytics />;
      default:
        return <AdminEvents />;
    }
  };

  return (
    <AdminLayout
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {renderContent()}
    </AdminLayout>
  );
}

export default AdminDashboard;
