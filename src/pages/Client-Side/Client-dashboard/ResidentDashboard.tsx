import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ResidentDashboard.css';

import type { Announcement } from './Modal/Models-TypeScript/Anc-types';

// Modals
import AnnouncementModal from './Modal/AnnouncementModal';
import BlotterModal from './Modal/Models-Blotter/Model-Blotter'; 
import DocsRequestModal from './Modal/Models-Documents/DocsRequestModal'; 

// --- FIXED: Use Live Backend URL ---
const API_BASE_URL = "https://capstone1-project.onrender.com/api";

interface UserProfile {
  name: string;
}

const ResidentDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [user, setUser] = useState<UserProfile>({ name: "Resident" });
  const [loading, setLoading] = useState<boolean>(true);
  
  // --- Modal States ---
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isBlotterModalOpen, setIsBlotterModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedName = localStorage.getItem('userName');
    if (storedName) setUser({ name: storedName });

    if (!token) {
      navigate('/login');
      return;
    }

    const fetchAllData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Fetch User
        const userRes = await fetch(`${API_BASE_URL}/users/me`, { headers });
        if (userRes.ok) {
          const uData = await userRes.json();
          const realName = uData.firstName || uData.fullName || uData.username || "Resident";
          setUser({ name: realName });
        }

        // Fetch Announcements
        const annRes = await fetch(`${API_BASE_URL}/announcements`, { headers });
        if (annRes.ok) {
            const annData = await annRes.json();
            const sorted = annData.sort((a: any, b: any) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setAnnouncements(sorted);
        }

      } catch (error) {
        console.error("Error loading dashboard", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [navigate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'long', day: 'numeric', year: 'numeric' 
    });
  };

  const renderImage = (url?: string, type: 'hero' | 'grid' = 'grid') => {
    if (url && url.trim() !== "") {
      return <div className={`card-img ${type}`} style={{ backgroundImage: `url(${url})` }}></div>;
    }
    return (
      <div className={`card-placeholder ${type}`}>
         <i className="far fa-image"></i>
      </div>
    );
  };

  if (loading) return <div className="Rsd-loading-screen"><div className="spinner"></div></div>;

  const featuredNews = announcements.length > 0 ? announcements[0] : null;
  const otherNews = announcements.length > 1 ? announcements.slice(1, 4) : [];

  return (
    <div className="Rsd-layout-container">
      
      <header className="Rsd-header">
        <h1>Welcome to Barangay Tugui Grande, {user.name} 👋</h1>
        <p>Access essential barangay services and stay informed.</p>
      </header>

      <section className="Rsd-quick-actions">
        
        {/* Card 1: Blotter */}
        <div className="action-card" onClick={() => setIsBlotterModalOpen(true)}>
            <div className="icon-circle orange"><i className="fas fa-exclamation-triangle"></i></div>
            <h3>File a Blotter Report</h3>
            <p>Report incidents and concerns to barangay officials securely.</p>
            <span className="link-text orange">Get Started <i className="fas fa-chevron-right"></i></span>
        </div>

        {/* Card 2: Request Documents */}
        <div className="action-card" onClick={() => setIsDocsModalOpen(true)}>
            <div className="icon-circle green"><i className="fas fa-file-contract"></i></div>
            <h3>Request Documents</h3>
            <p>Apply for clearances, certificates, and permits online.</p>
            <span className="link-text green">Apply Now <i className="fas fa-chevron-right"></i></span>
        </div>

      </section>

      <div className="Rsd-divider"></div>

      <section className="Rsd-feed">
        <div className="feed-header">
            <h3>Community Bulletin</h3>
        </div>

        {featuredNews ? (
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
                      <div className="badges-float">
                          <span className={`badge badge-${ann.primaryTag}`}>{ann.primaryTag}</span>
                      </div>
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
          <div className="empty-state">No announcements found.</div>
        )}
      </section>

      {/* --- MODALS --- */}

      {/* Announcement Details */}
      {selectedAnnouncement && (
        <AnnouncementModal 
            data={selectedAnnouncement} 
            onClose={() => setSelectedAnnouncement(null)} 
        />
      )}

      {/* Blotter Form */}
      <BlotterModal 
          isOpen={isBlotterModalOpen}
          onClose={() => setIsBlotterModalOpen(false)}
          currentUser={user.name}
      />

      {/* Documents Request Form */}
      <DocsRequestModal 
          isOpen={isDocsModalOpen}
          onClose={() => setIsDocsModalOpen(false)}
          currentUser={user.name}
      />

    </div>
  );
};

export default ResidentDashboard;
