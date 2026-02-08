import React, { useEffect, useState } from 'react';
import './dashboard.css';

// --- Types ---
export type ViewType =
  | 'dashboard'
  | 'residents'
  | 'documents'
  | 'blotter'
  | 'audit'
  | 'recycle'
  | 'profile';

interface Stats {
  residents: number;
  certificates: number;
  blotter: number;
  audit: number;
}

interface User {
  username: string;
  role: string;
  name?: string; 
}

// 1. Interface for Documents
interface DocumentRequest {
    _id: string;
    residentName: string;
    certificateType: string;
    purpose: string;
    status: string;
    dateRequested: string;
    type: 'document';
}

// 2. Interface for Blotter
interface BlotterCase {
    _id: string;
    complainant: string;
    respondent: string;
    type: string;
    status: string;
    createdAt: string;
    origin?: string; // ADDED: To track if it's 'Online' or 'Walk-in'
    source: 'blotter';
}

type ActivityItem = DocumentRequest | BlotterCase;

export interface DashboardProps {
  stats?: Stats;
  currentUser?: User;
  onNavigate: (view: ViewType) => void;
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

export default function Dashboard({
  stats,
  currentUser,
  onNavigate,
}: DashboardProps) {
  const [fetchedStats, setFetchedStats] = useState<Stats | null>(null);
  
  // Feed State
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Button State
  const [smartNav, setSmartNav] = useState<{ target: ViewType, label: string }>({ target: 'documents', label: 'Manage All' });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const safeStats: Stats = fetchedStats || stats || {
    residents: 0,
    certificates: 0,
    blotter: 0,
    audit: 0,
  };

  // --- FETCH DATA ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Stats (UPDATED URL)
        const statsRes = await fetch(`${BASE_URL}/api/stats`, { headers });
        if (statsRes.ok) setFetchedStats(await statsRes.json());

        // 2. Docs (Pending) (UPDATED URL)
        const docsRes = await fetch(`${BASE_URL}/api/certificates`, { headers });
        let docsList: DocumentRequest[] = [];
        if (docsRes.ok) {
            const data = await docsRes.json();
            docsList = data
                .filter((d: any) => d.status === 'Pending')
                .map((d: any) => ({ ...d, type: 'document' }));
        }

        // 3. Blotters (Active OR Online) (UPDATED URL)
        const blotterRes = await fetch(`${BASE_URL}/api/blotters`, { headers });
        let blotterList: BlotterCase[] = [];
        if (blotterRes.ok) {
            const data = await blotterRes.json();
            blotterList = data
                // Filter: Include if Active OR if it came from Online (to ensure we see new online reports)
                .filter((b: any) => b.status === 'Active' || b.source === 'Online')
                // Map: Save real DB source to 'origin', set discriminator 'source' to 'blotter'
                .map((b: any) => ({ ...b, origin: b.source, source: 'blotter' }));
        }

        // 4. SMART LOGIC: Decide where the "Manage All" button goes
        if (docsList.length > 0) {
            setSmartNav({ target: 'documents', label: 'Manage all' });
        } else if (blotterList.length > 0) {
            setSmartNav({ target: 'blotter', label: 'Manage Cases' });
        } else {
            setSmartNav({ target: 'documents', label: 'Manage All' });
        }

        // 5. MERGE & SORT for Feed
        const combined = [...docsList, ...blotterList].sort((a, b) => {
            const dateA = new Date((a as DocumentRequest).dateRequested || (a as any).createdAt).getTime();
            const dateB = new Date((b as DocumentRequest).dateRequested || (b as any).createdAt).getTime();
            return dateB - dateA; 
        });

        setActivityFeed(combined.slice(0, 7));

      } catch (err) {
        console.error('Data error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const displayName = currentUser?.name || currentUser?.username || 'Guest';
  const displayRole = currentUser?.role ? currentUser.role.toUpperCase() : 'GUEST';

  return (
    <div className="dashboard-body dash-page">
      
      {/* HEADER */}
      <div className="page-title">
        <h1>Barangay Eng.hill</h1>
        <p>
          Welcome back, <strong>{displayName}</strong> <span style={{fontSize:'0.9em', color:'#666'}}>({displayRole})</span>. Today is {today}.
        </p>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <StatCard label="Total Population" number={safeStats.residents} icon="users" color="blue" onClick={() => onNavigate('residents')} subLabel="View Residents →" />
        <StatCard label="Documents Issued" number={safeStats.certificates} icon="file-alt" color="pink" onClick={() => onNavigate('documents')} subLabel="View Requests →" />
        <StatCard label="Blotter Cases" number={safeStats.blotter} icon="gavel" color="yellow" onClick={() => onNavigate('blotter')} subLabel="View Cases →" />
        <StatCard label="System Activities" number={safeStats.audit} icon="history" color="red" onClick={() => onNavigate('audit')} subLabel="View Logs →" />
      </div>

      {/* BOTTOM GRID */}
      <div className="dashboard-bottom-grid">
        
        {/* MAP */}
        <div className="dash-panel map-panel">
          <div className="panel-header">
            <h3><i className="fas fa-map-marked-alt dash-icon-blue"></i> Barangay Map</h3>
          </div>
          <div className="panel-content map-placeholder-content" style={{ padding: 0 }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d965.5821285187082!2d119.8775527!3d16.2083468!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3393c6a8661642c3%3A0x63351d3840212f38!2sTugui%20Grande%20Barangay%20Hall!5e0!3m2!1sen!2sph!4v1732256189478!5m2!1sen!2sph"
              style={{ border: 0, width: '100%', height: '100%', borderRadius: '8px' }}
              allowFullScreen
              loading="lazy"
              title="Barangay Map"
            />
          </div>
        </div>

        {/* FEED */}
        <div className="dash-panel">
          <div className="panel-header">
            <h3><i className="fas fa-file-signature dash-icon-green"></i> Pending Request</h3>
            
            {/* SMART MANAGE ALL BUTTON */}
            <button 
                className="btn-link-small" 
                onClick={() => onNavigate(smartNav.target)}
                title={`Go to ${smartNav.target}`}
            >
                {smartNav.label} <i className="fas fa-arrow-right" style={{fontSize: '0.7em', marginLeft: '5px'}}></i>
            </button>
          </div>
          
          <div className="panel-content">
            {loading ? (
                <div style={{textAlign: 'center', padding: '20px', color: '#888'}}>Loading Activity...</div>
            ) : activityFeed.length > 0 ? (
              activityFeed.map((item) => {
                const isDoc = (item as any).type === 'document';
                // Check if it's an online blotter case
                const isOnlineBlotter = !isDoc && (item as BlotterCase).origin === 'Online';

                return (
                    <div key={item._id} className="appointment-item">
                        {/* BADGE */}
                        <div className="appt-time" style={{minWidth:'70px', textAlign:'center'}}>
                            {isDoc ? (
                                <span style={{fontSize: '0.65rem', fontWeight: '800', color: '#e67e22', background: '#fff3cd', padding: '3px 6px', borderRadius: '4px', display:'block'}}>DOC REQ</span>
                            ) : isOnlineBlotter ? (
                                <span style={{fontSize: '0.65rem', fontWeight: '800', color: '#c0392', background: '#fadbd8', padding: '3px 6px', borderRadius: '4px', display:'block'}}>BLOTTER </span>
                            ) : (
                                <span style={{fontSize: '0.65rem', fontWeight: '800', color: '#c0392b', background: '#fadbd8', padding: '3px 6px', borderRadius: '4px', display:'block'}}>BLOTTER</span>
                            )}
                            <span style={{fontSize: '0.65rem', color: '#999', marginTop: '4px', display:'block'}}>
                                {new Date((item as any).dateRequested || (item as any).createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                            </span>
                        </div>
                        
                        {/* DETAILS */}
                        <div className="appt-details">
                            {isDoc ? (
                                <>
                                    <h4 style={{marginBottom: '2px'}}>{(item as DocumentRequest).certificateType}</h4>
                                    <div style={{fontSize: '0.85rem', color: '#333'}}>
                                        <i className="fas fa-user" style={{marginRight:'5px', color:'#888'}}></i>
                                        {(item as DocumentRequest).residentName}
                                    </div>
                                    <p style={{fontSize: '0.8rem', color: '#666', fontStyle: 'italic', marginTop: '2px'}}>"{(item as DocumentRequest).purpose}"</p>
                                </>
                            ) : (
                                <>
                                    <h4 style={{marginBottom: '2px', color: isOnlineBlotter ? '#2980b9' : '#c0392b'}}>
                                        <i className="fas fa-gavel" style={{marginRight:'5px'}}></i>
                                        {(item as BlotterCase).type || 'Incident'}
                                    </h4>
                                    <div style={{fontSize: '0.85rem', color: '#333'}}>
                                        <strong>{(item as BlotterCase).complainant}</strong> <span style={{color:'#999'}}>vs</span> <strong>{(item as BlotterCase).respondent}</strong>
                                    </div>
                                    <p style={{fontSize: '0.8rem', color: '#666', marginTop: '2px'}}>Status: {(item as BlotterCase).status}</p>
                                </>
                            )}
                        </div>

                        {/* ARROW BTN */}
                        <button 
                            className="btn-icon-action" 
                            onClick={() => onNavigate(isDoc ? 'documents' : 'blotter')}
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                );
              })
            ) : (
              <div className="empty-calendar">
                <i className="far fa-check-circle"></i>
                <p>No pending actions or active cases</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- StatCard Component ---
interface StatCardProps {
  label: string; number: number; icon: string; color: string; onClick: () => void; subLabel?: string;
}

function StatCard({ label, number, icon, color, onClick, subLabel }: StatCardProps) {
  return (
    <div className="dash-stat-card clickable" onClick={onClick}>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <h2 className="stat-number">{number}</h2>
        {subLabel && <span className="stat-sub">{subLabel}</span>}
      </div>
      <div className={`stat-icon ${color}`}>
        <i className={`fas fa-${icon}`}></i>
      </div>
    </div>
  );
}
