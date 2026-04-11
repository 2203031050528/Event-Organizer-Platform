import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, CheckCircle, Package, CalendarDays, Store, Activity, Plus } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Service Form
  const [showForm, setShowForm] = useState(false);
  const [newSvc, setNewSvc] = useState({ name: '', description: '', category: '', price_type: 'FIXED', base_price: 100 });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [profRes, svcRes, bookRes] = await Promise.all([
          api.get('/vendors/me'),
          api.get('/vendors/me/services'),
          api.get('/vendors/me/bookings')
        ]);
        setProfile(profRes.data);
        setServices(svcRes.data);
        setBookings(bookRes.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load vendor dashboard");
      } finally {
         setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newSvc, category: profile.category };
      const res = await api.post('/vendors/me/services', payload);
      setServices([...services, res.data]);
      setShowForm(false);
      setNewSvc({ name: '', description: '', category: '', price_type: 'FIXED', base_price: 100 });
      toast.success("Service added");
    } catch {
      toast.error("Failed to add service");
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    try {
      await api.put(`/vendors/me/bookings/${id}/status?status=${status}`);
      setBookings(bookings.map(b => b._id === id ? { ...b, status } : b));
      toast.success(`Booking ${status}`);
    } catch {
      toast.error("Status update failed");
    }
  };

  if (loading) return <div className="p-10 text-center text-white">Loading Dashboard...</div>;
  if (!profile) return <div className="p-10 text-center text-red-500">Failed to load profile. Please ensure you are logged in as a vendor.</div>;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6 md:p-10 text-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-heading font-black mb-1">{profile.business_name}</h1>
          <p className="text-slate-400 capitalize">{profile.category.toLowerCase()} Vendor · {profile.city}</p>
        </div>
        
        {/* KYC Badge */}
        {profile.kyc_status === 'APPROVED' ? (
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-semibold">
             <CheckCircle className="w-5 h-5" /> KYC Verified Partner
           </div>
        ) : profile.kyc_status === 'PENDING' ? (
           <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-semibold">
             <ShieldAlert className="w-5 h-5" /> KYC Pending Approval
           </div>
        ) : (
           <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-semibold">
             <ShieldAlert className="w-5 h-5" /> KYC Rejected
           </div>
        )}
      </div>

      {profile.kyc_status === 'PENDING' && (
        <div className="glass-card mb-8 p-6 border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
           <p className="text-amber-200">Your profile is under review by admins. Once approved, organizers can view your profile and book your services.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Services Box */}
         <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-brand-400"/> My Services</h2>
              <button onClick={() => setShowForm(!showForm)} className="btn-primary py-2 px-4 text-sm flex items-center gap-1">
                 {showForm ? 'Cancel' : <><Plus className="w-4 h-4"/> Add Service</>}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleAddService} className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 space-y-4">
                 <input type="text" required placeholder="Service Name" className="input-glass w-full text-sm" value={newSvc.name} onChange={e=>setNewSvc({...newSvc, name:e.target.value})}/>
                 <textarea required placeholder="Description" rows={2} className="input-glass w-full text-sm" value={newSvc.description} onChange={e=>setNewSvc({...newSvc, description:e.target.value})}/>
                 <div className="grid grid-cols-2 gap-4">
                    <select className="input-glass text-sm appearance-none" value={newSvc.price_type} onChange={e=>setNewSvc({...newSvc, price_type:e.target.value})}>
                      <option value="FIXED">Flat Fee</option>
                      <option value="PER_HOUR">Per Hour</option>
                      <option value="PER_UNIT">Per Unit</option>
                    </select>
                    <input type="number" required placeholder="Base Price (₹)" className="input-glass text-sm" value={newSvc.base_price} onChange={e=>setNewSvc({...newSvc, base_price:Number(e.target.value)})}/>
                 </div>
                 <button type="submit" className="w-full btn-primary py-2 text-sm">Save Service</button>
              </form>
            )}

            <div className="space-y-4">
               {services.length === 0 ? (
                 <p className="text-slate-500 text-sm">No services listed yet.</p>
               ) : services.map(s => (
                 <div key={s._id} className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                    <div>
                      <p className="font-semibold text-white">{s.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{s.description.substring(0,60)}...</p>
                    </div>
                    <div className="text-right">
                      <p className="text-brand-400 font-black">₹{s.base_price}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{s.price_type.replace('_', ' ')}</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>

        {/* Bookings Box */}
         <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-brand-400"/> New Booking Requests</h2>
            </div>

            <div className="space-y-4">
               {bookings.length === 0 ? (
                 <p className="text-slate-500 text-sm">No bookings yet.</p>
               ) : bookings.map(b => (
                 <div key={b._id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between text-sm mb-2">
                       <span className="font-semibold text-brand-300">{new Date(b.date).toLocaleDateString()}</span>
                       <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                         b.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                         b.status === 'CONFIRMED' ? 'bg-blue-500/20 text-blue-400' :
                         b.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                         'bg-red-500/20 text-red-400'
                       }`}>{b.status}</span>
                    </div>
                    
                    <p className="text-white text-sm font-medium mb-1 line-clamp-1">Event: {b.event_title || b.event_id}</p>
                    {b.notes && <p className="text-xs text-slate-400 bg-black/20 p-2 rounded line-clamp-2 mb-3">"{b.notes}"</p>}
                    
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                       <span className="text-white font-black">₹{b.total_amount}</span>
                       
                       {b.status === 'PENDING' && (
                         <div className="flex gap-2">
                            <button onClick={()=>updateBookingStatus(b._id, 'REJECTED')} className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/30">Reject</button>
                            <button onClick={()=>updateBookingStatus(b._id, 'CONFIRMED')} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded hover:bg-emerald-500/30">Accept</button>
                         </div>
                       )}
                       {b.status === 'CONFIRMED' && (
                         <button onClick={()=>updateBookingStatus(b._id, 'COMPLETED')} className="px-4 py-1.5 btn-primary text-xs rounded">Mark Delivered</button>
                       )}
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
