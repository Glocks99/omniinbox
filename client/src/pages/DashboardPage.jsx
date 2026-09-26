import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Plus, LogOut } from 'lucide-react';
import * as api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ConversationList from '../components/ConversationList.jsx';
import ThreadView from '../components/ThreadView.jsx';
import NewMessageModal from '../components/NewMessageModal.jsx';
import InstallAppButton from '../components/InstallAppButton.jsx';
import WorkspaceMenu from '../components/WorkspaceMenu.jsx';
import { createInboxSocket } from '../socket.js';
import { playNotificationChime, prepareNotificationAudio } from '../utils/notificationAudio.js';

function decodeApplicationServerKey(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function initialPlatform() {
  const requested = new URLSearchParams(window.location.search).get('platform');
  return ['telegram', 'omniinbox'].includes(requested) ? requested : 'all';
}

export default function DashboardPage() {
  const { token, user, signOut } = useAuth();
  const [platform, setPlatform] = useState(initialPlatform);
  const [filters, setFilters] = useState({ q: '', status: 'all', assigned: '' });
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [listError, setListError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState({ sound: true, vibration: false });
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const activeRef = useRef(active);
  const pushEnabledRef = useRef(pushEnabled);
  const notificationPreferencesRef = useRef(notificationPreferences);
  const notificationConversationRef = useRef(new URLSearchParams(window.location.search).get('conversation') || '');
  activeRef.current = active;
  pushEnabledRef.current = pushEnabled;
  notificationPreferencesRef.current = notificationPreferences;
  const socket = useMemo(() => createInboxSocket(token), [token]);

  const changeFilters = useCallback((key, value) => {
    setFilters((current) => current[key] === value ? current : { ...current, [key]: value });
  }, []);
  const loadStats = useCallback(async () => {
    try { setStats(await api.getStats(token)); }
    catch (err) { if (/token|auth/i.test(err.message)) signOut(); }
  }, [token, signOut]);
  const refreshInbox = useCallback(async () => {
    try {
      const activeFilters = { ...filters, status: filters.status === 'all' ? '' : filters.status };
      const { conversations: rows } = await api.getConversations(token, platform, activeFilters);
      setConversations(rows);
      const requested = rows.find((item) => item._id === notificationConversationRef.current);
      if (requested) {
        setActive(requested);
        notificationConversationRef.current = '';
        const url = new URL(window.location.href);
        url.searchParams.delete('conversation');
        window.history.replaceState({}, '', url);
      } else {
        setActive((previous) => rows.find((item) => item._id === previous?._id) || null);
      }
    } catch (err) {
      setListError(err.message);
    }
  }, [token, platform, filters]);

  useEffect(() => {
    let current = true;
    setLoadingList(true);
    setListError('');
    api.getConversations(token, platform, { ...filters, status: filters.status === 'all' ? '' : filters.status })
      .then(({ conversations: rows }) => {
        if (!current) return;
        setConversations(rows);
        const requested = rows.find((item) => item._id === notificationConversationRef.current);
        if (requested) {
          setActive(requested);
          notificationConversationRef.current = '';
          const url = new URL(window.location.href);
          url.searchParams.delete('conversation');
          window.history.replaceState({}, '', url);
        } else {
          setActive((previous) => rows.find((item) => item._id === previous?._id) || null);
        }
      })
      .catch((err) => {
        if (!current) return;
        setListError(err.message);
        if (/token|auth/i.test(err.message)) signOut();
      })
      .finally(() => { if (current) setLoadingList(false); });
    return () => { current = false; };
  }, [token, platform, filters, signOut]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    let current = true;
    api.getWorkspace(token).then(({ members }) => { if (current) setTeamMembers(members || []); }).catch(() => {});
    api.getTelegramStatus(token).then((status) => { if (current) setTelegramStatus(status); }).catch(() => {});
    api.getNotificationSettings(token).then(async (settings) => {
      if (!current) return;
      setPushConfigured(Boolean(settings.pushConfigured));
      setNotificationPreferences(settings.preferences || { sound: true, vibration: false });
      if (typeof navigator.serviceWorker === 'undefined') return;
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (current) setPushEnabled(Boolean(subscription));
    }).catch(() => {});
    return () => { current = false; };
  }, [token]);

  useEffect(() => {
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
      setSocketConnected(false);
    };
  }, [socket]);

  useEffect(() => {
    if (!socketConnected) return;
    refreshInbox();
    loadStats();
  }, [socketConnected, refreshInbox, loadStats]);

  useEffect(() => {
    if (!active || active.platform !== 'omniinbox') return undefined;
    socket.emit('conversation:join', { conversationId: active._id });
    return () => socket.emit('conversation:leave', { conversationId: active._id });
  }, [active?._id, active?.platform, socket]);

  useEffect(() => {
    function receiveMessage({ conversation, message }) {
      const selectedPlatformMatches = platform === 'all' || conversation.platform === platform;
      const selectedStatusMatches = filters.status === 'all' || conversation.status === filters.status;
      const selectedAssigneeMatches = filters.assigned === '' || (filters.assigned === 'me' ? conversation.assignedToId === user?.id : filters.assigned === 'unassigned' ? !conversation.assignedToId : true);
      const searchableMessage = message.kind === 'note' ? '' : message.text;
      const queryMatches = !filters.q || `${conversation.participantName} ${searchableMessage}`.toLowerCase().includes(filters.q.toLowerCase());
      const matchesFilters = selectedPlatformMatches && selectedStatusMatches && selectedAssigneeMatches && queryMatches;
      setConversations((rows) => {
        const withoutCurrent = rows.filter((row) => row._id !== conversation._id);
        return matchesFilters
          ? [conversation, ...withoutCurrent].sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp))
          : withoutCurrent;
      });
      if (activeRef.current?._id === conversation._id) {
        setActive((current) => current ? { ...current, ...conversation } : current);
        setMessages((rows) => rows.some((item) => item._id === message._id) ? rows : [...rows, message]);
        if (message.kind !== 'note' && message.direction === 'inbound') {
          api.markRead(token, conversation._id).then(({ conversation: readConversation }) => {
            setActive((current) => current?._id === readConversation._id ? { ...current, ...readConversation } : current);
            setConversations((rows) => rows.map((row) => row._id === readConversation._id ? readConversation : row));
            loadStats();
          }).catch(() => {});
        }
      }
      if (message.kind !== 'note' && message.direction === 'inbound' && !pushEnabledRef.current) {
        if (document.visibilityState === 'visible') {
          if (notificationPreferencesRef.current.sound) playNotificationChime();
          if (notificationPreferencesRef.current.vibration && typeof navigator.vibrate === 'function') navigator.vibrate([70, 30, 70]);
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const notification = new Notification('New OmniInbox message', { body: 'Open OmniInbox to read and reply.', icon: '/icons/icon-192.svg', tag: conversation._id });
          notification.onclick = () => {
            window.focus();
            setPlatform(conversation.platform);
            setActive(conversation);
            notification.close();
          };
        }
      }
      loadStats();
    }

    function receiveConversationUpdate({ conversation }) {
      const matchesPlatform = platform === 'all' || conversation.platform === platform;
      const matchesStatus = filters.status === 'all' || conversation.status === filters.status;
      const matchesAssignee = filters.assigned === '' || (filters.assigned === 'me' ? conversation.assignedToId === user?.id : filters.assigned === 'unassigned' ? !conversation.assignedToId : true);
      setConversations((rows) => {
        const withoutCurrent = rows.filter((row) => row._id !== conversation._id);
        if (!matchesPlatform || !matchesStatus || !matchesAssignee) return withoutCurrent;
        return [conversation, ...withoutCurrent].sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp));
      });
      setActive((current) => current?._id === conversation._id ? { ...current, ...conversation } : current);
    }

    socket.on('message:new', receiveMessage);
    socket.on('conversation:update', receiveConversationUpdate);
    return () => {
      socket.off('message:new', receiveMessage);
      socket.off('conversation:update', receiveConversationUpdate);
    };
  }, [socket, token, loadStats, platform, filters, user?.id]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    async function receivePushMessage(event) {
      if (event.data?.type !== 'OMNIINBOX_PUSH') return;
      const payload = event.data.payload || {};
      if (notificationPreferencesRef.current.sound) playNotificationChime();
      if (notificationPreferencesRef.current.vibration && typeof navigator.vibrate === 'function') navigator.vibrate([70, 30, 70]);
      refreshInbox();
      loadStats();
      if (payload.conversationId && activeRef.current?._id === payload.conversationId) {
        try {
          const { messages: rows } = await api.getMessages(token, payload.conversationId);
          if (activeRef.current?._id === payload.conversationId) setMessages(rows);
        } catch { /* Socket reconnection can fill in the thread later. */ }
      }
    }
    navigator.serviceWorker.addEventListener('message', receivePushMessage);
    return () => navigator.serviceWorker.removeEventListener('message', receivePushMessage);
  }, [token, refreshInbox, loadStats]);

  useEffect(() => {
    if (!profileOpen && !notificationsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === 'Escape') { setProfileOpen(false); setNotificationsOpen(false); } };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen, notificationsOpen]);

  useEffect(() => {
    let current = true;
    if (!active) { setMessages([]); return undefined; }
    setLoadingMessages(true);
    setMessageError('');
    api.getMessages(token, active._id).then(({ messages: rows }) => { if (current) setMessages(rows); })
      .catch((err) => { if (current) setMessageError(err.message); })
      .finally(() => { if (current) setLoadingMessages(false); });
    api.markRead(token, active._id).then(({ conversation }) => {
      if (!current) return;
      setActive((item) => item?._id === conversation._id ? conversation : item);
      setConversations((rows) => rows.map((item) => item._id === conversation._id ? conversation : item));
      loadStats();
    }).catch(() => {});
    return () => { current = false; };
  }, [active?._id, token, loadStats]);

  async function send(text, { kind = 'message' } = {}) {
    try {
      let result;
      if (kind === 'note') {
        result = await api.addInternalNote(token, active._id, text).then(({ message }) => ({ message }));
      } else if (active.platform === 'omniinbox') {
        result = await new Promise((resolve, reject) => {
          socket.timeout(10000).emit('message:send', { conversationId: active._id, text }, (timeoutError, response) => {
            if (timeoutError) return reject(new Error('Message delivery timed out. Check your connection and retry.'));
            if (response?.error) return reject(new Error(response.error));
            resolve(response);
          });
        });
      } else {
        result = await api.sendMessage(token, active._id, text).then(({ message }) => ({ message }));
      }
      const { message, conversation } = result;
      setMessages((rows) => rows.some((item) => item._id === message._id) ? rows : [...rows, message]);
      const preview = kind === 'note' ? `Internal note: ${message.text.slice(0, 125)}` : message.text;
      if (conversation) setActive((item) => ({ ...item, ...conversation }));
      else setActive((item) => ({ ...item, lastMessagePreview: preview, lastMessageTimestamp: message.timestamp }));
      setConversations((rows) => rows.map((item) => item._id === active._id ? { ...item, ...(conversation || {}), lastMessagePreview: preview, lastMessageTimestamp: message.timestamp } : item).sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp)));
    } catch (error) {
      setMessageError(error.message);
      throw error;
    }
  }

  async function updateWorkflow(changes) {
    try {
      const { conversation } = await api.updateConversation(token, active._id, changes);
      setActive(conversation);
      setConversations((rows) => rows.map((item) => item._id === conversation._id ? conversation : item));
      setMessageError('');
    } catch (error) {
      setMessageError(error.message);
    }
  }

  async function createMessage(payload) {
    const { conversation, message } = await api.createConversation(token, payload);
    setPlatform('all');
    setConversations((rows) => [conversation, ...rows.filter((row) => row._id !== conversation._id)].sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp)));
    setActive(conversation);
    setMessages([message]);
    setMessageError('');
    setComposeOpen(false);
    loadStats();
  }

  async function enablePushNotifications() {
    setPushError('');
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      setPushError('This browser or page does not support background push. Use HTTPS or localhost in a supported browser.');
      return;
    }
    if (!pushConfigured) {
      setPushError('The server needs VAPID keys before background push can be enabled.');
      return;
    }
    if (notificationPreferencesRef.current.sound) void prepareNotificationAudio().catch(() => {});
    setPushBusy(true);
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        setPushError(permission === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser settings.' : 'Allow notifications to enable background push.');
        return;
      }
      const settings = await api.getNotificationSettings(token);
      if (!settings.pushConfigured || !settings.vapidPublicKey) throw new Error('The server has not finished configuring Web Push.');
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(settings.vapidPublicKey)
        });
      }
      await api.savePushSubscription(token, subscription.toJSON());
      setPushEnabled(true);
      setPushError('');
    } catch (error) {
      setPushError(error.message || 'Push notifications could not be enabled. Try again.');
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePushNotifications() {
    setPushBusy(true);
    setPushError('');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await api.removePushSubscription(token, subscription.endpoint);
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
    } catch (error) {
      setPushError(error.message || 'Push notifications could not be disabled.');
    } finally {
      setPushBusy(false);
    }
  }

  async function updateNotificationPreference(key, value) {
    const next = { ...notificationPreferencesRef.current, [key]: value };
    notificationPreferencesRef.current = next;
    setNotificationPreferences(next);
    setPushError('');
    if (key === 'sound' && value) void prepareNotificationAudio().catch(() => {});
    try {
      const result = await api.updateNotificationPreferences(token, { [key]: value });
      notificationPreferencesRef.current = result.preferences;
      setNotificationPreferences(result.preferences);
    } catch (error) {
      setPushError(error.message || 'Notification preferences could not be saved.');
    }
  }

  const totalUnread = stats?.totalUnread ?? 0;
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Account';
  const userInitial = displayName.trim().charAt(0).toUpperCase() || 'A';
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();

  return <main className="dashboard">
    <Sidebar active={platform} onSelect={setPlatform} stats={stats} onLogout={signOut} user={user} socketConnected={socketConnected}/>
    <section className="main-area">
      <header className="topbar">
        <div className="crumb">Workspace <span>/</span> <strong>{displayName}</strong></div>
        <div className="topbar-right">
          <div className="inbox-status"><span className={`online-dot ${socketConnected ? '' : 'offline-dot'}`}/>{socketConnected ? 'Live messaging connected' : 'Reconnecting…'}</div>
          {platform === 'telegram' && <div className="telegram-connection-pill" title={telegramStatus?.error || (telegramStatus?.connected ? 'Telegram bot is connected' : telegramStatus?.configured ? 'Telegram bot is reconnecting' : 'Telegram bot is not configured')}><span className={`online-dot ${telegramStatus?.connected ? '' : 'offline-dot'}`}/>{telegramStatus?.connected ? 'Telegram connected' : telegramStatus?.configured ? 'Telegram reconnecting' : 'Telegram setup needed'}</div>}
          <WorkspaceMenu token={token}/>
          <InstallAppButton/>
          <div className="notification-wrap" ref={notificationRef}>
            <button className="icon-button notification-button" aria-label="Unread message summary" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18}/>{totalUnread > 0 && <span className="notification-dot"/>}</button>
            {notificationsOpen && <div className="notifications-popover">
              <strong>Unread messages</strong>
              <p>{totalUnread ? `You have ${totalUnread} unread messages.` : 'You are all caught up.'}</p>
              {stats?.byPlatform && <div className="notification-breakdown">{['omniinbox', 'telegram'].filter((item) => stats.byPlatform[item]).map((item) => <span key={item}>{item === 'omniinbox' ? 'OmniInbox' : item} <b>{stats.byPlatform[item]}</b></span>)}</div>}
              <div className="notification-settings">
                <strong>Push notifications</strong>
                <p>{pushEnabled ? 'Enabled when OmniInbox is closed or in the background.' : notificationPermission === 'denied' ? 'Blocked by your browser. Allow notifications for this site in browser settings.' : pushConfigured ? 'Get new-message alerts even when this app is closed.' : 'The server needs VAPID keys before push can be enabled.'}</p>
                {pushConfigured && <button type="button" onClick={pushEnabled ? disablePushNotifications : enablePushNotifications} disabled={pushBusy}>{pushBusy ? 'Updating…' : pushEnabled ? 'Turn off push' : 'Enable push'}</button>}
                <label className="notification-toggle"><input type="checkbox" checked={notificationPreferences.sound} onChange={(event) => updateNotificationPreference('sound', event.target.checked)}/>Gentle sound while the inbox is open</label>
                <label className="notification-toggle"><input type="checkbox" checked={notificationPreferences.vibration} onChange={(event) => updateNotificationPreference('vibration', event.target.checked)}/>Vibrate on supported devices</label>
                <small className="notification-hint">Background alert sound follows your device settings. Message previews stay private.</small>
                {pushError && <p className="notification-error" role="status">{pushError}</p>}
              </div>
            </div>}
          </div>
          <span className="topbar-divider"/>
          <div className="profile-menu-wrap" ref={profileRef}><button className="profile-menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><span className="profile-avatar">{userInitial}</span><span>{displayName}</span><ChevronDown size={15}/></button>{profileOpen && <div className="profile-popover"><div className="popover-account"><span className="profile-avatar">{userInitial}</span><div><strong>{displayName}</strong><small>{user?.email || 'Signed-in account'}</small><small>@{user?.username || 'account'}</small></div></div><div className="popover-divider"/><button className="popover-signout" onClick={signOut}><LogOut size={16}/> Sign out</button></div>}</div>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="page-heading"><div><p className="eyebrow">{today}</p><h1>{displayName === 'Admin' ? 'Your inbox' : `${displayName}'s inbox`} <span>✳</span></h1><p>Customer conversations, organized and ready for follow-up.</p></div><button className="new-message-button" onClick={() => setComposeOpen(true)}><Plus size={17}/> New direct chat</button></div>
        <div className="inbox-layout">
          <ConversationList conversations={conversations} activeId={active?._id} onSelect={setActive} loading={loadingList} error={listError} filters={filters} onFiltersChange={changeFilters} teamMembers={teamMembers}/>
          <ThreadView conversation={active} messages={messages} loading={loadingMessages} error={messageError} onSend={send} onBack={() => setActive(null)} platform={platform} telegramStatus={telegramStatus} teamMembers={teamMembers} onWorkflowChange={updateWorkflow}/>
        </div>
        <footer className="dashboard-foot"><span><span className={`online-dot ${socketConnected ? '' : 'offline-dot'}`}/>{socketConnected ? 'Up to date' : 'Offline'}</span><span>Showing {conversations.length} conversations <span className="foot-divider">·</span> {totalUnread} unread</span></footer>
      </div>
      {composeOpen && <NewMessageModal token={token} onClose={() => setComposeOpen(false)} onCreate={createMessage}/>}
    </section>
  </main>;
}
