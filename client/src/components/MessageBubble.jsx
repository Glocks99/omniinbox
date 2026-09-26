import { Check, CheckCheck } from 'lucide-react';

export default function MessageBubble({ message }) {
  if (message.kind === 'note') {
    return <div className="message-line internal-note"><div className="message-content"><div className="internal-note-title">Internal note <span>· {message.noteAuthorName || 'Teammate'}</span></div><div className="message-bubble">{message.text}</div><div className="message-meta"><time>{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div></div></div>;
  }
  const outbound = message.direction === 'outbound';
  return <div className={`message-line ${outbound ? 'outbound' : 'inbound'}`}><div className="message-content"><div className="message-bubble">{message.text}</div><div className="message-meta"><time>{new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>{outbound && (message.status === 'read' ? <CheckCheck size={14}/> : <Check size={14}/>)}</div></div></div>;
}
