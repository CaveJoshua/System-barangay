import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

// CSS Imports
import './App.css';
import './pages/Login/Auth.css';
import './pages/recylebin/Recylebin.css';
import './pages/Profile/Profile.css';

// Component Imports
import Dashboard from './pages/Dash/dashboard';
import Residents from './pages/Res/Resident';
import BlotterCases from './pages/Blottercases/Blottercase';
import Documents from './pages/Docs_request/Documents';
import Officials from './pages/Office/Officials';
import AuditLog from './pages/Audit/AuditLog';
import Login from './pages/Login/Auth';
import RecycleBin from './pages/recylebin/Recylebin';
import Profile from './pages/Profile/Profile';
import Announcement from './pages/Announcement/Announcement';
// REMOVED: UserManagement import

// --- TYPESCRIPT INTERFACES ---
interface User {
  username: string;
  role: string;
  name?: string;
}

interface DecodedToken {
  exp: number;
  iat?: number;
  [key: string]: any;
}

interface Stats {
  officials: number;
  residents: number;
  certificates: number;
  blotter: number;
  audit: number;
  announcements: number; 
}

interface AppData {
  user: User;
  stats: Stats;
  residents: any[];
  officials: any[];
  documents: any[];
  blotterCases: any[];
  auditLogs: any[];
  // users: any[]; // Removed from AppData
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

export default function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [token, setToken] = useState<string>(localStorage.getItem('token') || '');
  const [currentView, setCurrentView] = useState<string>('dashboard');

  const [appData, setAppData] = useState<AppData>({
    user: { username: 'Guest', role: 'Guest' },
    stats: { officials: 0, residents: 0, certificates: 0, blotter: 0, audit: 0, announcements: 0 },
    residents: [],
    officials: [],
    documents: [],
    blotterCases: [],
    auditLogs: [],
  });

  // ----------------------------------------------------------
  // 1. SESSION RESTORATION
  // ----------------------------------------------------------
  useEffect(() => {
    const checkSession = () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedToken);
          const currentTime = Date.now() / 1000;
          const userObj = JSON.parse(storedUser);

          if (decoded.exp < currentTime) {
            handleLogout();
          } else {
            setToken(storedToken);
            setAppData(prev => ({ ...prev, user: userObj }));
            setIsLoggedIn(true);
            setCurrentView('dashboard'); 
          }
        } catch {
          handleLogout();
        }
      } else {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // ----------------------------------------------------------
  // 2. LOGIN HANDLER
  // ----------------------------------------------------------
  const handleLogin = (newToken: string, userData: any) => { 
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));

    setToken(newToken);
    setAppData(prev => ({ ...prev, user: userData }));
    setIsLoggedIn(true);
    setCurrentView('dashboard'); 
  };

  // ----------------------------------------------------------
  // 3. LOGOUT HANDLER
  // ----------------------------------------------------------
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setIsLoggedIn(false);
    setAppData(prev => ({
      ...prev,
      user: { username: 'Guest', role: 'Guest' }
    }));
    setIsLoading(false);
    setCurrentView('dashboard');
  };

  // ----------------------------------------------------------
  // 4. DATA FETCHING
  // ----------------------------------------------------------
  useEffect(() => {
    if (isLoggedIn && token && !isLoading) {
      const fetchDashboardData = async () => {
        try {
          const headers = { Authorization: `Bearer ${token}` };

          // Basic Stats (UPDATED URL)
          const statsRes = await fetch(`${BASE_URL}/api/stats`, { headers });
          const statsData = statsRes.ok ? await statsRes.json() : {};

          // UPDATED URLs for all endpoints
          const fetchPromises = [
            fetch(`${BASE_URL}/api/residents`, { headers }),
            fetch(`${BASE_URL}/api/officials`, { headers }),
            fetch(`${BASE_URL}/api/certificates`, { headers }),
            fetch(`${BASE_URL}/api/blotters`, { headers }),
            fetch(`${BASE_URL}/api/audit-logs`, { headers }),
          ];
          
          const [residentsRes, officialsRes, documentsRes, blotterRes, auditRes] = await Promise.all(fetchPromises);

          const residents = residentsRes.ok ? await residentsRes.json() : [];
          const officials = officialsRes.ok ? await officialsRes.json() : [];
          const documents = documentsRes.ok ? await documentsRes.json() : [];
          const blotterCases = blotterRes.ok ? await blotterRes.json() : [];
          const auditLogs = auditRes.ok ? await auditRes.json() : [];

          setAppData(prev => ({
            ...prev,
            stats: {
              officials: statsData.officials || 0,
              residents: statsData.residents || 0,
              certificates: statsData.certificates || 0,
              blotter: statsData.blotter || 0,
              audit: statsData.audit || 0,
              announcements: statsData.announcements || 0,
            },
            residents,
            officials,
            documents,
            blotterCases,
            auditLogs,
          }));
          
          setIsLoading(false);

        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(err.message);
          }
          setIsLoading(false);
        }
      };

      fetchDashboardData();
    } else {
        setIsLoading(false);
    }
  }, [isLoggedIn, token, appData.user.role]); 

  // Initials logic: Use Name if available, otherwise Username
  const displayName = appData.user.name || appData.user.username;
  const initials = displayName ? displayName[0].toUpperCase() : 'U';

  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!isLoggedIn) return <Login onLoginSuccess={handleLogin} />;

  return (
    <div className="app-root">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-header"><i className="fas fa-landmark"></i>Bar Chain</div>
        <ul className="sidebar-menu">
          <li><a href="#" className={currentView === 'dashboard' ? 'active' : ''} onClick={() => setCurrentView('dashboard')}><i className="fas fa-th-large"></i> Dashboard</a></li>
          
          <li><a href="#" className={currentView === 'profile' ? 'active' : ''} onClick={() => setCurrentView('profile')}><i className="fas fa-user"></i> My Profile</a></li>
          
          {/* Admin/Staff Views Only */}
          {appData.user.role !== 'resident' && (
            <>
              <li><a href="#" className={currentView === 'residents' ? 'active' : ''} onClick={() => setCurrentView('residents')}><i className="fas fa-users"></i> Residents</a></li>
              
              {/* REMOVED: User Accounts Link for Admin */}
              
              <li><a href="#" className={currentView === 'officials' ? 'active' : ''} onClick={() => setCurrentView('officials')}><i className="fas fa-users"></i> Officials</a></li>
              <li><a href="#" className={currentView === 'documents' ? 'active' : ''} onClick={() => setCurrentView('documents')}><i className="fas fa-file-alt"></i> Documents</a></li>
              <li><a href="#" className={currentView === 'blotter' ? 'active' : ''} onClick={() => setCurrentView('blotter')}><i className="fas fa-exclamation-triangle"></i> Blotter Cases</a></li>
              <li><a href="#" className={currentView === 'recycle' ? 'active' : ''} onClick={() => setCurrentView('recycle')}><i className="fas fa-archive"></i> Archive</a></li>
              <li><a href="#" className={currentView === 'audit' ? 'active' : ''} onClick={() => setCurrentView('audit')}><i className="fas fa-history"></i> Audit Log</a></li>
            </>
          )}

          <li><a href="#" className={currentView === 'announcement' ? 'active' : ''} onClick={() => setCurrentView('announcement')}><i className="fas fa-bullhorn"></i> Announcements</a></li>
        </ul>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="spacer"></div>
          <div className="user-profile-section">
            <div className="user-text-stack">
              <span className="user-name-text">{displayName}</span>
              <span className="user-role-text">{appData.user.role}</span>
            </div>
            <div className="avatar-circle">{initials}</div>
            <button className="logout-button-styled" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Renderer */}
        {currentView === 'dashboard' && (
             <Dashboard
               stats={appData.stats}
               currentUser={appData.user}
               onNavigate={setCurrentView}
             />
        )}
        
        {currentView === 'residents' && <Residents initialData={appData.residents} />}
        {currentView === 'officials' && <Officials initialData={appData.officials} />}
        {currentView === 'documents' && <Documents initialData={appData.documents} />}
        {currentView === 'blotter' && <BlotterCases initialData={appData.blotterCases} />}
        {currentView === 'audit' && <AuditLog initialData={appData.auditLogs} />}
        {currentView === 'recycle' && <RecycleBin />}
        {currentView === 'profile' && <Profile />}
        {currentView === 'announcement' && <Announcement />}
        
        {/* REMOVED: UserManagement Route Rendering */}
      </main>
    </div>
  );
}
