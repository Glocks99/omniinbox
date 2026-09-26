import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MoreHorizontal, Phone, Search, Send, Tag, Video, X } from 'lucide-react';
import PlatformBadge from './PlatformBadge.jsx';
import ParticipantAvatar from './ParticipantAvatar.jsx';
import MessageBubble from './MessageBubble.jsx';
import ReplyBox from './ReplyBox.jsx';

export default function ThreadView({ conversation, messages, loading, error, onSend, onBack, platform, telegramStatus, teamMembers, onWorkflowChange }) {
  const bottomRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? messages.filter((message) => message.text.toLowerCase().includes(query)) : messages;
  }, [messages, search]);

  useEffect(() => {
    if (!search) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, search]);
  useEffect(() => setTagDraft(''), [conversation?._id]);

  if (!conversation) {
    return <section className="thread-panel empty-thread">
      <div className="empty-art"><div className="empty-bubble bubble-one"/><div className="empty-bubble bubble-two"/><div className="empty-center"><span>✳</span></div></div>
      {platform === 'telegram' ? <div className="telegram-setup-card">
        <p className="eyebrow">TELEGRAM INBOX</p>
        <h2>Connect your Telegram bot</h2>
        {!telegramStatus?.configured ? <><p>Add your bot token to the server environment as <code>TELEGRAM_BOT_TOKEN</code>, set the workspace owner with <code>TELEGRAM_OWNER_ID</code> if needed, then restart the server.</p><a href="https://t.me/BotFather" target="_blank" rel="noreferrer">Create a bot with BotFather <Send size={14}/></a></> : <>
          <p className={telegramStatus.connected ? 'telegram-connected-copy' : 'telegram-connecting-copy'}>{telegramStatus.connected ? `Connected${telegramStatus.botUsername ? ` as @${telegramStatus.botUsername}` : ''}.` : telegramStatus.error || 'Connecting to Telegram…'}</p>
          {telegramStatus.error && <p className="telegram-error-copy">{telegramStatus.error}</p>}
          {telegramStatus.botLink && <a href={telegramStatus.botLink} target="_blank" rel="noreferrer">Start a chat with @{telegramStatus.botUsername} <Send size={14}/></a>}
          {telegramStatus.connected && <p>Customers can message the bot to start a conversation. Their messages will appear here.</p>}
        </>}
      </div> : <><h2>Your conversations, in one place</h2><p>Select a conversation to view the thread and reply to your customers.</p></>}
    </section>;
  }

  const isTelegram = conversation.platform === 'telegram';
  const pendingSince = new Date(conversation.statusUpdatedAt || conversation.lastMessageTimestamp).getTime();
  const needsFollowUp = conversation.status === 'pending' && Date.now() - pendingSince > 24 * 60 * 60 * 1000;

  function addTag(event) {
    event.preventDefault();
    const tag = tagDraft.trim().toLowerCase();
    if (!tag || (conversation.tags || []).includes(tag) || (conversation.tags || []).length >= 8) return;
    onWorkflowChange({ tags: [...(conversation.tags || []), tag] });
    setTagDraft('');
  }

  return <section className="thread-panel">
    <header className="thread-header">
      <button className="mobile-back icon-button" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={18}/></button>
      <div className="contact"><ParticipantAvatar name={conversation.participantName} className="contact-avatar"/><div><div className="contact-name">{conversation.participantName}<span className="contact-online"/></div><div className="contact-subtitle">{isTelegram && conversation.telegramUsername ? `@${conversation.telegramUsername}` : 'Conversation'} <span>·</span> <PlatformBadge platform={conversation.platform}/></div></div></div>
      <div className="thread-tools"><button className="icon-button" aria-label="Search messages" onClick={() => { setSearchOpen((open) => !open); setSearch(''); }}><Search size={18}/></button><button className="icon-button" aria-label="Call" onClick={() => setNotice('Voice calls are coming soon.')}><Phone size={18}/></button><button className="icon-button" aria-label="Video call" onClick={() => setNotice('Video calls are coming soon.')}><Video size={18}/></button><span className="tool-divider"/><button className="icon-button" aria-label="More options" onClick={() => setNotice('More conversation options are coming soon.')}><MoreHorizontal size={20}/></button></div>
    </header>
    {isTelegram && <div className="workflow-panel">
      <label>Status<select value={conversation.status || 'open'} onChange={(event) => onWorkflowChange({ status: event.target.value })}><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select></label>
      <label>Assigned to<select value={conversation.assignedToId || ''} onChange={(event) => onWorkflowChange({ assignedToId: event.target.value || null })}><option value="">Unassigned</option>{teamMembers.map((member) => <option value={member.id} key={member.id}>{member.displayName}{member.role === 'owner' ? ' (owner)' : ''}</option>)}</select></label>
      <div className="workflow-tags"><div className="workflow-tag-list">{(conversation.tags || []).map((tag) => <button type="button" className="conversation-tag" key={tag} title={`Remove ${tag} tag`} onClick={() => onWorkflowChange({ tags: conversation.tags.filter((item) => item !== tag) })}>{tag}<X size={11}/></button>)}{!conversation.tags?.length && <span className="tag-placeholder"><Tag size={13}/> Add tags</span>}</div><form onSubmit={addTag}><input aria-label="Add a tag" placeholder="Add tag" value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} maxLength={24}/></form></div>
      {needsFollowUp && <span className="follow-up-label workflow-follow-up">Needs follow-up · pending over 24h</span>}
    </div>}
    {searchOpen && <div className="thread-search"><Search size={16}/><input autoFocus aria-label="Search messages" placeholder="Find in this conversation..." value={search} onChange={(event) => setSearch(event.target.value)}/><button type="button" onClick={() => { setSearch(''); setSearchOpen(false); }} aria-label="Close message search"><X size={16}/></button></div>}
    <div className="date-divider"><span>{search ? `${visibleMessages.length} MATCHING MESSAGES` : 'CONVERSATION'}</span></div>
    <div className="messages-scroll">{loading ? <div className="state-message">Loading messages…</div> : error ? <div className="state-message error-text">{error}</div> : visibleMessages.length ? visibleMessages.map((message) => <MessageBubble key={message._id} message={message}/>) : <div className="state-message">{search ? 'No messages match your search.' : 'No messages yet.'}</div>}<div ref={bottomRef}/></div>
    <ReplyBox onSend={onSend} onNotice={setNotice} disabled={loading || !conversation} allowNotes={isTelegram}/>
    {notice && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotice(''); }}><section className="coming-soon-modal" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title"><button className="icon-button coming-soon-close" onClick={() => setNotice('')} aria-label="Close"><X size={17}/></button><div className="coming-soon-mark">✦</div><p className="eyebrow">COMING SOON</p><h2 id="coming-soon-title">Feature in progress</h2><p>{notice}</p><button className="login-button" onClick={() => setNotice('')}>Got it</button></section></div>}
  </section>;
}
