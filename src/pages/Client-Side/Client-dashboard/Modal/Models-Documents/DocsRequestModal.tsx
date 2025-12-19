import React, { useState } from 'react';
import './DocsRequestModal.css';

interface DocsRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string; // Auto-fills Resident Name
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

const DocsRequestModal: React.FC<DocsRequestModalProps> = ({ isOpen, onClose, currentUser }) => {
  if (!isOpen) return null;

  // --- Form State ---
  const [formData, setFormData] = useState({
    certificateType: '',
    purpose: '',
    age: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    // Generate a simple Reference Number (e.g., REQ-171123456)
    const generatedRef = `REQ-${Date.now().toString().slice(-8)}`;
    const today = new Date().toISOString();

    try {
      // --- FIXED: Use BASE_URL variable ---
      const res = await fetch(`${BASE_URL}/api/certificates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          residentName: currentUser,
          age: parseInt(formData.age),
          certificateType: formData.certificateType,
          purpose: formData.purpose,
          referenceNo: generatedRef,
          dateRequested: today,
          source: 'Online', // <--- Tags it as Online Request
          status: 'Pending'
        })
      });

      if (res.ok) {
        alert(`Request Submitted Successfully!\nReference No: ${generatedRef}`);
        onClose();
        setFormData({ certificateType: '', purpose: '', age: '' });
      } else {
        const error = await res.json();
        alert(`Request Failed: ${error.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="drm-overlay">
      <div className="drm-container">
        
        {/* Header */}
        <div className="drm-header">
           <div className="drm-icon-wrapper">
             <i className="fas fa-file-signature"></i>
           </div>
           <div className="drm-header-text">
             <h2>Request Document</h2>
             <p>Select the type of certificate you need</p>
           </div>
           <button className="drm-close-icon" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="drm-form">
            
            {/* Requester Info */}
            <div className="drm-row">
                <div className="drm-group">
                    <label>Requester Name</label>
                    <input 
                        type="text" 
                        value={currentUser} 
                        readOnly 
                        className="drm-input readonly" 
                    />
                </div>
                <div className="drm-group small">
                    <label>Age <span className="req">*</span></label>
                    <input 
                        type="number" 
                        name="age"
                        value={formData.age} 
                        onChange={handleChange}
                        required 
                        className="drm-input" 
                        placeholder="00"
                    />
                </div>
            </div>

            {/* Document Type */}
            <div className="drm-group">
                <label>Document Type <span className="req">*</span></label>
                <select 
                    name="certificateType" 
                    value={formData.certificateType} 
                    onChange={handleChange} 
                    required 
                    className="drm-select"
                >
                    <option value="" disabled>Select Document</option>
                    <option value="Barangay Clearance">Barangay Clearance</option>
                    <option value="Certificate of Indigency">Certificate of Indigency</option>
                    <option value="Certificate of Residency">Certificate of Residency</option>
                    <option value="Business Permit">Business Permit</option>
                    <option value="First Time Job Seeker">First Time Job Seeker</option>
                </select>
            </div>

            {/* Purpose */}
            <div className="drm-group">
                <label>Purpose of Request <span className="req">*</span></label>
                <textarea 
                    name="purpose"
                    placeholder="E.g., For employment requirement, school enrollment, etc."
                    value={formData.purpose} 
                    onChange={handleChange} 
                    required 
                    className="drm-textarea"
                ></textarea>
            </div>

            {/* Info Box */}
            <div className="drm-info-box">
                <i className="fas fa-info-circle"></i>
                <p><strong>Note:</strong> Please bring a valid ID when claiming your document at the Barangay Hall. Processing time is usually 1-2 working days.</p>
            </div>

            {/* Actions */}
            <div className="drm-actions">
                <button type="button" className="drm-cancel-btn" onClick={onClose}>Cancel</button>
                <button 
                    type="submit" 
                    className="drm-submit-btn" 
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
};

export default DocsRequestModal;
