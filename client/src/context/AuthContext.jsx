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

  // Patch the user object with the browser's timezone and persist to server.
  // Returns the (possibly updated) user so callers only call setUser once.
  const applyTimezone = (userData) => {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detectedTz || userData.settings?.timezone === detectedTz) return userData;

    const patched = {
      ...userData,
      settings: { ...userData.settings, timezone: detectedTz },
    };
    // Fire-and-forget server save — non-critical, don't block login
    updateProfile({ settings: { timezone: detectedTz } }).catch(() => {});
    return patched;
  };

  const login = async (email, password) => {
    const { data } = await loginUser(email, password);
    localStorage.setItem('token', data.data.token);
    const userData = applyTimezone(data.data.user);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const register = async (name, email, password) => {
    const { data } = await registerUser(name, email, password);
    localStorage.setItem('token', data.data.token);
    const userData = applyTimezone(data.data.user);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
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
