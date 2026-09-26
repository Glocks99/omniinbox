import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import * as api from '../api/client.js';

export default function NewMessageModal({ token, onClose, onCreate }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2 || recipient) { setUsers([]); return undefined; }
    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError('');
      api.searchUsers(token, query.trim()).then(({ users: matches }) => { if (current) setUsers(matches); })
        .catch((cause) => { if (current) setSearchError(cause.message); })
        .finally(() => { if (current) setSearching(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query, recipient, token]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate({ recipientId: recipient.id, platform: 'omniinbox', text });
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
      <header className="compose-header"><div><p className="eyebrow">OMNIINBOX CHAT</p><h2 id="compose-title">New direct chat</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close" disabled={saving}><X size={18}/></button></header>
      <form className="compose-form" onSubmit={submit}>
        <div className="recipient-search"><label>Find a person by name or username<input autoFocus value={recipient ? `@${recipient.username}` : query} onChange={(event) => { setRecipient(null); setQuery(event.target.value.replace(/^@/, '')); }} placeholder="Search name or @username" autoComplete="off"/></label>{searching && <small className="search-status">Searching accounts…</small>}{searchError && <small className="search-status error-text">{searchError}</small>}{!searching && query.trim().length >= 2 && !users.length && !searchError && !recipient && <small className="search-status">No matching users found.</small>}{users.length > 0 && !recipient && <div className="recipient-results">{users.map((user) => <button type="button" className="recipient-result" key={user.id} onClick={() => { setRecipient(user); setQuery(''); setUsers([]); }}><span className="profile-avatar">{user.displayName.charAt(0).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></button>)}</div>}{recipient && <div className="recipient-selected"><span>Messaging <strong>{recipient.displayName}</strong> <small>@{recipient.username}</small></span><button type="button" onClick={() => { setRecipient(null); setQuery(''); }} aria-label="Choose another user">Change</button></div>}</div>
        <label>First message<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={4} placeholder="Write your message…" required/></label>
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="compose-cancel" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="login-button" disabled={saving || !text.trim() || !recipient}>{saving ? 'Creating…' : 'Start chat'}</button></footer>
      </form>
    </section>
  </div>;
}
