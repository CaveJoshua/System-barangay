import React, { useState, useEffect } from 'react';
import AddOfficialModal from './Officials_Modal/AddOfficialsModal';
import './Officials.css';

// Using camelCase to match the Schema from Backend
interface Official {
  _id: string;
  name: string;
  position: string;
  contact: string;
  email?: string;
  termStart: string;
  termEnd: string;
  status: string;
  committee?: string;
}

interface OfficialsProps {
  initialData?: Official[];
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

export default function Officials({ initialData = [] }: OfficialsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [officials, setOfficials] = useState<Official[]>(initialData);
  const [selectedOfficial, setSelectedOfficial] = useState<Official | null>(null);

  // --- 1. REFRESH LOGIC ---
  const refreshOfficials = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // UPDATED URL
      const res = await fetch(`${BASE_URL}/api/officials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setOfficials(data);
        else if (data.officials) setOfficials(data.officials);
      }
    } catch (err) {
      console.error("Failed to refresh officials:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialData.length === 0) refreshOfficials();
    else setOfficials(initialData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  // --- 2. ARCHIVE LOGIC ---
  const handleArchive = async (id: string, name: string) => {
    if(!window.confirm(`Archive ${name}? They will be moved to the Archived list.`)) return;

    const token = localStorage.getItem('token');
    try {
      // UPDATED URL
      const res = await fetch(`${BASE_URL}/api/officials/${id}`, {
        method: 'PUT', 
        headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status: 'Archived' }) 
      });

      if (res.ok) {
        refreshOfficials(); 
      } else {
        alert("Failed to archive official.");
      }
    } catch (error) {
      console.error("Archive error:", error);
    }
  };

  // --- 3. EDIT/CLOSE LOGIC ---
  const handleEdit = (official: Official) => {
    setSelectedOfficial(official); 
    setIsModalOpen(true);          
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOfficial(null); 
  };

  // --- FILTERING (Active Only) ---
  const filteredOfficials = officials.filter(off => {
    const status = off.status ? off.status.toLowerCase() : 'active';
    
    // Strict Filter: Show ONLY Active
    if (status === 'archived' || status === 'end of term') return false;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      return (
        (off.name && off.name.toLowerCase().includes(lowerTerm)) ||
        (off.position && off.position.toLowerCase().includes(lowerTerm))
      );
    }
    return true;
  });

  return (
    <div className="dashboard-body officials-page">
      
      {/* Header */}
      <div className="off-header-row">
        <div>
          <h1>Officials Management</h1>
          <p>Manage current barangay officials and committee heads</p>
        </div>
        <button className="btn-black" onClick={() => { setSelectedOfficial(null); setIsModalOpen(true); }}>
          <i className="fas fa-plus"></i> Add Official
        </button>
      </div>

      {/* Main Card */}
      <div className="off-card">
        
        {/* Toolbar */}
        <div className="off-toolbar">
          <div className="off-search">
            <i className="fas fa-search"></i>
            <input 
              type="text" 
              placeholder="Search officials..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="off-count-badge">
            {filteredOfficials.length} Active Officials
          </div>
        </div>

        <div className="off-table-container">
          <table className="off-table">
            <thead>
              <tr>
                <th>NAME / COMMITTEE</th>
                <th>POSITION</th>
                <th>CONTACT</th>
                <th>TERM DURATION</th>
                <th>STATUS</th>
                <th align="right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="loading-text">Loading data...</td></tr>
              ) : filteredOfficials.length > 0 ? (
                filteredOfficials.map(off => (
                  <tr key={off._id}>
                    <td>
                      <div className="off-name">{off.name}</div>
                      {off.committee && <div className="off-committee">{off.committee}</div>}
                    </td>
                    <td className="off-pos">{off.position}</td>
                    <td className="text-muted">{off.contact || 'N/A'}</td>
                    <td className="text-muted">
                      {(off.termStart) ? (
                        <span>
                          {new Date(off.termStart).getFullYear()} - {new Date(off.termEnd).getFullYear()}
                        </span>
                      ) : 'N/A'}
                    </td>
                    <td>
                      <span className="status-pill active">Active</span>
                    </td>
                    <td align="right">
                      <div className="action-group">
                        <button 
                            className="action-btn edit" 
                            title="Edit"
                            onClick={() => handleEdit(off)}
                        >
                            <i className="fas fa-pencil-alt"></i>
                        </button>
                        
                        <button 
                            className="action-btn archive" 
                            title="End Term / Archive" 
                            onClick={() => handleArchive(off._id, off.name)}
                        >
                            <i className="fas fa-archive"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No active officials found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      <AddOfficialModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSuccess={refreshOfficials} 
        officialToEdit={selectedOfficial} 
      />

    </div>
  );
}
