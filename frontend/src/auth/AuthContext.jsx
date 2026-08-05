import { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { api, setSession, clearSession, getCurrentUser, isAuthenticated } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setSession(data);
    setUser(data.user);
    setAuthenticated(true);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    clearSession();
    setUser(null);
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authenticated,
      login,
      logout,
    }),
    [user, authenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}