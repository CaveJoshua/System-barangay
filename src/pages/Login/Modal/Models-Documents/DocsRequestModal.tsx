import React, { useState, useEffect } from 'react';
import './DocsRequestModal.css';

interface DocsRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string; 
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

const DocsRequestModal: React.FC<DocsRequestModalProps> = ({ isOpen, onClose, currentUser }) => {
  // --- Form State ---
  const [formData, setFormData] = useState({
    residentName: '', 
    age: '',
    zone: '',            // NEW: Dropdown
    specificAddress: '', // NEW: Text input
    certificateType: '',
    purpose: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);

  // --- Effect: Check Daily Limit on Mount ---
  useEffect(() => {
    if (isOpen) {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const storageKey = `docs_requests_${today}`;
        const currentUsage = parseInt(localStorage.getItem(storageKey) || '0', 10);
        setDailyCount(currentUsage);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // RULE: Prevent negative age
    if (name === 'age' && Number(value) < 0) {
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. CHECK DAILY LIMIT (Max 2)
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `docs_requests_${today}`;
    const currentUsage = parseInt(localStorage.getItem(storageKey) || '0', 10);

    if (currentUsage >= 2) {
        alert("⚠️ Daily Limit Reached\n\nTo ensure fair service, this device is limited to 2 Document Requests per day.");
        return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    // Generate Reference No.
    const generatedRef = `REQ-${Date.now().toString().slice(-8)}`;
    const dateToday = new Date().toISOString();

    // COMBINE ADDRESS LOGIC
    // Since Certificate DB model might not have 'address' field yet, 
    // we append the address to the 'purpose' so officials can see it.
    const fullAddress = `${formData.zone} - ${formData.specificAddress}`;
    const purposeWithAddress = `${formData.purpose} \n(Residing at: ${fullAddress})`;

    try {
      // --- FIXED: Use BASE_URL variable ---
      const res = await fetch(`${BASE_URL}/api/certificates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          residentName: formData.residentName, 
          age: parseInt(formData.age),
          certificateType: formData.certificateType,
          purpose: purposeWithAddress, // Sending combined purpose + address
          referenceNo: generatedRef,
          dateRequested: dateToday,
          source: 'Online', 
          status: 'Pending'
        })
      });

      if (res.ok) {
        // 2. INCREMENT LOCAL LIMIT ON SUCCESS
        const newCount = currentUsage + 1;
        localStorage.setItem(storageKey, newCount.toString());

        alert(`Request Submitted Successfully!\nReference No: ${generatedRef}\n(Requests used today: ${newCount}/2)`);
        
        onClose();
        // Reset form
        setFormData({ residentName: '', age: '', zone: '', specificAddress: '', certificateType: '', purpose: '' });
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
             <p>Limit: 2 requests per day per device.</p>
           </div>
           <button className="drm-close-icon" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="drm-form">
            
            {/* Limit Warning */}
            {dailyCount >= 2 && (
                <div className="error-msg" style={{marginBottom: '15px', color: '#dc3545', background: '#ffe6e6', padding: '10px', borderRadius: '5px'}}>
                    <i className="fas fa-ban"></i> You have reached the daily limit for this device.
                </div>
            )}

            {/* Row 1: Requester Info */}
            <div className="drm-row">
                <div className="drm-group">
                    <label>Requester Name <span className="req">*</span></label>
                    <input 
                        type="text" 
                        name="residentName"
                        value={formData.residentName} 
                        onChange={handleChange}
                        className="drm-input" 
                        placeholder="Enter your full name"
                        required
                    />
                </div>
                <div className="drm-group small">
                    <label>Age <span className="req">*</span></label>
                    <input 
                        type="number" 
                        min="0" // HTML Constraint
                        name="age"
                        value={formData.age} 
                        onChange={handleChange}
                        required 
                        className="drm-input" 
                        placeholder="00"
                    />
                </div>
            </div>

            {/* Row 2: Address Info (Zone & Specific) */}
            <div className="drm-row">
                <div className="drm-group">
                    <label>Barangay Zone <span className="req">*</span></label>
                    <select 
                        name="zone" 
                        value={formData.zone} 
                        onChange={handleChange} 
                        required 
                        className="drm-select"
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
                <div className="drm-group">
                    <label>Specific Address <span className="req">*</span></label>
                    <input 
                        type="text" 
                        name="specificAddress"
                        placeholder="e.g., Near Chapel, Blue Gate"
                        value={formData.specificAddress} 
                        onChange={handleChange} 
                        required 
                        className="drm-input" 
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
                    <option value="Sedula">Sedula</option>
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
                    disabled={isSubmitting || dailyCount >= 2}
                    style={dailyCount >= 2 ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
                >
                    {dailyCount >= 2 ? `Limit Reached (${dailyCount}/2)` : isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
};

export default DocsRequestModal;
