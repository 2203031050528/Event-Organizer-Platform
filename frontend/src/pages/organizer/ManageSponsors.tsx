import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { ArrowLeft, Target, Plus, CheckCircle, XCircle, Clock, Trash2, LayoutDashboard, Globe } from "lucide-react";

interface Package {
  _id: string;
  name: string;
  price: number;
  description: string;
  available_slots: number;
  sold_slots: number;
}

interface Sponsor {
  _id: string;
  package_id: string;
  package_name?: string;
  user_id: string;
  company_name: string;
  contact_email: string;
  website_url?: string;
  logo_url?: string;
  status: string;
}

export default function ManageSponsors() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"PACKAGES" | "SPONSORS">("PACKAGES");
  const [packages, setPackages] = useState<Package[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  // New Package Form
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: "", price: "", description: "", available_slots: "" });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pkgRes, spnRes] = await Promise.all([
        api.get(`/sponsors/events/${id}/packages`),
        api.get(`/sponsors/events/${id}/sponsors`)
      ]);
      setPackages(pkgRes.data);
      setSponsors(spnRes.data);
    } catch (err) {
      toast.error("Failed to load sponsors data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/sponsors/events/${id}/packages`, {
        name: newPackage.name,
        price: Number(newPackage.price),
        description: newPackage.description,
        available_slots: Number(newPackage.available_slots),
      });
      toast.success("Sponsorship package created");
      setShowNewPackage(false);
      setNewPackage({ name: "", price: "", description: "", available_slots: "" });
      fetchData();
    } catch {
      toast.error("Failed to create package");
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    try {
      await api.delete(`/sponsors/packages/${pkgId}`);
      toast.success("Package deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete package");
    }
  };

  const handleUpdateStatus = async (sponsorId: string, status: string) => {
    try {
      await api.put(`/sponsors/manage/${sponsorId}/status`, { status });
      toast.success(`Sponsor marked as ${status}`);
      fetchData();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => navigate(`/organizer/events/${id}`)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Event Hub
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-3xl text-white mb-2 flex items-center gap-3">
              <Target className="w-8 h-8 text-amber-500" />
              Sponsor Management
            </h1>
            <p className="text-slate-400 text-sm">Create sponsorship packages and review incoming sponsor requests.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl border border-white/5 w-fit" style={{ background: 'var(--btn-secondary-bg)' }}>
          <button
            onClick={() => setActiveTab("PACKAGES")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "PACKAGES" ? "bg-amber-500/20 text-amber-500 shadow" : "text-slate-400 hover:text-white"}`}
          >
            Packages
          </button>
          <button
            onClick={() => setActiveTab("SPONSORS")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "SPONSORS" ? "bg-amber-500/20 text-amber-500 shadow" : "text-slate-400 hover:text-white"}`}
          >
            Sponsor Requests
          </button>
        </div>

        {/* PACKAGES TAB */}
        {activeTab === "PACKAGES" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Sponsorship Tiers</h2>
              <button
                onClick={() => setShowNewPackage(!showNewPackage)}
                className="btn-primary px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 border-amber-400 text-white"
              >
                <Plus className="w-4 h-4" /> New Package
              </button>
            </div>

            {showNewPackage && (
              <form onSubmit={handleCreatePackage} className="glass-card p-6 rounded-2xl max-w-2xl border-amber-500/30">
                <h3 className="font-bold text-white mb-4">Create New Package</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Package Name (e.g. Platinum)</label>
                    <input type="text" required value={newPackage.name} onChange={e => setNewPackage({ ...newPackage, name: e.target.value })} className="input-glass w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Price (₹)</label>
                    <input type="number" required min="1" value={newPackage.price} onChange={e => setNewPackage({ ...newPackage, price: e.target.value })} className="input-glass w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Available Slots</label>
                    <input type="number" required min="1" value={newPackage.available_slots} onChange={e => setNewPackage({ ...newPackage, available_slots: e.target.value })} className="input-glass w-full" />
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                  <textarea required value={newPackage.description} onChange={e => setNewPackage({ ...newPackage, description: e.target.value })} className="input-glass w-full" rows={3}></textarea>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-sm px-6 bg-amber-500 hover:bg-amber-600 border-none">Save Package</button>
                  <button type="button" onClick={() => setShowNewPackage(false)} className="text-sm px-4 py-2 hover:bg-white/5 rounded-xl text-slate-300">Cancel</button>
                </div>
              </form>
            )}

            <div className="grid md:grid-cols-3 gap-6">
              {packages.length === 0 && !showNewPackage && (
                <div className="md:col-span-3 text-center py-10 text-slate-400 border border-white/5 rounded-2xl">
                  No packages defined. Create one to accept sponsors.
                </div>
              )}
              {packages.map(pkg => (
                <div key={pkg._id} className="glass-card rounded-2xl p-6 relative">
                  <button onClick={() => handleDeletePackage(pkg._id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <h3 className="font-bold text-xl text-white mb-1">{pkg.name}</h3>
                  <div className="text-amber-400 text-lg font-bold mb-4">₹{pkg.price}</div>
                  <p className="text-sm text-slate-400 mb-6">{pkg.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10 text-sm">
                    <span className="text-slate-300">Slots: <span className="font-bold text-white">{pkg.sold_slots}/{pkg.available_slots}</span></span>
                    {pkg.sold_slots >= pkg.available_slots && <span className="text-red-400 font-bold text-xs uppercase bg-red-400/10 px-2 py-0.5 rounded">Sold Out</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SPONSORS TAB */}
        {activeTab === "SPONSORS" && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-white">Sponsor Requests</h2>
            
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500 bg-white/5">
                      <th className="p-4 font-semibold">Company / Email</th>
                      <th className="p-4 font-semibold">Package</th>
                      <th className="p-4 font-semibold">Amount</th>
                      <th className="p-4 font-semibold">Logo/Site</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-300">
                    {sponsors.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">No sponsorship requests yet.</td>
                      </tr>
                    )}
                    {sponsors.map(sponsor => (
                      <tr key={sponsor._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{sponsor.company_name}</div>
                          <div className="text-xs text-slate-500">{sponsor.contact_email}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {sponsor.package_name || "Unknown"}
                          </span>
                        </td>
                        <td className="p-4 font-medium">₹{packages.find(p => p._id === sponsor.package_id)?.price || 0}</td>
                        <td className="p-4">
                           <div className="flex items-center gap-2">
                             {sponsor.logo_url ? <a href={sponsor.logo_url} target="_blank" rel="noreferrer"><LayoutDashboard className="w-4 h-4 text-brand-400" /></a> : <span className="text-xs text-slate-500">No Logo</span>}
                             {sponsor.website_url && <a href={sponsor.website_url} target="_blank" rel="noreferrer"><Globe className="w-4 h-4 text-brand-400" /></a>}
                           </div>
                        </td>
                        <td className="p-4">
                          {sponsor.status === "PENDING" && <span className="flex items-center gap-1.5 text-amber-500 text-xs font-bold"><Clock className="w-3.5 h-3.5" /> PENDING</span>}
                          {sponsor.status === "APPROVED" && <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" /> APPROVED</span>}
                          {sponsor.status === "REJECTED" && <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold"><XCircle className="w-3.5 h-3.5" /> REJECTED</span>}
                        </td>
                        <td className="p-4 flex items-center gap-2">
                           <button onClick={() => handleUpdateStatus(sponsor._id, "APPROVED")} disabled={sponsor.status === "APPROVED"} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition-all border border-emerald-500/20">
                             Approve
                           </button>
                           <button onClick={() => handleUpdateStatus(sponsor._id, "REJECTED")} disabled={sponsor.status === "REJECTED"} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all border border-red-500/20">
                             Reject
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
