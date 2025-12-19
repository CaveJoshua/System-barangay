import React from 'react';
import './CSS/AnnouncementModal.css';
import type { Announcement } from './Models-TypeScript/Anc-types'; // Using the specific type file

interface ModalProps {
  data: Announcement;
  onClose: () => void;
}

const AnnouncementModal: React.FC<ModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  // Formatting helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'long', day: 'numeric', year: 'numeric' 
    });
  };

  // Image Helper
  const renderImage = (url?: string) => {
    if (url && url.trim() !== "") {
      return <div className="Anc-hero-img" style={{ backgroundImage: `url(${url})` }}></div>;
    }
    return (
      <div className="Anc-hero-placeholder">
         <i className="far fa-image"></i>
      </div>
    );
  };

  return (
    <div className="Anc-overlay" onClick={onClose}>
      <div className="Anc-container" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER: Title & Close Button */}
        <div className="Anc-header">
          <h2>{data.title}</h2>
          <button className="Anc-close-icon" onClick={onClose}>&times;</button>
        </div>

        {/* BADGES ROW */}
        <div className="Anc-badges">
           <span className="Anc-badge featured"><i className="fas fa-bookmark"></i> FEATURED</span>
           <span className={`Anc-badge ${data.primaryTag}`}>
             <i className="fas fa-bullhorn"></i> {data.primaryTag} PRIORITY
           </span>
           <span className="Anc-badge date">
             <i className="far fa-calendar-alt"></i> {formatDate(data.createdAt)}
           </span>
        </div>

        {/* HERO IMAGE */}
        <div className="Anc-image-wrapper">
           {renderImage(data.imageUrl)}
        </div>

        {/* INFO GRID (The Gray Box) */}
        <div className="Anc-info-box">
           {/* Location */}
           <div className="Anc-info-item">
              <div className="Anc-icon blue"><i className="fas fa-map-marker-alt"></i></div>
              <div className="Anc-info-text">
                 <span className="label">LOCATION</span>
                 <span className="value">Barangay Hall Main Grounds</span>
              </div>
           </div>

           {/* Time */}
           <div className="Anc-info-item">
              <div className="Anc-icon green"><i className="far fa-clock"></i></div>
              <div className="Anc-info-text">
                 <span className="label">TIME</span>
                 <span className="value">6:00 AM - 10:00 AM</span>
              </div>
           </div>

           {/* Organized By */}
           <div className="Anc-info-item full-width">
              <div className="Anc-icon purple"><i className="far fa-bell"></i></div>
              <div className="Anc-info-text">
                 <span className="label">ORGANIZED BY</span>
                 <span className="value">Barangay Environment Committee</span>
              </div>
           </div>
        </div>

        {/* CONTENT BODY */}
        <div className="Anc-body">
           <h3>Overview</h3>
           <p>{data.description}</p>
           
           <h3>Details</h3>
           <p>
             Join us for this event! Active participation is encouraged for all residents. 
             Please bring your ID and coordinate with the staff on duty. 
             Let's work together to make our community a better place for everyone!
           </p>
        </div>

        {/* FOOTER */}
        <div className="Anc-footer">
           <button className="Anc-close-btn" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
};

export default AnnouncementModal;