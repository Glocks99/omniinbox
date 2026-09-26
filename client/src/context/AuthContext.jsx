import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as api from '../api/client.js';

const AuthContext = createContext(null);
function getStoredUser(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(Array.from(atob(encoded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    const claims = JSON.parse(json);
    return { id: claims.sub, email: claims.email, displayName: claims.name || claims.email?.split('@')[0] || 'Account', username: claims.username || claims.email?.split('@')[0] || 'account', workspaceId: claims.workspaceId, role: claims.role || 'owner' };
  } catch { return { email: '', displayName: 'Account' }; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('omniinbox-token'));
  const [user, setUser] = useState(() => {
    const storedToken = localStorage.getItem('omniinbox-token');
    return storedToken ? getStoredUser(storedToken) : null;
  });
  const authenticate = useCallback(async (authRequest, ...credentials) => {
    const result = await authRequest(...credentials);
    localStorage.setItem('omniinbox-token', result.token);
    setToken(result.token);
    setUser(result.user || getStoredUser(result.token));
  }, []);
  const signIn = useCallback((email, password) => authenticate(api.login, email, password), [authenticate]);
  const signUp = useCallback((displayName, username, email, password, inviteToken) => authenticate(api.register, displayName, username, email, password, inviteToken), [authenticate]);
  const signOut = useCallback(() => { localStorage.removeItem('omniinbox-token'); setToken(null); setUser(null); }, []);
  const value = useMemo(() => ({ token, user, signIn, signUp, signOut }), [token, user, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
