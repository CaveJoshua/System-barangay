import React, { useState } from 'react';
import './BlotterModal.css';

interface BlotterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string; // Auto-fills the Complainant Name
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

const BlotterModal: React.FC<BlotterModalProps> = ({ isOpen, onClose, currentUser }) => {
  if (!isOpen) return null;

  // --- Form State ---
  const [formData, setFormData] = useState({
    respondent: '',
    type: '',
    date: '',
    time: '',
    location: '',
    narrative: '',
  });

  const [isCertified, setIsCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Handlers ---
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCertified) {
      alert("Please certify that the information provided is true and accurate.");
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      // Combine Date & Time for the backend
      const combinedDateTime = `${formData.date} at ${formData.time}`;

      // --- FIXED: Use BASE_URL variable ---
      const res = await fetch(`${BASE_URL}/api/blotters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complainant: currentUser,
          respondent: formData.respondent,
          type: formData.type,
          location: formData.location,
          date: combinedDateTime,
          narrative: formData.narrative,
          source: 'Online', // <--- Tags this as an Online Blotter
          status: 'Active'
        })
      });

      if (res.ok) {
        alert("Blotter Report submitted successfully!");
        onClose();
        // Reset form
        setFormData({
            respondent: '', type: '', date: '', time: '', location: '', narrative: ''
        });
        setIsCertified(false);
      } else {
        const error = await res.json();
        alert(`Submission Failed: ${error.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bm-overlay">
      <div className="bm-container">
        
        {/* Header */}
        <div className="bm-header">
           <div className="bm-icon-wrapper">
             <i className="fas fa-exclamation"></i>
           </div>
           <div className="bm-header-text">
             <h2>File a Blotter Report</h2>
             <p>Anti-Troll System: Provide accurate details of the incident</p>
           </div>
           <button className="bm-close-icon" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="bm-form">
            
            {/* Row 1: Names */}
            <div className="bm-row">
                <div className="bm-group">
                    <label>Complainant Name <span className="req">*</span></label>
                    <input 
                        type="text" 
                        value={currentUser} 
                        readOnly 
                        className="bm-input readonly" 
                    />
                </div>
                <div className="bm-group">
                    <label>Respondent Name <span className="req">*</span></label>
                    <input 
                        type="text" 
                        name="respondent"
                        placeholder="Person/s Involved"
                        value={formData.respondent} 
                        onChange={handleChange}
                        required 
                        className="bm-input" 
                    />
                </div>
            </div>

            {/* Incident Type */}
            <div className="bm-group">
                <label>Incident Type <span className="req">*</span></label>
                <select 
                    name="type" 
                    value={formData.type} 
                    onChange={handleChange} 
                    required 
                    className="bm-select"
                >
                    <option value="" disabled>Select Incident Type</option>
                    <option value="Noise Complaint">Noise Complaint</option>
                    <option value="Physical Altercation">Physical Altercation</option>
                    <option value="Property Damage">Property Damage</option>
                    <option value="Theft">Theft</option>
                    <option value="Harassment">Harassment</option>
                    <option value="Others">Others</option>
                </select>
            </div>

            {/* Row 2: Date & Time */}
            <div className="bm-row">
                <div className="bm-group">
                    <label>Date of Incident <span className="req">*</span></label>
                    <input 
                        type="date" 
                        name="date" 
                        value={formData.date} 
                        onChange={handleChange} 
                        required 
                        className="bm-input" 
                    />
                </div>
                <div className="bm-group">
                    <label>Time of Incident</label>
                    <input 
                        type="time" 
                        name="time" 
                        value={formData.time} 
                        onChange={handleChange} 
                        required 
                        className="bm-input" 
                    />
                </div>
            </div>

            {/* Location */}
            <div className="bm-group">
                <label>Location of Incident <span className="req">*</span></label>
                <input 
                    type="text" 
                    name="location"
                    placeholder="e.g., Near the Basketball Court, Purok 2"
                    value={formData.location} 
                    onChange={handleChange} 
                    required 
                    className="bm-input" 
                />
            </div>

            {/* Narrative */}
            <div className="bm-group">
                <label>Narrative / Details <span className="req">*</span></label>
                <textarea 
                    name="narrative"
                    placeholder="Describe clearly what happened, who was involved, and other important details..."
                    value={formData.narrative} 
                    onChange={handleChange} 
                    required 
                    className="bm-textarea"
                ></textarea>
            </div>

            {/* Visual Upload Placeholder */}
            <div className="bm-upload-box">
                <i className="fas fa-camera"></i>
                <span className="upload-title">Upload Photo/Evidence</span>
                <span className="upload-sub">Click to attach photos or documents related to the incident</span>
                <span className="upload-types">JPG, PNG or PDF (Max 5MB)</span>
            </div>

            {/* Certification */}
            <div className="bm-checkbox-row">
                <input 
                    type="checkbox" 
                    id="certify" 
                    checked={isCertified}
                    onChange={(e) => setIsCertified(e.target.checked)}
                />
                <label htmlFor="certify">I certify that the information provided is true and accurate. <span className="req">*</span></label>
            </div>

            {/* Privacy Box */}
            <div className="bm-privacy-notice">
                <i className="fas fa-lock"></i>
                <div>
                    <strong>Privacy Notice:</strong> Your report is confidential. False reporting may result in legal penalties (Art. 183 RPC).
                </div>
            </div>

            {/* Button */}
            <button 
                type="submit" 
                className="bm-submit-btn" 
                disabled={isSubmitting || !isCertified}
            >
                {isSubmitting ? 'Submitting...' : 'Submit Blotter Report'}
            </button>

        </form>
      </div>
    </div>
  );
};

export default BlotterModal;
