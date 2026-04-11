import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  // baseURL: 'https://event-organizer-platform.onrender.com',
  baseURL: 'http://localhost:8000',
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Don't attach token to refresh endpoint
    if (config.url?.includes('/users/refresh')) {
      return config;
    }
    const token = localStorage.getItem('access_token');

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => api(originalRequest));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      processQueue(error, null);
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      const res = await axios.post(
        `${api.defaults.baseURL}/users/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { access_token } = res.data;
      localStorage.setItem('access_token', access_token);
      processQueue(null, access_token);
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;


export const createEvent = (payload: any) =>
  api.post("/events/", payload);


export const getMyEvents = async () => {
  const res = await api.get("/organizers/me/events");
  return res.data;
};
export const getMyBookings = async () => {
  const res = await api.get("/users/me/bookings");
  return res.data;
}

export const deleteMyBooking = (booking_id: string) =>
  api.delete(`/users/me/bookings/${booking_id}`);

export const createBooking = (payload: {
  event_id: string;
  ticket_id: string;
  quantity: number;
  addons?: Array<{ addon_id: string; quantity: number }>;
  discount_code?: string;
}) => api.post("/bookings/", payload);

export const createPaymentOrder = (booking_id: string) =>
  api.post(`/payments/create-order/${booking_id}`);

export const verifyPayment = (payload: any) =>
  api.post("/payments/verify", payload);

export const getEventBookings = async (eventId: string) => {
  const res = await api.get(
    `/organizers/me/events/${eventId}/bookings`
  );
  return res.data;
};

export const scanBookingQR = (payload: any) =>
  api.post("/bookings/scan", payload);

// ─── Event Management ────────────────────────────────────────────────────────
export const updateEvent = (eventId: string, payload: any) =>
  api.put(`/events/${eventId}`, payload);

export const deleteEvent = (eventId: string) =>
  api.delete(`/events/${eventId}`);

export const updateEventAgenda = async (eventId: string, agenda: any[]) => {
  const res = await api.put(`/events/${eventId}/agenda`, agenda);
  return res.data;
};

// ─── Ticket Management ───────────────────────────────────────────────────────
export const getEventTickets = async (eventId: string) => {
  const res = await api.get(`/tickets/event/${eventId}`);
  return res.data;
};

export const createTicket = (payload: any) =>
  api.post("/tickets/", payload);

export const updateTicket = (ticketId: string, payload: any) =>
  api.put(`/tickets/${ticketId}`, payload);

export const deleteTicket = (ticketId: string) =>
  api.delete(`/tickets/${ticketId}`);

// ================= PROFILE MANAGEMENT =================
export const getUserProfile = async () => {
  const response = await api.get("/users/me");
  return response.data;
};

export const updateUserProfile = async (data: Record<string, any>) => {
  const response = await api.put("/users/me", data);
  return response.data;
};

export const getOrganizerProfile = async () => {
  const response = await api.get("/organizers/me");
  return response.data;
};

export const updateOrganizerProfile = async (data: Record<string, any>) => {
  const response = await api.put("/organizers/me", data);
  return response.data;
};

// ================= WISHLIST MANAGEMENT =================
export const getMyWishlist = async () => {
  const response = await api.get("/users/me/wishlist");
  return response.data;
};

export const addToWishlist = async (eventId: string) => {
  const response = await api.post(`/users/me/wishlist/${eventId}`);
  return response.data;
};

export const removeFromWishlist = async (eventId: string) => {
  const response = await api.delete(`/users/me/wishlist/${eventId}`);
  return response.data;
};

// ================= DISCOUNT MANAGEMENT =================
export const getOrganizerDiscounts = async () => {
  const res = await api.get('/discounts/organizer');
  return res.data;
};

export const createDiscount = async (payload: {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  applies_to_ticket?: string;
  usage_limit?: number;
  expires_at?: string;
  event_id?: string | null;
}) => {
  const res = await api.post('/discounts/organizer', payload);
  return res.data;
};

export const updateDiscount = async (id: string, payload: {
  code?: string;
  type?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value?: number;
  applies_to_ticket?: string;
  usage_limit?: number;
  expires_at?: string;
  event_id?: string | null;
}) => {
  const res = await api.put(`/discounts/organizer/${id}`, payload);
  return res.data;
};

export const deleteDiscount = async (id: string) => {
  const res = await api.delete(`/discounts/organizer/${id}`);
  return res.data;
};

// getTicketsByEvent is an alias used by the Tickets dashboard page
export const getTicketsByEvent = async (eventId: string) => {
  const res = await api.get(`/tickets/event/${eventId}`);
  return res.data;
};

// ================= SURVEY / FEEDBACK =================

// Organizer Endpoints
export const getOrganizerSurvey = async (eventId: string) => {
  const res = await api.get(`/surveys/organizer/${eventId}`);
  return res.data;
};

export const saveOrganizerSurvey = async (eventId: string, questions: any[]) => {
  const res = await api.put(`/surveys/organizer/${eventId}`, { questions });
  return res.data;
};

export const getSurveyResponses = async (eventId: string) => {
  const res = await api.get(`/surveys/organizer/${eventId}/responses`);
  return res.data;
};

// User Endpoints
export const getEventSurvey = async (eventId: string) => {
  const res = await api.get(`/surveys/event/${eventId}`);
  return res.data;
};

export const checkMySurveyResponse = async (eventId: string) => {
  const res = await api.get(`/surveys/event/${eventId}/my-response`);
  return res.data;
};

export const submitSurveyResponse = async (eventId: string, responses: any[]) => {
  const res = await api.post(`/surveys/event/${eventId}/respond`, { responses });
  return res.data;
};

// ================= EMAIL BLAST =================
export const sendEmailBlast = async (payload: {
  event_id: string;
  target: string;
  subject: string;
  body: string;
}) => {
  const res = await api.post('/organizers/me/email-blast', payload);
  return res.data;
};


export const getEmailBlastHistory = async () => {
  const res = await api.get('/organizers/me/email-blast/history');
  return res.data;
};

// ================= CERTIFICATES =================
export const getCertificateTemplates = async () => {
  const res = await api.get('/certificates/templates');
  return res.data;
};

export const generateCertificates = async (event_id: string, role: string) => {
  const res = await api.post('/certificates/generate', { event_id, role });
  return res.data;
};

export const sendCertificates = async (event_id: string, role?: string) => {
  const res = await api.post('/certificates/send', { event_id, role });
  return res.data;
};

export const getEventCertificates = async (event_id: string, role?: string) => {
  const params = role ? { role } : {};
  const res = await api.get(`/certificates/event/${event_id}`, { params });
  return res.data;
};

export const getMyCertificates = async () => {
  const res = await api.get('/certificates/my');
  return res.data;
};

export const verifyCertificate = async (cert_id: string) => {
  const res = await api.get(`/certificates/verify/${cert_id}`);
  return res.data;
};

// Downloads the cert PDF via the authenticated streaming endpoint
export const downloadCertificate = async (cert_id: string, filename = 'Certificate.pdf') => {
  const res = await api.get(`/certificates/download/${cert_id}`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};


// ================= PARTICIPANTS (Volunteers / Vendors) =================
export const addParticipant = async (payload: {
  event_id: string;
  role: 'VOLUNTEER' | 'VENDOR';
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  designation?: string;
  category?: string;
  notes?: string;
}) => {
  const res = await api.post('/certificates/participants', payload);
  return res.data;
};

export const getParticipants = async (event_id: string, role: string) => {
  const res = await api.get(`/certificates/participants/${event_id}`, { params: { role } });
  return res.data;
};

export const deleteParticipant = async (participant_id: string) => {
  const res = await api.delete(`/certificates/participants/${participant_id}`);
  return res.data;
};

// ================= ADDONS =================
export const getEventAddons = async (eventId: string) => {
  const res = await api.get(`/events/${eventId}/addons`);
  return res.data;
};

export const createEventAddon = async (eventId: string, payload: any) => {
  const res = await api.post(`/events/${eventId}/addons`, payload);
  return res.data;
};

export const deleteAddon = async (addonId: string) => {
  const res = await api.delete(`/events/addons/${addonId}`);
  return res.data;
};

export const getPublicStats = async () => {
  const res = await api.get('/users/stats');
  return res.data;
};

// ================= DISCOUNT ENGINE =================
export const evaluateDiscounts = async (payload: {
  event_id: string;
  ticket_id: string;
  quantity: number;
  promo_code?: string;
}) => {
  const res = await api.post('/discounts/engine/evaluate', payload);
  return res.data as {
    subtotal: number;
    total_discount: number;
    final_price: number;
    discounts: Array<{
      type: string;
      label: string;
      amount: number;
      code: string | null;
    }>;
  };
};
