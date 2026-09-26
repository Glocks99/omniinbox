const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    });
  } catch {
    throw new Error(`Can't reach the OmniInbox API at ${API_URL}. Make sure the server is running and reachable.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const login = (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const register = (displayName, username, email, password, inviteToken) => request('/auth/register', { method: 'POST', body: JSON.stringify({ displayName, username, email, password, ...(inviteToken ? { inviteToken } : {}) }) });
export const createConversation = (token, payload) => request('/conversations', { token, method: 'POST', body: JSON.stringify(payload) });
export const searchUsers = (token, query) => request(`/users/search?q=${encodeURIComponent(query)}`, { token });
export const getConversations = (token, platform, filters = {}) => {
  const params = new URLSearchParams();
  if (platform !== 'all') params.set('platform', platform);
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.assigned) params.set('assigned', filters.assigned);
  const query = params.toString();
  return request(`/conversations${query ? `?${query}` : ''}`, { token });
};
export const getMessages = (token, id) => request(`/conversations/${encodeURIComponent(id)}/messages`, { token });
export const sendMessage = (token, id, text) => request(`/conversations/${encodeURIComponent(id)}/messages`, { token, method: 'POST', body: JSON.stringify({ text }) });
export const markRead = (token, id) => request(`/conversations/${encodeURIComponent(id)}/read`, { token, method: 'PATCH' });
export const updateConversation = (token, id, changes) => request(`/conversations/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: JSON.stringify(changes) });
export const addInternalNote = (token, id, text) => request(`/conversations/${encodeURIComponent(id)}/notes`, { token, method: 'POST', body: JSON.stringify({ text }) });
export const getStats = (token) => request('/stats', { token });
export const getWorkspace = (token) => request('/workspace', { token });
export const createWorkspaceInvite = (token) => request('/workspace/invites', { token, method: 'POST', body: '{}' });
export const getTelegramStatus = (token) => request('/integrations/telegram', { token });
export const getNotificationSettings = (token) => request('/notifications/settings', { token });
export const savePushSubscription = (token, subscription) => request('/notifications/subscriptions', { token, method: 'POST', body: JSON.stringify({ subscription }) });
export const removePushSubscription = (token, endpoint) => request('/notifications/subscriptions', { token, method: 'DELETE', body: JSON.stringify({ endpoint }) });
export const updateNotificationPreferences = (token, preferences) => request('/notifications/preferences', { token, method: 'PATCH', body: JSON.stringify(preferences) });
