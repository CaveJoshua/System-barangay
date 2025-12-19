import React, { useState, useEffect, useCallback } from 'react';
import './Announcement.css';
import AddAnnouncementModal from './AddannouncementModal/addAnnouncementModal';

// --- Types ---
export interface AnnouncementData {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  isActive: boolean;
  primaryTag: 'HIGH' | 'MEDIUM' | 'LOW';
  secondaryTag: 'Warning' | 'Success' | 'Info';
  date: string; 
  views: number;
  daysRemaining: string;
  expires: string; // Formatted string
  expiresAt?: string; // Raw date string for editing
  location?: string;
  eventTime?: string;
  organizer?: string;
}

// --- Helper Functions ---
const API_URL = 'http://localhost:5000/api/announcements';

const getTagClass = (tag: string) => {
  switch (tag?.toUpperCase()) {
    case 'HIGH': return 'tag-high';
    case 'MEDIUM': return 'tag-medium';
    case 'LOW': return 'tag-low';
    default: return 'tag-low';
  }
};

// --- Component: AnnouncementItem ---
interface ItemProps {
  data: AnnouncementData;
  onUpdate: (id: string, updates: Partial<AnnouncementData>) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (item: AnnouncementData) => void; 
}

const AnnouncementItem: React.FC<ItemProps> = ({ data, onUpdate, onDelete, onArchive, onEdit }) => {
  const { id, title, description, imageUrl, isActive, primaryTag, secondaryTag, date, views, daysRemaining, expires } = data;

  return (
    <div className="announcement-card">
      {/* 1. Image */}
      <div className="card-media">
        <img src={imageUrl || 'https://via.placeholder.com/150'} alt={title} />
      </div>

      {/* 2. Content Body */}
      <div className="card-body">
        <div className="card-top-row">
          <h3 className="card-title">{title}</h3>
          <span className={`status-pill ${isActive ? 'active' : ''}`}>
            • {isActive ? 'Active' : 'Archived'}
          </span>
        </div>
        
        <p className="card-description">{description}</p>
        
        <div className="card-meta-bar">
          <span className={`meta-badge ${getTagClass(primaryTag)}`}>{primaryTag}</span>
          <span className="meta-badge outline">
            <i className={`fas ${secondaryTag === 'Warning' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} />
            {secondaryTag}
          </span>
          <span className="meta-divider">|</span>
          <span className="meta-text">{date}</span>
          <span className="meta-pill"><i className="far fa-eye"></i> {views}</span>
          <span className="meta-pill"><i className="far fa-clock"></i> {daysRemaining}</span>
          <span className="meta-text expires">Expires: {expires}</span>
        </div>
      </div>

      {/* 3. Actions */}
      <div className="card-actions">
        {/* EYE ICON: Toggles Active Status */}
        <button className="action-btn" title={isActive ? "Hide (Archive)" : "Show (Activate)"} onClick={() => onUpdate(id, { isActive: !isActive })}>
          <i className={`fas ${isActive ? 'fa-eye' : 'fa-eye-slash'}`}></i>
        </button>
        
        {/* EDIT ICON */}
        <button className="action-btn" title="Edit" onClick={() => onEdit(data)}>
            <i className="fas fa-pencil-alt"></i>
        </button>
        
        {/* DELETE ICON */}
        <button className="action-btn danger" title="Delete" onClick={() => onDelete(id)}>
            <i className="far fa-trash-alt"></i>
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---
const Announcement: React.FC = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // NEW STATE: Tracks the item currently being edited
  const [editingItem, setEditingItem] = useState<AnnouncementData | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  // --- API ---
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch ALL (Active + Archived) so the eye toggle doesn't make items disappear instantly
      const response = await fetch(`${API_URL}/all`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      // Fallback if /all route doesn't exist, use standard route
      const finalRes = response.ok ? response : await fetch(API_URL, { headers: { 'Authorization': `Bearer ${token}` }});

      if (finalRes.ok) {
        const rawData = await finalRes.json();
        
        const formattedData = Array.isArray(rawData) ? rawData.map((item: any) => {
            const expiresDate = new Date(item.expiresAt);
            const today = new Date();
            const timeDiff = expiresDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            let daysString = "";
            if (daysLeft < 0) daysString = "Expired";
            else if (daysLeft === 0) daysString = "Expires Today";
            else daysString = `${daysLeft} days left`;

            return {
                ...item,
                id: item._id,
                isActive: item.status === 'Active', 
                expiresAt: item.expiresAt, // Keep raw date for editing
                date: new Date(item.createdAt).toLocaleDateString('en-CA'),
                expires: expiresDate.toLocaleDateString(),
                daysRemaining: daysString,
                views: item.views || 0
            };
        }) : [];

        setAnnouncements(formattedData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  // --- Filter ---
  const filteredList = announcements.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    // Show everything for now so we can see the "Eye" toggle effect
    return matchesSearch; 
  });

  const activeCount = announcements.filter(a => a.isActive).length;

  // --- Handlers ---
  const handleUpdate = async (id: string, updates: Partial<AnnouncementData>) => {
    // Optimistic Update (Update UI immediately)
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));

    try {
      const token = localStorage.getItem('token');
      // Prepare payload for backend
      const backendUpdates = {
          ...updates,
          status: updates.isActive ? 'Active' : 'Archived'
      };

      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT', // Changed to PUT to match typical update routes
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(backendUpdates)
      });

      if (!response.ok) throw new Error('Failed to update');
    } catch (error) {
      console.error(error);
      alert("Failed to update status.");
      fetchAnnouncements(); // Revert on error
    }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Permanently delete this item?")) return;
    setAnnouncements(prev => prev.filter(a => a.id !== id));

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/permanent/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      alert("Failed to delete.");
      fetchAnnouncements();
    }
  };

  // 1. OPEN ADD MODAL (Clear Edit State)
  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  // 2. OPEN EDIT MODAL (Set Edit State)
  const handleEdit = (item: AnnouncementData) => {
    setEditingItem(item);
    setIsModalOpen(true); 
  };

  return (
    <div className="announcement-dashboard-wrapper">
      <div className="page-header">
        <div className="header-icon"><i className="far fa-bell"></i></div>
        <div className="header-text">
          <h1>Announcements Dashboard</h1>
          <p>Manage and organize system announcements efficiently</p>
        </div>
      </div>

      <div className="main-panel">
        <div className="panel-top">
          <div className="panel-label"><i className="far fa-bell"></i> Announcement Center</div>
          <p className="panel-sub">Create, edit, and manage announcements.</p>
        </div>

        <div className="panel-actions">
           {/* Update OnClick to use handleOpenAdd */}
           <button className="btn-create" onClick={handleOpenAdd}>
              <i className="fas fa-plus"></i> Add Announcement
           </button>
        </div>

        <div className="status-bar">
           <div className="status-tab active">
              <i className="far fa-bell"></i> Active <span className="count-badge">{activeCount}</span>
           </div>
        </div>

        <div className="filter-bar">
           <div className="search-box">
              <i className="fas fa-search"></i>
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
        </div>

        <div className="list-container">
           <div className="list-stack">
             {filteredList.length > 0 ? filteredList.map(item => (
               <AnnouncementItem 
                 key={item.id} 
                 data={item} 
                 onUpdate={handleUpdate}
                 onDelete={handleDelete}
                 onArchive={() => handleUpdate(item.id, { isActive: false })}
                 onEdit={handleEdit}
               />
             )) : (
               <div className="empty-view">No announcements found.</div>
             )}
           </div>
        </div>
      </div>

      {/* PASS EDIT DATA TO MODAL */}
      {isModalOpen && (
        <AddAnnouncementModal 
          isOpen={isModalOpen} // Explicit pass
          editData={editingItem} // Pass the item to edit
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
          onSuccess={() => { setIsModalOpen(false); setEditingItem(null); fetchAnnouncements(); }} 
        />
      )}
    </div>
  );
};

export default Announcement;