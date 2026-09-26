import { Instagram, Send, MessageCircle, Users } from 'lucide-react';

const details = {
  whatsapp: { label: 'WhatsApp', className: 'whatsapp', Icon: MessageCircle },
  instagram: { label: 'Instagram', className: 'instagram', Icon: Instagram },
  telegram: { label: 'Telegram', className: 'telegram', Icon: Send },
  omniinbox: { label: 'OmniInbox', className: 'omniinbox', Icon: Users }
};
export default function PlatformBadge({ platform, compact = false }) {
  const item = details[platform] || details.whatsapp;
  return <span className={`platform-badge ${item.className} ${compact ? 'compact' : ''}`} title={item.label}><item.Icon size={compact ? 15 : 14} strokeWidth={2.2}/>{!compact && item.label}</span>;
}
