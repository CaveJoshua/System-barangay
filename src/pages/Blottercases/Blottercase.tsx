import { useState, useEffect, useCallback } from 'react';
import AddBlotterModal from './BlotterModal/BlotterModal';
import './Blottercase.css';

interface BlotterCase {
    _id: string;
    complainant: string;
    respondent: string;
    type: string;
    location: string;
    date: string;
    narrative?: string;
    status: string;
    source?: 'Walk-In' | 'Online';
    createdAt?: string;
    updatedAt?: string;
}

interface BlotterProps {
    initialData?: BlotterCase[];
}

export default function BlotterCases({ initialData = [] }: BlotterProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cases, setCases] = useState<BlotterCase[]>(initialData);
    const [loading, setLoading] = useState(true); // Initial load is true
    
    // Filters
    const [filterStatus, setFilterStatus] = useState('Active');
    const [activeSource, setActiveSource] = useState<'Walk-In' | 'Online'>('Walk-In'); 
    const [searchQuery, setSearchQuery] = useState('');
    
    const [editingCase, setEditingCase] = useState<BlotterCase | null>(null);
    const token = localStorage.getItem('token');

    // --- API Logic ---
    const fetchCases = useCallback(async (isBackgroundRefresh = false) => {
        // Only show loading spinner on the very first load, NOT on background refreshes
        if (!isBackgroundRefresh) setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/blotters', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const normalized = data.map((c: any) => ({
                    ...c,
                    source: c.source || 'Walk-In'
                }));

                // FIX: DEEP COMPARE to prevent blinking
                // We checks if the new data is exactly the same as old data.
                // If yes, we return 'prevCases' (the old state), so React skips the re-render.
                setCases(prevCases => {
                    if (JSON.stringify(prevCases) === JSON.stringify(normalized)) {
                        return prevCases; 
                    }
                    return normalized;
                });
            }
        } catch (error) {
            console.error("Error fetching cases:", error);
        } finally {
            if (!isBackgroundRefresh) setLoading(false);
        }
    }, [token]);

    // Initial Load
    useEffect(() => {
        fetchCases(false); // First load (shows spinner)
        
        // Background Interval
        const intervalId = setInterval(() => {
            fetchCases(true); // Background refresh (NO spinner, NO blink)
        }, 5000); 

        return () => clearInterval(intervalId);
    }, [fetchCases]);

    // --- Handlers ---

    // 1. SAVE
    const handleSaveCase = async (formData: any) => {
        // We set loading true here manually because saving is a user action
        setLoading(true); 
        try {
            const method = editingCase ? 'PUT' : 'POST';
            const url = editingCase 
                ? `http://localhost:5000/api/blotters/${editingCase._id}`
                : 'http://localhost:5000/api/blotters';

            const payload = { 
                ...formData, 
                source: editingCase ? (editingCase.source || 'Walk-In') : 'Walk-In' 
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchCases(false); // Refresh list immediately
                setIsModalOpen(false);
                setEditingCase(null);
                
                if (!editingCase) {
                    setFilterStatus('Active');
                    setActiveSource('Walk-In');
                }
            } else {
                alert("Failed to save case.");
            }
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    // 2. MARK SETTLED
    const handleMarkSettled = async (item: BlotterCase) => {
        if (!window.confirm("Mark case as settled?")) return;

        // Optimistic Update
        const updatedItem = { ...item, status: 'Settled' };
        setCases(prevCases => prevCases.map(c => 
            c._id === item._id ? updatedItem : c
        ));

        try {
            const res = await fetch(`http://localhost:5000/api/blotters/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    status: 'Settled',
                    source: item.source || 'Walk-In'
                })
            });

            if (!res.ok) {
                fetchCases(true); 
                alert("Failed to update status.");
            }
        } catch (err) { 
            console.error(err);
            fetchCases(true); 
        }
    };

    // 3. ARCHIVE
    const handleArchive = async (id: string) => {
        if (!window.confirm("Move this case to the Archive?")) return;
        
        setCases(prevCases => prevCases.map(c => 
            c._id === id ? { ...c, status: 'Archived' } : c
        ));

        try {
            const res = await fetch(`http://localhost:5000/api/blotters/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'Archived' }) 
            });
            if (!res.ok) fetchCases(true); 
        } catch (err) { 
            console.error(err); 
            fetchCases(true); 
        }
    };

    const handleExport = () => {
        alert("Exporting...");
    };

    // --- Filter Logic ---
    const filteredCases = cases.filter(c => {
        if (c.status === 'Archived') return false;

        const matchesStatus = c.status === filterStatus;
        const matchesSearch = 
            c.complainant.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.respondent.toLowerCase().includes(searchQuery.toLowerCase());
        
        const itemSource = c.source || 'Walk-In'; 
        const matchesSource = itemSource === activeSource;

        return matchesStatus && matchesSearch && matchesSource;
    });

    const openNewModal = () => { setEditingCase(null); setIsModalOpen(true); };
    const openEditModal = (c: BlotterCase) => { setEditingCase(c); setIsModalOpen(true); };

    return (
        <div className="dashboard-body blotter-page">
            
            <div className="blotter-page-header-row">
                <div>
                    <h1>Blotter Cases</h1>
                    <p>Record and manage community disputes</p>
                </div>
                <div className="action-buttons-container">
                    <button className="export-btn" onClick={handleExport}>
                        <i className="fas fa-file-export"></i> Export
                    </button>
                    <button className="btn-black" onClick={openNewModal}>
                        <i className="fas fa-plus"></i> File New Case
                    </button>
                </div>
            </div>

            <div className="blotter-stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className={`blotter-stat-card ${filterStatus === 'Active' ? 'selected' : ''}`} onClick={() => setFilterStatus('Active')}>
                    <div className="stat-info">
                        <span className="stat-sub">ACTIVE CASES</span>
                        <h2 className="stat-number">{cases.filter(c => c.status === 'Active').length}</h2>
                    </div>
                    <div className="stat-icon yellow"><i className="fas fa-folder-open"></i></div>
                </div>

                <div className={`blotter-stat-card ${filterStatus === 'Settled' ? 'selected' : ''}`} onClick={() => setFilterStatus('Settled')}>
                    <div className="stat-info">
                        <span className="stat-sub">SETTLED CASES</span>
                        <h2 className="stat-number">{cases.filter(c => c.status === 'Settled').length}</h2>
                    </div>
                    <div className="stat-icon green"><i className="fas fa-check-circle"></i></div>
                </div>
            </div>

            <div className="blotter-table-card">
                <div className="card-fixed-header">
                    <div className="header-row">
                        <h3>{filterStatus} Cases List <span className="count-badge">(Count: {filteredCases.length})</span></h3>
                        
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
                            placeholder="Search by name..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-scroll-area">
                    {loading ? (
                         <div className="blotter-empty-state"><p>Loading...</p></div>
                    ) : filteredCases.length > 0 ? (
                        <table className="resident-table">
                            <thead>
                                <tr>
                                    <th>COMPLAINANT</th>
                                    <th>RESPONDENT</th>
                                    <th>TYPE</th>
                                    <th>SOURCE</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCases.map(c => (
                                    <tr key={c._id}>
                                        <td className="fw-bold">{c.complainant}</td>
                                        <td>{c.respondent}</td>
                                        <td>{c.type || "Incident"}</td> 
                                        <td>
                                            <span className={`source-badge ${c.source === 'Online' ? 'online' : 'walkin'}`}>
                                                {c.source || 'Walk-In'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${c.status === 'Active' ? 'active' : 'completed'}`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons-cell">
                                                
                                                {c.status === 'Active' && (
                                                    <button className="blotter-action-box edit" title="Edit" onClick={() => openEditModal(c)}>
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                )}

                                                {c.status === 'Active' && (
                                                    <>
                                                        <button className="blotter-action-box check" title="Mark Settled" onClick={() => handleMarkSettled(c)}>
                                                            <i className="fas fa-check"></i>
                                                        </button>
                                                        <button className="blotter-action-box archive" title="Archive" onClick={() => handleArchive(c._id)}>
                                                            <i className="fas fa-folder-minus"></i>
                                                        </button>
                                                    </>
                                                )}
                                                
                                                {c.status === 'Settled' && (
                                                    <button className="blotter-action-box archive" title="Archive" onClick={() => handleArchive(c._id)}>
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
                        <div className="blotter-empty-state">
                            <div className="empty-icon-wrapper">
                                <i className="fas fa-folder-open"></i>
                            </div>
                            <p>No {filterStatus.toLowerCase()} cases ({activeSource}) found</p>
                        </div>
                    )}
                </div>
            </div>

            <AddBlotterModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveCase}
                loading={loading}
                initialData={editingCase}
            />

        </div>
    );
}