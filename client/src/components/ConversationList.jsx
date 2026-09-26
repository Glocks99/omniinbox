import { Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ConversationRow from './ConversationRow.jsx';

const statusFilters = ['all', 'open', 'pending', 'resolved'];

export default function ConversationList({ conversations, activeId, onSelect, loading, error, filters, onFiltersChange, teamMembers }) {
  const [query, setQuery] = useState(filters.q || '');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const searchRef = useRef(null);
  const visible = useMemo(() => conversations.filter((item) => !unreadOnly || item.unreadCount > 0), [conversations, unreadOnly]);

  useEffect(() => {
    const timer = setTimeout(() => onFiltersChange('q', query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query, onFiltersChange]);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  return (
    <section className="conversation-panel">
      <header className="list-header">
        <div><p className="eyebrow">YOUR INBOX</p><h1>Messages <span className="total-count">{conversations.length}</span></h1></div>
        <button className={`icon-button ${unreadOnly ? 'filter-active' : ''}`} aria-label="Toggle unread conversations" aria-pressed={unreadOnly} title={unreadOnly ? 'Show all conversations' : 'Show unread conversations'} onClick={() => setUnreadOnly((value) => !value)}><SlidersHorizontal size={18}/></button>
      </header>
      <label className="search-box"><Search size={17}/><input ref={searchRef} placeholder="Search customers and messages…" value={query} onChange={(event) => setQuery(event.target.value)}/><kbd>⌘ K</kbd></label>
      <div className="status-filters" aria-label="Filter by conversation status">
        {statusFilters.map((status) => <button key={status} type="button" className={filters.status === status ? 'selected' : ''} aria-pressed={filters.status === status} onClick={() => onFiltersChange('status', status)}>{status === 'all' ? 'All' : status}</button>)}
      </div>
      <label className="assignee-filter">Assigned to<select value={filters.assigned} onChange={(event) => onFiltersChange('assigned', event.target.value)}><option value="">Everyone</option><option value="me">Me</option><option value="unassigned">Unassigned</option></select></label>
      <div className="list-caption"><span>{unreadOnly ? 'UNREAD MESSAGES' : filters.status === 'all' ? 'ALL MESSAGES' : filters.status.toUpperCase()}</span><span>{visible.length} conversations</span></div>
      <div className="conversation-scroll">
        {loading ? <div className="state-message">Loading conversations…</div> : error ? <div className="state-message error-text">{error}</div> : visible.length ? visible.map((conversation) => <ConversationRow key={conversation._id} conversation={conversation} teamMembers={teamMembers} active={activeId === conversation._id} onClick={() => onSelect(conversation)}/>) : <div className="state-message">{unreadOnly ? 'No unread conversations.' : filters.q ? 'No messages match your search.' : `No ${filters.status === 'all' ? '' : `${filters.status} `}conversations yet.`}</div>}
      </div>
    </section>
  );
}
