import { useState, useRef } from 'react';
import AddResidentModal from './Resident_Modal/ResidentModal';
import AnalyticsDashboard from './Demographics/AnalyticsDashboard'; 
import { useResidents } from './useResidents'; 
import './Resident.css';

interface ResidentsProps {
  initialData?: any[];
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

// --- SMART SCANNER LOGIC ---
const KEY_MAPPING: { [key: string]: string[] } = {
    firstName: ['firstname', 'first name', 'given name', 'fname', 'name', 'first'],
    lastName: ['lastname', 'last name', 'surname', 'lname', 'family name', 'last'],
    age: ['age', 'year', 'years old'],
    zone: ['zone', 'purok', 'area', 'district', 'street'],
    gender: ['gender', 'sex', 'm/f'],
    contact: ['contact', 'phone', 'mobile', 'cellphone', 'tel', 'number'],
    email: ['email', 'e-mail', 'mail'],
    occupation: ['occupation', 'job', 'work', 'profession'],
    civilStatus: ['civil status', 'civil', 'marital status', 'status'],
    alias: ['alias', 'nickname', 'aka'],
    
    // --- NEW FIELDS ---
    is4Ps: ['4ps', 'pantawid', 'cct', 'mcct', 'beneficiary'],
    isFarmer: ['farmer', 'rsbsa', 'agri', 'agriculture', 'tiller']
};

export default function Residents({ initialData }: ResidentsProps) {
  const [showMetrics, setShowMetrics] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // --- 1. NEW STATE: Track the resident being edited ---
  const [residentToEdit, setResidentToEdit] = useState<any>(null);

  // Hook Data
  const {
    searchQuery, setSearchQuery,
    paginatedResidents,
    residents,           
    handleDelete, handleExport,
    fetchResidents,
    setFilterCategory, 
    filterCategory,
    currentPage, setCurrentPage, totalPages
  } = useResidents(initialData);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 2. HANDLER: Open Modal for Editing ---
  const handleEdit = (resident: any) => {
    setResidentToEdit(resident); // Load data
    setIsModalOpen(true);        // Open modal
  };

  // --- 3. HANDLER: Open Modal for Adding (Clear previous data) ---
  const handleOpenAdd = () => {
    setResidentToEdit(null);     // Clear data
    setIsModalOpen(true);        // Open modal
  };

  // --- 4. HANDLER: Close Modal ---
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setResidentToEdit(null); // Reset on close
  };

  // --- HANDLE CLEAR DATA ---
  const handleClearData = async () => {
    if (!window.confirm('⚠️ WARNING: This will move ALL active residents to the Archive/Recycle Bin.\n\nAre you sure you want to proceed?')) return;

    try {
        const token = localStorage.getItem('token');
        // UPDATED URL
        const res = await fetch(`${BASE_URL}/api/residents/clear-all`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to clear data');
        const data = await res.json();
        alert(`Success! ${data.count} residents moved to Archive.`);
        fetchResidents();
    } catch (err: any) {
        alert(`Error: ${err.message}`);
    }
  };

  // --- SMART IMPORT SCANNER ---
  const handleSmartImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        // A. Parse CSV
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '')); 
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell));

        // B. Identify Columns
        const columnMap: { [index: number]: string } = {};
        
        headers.forEach((header, index) => {
            for (const [schemaKey, variations] of Object.entries(KEY_MAPPING)) {
                if (variations.some(v => header.includes(v.replace(/\s/g, '')))) {
                    columnMap[index] = schemaKey;
                    break;
                }
            }
        });

        // C. Build Payload
        const cleanData = dataRows.map(row => {
            const residentObj: any = {};
            row.forEach((cell, index) => {
                const key = columnMap[index];
                if (key) {
                    const cleanCell = cell.replace(/"/g, '');
                    
                    if (key === 'age') {
                        residentObj[key] = parseInt(cleanCell.replace(/\D/g, '')) || 0;
                    } 
                    else if (key === 'contact') {
                        residentObj[key] = cleanCell.replace(/[^0-9+]/g, '');
                    }
                    else if (key === 'is4Ps' || key === 'isFarmer') {
                        const lower = cleanCell.toLowerCase();
                        residentObj[key] = ['yes', 'true', '1', 'member', 'registered'].includes(lower);
                    }
                    else {
                        residentObj[key] = cleanCell;
                    }
                }
            });
            
            if (!residentObj.isFarmer && residentObj.occupation?.toLowerCase().includes('farmer')) {
                residentObj.isFarmer = true;
            }

            residentObj.status = 'Active';
            return residentObj;
        });

        // D. Send to Backend
        try {
            const token = localStorage.getItem('token');
            // UPDATED URL
            const res = await fetch(`${BASE_URL}/api/residents/bulk-import`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(cleanData)
            });

            const result = await res.json();
            if (res.ok) {
                alert(`Import Successful! Scanned and added ${result.count} residents.`);
                fetchResidents();
            } else {
                alert(`Import Failed: ${result.message}`);
            }
        } catch (err) {
            console.error(err);
            alert("Network Error during import");
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    reader.readAsText(file);
  };

  // Helpers
  const getCategory = (age: string | number) => {
    const n = Number(age);
    if (isNaN(n)) return 'Unknown';
    if (n >= 60) return 'Senior';
    if (n < 18) return 'Minor';
    return 'Adult';
  };

  const getFullName = (res: any) => {
    // Check both split fields and legacy 'name' field
    const first = res.firstName || (res.name ? res.name.split(' ')[0] : '');
    const last = res.lastName || (res.name ? res.name.split(' ').slice(1).join(' ') : '');
    return `${first} ${last}`.trim() || 'Unknown Name';
  };

  return (
    <div className="residents-dashboard-wrapper">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleSmartImport} 
      />

      {/* HEADER */}
      <div className="page-header-row">
        <div>
          <h1>Resident Database</h1>
          <p className="page-subtitle">
            Manage population, track demographics, and generate reports.
          </p>
        </div>
        
        <div className="header-actions">
          <button 
            className={`btn ${showMetrics ? 'btn-black' : 'btn-white'}`} 
            onClick={() => setShowMetrics(!showMetrics)}
          >
            <i className={`fas ${showMetrics ? 'fa-times' : 'fa-chart-pie'}`}></i> 
            {showMetrics ? ' Close Analytics' : ' Analytics'}
          </button>
          
          <button className="btn btn-white" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? (
                <>
                    <i className="fas fa-spinner fa-spin"></i> Scanning...
                </>
            ) : (
                <>
                    <i className="fas fa-file-upload"></i> Import CSV
                </>
            )}
          </button>
          
          <button className="btn btn-white" onClick={handleExport}>
            <i className="fas fa-download"></i> Export
          </button>
          
          
          
          {/* UPDATED: Add Button calls handleOpenAdd */}
          <button className="btn btn-black" onClick={handleOpenAdd}>
            <i className="fas fa-plus"></i> Add Resident
          </button>
        </div>
      </div>

      {/* ANALYTICS DASHBOARD */}
      {showMetrics && (
        <div style={{ marginBottom: '30px', animation: 'fadeIn 0.3s ease-out' }}>
           <AnalyticsDashboard 
              residents={residents || []} 
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
           />
        </div>
      )}

      {/* TABLE CARD */}
      <div className="table-card">

        {/* TOOLBAR */}
        <div className="toolbar" style={{ padding: '15px 20px' }}>
          <div className="search-container">
            <i className="fas fa-search search-icon"></i>
            <input
              className="search-input"
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          {filterCategory !== 'All' && (
             <div className="active-filter-badge" onClick={() => setFilterCategory('All')}>
               Filtering by: <strong>{filterCategory}</strong> <i className="fas fa-times"></i>
             </div>
          )}
        </div>

        {/* TABLE */}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="col-name">Name</th>
                <th style={{ width: '80px' }}>Age</th>
                <th style={{ width: '15%' }}>Zone</th>
                <th style={{ width: '20%' }}>Occupation</th>
                <th style={{ width: '12%' }}>Category</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedResidents.length > 0 ? (
                paginatedResidents.map((res: any) => (
                  <tr key={res._id || res.id}>
                    <td className="col-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar-circle">
                          {getFullName(res).charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                               <span style={{ fontWeight: 500, color: '#111827' }}>{getFullName(res)}</span>
                               {/* 4Ps Badge */}
                               {res.is4Ps && (
                                   <span title="4Ps Beneficiary" style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                           4Ps
                                   </span>
                               )}
                               {/* Farmer Icon */}
                               {res.isFarmer && (
                                   <i className="fas fa-leaf" title="Farmer / RSBSA" style={{ color: '#10b981', fontSize: '0.8rem' }}></i>
                               )}
                           </div>
                           <span style={{ fontSize: '11px', color: '#9ca3af' }}>{res.gender || res.sex || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{res.age}</td>
                    <td>{res.zone || 'Unassigned'}</td>
                    <td>{res.occupation || 'Unemployed'}</td>
                    <td>
                      <span className={`status-badge ${getCategory(res.age).toLowerCase()}`}>
                        {getCategory(res.age)}
                      </span>
                    </td>
                    <td style={{ color: '#6b7280' }}>{res.status || 'Active'}</td>
                    <td>
                      <div className="actions-cell">
                        {/* UPDATED: Edit Action */}
                        <button className="btn-icon" onClick={() => handleEdit(res)}>
                            <i className="fas fa-pen"></i>
                        </button>
                        
                        <button className="btn-icon delete" onClick={() => handleDelete(res._id || res.id)}>
                            <i className="fas fa-archive"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty-state">No residents found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="pagination">
          <button 
            className="page-btn" 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage((p: number) => p - 1)}
          >
             <i className="fas fa-chevron-left"></i> Previous
          </button>
          
          <span className="page-info">
              Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>
          </span>
          
          <button 
            className="page-btn" 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage((p: number) => p + 1)}
          >
              Next <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* UPDATED MODAL USAGE */}
      <AddResidentModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSuccess={fetchResidents} 
        residentToEdit={residentToEdit}
      />
    </div>
  );
}
