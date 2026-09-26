import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

function AppContent() { const { token } = useAuth(); return token ? <DashboardPage/> : <LoginPage/>; }
export default function App() { return <AuthProvider><AppContent/></AuthProvider>; }
