import { useEffect, useRef, useState } from 'react';
import { Check, Copy, UserPlus, Users, X } from 'lucide-react';
import * as api from '../api/client.js';

export default function WorkspaceMenu({ token }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [workspaceName, setWorkspaceName] = useState('Your workspace');
  const [canInvite, setCanInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    api.getWorkspace(token).then(({ workspace, members: rows }) => {
      if (!current) return;
      setWorkspaceName(workspace?.name || 'Your workspace');
      setCanInvite(workspace?.role === 'owner');
      setMembers(rows || []);
    }).catch((cause) => { if (current) setError(cause.message); });
    const close = (event) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.type === 'pointerdown' && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      current = false;
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open, token]);

  async function invite() {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const result = await api.createWorkspaceInvite(token);
      setInviteUrl(result.inviteUrl);
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError('Select and copy the invite link from the field above.');
    }
  }

  return (
    <div className="workspace-menu-wrap" ref={rootRef}>
      <button className="icon-button workspace-menu-button" type="button" aria-label="Workspace and teammates" title="Workspace and teammates" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Users size={18}/></button>
      {open && <section className="workspace-popover" aria-label="Workspace and teammates">
        <header><div><strong>{workspaceName}</strong><small>{members.length} teammate{members.length === 1 ? '' : 's'}</small></div><button type="button" className="workspace-close" aria-label="Close" onClick={() => setOpen(false)}><X size={16}/></button></header>
        <div className="workspace-member-list">{members.map((member) => <div className="workspace-member" key={member.id}><span className="profile-avatar">{(member.displayName || 'A').trim().charAt(0).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{member.role === 'owner' ? 'Workspace owner' : `@${member.username}`}</small></span></div>)}</div>
        {canInvite && <button type="button" className="workspace-invite-button" onClick={invite} disabled={loading}><UserPlus size={16}/>{loading ? 'Creating invite…' : 'Invite teammate'}</button>}
        {inviteUrl && <div className="invite-link-box"><label htmlFor="team-invite-link">Share this link · expires in 7 days</label><div><input id="team-invite-link" readOnly value={inviteUrl} onFocus={(event) => event.target.select()}/><button type="button" aria-label="Copy invite link" onClick={copyInvite}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button></div></div>}
        {error && <p className="workspace-error">{error}</p>}
      </section>}
    </div>
  );
}
