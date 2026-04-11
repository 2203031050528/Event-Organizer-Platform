import { createContext, useContext, useState, useEffect } from "react";

export type Role = "ADMIN" | "USER" | "ORGANIZER" | "VENDOR";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type LoginResponse = {
  access_token: string;
  refresh_token?: string;
  user: User;
};

type AuthContextType = {
  user: User | null;
  login: (data: LoginResponse) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

/** Clear all auth data from localStorage */
function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return null;
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  });

  const login = (data: LoginResponse) => {
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
    // Redirect to login after logout
    window.location.href = "/login";
  };

  useEffect(() => {
    const onSessionExpired = () => {
      clearAuthStorage();
      setUser(null);
      // Redirect to login with a message via query param
      window.location.href = "/login?reason=session_expired";
    };
    window.addEventListener("auth:session-expired", onSessionExpired);
    return () => window.removeEventListener("auth:session-expired", onSessionExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
