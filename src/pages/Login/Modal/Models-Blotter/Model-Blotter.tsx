import React, { useState, useEffect } from 'react';
import './BlotterModal.css';

interface BlotterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string; 
}

const BlotterModal: React.FC<BlotterModalProps> = ({ isOpen, onClose, currentUser }) => {
  // --- Form State ---
  const [formData, setFormData] = useState({
    complainant: '',
    contactNumber: '', 
    respondent: '',
    type: '',
    date: '',
    time: '',
    zone: '',            // Changed: Dropdown for Zone
    specificAddress: '', // Changed: Text input for address details
    narrative: '',
  });

  const [isCertified, setIsCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);

  // --- Effect: Check Daily Limit on Mount ---
  useEffect(() => {
    if (isOpen) {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const storageKey = `blotter_requests_${today}`;
        const currentUsage = parseInt(localStorage.getItem(storageKey) || '0', 10);
        setDailyCount(currentUsage);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Check Certification
    if (!isCertified) {
      alert("Please certify that the information provided is true and accurate.");
      return;
    }

    // 2. CHECK DAILY LIMIT (Max 2)
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `blotter_requests_${today}`;
    const currentUsage = parseInt(localStorage.getItem(storageKey) || '0', 10);

    if (currentUsage >= 2) {
        alert("⚠️ Daily Limit Reached\n\nTo prevent spam, this device is limited to 2 Blotter Reports per day. Please try again tomorrow or visit the Barangay Hall.");
        return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const combinedDateTime = `${formData.date} at ${formData.time}`;
      // Combine Zone and Address for the backend "location" field
      const combinedLocation = `${formData.zone} - ${formData.specificAddress}`;

      const res = await fetch('http://localhost:5000/api/blotters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complainant: formData.complainant, 
          contactNumber: formData.contactNumber, 
          respondent: formData.respondent,
          type: formData.type,
          location: combinedLocation, // Sending combined string
          date: combinedDateTime,
          narrative: formData.narrative,
          source: 'Online',
          status: 'Active'
        })
      });

      if (res.ok) {
        // 3. INCREMENT LOCAL LIMIT ON SUCCESS
        const newCount = currentUsage + 1;
        localStorage.setItem(storageKey, newCount.toString());
        
        alert(`Blotter Report submitted successfully! \n(Requests used today: ${newCount}/2)`);
        
        onClose();
        // Reset form
        setFormData({
            complainant: '', contactNumber: '', respondent: '', type: '', date: '', time: '', zone: '', specificAddress: '', narrative: ''
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
             <p>Reminder: Limit 2 requests per day.</p>
             {/* ADDED: Official Barangay Number */}
             <div style={{marginTop: '5px', color: '#dc3545', fontWeight: 'bold', fontSize: '0.9rem'}}>
                <i className="fas fa-phone-alt"></i> Barangay-Contact: 0977-723-8910
             </div>
           </div>
           <button className="bm-close-icon" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="bm-form">
            
            {/* Limit Warning */}
            {dailyCount >= 2 && (
                <div className="error-msg" style={{marginBottom: '15px'}}>
                    <i className="fas fa-ban"></i> You have reached the daily limit for this device.
                </div>
            )}

            {/* Row 1: Complainant Details (Name & Contact) */}
            <div className="bm-row">
                <div className="bm-group">
                    <label>Your Name <span className="req">*</span></label>
                    <input 
                        type="text" 
                        name="complainant"
                        value={formData.complainant} 
                        onChange={handleChange}
                        className="bm-input" 
                        placeholder="Juan Dela Cruz"
                        required
                    />
                </div>
                <div className="bm-group">
                    <label>Your Contact Number <span className="req">*</span></label>
                    <input 
                        type="tel" 
                        name="contactNumber"
                        value={formData.contactNumber} 
                        onChange={handleChange}
                        className="bm-input" 
                        placeholder="0912 345 6789"
                        required
                    />
                </div>
            </div>

            {/* Row 2: Respondent (Full Width) */}
            <div className="bm-group">
                <label>Respondent Name (Person to Complain) <span className="req">*</span></label>
                <input 
                    type="text" 
                    name="respondent"
                    placeholder="Name of person/s involved"
                    value={formData.respondent} 
                    onChange={handleChange}
                    required 
                    className="bm-input" 
                />
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

            {/* Row 3: Date & Time */}
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

            {/* Row 4: Location (Zone Dropdown & Specific Address) */}
            <div className="bm-row">
                <div className="bm-group">
                    <label>Barangay Zone <span className="req">*</span></label>
                    <select 
                        name="zone" 
                        value={formData.zone} 
                        onChange={handleChange} 
                        required 
                        className="bm-select"
                    >
                        <option value="" disabled>Select Zone</option>
                        <option value="Zone 1">Zone 1</option>
                        <option value="Zone 2">Zone 2</option>
                        <option value="Zone 3">Zone 3</option>
                        <option value="Zone 4">Zone 4</option>
                        <option value="Zone 5">Zone 5</option>
                        <option value="Zone 6">Zone 6</option>
                        <option value="Zone 7">Zone 7</option>
                    </select>
                </div>
                <div className="bm-group">
                    <label>Specific Address <span className="req">*</span></label>
                    <input 
                        type="text" 
                        name="specificAddress"
                        placeholder="e.g., Near Chapel, Blue Gate"
                        value={formData.specificAddress} 
                        onChange={handleChange} 
                        required 
                        className="bm-input" 
                    />
                </div>
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
                disabled={isSubmitting || !isCertified || dailyCount >= 2}
                style={dailyCount >= 2 ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
            >
                {dailyCount >= 2 
                    ? `Daily Limit Reached (${dailyCount}/2)` 
                    : isSubmitting 
                        ? 'Submitting...' 
                        : 'Submit Blotter Report'
                }
            </button>

        </form>
      </div>
    </div>
  );
};

export default BlotterModal;