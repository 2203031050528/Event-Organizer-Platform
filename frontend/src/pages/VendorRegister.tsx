import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Mail, MapPin, Store, Building2, Phone, AlignLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function VendorRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    business_name: '',
    category: 'CATERING',
    description: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    city: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/vendors/register', formData);
      localStorage.setItem('token', res.data.access_token);
      toast.success('Registration successful! Profile pending review.');
      // Update window location instead of navigate to hard flash auth state
      window.location.href = '/vendor/dashboard';
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-xl glass-card rounded-3xl p-8 relative z-10 border border-white/5 animate-fade-in shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4 border border-brand-500/30">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="font-heading font-black text-3xl text-white mb-2">Partner with Us</h1>
          <p className="text-slate-400">Join thousands of vendors powering epic events.</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 1 ? 'bg-brand-500 text-white' : 'bg-brand-500/20 text-brand-300'}`}>1</div>
            <span className={`text-sm ${step === 1 ? 'text-white font-medium' : 'text-slate-500'}`}>Account</span>
          </div>
          <div className="w-12 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full bg-brand-500 transition-all duration-500 ${step === 2 ? 'w-full' : 'w-0'}`} />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 2 ? 'bg-brand-500 text-white' : 'bg-white/5 text-slate-500'}`}>2</div>
            <span className={`text-sm ${step === 2 ? 'text-white font-medium' : 'text-slate-500'}`}>Business Profile</span>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleNext} className="space-y-4 animate-fade-in">
            <div className="space-y-4">
              <div className="relative">
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input-glass w-full pl-11 py-3.5" placeholder="Full Name" />
                <Store className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>
              <div className="relative">
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="input-glass w-full pl-11 py-3.5" placeholder="Login Email" />
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>
              <div className="relative">
                <input required type="password" name="password" minLength={6} value={formData.password} onChange={handleChange} className="input-glass w-full pl-11 py-3.5" placeholder="Create Password (min 6 chars)" />
                <ShieldCheck className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>
            </div>
            <button type="submit" className="w-full btn-primary py-3.5 flex justify-center mt-6">
              Continue to Business Details
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative col-span-2">
                <input required type="text" name="business_name" value={formData.business_name} onChange={handleChange} className="input-glass w-full pl-11 py-3" placeholder="Business Name" />
                <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>
              
              <div className="relative col-span-2">
                <select required name="category" value={formData.category} onChange={handleChange} className="input-glass w-full pl-4 py-3 appearance-none">
                  <option value="CATERING">Catering</option>
                  <option value="DECORATION">Decoration & Design</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="AV">Audio / Visual Production</option>
                  <option value="SECURITY">Event Security</option>
                  <option value="OTHER">Other Services</option>
                </select>
              </div>

              <div className="relative col-span-2">
                <textarea required name="description" value={formData.description} onChange={handleChange} rows={3} className="input-glass w-full pl-11 py-3 resize-none" placeholder="Business Description & Expertise" />
                <AlignLeft className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>

              <div className="relative">
                <input required type="tel" name="contact_phone" value={formData.contact_phone} onChange={handleChange} className="input-glass w-full pl-11 py-3" placeholder="Support Phone" />
                <Phone className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>

              <div className="relative">
                <input required type="text" name="city" value={formData.city} onChange={handleChange} className="input-glass w-full pl-11 py-3" placeholder="Operations City" />
                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>

              <div className="relative col-span-2">
                <input required type="text" name="address" value={formData.address} onChange={handleChange} className="input-glass w-full pl-11 py-3" placeholder="Full Registered Address" />
                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button type="button" onClick={() => setStep(1)} className="px-6 py-3.5 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5 transition-all text-sm">
                Back
              </button>
              <button type="submit" disabled={loading} className="flex-1 btn-primary py-3.5 flex justify-center">
                {loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Complete Registration"}
              </button>
            </div>
            
            <p className="text-xs text-slate-500 text-center mt-4">
              By registering, you agree to our <a href="#" className="text-brand-400 hover:underline">Vendor Terms of Service</a>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
