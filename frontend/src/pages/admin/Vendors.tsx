import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Building2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminVendors() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchVendors();
  }, [filter]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const qs = filter === 'ALL' ? '' : `?status=${filter}`;
      const res = await api.get(`/vendors/admin/list${qs}`);
      setVendors(res.data);
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const updateKyc = async (id: string, status: string) => {
    try {
      await api.put(`/vendors/admin/${id}/kyc?kyc_status=${status}`);
      setVendors(vendors.map(v => v._id === id ? { ...v, kyc_status: status } : v));
      toast.success(`Vendor KYC updated to ${status}`);
    } catch {
      toast.error("Status update failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-heading font-black text-white mb-2">Vendor KYC Management</h1>
          <p className="text-slate-400">Review and approve vendor applications to join the marketplace.</p>
        </div>
        
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
           {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
             <button 
               key={f}
               onClick={() => setFilter(f)}
               className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === f ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}
             >
               {f}
             </button>
           ))}
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
           <div className="text-center py-10 text-slate-400">Loading applications...</div>
        ) : vendors.length === 0 ? (
           <div className="glass-card p-10 text-center text-slate-400">No vendors found for this filter.</div>
        ) : vendors.map(v => (
           <div key={v._id} className="glass-card p-6 flex flex-col sm:flex-row gap-6 justify-between items-start border border-white/5">
              <div className="flex-1">
                 <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-white"><Building2 className="inline w-5 h-5 text-brand-400 mr-2"/>{v.business_name}</h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase ${
                      v.kyc_status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      v.kyc_status === 'PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                       {v.kyc_status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-300 font-medium mb-4">{v.category} • Applied on {new Date(v.created_at).toLocaleDateString()}</p>
                 
                 <div className="grid sm:grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-400 mb-4">
                    <p className="flex items-center gap-1.5"><MapPin className="w-4 h-4"/> {v.address}, {v.city}</p>
                    <p className="flex items-center gap-1.5"><Phone className="w-4 h-4"/> {v.contact_phone}</p>
                    <p className="flex items-center gap-1.5"><Mail className="w-4 h-4"/> {v.contact_email}</p>
                 </div>
                 
                 <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Business Description</p>
                    <p className="text-sm text-slate-300 line-clamp-3">{v.description}</p>
                 </div>
              </div>
              
              <div className="flex sm:flex-col gap-3 min-w-[140px] pt-2">
                 {v.kyc_status === 'PENDING' ? (
                   <>
                     <button onClick={()=>updateKyc(v._id, 'APPROVED')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold transition">
                        <CheckCircle className="w-5 h-5"/> Approve
                     </button>
                     <button onClick={()=>updateKyc(v._id, 'REJECTED')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold transition">
                        <XCircle className="w-5 h-5"/> Reject
                     </button>
                   </>
                 ) : v.kyc_status === 'REJECTED' ? (
                     <button onClick={()=>updateKyc(v._id, 'APPROVED')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold transition">
                        <CheckCircle className="w-5 h-5"/> Override Approve
                     </button>
                 ) : (
                     <button onClick={()=>updateKyc(v._id, 'REJECTED')} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold transition">
                        <AlertCircle className="w-5 h-5"/> Revoke Access
                     </button>
                 )}
              </div>
           </div>
        ))}
      </div>
    </div>
  );
}
