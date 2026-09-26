import { useEffect, useState } from 'react';
import { ArrowRight, MessageCircle, Instagram, Send } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';
import InstallAppButton from '../components/InstallAppButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [mode, setMode] = useState(() => inviteToken ? 'register' : 'login');
  const [email, setEmail] = useState('admin@omniinbox.local');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inviteToken) window.history.replaceState({}, document.title, window.location.pathname);
  }, [inviteToken]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    if (nextMode === 'register') {
      if (email === 'admin@omniinbox.local') setEmail('');
      setPassword('');
    }
    if (nextMode === 'login' && !email) {
      setEmail('admin@omniinbox.local');
      setPassword('password123');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') await signUp(displayName, username, email, password, inviteToken);
      else await signIn(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const registering = mode === 'register';

  return (
    <main className="login-shell">
      <InstallAppButton className="login-install-control" />
      <section className="login-brand-panel">
        <BrandLogo className="login-brand" />
        <div className="login-hero">
          <div className="platform-orbit">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <div className="orbit-center"><img src="/icons/icon-192.svg" alt="" /></div>
            <span className="orbit-icon whatsapp-orbit"><MessageCircle size={19} /></span>
            <span className="orbit-icon instagram-orbit"><Instagram size={19} /></span>
            <span className="orbit-icon telegram-orbit"><Send size={18} /></span>
          </div>
          <p className="eyebrow">ONE INBOX. EVERY CONVERSATION.</p>
          <h1>Make every<br />conversation <em>count.</em></h1>
          <p className="hero-copy">Bring your customer messages together and keep every conversation moving forward.</p>
        </div>
        <div className="brand-panel-foot">© 2026 OmniInbox <span>·</span> Built for better conversations</div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <BrandLogo className="mobile-login-brand" />
          <div className="login-heading">
            <p className="eyebrow">{registering ? 'GET STARTED' : 'WELCOME BACK'}</p>
            <h2>{registering ? 'Create your account' : 'Sign in to your workspace'}</h2>
            <p>{registering ? inviteToken ? 'Create an account to join your teammate’s workspace.' : 'Create an account to access your inbox.' : 'Enter your details to access your inbox.'}</p>
          </div>
          <form className="login-form" onSubmit={submit}>
            {registering && <>
              <label>Your name<input type="text" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={60} required /></label>
              <label>Username<input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" required /><span className="password-hint">People can find you by name or @{username || 'username'}.</span></label>
            </>}
            <label>Email address<input type="email" autoComplete={registering ? 'email' : 'username'} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required />{registering && <span className="password-hint">Use at least 8 characters.</span>}</label>
            {error && <p className="form-error">{error}</p>}
            <button className="login-button" disabled={loading}>
              {loading ? (registering ? 'Creating account…' : 'Signing in…') : <>{registering ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}
            </button>
          </form>
          <div className="auth-switch">{registering ? 'Already have an account?' : 'New to OmniInbox?'} <button type="button" onClick={() => changeMode(registering ? 'login' : 'register')}>{registering ? 'Sign in' : 'Create account'}</button></div>
          <div className="login-note"><span className="note-lock">✦</span><span>Your workspace is private and secure.</span></div>
        </div>
        <div className="form-footer">Need help? <a href="mailto:support@omniinbox.local">Contact support</a></div>
      </section>
    </main>
  );
}
