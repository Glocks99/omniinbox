import PlatformBadge from './PlatformBadge.jsx';
import ParticipantAvatar from './ParticipantAvatar.jsx';

function timeLabel(value) {
  const date = new Date(value); const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (now - date < 6 * 86400000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export default function ConversationRow({ conversation, active, onClick, teamMembers = [] }) {
  const overdue = conversation.status === 'pending' && Date.now() - new Date(conversation.statusUpdatedAt || conversation.lastMessageTimestamp).getTime() > 24 * 60 * 60 * 1000;
  const assignee = teamMembers.find((member) => member.id === conversation.assignedToId);
  return <button type="button" className={`conversation-row ${active ? 'selected' : ''}`} onClick={onClick}><ParticipantAvatar name={conversation.participantName} className="avatar"/><div className="row-content"><div className="row-top"><strong>{conversation.participantName}</strong><time>{timeLabel(conversation.lastMessageTimestamp)}</time></div><div className="row-bottom"><p>{conversation.lastMessagePreview}</p>{conversation.unreadCount > 0 && <span className="unread-pill">{conversation.unreadCount}</span>}</div><div className="row-labels"><PlatformBadge platform={conversation.platform} compact/><span className={`status-label ${conversation.status || 'open'}`}>{conversation.status || 'open'}</span>{overdue && <span className="follow-up-label">Follow up</span>}{conversation.assignedToId && <span className="row-assignee">{assignee?.displayName || 'Assigned'}</span>}{(conversation.tags || []).slice(0, 2).map((tag) => <span className="conversation-tag" key={tag}>{tag}</span>)}</div></div></button>;
}
