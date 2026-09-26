const palette = ['#e9def8', '#dcedeb', '#f6e3d7', '#e1e8fa', '#f3e7c9', '#e7e1f1', '#dcecf4'];

export default function ParticipantAvatar({ name, className = '' }) {
  const label = name?.trim() || 'Unknown';
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const hash = [...label].reduce((value, character) => value + character.charCodeAt(0), 0);
  return <span className={`participant-avatar ${className}`} style={{ '--avatar-color': palette[hash % palette.length] }} role="img" aria-label={`${label} avatar`}>{initials}</span>;
}
