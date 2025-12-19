import { useState, useEffect, useMemo } from 'react';

// Types
interface ArchivedItem {
  originalId: string;
  type: 'Resident' | 'Official' | 'Document' | 'Blotter' | 'Announcement';
  name: string;
  details: string;
  dateDeleted: string;
  endpoint: string; 
}

// Helper: Get Week Number (1-5)
const getWeekOfMonth = (dateString: string) => {
  const d = new Date(dateString);
  const day = d.getDate(); 
  return Math.ceil(day / 7);
};

// Helper: Get Class Name for Tag Color
const getTypeClassName = (type: string) => {
    switch (type) {
      case 'Resident': return 'resident';
      case 'Official': return 'official';
      case 'Blotter': return 'blotter';
      case 'Document': return 'document';
      case 'Announcement': return 'announcement';
      default: return '';
    }
};

export default function Archives() {
  const [archives, setArchives] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeTab, setActiveTab] = useState<'All' | 'Resident' | 'Official' | 'Document' | 'Blotter' | 'Announcement'>('All');

  const token = localStorage.getItem('token');
  const API_BASE_URL = 'http://localhost:5000/api';

  // --- 1. FETCH ALL DATA (Unified Approach) ---
  const fetchAllArchives = async () => {
    if (!token) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/archives/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const backendArchives: any[] = await res.json();
      
      const mappedArchives: ArchivedItem[] = backendArchives.map(item => {
        let details = 'No additional details';
        if (item.type === 'Resident') details = `${item.age} y/o • ${item.zone}`;
        if (item.type === 'Official') details = item.position;
        if (item.type === 'Document') details = item.purpose || item.referenceNo;
        if (item.type === 'Blotter') details = item.location || item.type;
        if (item.type === 'Announcement') details = item.description?.substring(0, 30) + '...';

        return {
          originalId: item._id,
          type: item.type,
          name: item.displayTitle || item.name || item.title || 'Unknown Item', 
          details: details,
          dateDeleted: item.updatedAt || item.createdAt, 
          endpoint: '', 
        };
      });

      mappedArchives.sort((a, b) => new Date(b.dateDeleted).getTime() - new Date(a.dateDeleted).getTime());
      
      setArchives(mappedArchives);

    } catch (err) {
      console.error("Failed to fetch archives:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllArchives(); }, [token]);

  // --- 2. SMART GROUPING ---
  const groupedArchives = useMemo(() => {
    const filtered = archives.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (item.details?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        if (!matchesSearch) return false;
        
        if (activeTab !== 'All' && item.type !== activeTab) return false;
        return item.type !== 'Document'; 
    });
    
    const finalFiltered = archives.filter(item => {
         const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (item.details?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        if (!matchesSearch) return false;
        if (activeTab !== 'All' && item.type !== activeTab) return false;
        return true;
    });

    const groups: Record<string, ArchivedItem[]> = {};

    finalFiltered.forEach(item => {
        const d = new Date(item.dateDeleted);
        const year = d.getFullYear();
        const month = d.toLocaleString('default', { month: 'long' });
        const week = getWeekOfMonth(item.dateDeleted);
        
        const key = `${month} ${year} (Week ${week})`;
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    return groups;
  }, [archives, searchQuery, activeTab]);

  // --- EXPORT FUNCTIONALITY ---
  const handleExportLogs = () => {
    if (archives.length === 0) {
        alert("No archived records to export.");
        return;
    }

    const headers = ['Type', 'Name', 'Details', 'Deleted Date', 'Original ID'];
    const csvContent = [
        headers.join(','), 
        ...archives.map(item => {
            const date = new Date(item.dateDeleted).toLocaleDateString();
            const cleanName = `"${item.name.replace(/"/g, '""')}"`;
            const cleanDetails = `"${item.details.replace(/"/g, '""')}"`;
            return [item.type, cleanName, cleanDetails, date, item.originalId].join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `archived_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = ['All', 'Resident', 'Official', 'Document', 'Blotter', 'Announcement'];

  return (
    <div className="arch-body">
      
      {/* Header */}
      <div className="arch-header-row">
        <div>
          <h1 className="arch-page-title">📁 Archiver</h1>
          <p className="arch-page-subtitle">Record Manager of all archived items.</p>
        </div>
        
        <div className="arch-stats-box">
          <span className="arch-count-badge">
             {archives.length} items archived
          </span>
        </div>
      </div>

      {/* Main Card */}
      <div className="arch-main-card">
        
        {/* Card Top Section (Tabs + Toolbar) */}
        <div className="arch-card-top">
          
          {/* Tabs */}
          <div className="arch-tab-group">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`arch-tab-btn ${activeTab === tab ? 'active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Toolbar & Search */}
          <div className="arch-toolbar">
              <div className="arch-search-group">
                  <i className="fas fa-search arch-search-icon" />
                  <input 
                      type="text" 
                      placeholder="Search archived records..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="arch-search-input"
                  />
              </div>
              
              <button 
                  onClick={handleExportLogs}
                  className="arch-btn-empty"
                  disabled={archives.length === 0 || loading}
                  style={{ color: '#0f172a', borderColor: '#cbd5e1' }} 
              >
                <i className="fas fa-file-export"></i> Export Logs
              </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="arch-table-scroll">
            {loading ? (
                <div className="arch-empty-view">Loading archives...</div>
            ) : Object.keys(groupedArchives).length > 0 ? (
                <table className="arch-data-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Name / Title</th>
                            <th>Details</th>
                            <th>Archived Date</th>
                            {/* Actions Column Header Removed */}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groupedArchives).map(([groupLabel, items]) => (
                            <>
                                {/* THE GROUP HEADER ROW - colSpan reduced to 4 */}
                                <tr key={groupLabel}>
                                    <td colSpan={4} style={{backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#64748b'}}>
                                        <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: '#94a3b8' }}></i>
                                        {groupLabel}
                                    </td>
                                </tr>

                                {/* THE ITEMS */}
                                {items.map(item => (
                                    <tr key={item.originalId}>
                                        <td>
                                            <span className={`arch-type-tag ${getTypeClassName(item.type)}`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="arch-fw-bold">{item.name}</td>
                                        <td>
                                            <div className="arch-text-muted">{item.details}</div>
                                        </td>
                                        <td className="arch-text-muted">{new Date(item.dateDeleted).toLocaleDateString()}</td>
                                        {/* Actions Button Cell Removed */}
                                    </tr>
                                ))}
                            </>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="arch-empty-view">
                    <div className="arch-empty-icon">
                        <i className="fas fa-box-open"></i>
                    </div>
                    No archived items found.
                </div>
            )}
        </div>

      </div>
    </div>
  );
}