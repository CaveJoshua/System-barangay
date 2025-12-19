import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DocsModal from './Docs_Modal/Docs_Modal';
import './Documents.css';

interface DocumentRequest {
    _id: string;
    residentName: string;
    certificateType: string;
    purpose: string;
    source: 'Walk-In' | 'Online';
    status: 'Pending' | 'Issued' | 'Rejected' | 'Archived' | 'Settled';
    createdAt: string;
}

interface DocumentsProps {
    initialData?: DocumentRequest[];
}

export default function Documents({ initialData = [] }: DocumentsProps) {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [requests, setRequests] = useState<DocumentRequest[]>(initialData);
    const [loading, setLoading] = useState(false);
    
    // Default to 'Pending'
    const [filterStatus, setFilterStatus] = useState<'Pending' | 'Issued' | 'Archived'>('Pending');
    const [activeSource, setActiveSource] = useState<'Online' | 'Walk-In'>('Online');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
    const token = localStorage.getItem('token');

    // --- API Logic ---
    const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers };
        const res = await fetch(url, { ...options, headers });
        if (!res.ok) throw new Error('API Call Failed');
        return res.json();
    }, [token]);

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('http://localhost:5000/api/certificates');
            const normalized = Array.isArray(data) ? data.map((item: any) => ({
                ...item,
                source: item.source === 'Walk-in' ? 'Walk-In' : item.source
            })) : [];
            setRequests(normalized);
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    }, [apiFetch]);

    useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

    // --- Actions ---
    const updateStatus = async (id: string, newStatus: string) => {
        let actionWord = "Update status";
        if (newStatus === 'Settled') actionWord = "Mark Settled";
        
        // REJECTION LOGIC CHANGE:
        // If rejecting, we ask "Archive this rejected document?".
        // If confirmed, status becomes 'Archived'.
        if (newStatus === 'Rejected') {
            if (!window.confirm("Reject and Archive this document?")) return;
            newStatus = 'Archived'; // Override to Archive immediately
        } else {
            if (!window.confirm(`${actionWord} this document?`)) return;
        }

        try {
            await apiFetch(`http://localhost:5000/api/certificates/${id}`, {
                method: "PUT",
                body: JSON.stringify({ status: newStatus }),
            });
            fetchDocuments();
        } catch (err) { alert("Failed to update status."); }
    };

    const handleArchiveAndRedirect = async (id: string) => {
        if (!window.confirm("Archive this document and go to Recycle Bin?")) return;
        try {
            // Soft Delete via PUT to 'Archived' (Or DELETE endpoint depending on backend logic)
            // Using PUT here to be safe as per your 'updateStatus' logic above
            await apiFetch(`http://localhost:5000/api/certificates/${id}`, {
                method: "PUT",
                body: JSON.stringify({ status: 'Archived' }),
            });
            // Optional: Redirect to Archive page immediately
            // navigate('/archives'); 
            fetchDocuments(); // Just refresh list to remove it from current view
        } catch (err) { alert("Failed to archive document."); }
    };

    const handleEdit = (req: DocumentRequest) => {
        setSelectedRequest(req);
        setIsModalOpen(true);
    };

    const handleManualIssueClick = () => {
        setSelectedRequest(null); 
        setIsModalOpen(true);
        setFilterStatus('Pending'); 
        setActiveSource('Walk-In');
    };

    const handleExport = () => {
        alert("Exporting document list...");
    };

    // --- Filtering Logic ---
    const filteredRequests = requests.filter(req => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = req.residentName.toLowerCase().includes(searchLower);
        if(!matchesSearch) return false;

        if (filterStatus === 'Pending') {
            return req.status === 'Pending' && req.source === activeSource;
        } 
        else if (filterStatus === 'Issued') {
            const isIssuedState = req.status === 'Issued' || req.status === 'Settled';
            return isIssuedState && req.source === activeSource;
        }
        else if (filterStatus === 'Archived') {
            // Now includes things that were "Rejected" (which are now Archived status)
            return req.status === 'Archived' || req.status === 'Rejected';
        }

        return false;
    });

    return (
        <div className="dashboard-body doc-page">
            
            {/* HEADER */}
            <div className="doc-page-header">
                <div>
                    <h1>Document Management</h1>
                    <p>Process requests and issue certificates</p>
                </div>
                <div className="action-buttons-container">
                    <button className="export-btn" onClick={handleExport}>
                        <i className="fas fa-file-export"></i> Export
                    </button>
                    <button className="btn-black" onClick={handleManualIssueClick}>
                        <i className="fas fa-plus"></i> Manual Issue
                    </button>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="doc-stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                
                {/* 1. Pending Card */}
                <div 
                    className={`doc-stat-card ${filterStatus === 'Pending' ? 'selected' : ''}`} 
                    onClick={() => { setFilterStatus('Pending'); setActiveSource('Online'); }} 
                >
                    <div className="stat-info">
                        <span className="stat-sub">PENDING REQUESTS</span>
                        <h2 className="stat-number">{requests.filter(r => r.status === 'Pending').length}</h2>
                    </div>
                    <div className="stat-icon yellow"><i className="fas fa-clock"></i></div>
                </div>

                {/* 2. Issued Card */}
                <div 
                    className={`doc-stat-card ${filterStatus === 'Issued' ? 'selected' : ''}`} 
                    onClick={() => setFilterStatus('Issued')}
                >
                    <div className="stat-info">
                        <span className="stat-sub">ISSUED / SETTLED</span>
                        <h2 className="stat-number">{requests.filter(r => r.status === 'Issued' || r.status === 'Settled').length}</h2>
                    </div>
                    <div className="stat-icon green"><i className="fas fa-check"></i></div>
                </div>

            </div>

            {/* TABLE CARD */}
            <div className="doc-table-card">
                <div className="card-fixed-header">
                    <div className="header-row">
                        <h3>{filterStatus} Documents <span className="count-badge">(Count: {filteredRequests.length})</span></h3>
                        
                        <div className="toggle-capsule">
                            <button 
                                className={activeSource === 'Online' ? 'toggle-btn active' : 'toggle-btn'}
                                onClick={() => setActiveSource('Online')}
                            >
                                Online
                            </button>
                            <button 
                                className={activeSource === 'Walk-In' ? 'toggle-btn active' : 'toggle-btn'}
                                onClick={() => setActiveSource('Walk-In')}
                            >
                                Walk-In
                            </button>
                        </div>
                    </div>

                    <div className="search-box-wrapper">
                        <i className="fas fa-search"></i>
                        <input 
                            type="text" 
                            placeholder="Search requester name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-scroll-area">
                    {loading ? (
                        <div className="doc-empty-state"><p>Loading...</p></div>
                    ) : filteredRequests.length > 0 ? (
                        <table className="doc-table">
                            <thead>
                                <tr>
                                    <th>REQUESTER</th>
                                    <th>DOC TYPE</th>
                                    <th>PURPOSE</th>
                                    <th>DATE</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRequests.map(req => (
                                    <tr key={req._id}>
                                        <td className="fw-bold">{req.residentName}</td>
                                        <td><span className="doc-type-badge">{req.certificateType}</span></td>
                                        <td className="text-muted">{req.purpose || 'N/A'}</td>
                                        <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <span className={`status-pill ${req.status.toLowerCase()}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons-cell">

                                                {/* PENDING ACTIONS */}
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <button className="doc-action-box edit" title="Edit" onClick={() => handleEdit(req)}>
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button className="doc-action-box check" title="Approve" onClick={() => updateStatus(req._id, 'Issued')}>
                                                            <i className="fas fa-check"></i>
                                                        </button>
                                                        {/* REJECT BUTTON - Now sends 'Rejected' which converts to 'Archived' inside updateStatus */}
                                                        <button className="doc-action-box reject" title="Reject & Archive" onClick={() => updateStatus(req._id, 'Rejected')}>
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    </>
                                                )}

                                                {/* ISSUED ACTIONS */}
                                                {req.status === 'Issued' && (
                                                    <>
                                                        <button className="btn-settle-action" onClick={() => updateStatus(req._id, 'Settled')}>
                                                            Mark Settled
                                                        </button>
                                                        <button className="doc-action-box archive" title="Archive" onClick={() => handleArchiveAndRedirect(req._id)}>
                                                            <i className="fas fa-folder-minus"></i>
                                                        </button>
                                                    </>
                                                )}

                                                {/* SETTLED ACTIONS */}
                                                {req.status === 'Settled' && (
                                                    <button className="doc-action-box archive" title="Archive" onClick={() => handleArchiveAndRedirect(req._id)}>
                                                        <i className="fas fa-folder-minus"></i>
                                                    </button>
                                                )}

                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="doc-empty-state">
                            <div className="empty-icon-wrapper"><i className="fas fa-archive"></i></div>
                            <p>No {filterStatus.toLowerCase()} documents found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            <DocsModal 
                isOpen={isModalOpen}
                editData={selectedRequest}
                onClose={() => { setIsModalOpen(false); setSelectedRequest(null); }}
                onSuccess={() => { 
                    fetchDocuments(); 
                    setIsModalOpen(false); 
                    setSelectedRequest(null);
                    // Stay on current view or switch if needed
                }}
            />

        </div>
    );
}