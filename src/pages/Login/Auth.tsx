import { useState, useEffect } from 'react';
import './Auth.css';

// --- Types ---
import type { Announcement } from './Modal/Models-TypeScript/Anc-types';

// --- Modals ---
import AnnouncementModal from './Modal/AnnouncementModal';
import BlotterModal from './Modal/Models-Blotter/Model-Blotter'; 
import DocsRequestModal from './Modal/Models-Documents/DocsRequestModal';

interface AuthProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  // --- VIEW STATE ---
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'forgot-pass' | 'resident-dashboard'>('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // --- FORM STATES: LOGIN ---
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  
  // --- FORM STATES: REGISTER ---
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regPosition, setRegPosition] = useState('');
  const [regRole, setRegRole] = useState('resident'); // <--- ADDED: Default role

  // --- FORM STATES: FORGOT PASSWORD ---
  const [forgotEmail, setForgotEmail] = useState('');

  // --- DASHBOARD STATES ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dashLoading, setDashLoading] = useState<boolean>(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isBlotterModalOpen, setIsBlotterModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  const API_BASE_URL = "http://localhost:5000/api";
  const AUTH_API_URL = `${API_BASE_URL}/auth`;

  // --- EFFECT: Fetch Announcements ---
  useEffect(() => {
    if (view === 'resident-dashboard') {
      const fetchAnnouncements = async () => {
        setDashLoading(true);
        try {
          const annRes = await fetch(`${API_BASE_URL}/announcements`);
          if (!annRes.ok) throw new Error(`HTTP Error: ${annRes.status}`);
          const annData = await annRes.json();
          
          let dataArray: Announcement[] = [];
          if (Array.isArray(annData)) dataArray = annData;
          else if (annData.data && Array.isArray(annData.data)) dataArray = annData.data;
          else if (annData.announcements && Array.isArray(annData.announcements)) dataArray = annData.announcements;

          const sorted = dataArray.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setAnnouncements(sorted);
        } catch (error) {
          console.error("Error loading dashboard data:", error);
          setAnnouncements([]); 
        } finally {
          setDashLoading(false);
        }
      };
      fetchAnnouncements();
    }
  }, [view]);

  // --- VIEW SWITCHER ---
  const switchView = (newView: typeof view) => {
    setError(''); setSuccessMsg('');
    setView(newView);
  };

  // --- AUTH HANDLERS ---
  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || 'Login failed');
      else onLoginSuccess(data.token, data.user); 
    } catch (err) { setError('Server connection failed'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    // Standard validation
    if(!regUser || !regPass || !regEmail || !regName) {
        setError("Please fill in all required fields (Name, Username, Email, Password).");
        return;
    }

    setLoading(true); setError('');
    try {
      const res = await fetch(`${AUTH_API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: regUser, 
            email: regEmail,
            password: regPass,
            name: regName, 
            position: regPosition,
            role: regRole // <--- PASS THE SELECTED ROLE
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Registration failed');
      } else { 
        alert(`${regRole.toUpperCase()} Account created successfully! Please log in.`); 
        switchView('login'); 
      }
    } catch (err) { setError('Server connection failed'); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if(!forgotEmail) { setError('Please enter your email.'); return; }
    setLoading(true); setError(''); setSuccessMsg('');
    
    try {
      const res = await fetch(`${AUTH_API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error sending email');
      } else {
        setSuccessMsg('Reset link sent to your email.'); 
        setForgotEmail(''); 
      }
    } catch (err) { 
      setError('Connection error. Please try again later.'); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- HELPERS ---
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderImage = (url?: string, type: 'hero' | 'grid' = 'grid') => {
    if (url && url.trim() !== "") {
      return <div className={`card-img ${type}`} style={{ backgroundImage: `url(${url})` }}></div>;
    }
    return <div className={`card-placeholder ${type}`}><i className="far fa-image"></i></div>;
  };

  // --------------------------------------------------------------------------------
  // RENDER VIEWS
  // --------------------------------------------------------------------------------

  // === VIEW: LANDING ===
  if (view === 'landing') {
    return (
      <div className="auth-container">
        <div className="auth-content landing-mode">
          <div className="auth-brand-section">
             <div className="brand-icon"><i className="fas fa-landmark"></i></div>
             <h1 className="brand-title">
               <span className="text-blue">Barangay Tugui</span> <span className="text-black">Grande</span>
             </h1>
             <p className="brand-desc">Select your portal to continue</p>
          </div>

          <div className="landing-options">
              {/* Resident Access */}
              <div className="option-card green" onClick={() => setView('resident-dashboard')}>
                  <div className="opt-icon"><i className="fas fa-users"></i></div>
                  <h3>Resident Services</h3>
                  <p>Access announcements, file reports, and request documents.</p>
                  <button className="btn-auth green">Enter Portal <i className="fas fa-arrow-right"></i></button>
              </div>

              {/* Official Access */}
              <div className="option-card black" onClick={() => switchView('login')}>
                  <div className="opt-icon"><i className="fas fa-user-shield"></i></div>
                  <h3>Official Login</h3>
                  <p>Restricted access for Barangay Officials and Staff.</p>
                  <button className="btn-auth black">Sign In <i className="fas fa-lock"></i></button>
              </div>
          </div>
        </div>
      </div>
    );
  }

  // === VIEW: RESIDENT DASHBOARD ===
  if (view === 'resident-dashboard') {
    const featuredNews = announcements.length > 0 ? announcements[0] : null;
    const otherNews = announcements.length > 1 ? announcements.slice(1, 4) : [];

    return (
      <div className="auth-container">
        <div className="Rsd-layout-container">
          <header className="Rsd-header">
             <button className="btn-back-home" onClick={() => setView('landing')}>
               <i className="fas fa-arrow-left"></i> Exit Portal
             </button>
             <h1>Welcome to Barangay Tugui Grande 👋</h1>
             <p>Guest Access Mode</p>
          </header>

          <section className="Rsd-quick-actions">
            <div className="action-card" onClick={() => setIsBlotterModalOpen(true)}>
                <div className="icon-circle orange"><i className="fas fa-exclamation-triangle"></i></div>
                <h3>File a Blotter Report</h3>
                <p>Report incidents securely.</p>
                <span className="link-text orange">Get Started <i className="fas fa-chevron-right"></i></span>
            </div>

            <div className="action-card" onClick={() => setIsDocsModalOpen(true)}>
                <div className="icon-circle green"><i className="fas fa-file-contract"></i></div>
                <h3>Request Documents</h3>
                <p>Clearances & Certificates.</p>
                <span className="link-text green">Apply Now <i className="fas fa-chevron-right"></i></span>
            </div>
          </section>

          <section className="Rsd-feed">
             <h3>Community Bulletin</h3>
             
             {dashLoading ? (
               <div className="spinner-container"><div className="spinner"></div></div>
             ) : featuredNews ? (
               <div className="feed-content">
                  <div className="featured-card" onClick={() => setSelectedAnnouncement(featuredNews)}>
                     <div className="featured-media">
                        {renderImage(featuredNews.imageUrl, 'hero')}
                        <div className="badges-float">
                            <span className="badge badge-gold">FEATURED</span>
                            <span className={`badge badge-${featuredNews.primaryTag}`}>{featuredNews.primaryTag}</span>
                        </div>
                     </div>
                     <div className="featured-info">
                        <h2>{featuredNews.title}</h2>
                        <p>{featuredNews.description}</p>
                        <div className="meta-date"><i className="far fa-calendar"></i> {formatDate(featuredNews.createdAt)}</div>
                     </div>
                  </div>
                  
                  <div className="grid-cards">
                    {otherNews.map((ann) => (
                      <div key={ann._id} className="grid-card" onClick={() => setSelectedAnnouncement(ann)}>
                          <div className="grid-media">
                            {renderImage(ann.imageUrl, 'grid')}
                            <div className="badges-float"><span className={`badge badge-${ann.primaryTag}`}>{ann.primaryTag}</span></div>
                          </div>
                          <div className="grid-info">
                            <h4>{ann.title}</h4>
                            <p>{ann.description.substring(0, 60)}...</p>
                            <div className="meta-date">{formatDate(ann.createdAt)}</div>
                          </div>
                      </div>
                    ))}
                  </div>
               </div>
             ) : (
               <div className="empty-state">
                   <i className="fas fa-newspaper" style={{fontSize: '2rem', marginBottom: '10px', display: 'block'}}></i>
                   No announcements found.
               </div>
             )}
          </section>

          {selectedAnnouncement && <AnnouncementModal data={selectedAnnouncement} onClose={() => setSelectedAnnouncement(null)} />}
          <BlotterModal isOpen={isBlotterModalOpen} onClose={() => setIsBlotterModalOpen(false)} currentUser="Guest Resident" />
          <DocsRequestModal isOpen={isDocsModalOpen} onClose={() => setIsDocsModalOpen(false)} currentUser="Guest Resident" />
        </div>
      </div>
    );
  }

  // === VIEW: LOGIN ===
  if (view === 'login') {
    return (
      <div className="auth-container">
        <div className="auth-content">
          <div className="auth-brand-section">
             <div className="brand-icon"><i className="fas fa-landmark"></i></div>
             <h1 className="brand-title">Official Sign In</h1>
             <p className="brand-desc">Administration Dashboard</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>Username</label>
            <input type="text" className="auth-input" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" className="auth-input" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
            <span className="forgot-link" onClick={() => switchView('forgot-pass')}>Forgot Password?</span>
          </div>

          <button className="btn-auth blue" onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'} <i className="fas fa-sign-in-alt"></i>
          </button>

          <div className="auth-footer-links" style={{marginTop:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <button className="btn-link" onClick={() => switchView('landing')}>
                <i className="fas fa-arrow-left"></i> Back
            </button>
            <span 
                style={{fontSize:'0.8rem', color:'white', cursor:'pointer', textDecoration:'underline'}} 
                onClick={() => switchView('register')}
            >
                Create Account
            </span>
          </div>
        </div>
      </div>
    );
  }

  // === VIEW: REGISTER (UPDATED WITH ROLE SELECTOR) ===
  if (view === 'register') {
      return (
        <div className="auth-container">
            <div className="auth-content">
                <div className="auth-brand-section">
                    <h2 className="brand-title" style={{fontSize:'1.5rem'}}>Create Account</h2>
                    <p className="brand-desc">Select role & fill details</p>
                </div>

                {error && <div className="error-msg">{error}</div>}

                <div className="scrollable-form" style={{maxHeight:'350px', overflowY:'auto', paddingRight:'5px'}}>
                    
                    {/* ROLE SELECTION */}
                    <div className="form-group">
                        <label>Account Role *</label>
                        <select className="auth-input" value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                            <option value="resident">Resident</option>
                            <option value="staff">Barangay Staff</option>
                            <option value="admin">System Admin</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Full Name *</label>
                        <input type="text" className="auth-input" value={regName} onChange={(e) => setRegName(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Official Position (Optional)</label>
                        <input type="text" className="auth-input" placeholder="e.g. Secretary (If Staff)" value={regPosition} onChange={(e) => setRegPosition(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Username *</label>
                        <input type="text" className="auth-input" value={regUser} onChange={(e) => setRegUser(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Email Address *</label>
                        <input type="email" className="auth-input" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>Password *</label>
                        <input type="password" className="auth-input" value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                    </div>
                </div>

                <button className="btn-auth green" onClick={handleRegister} disabled={loading} style={{marginTop:'15px'}}>
                    {loading ? 'Creating...' : 'Register'} <i className="fas fa-check"></i>
                </button>

                <button className="btn-link" onClick={() => switchView('login')}>
                    Cancel
                </button>
            </div>
        </div>
      );
  }

  // === VIEW: FORGOT PASSWORD ===
  if (view === 'forgot-pass') {
      return (
        <div className="auth-container">
          <div className="auth-content">
            <div className="auth-brand-section">
               <h2 className="brand-title" style={{fontSize:'1.8rem'}}>Reset Password</h2>
               <p className="brand-desc">Enter your email to continue</p>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {successMsg && <div className="success-msg">{successMsg}</div>}

            <div className="form-group">
              <label>Email Address</label>
              <input 
                 type="email" 
                 className="auth-input" 
                 placeholder="Enter your email address" 
                 value={forgotEmail} 
                 onChange={(e) => setForgotEmail(e.target.value)} 
              />
            </div>

            <button className="btn-auth blue" onClick={handleForgotPassword} disabled={loading}>
              {loading ? 'Checking...' : 'Next'} <i className="fas fa-arrow-right"></i>
            </button>

            <button className="btn-link" onClick={() => switchView('login')}>
              <i className="fas fa-arrow-left"></i> Back to Login
            </button>
          </div>
        </div>
      );
  }

  return null;
}