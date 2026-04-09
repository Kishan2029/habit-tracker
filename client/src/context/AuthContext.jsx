import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser } from '../api/authApi';
import { updateProfile } from '../api/userApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user data:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const syncTimezone = async (userData) => {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTz && userData.settings?.timezone !== detectedTz) {
      try {
        const res = await updateProfile({ settings: { timezone: detectedTz } });
        const updated = res.data.data.user;
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
      } catch {
        // Non-critical — don't block login
      }
    }
  };

  const login = async (email, password) => {
    const { data } = await loginUser(email, password);
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    syncTimezone(data.data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await registerUser(name, email, password);
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    syncTimezone(data.data.user);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
