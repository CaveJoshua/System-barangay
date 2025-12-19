import React, { useState, useEffect } from 'react';
import './BlotterModal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  loading?: boolean;
  initialData?: any; 
}

export default function AddBlotterModal({ isOpen, onClose, onSave, loading = false, initialData = null }: ModalProps) {
  
  const [formData, setFormData] = useState({
    complainant: '',
    respondent: '',
    type: '',
    date: '',
    location: '',
    narrative: '',
    status: 'Active',
    source: 'Online' // <--- CHANGED: Default is now 'Online' (Resident Request)
  });

  // Helper to fix date format for input (YYYY-MM-DDThh:mm)
  const formatDateForInput = (isoString: string) => {
    if (!isoString) return '';
    return isoString.slice(0, 16);
  };

  // Load data if editing
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        ...initialData,
        date: formatDateForInput(initialData.date),
        // If data has a source, use it; otherwise default to 'Online' if missing
        source: initialData.source || 'Online' 
      });
    } else if (isOpen && !initialData) {
      // Reset if creating new
      setFormData({
        complainant: '',
        respondent: '',
        type: '',
        date: '',
        location: '',
        narrative: '',
        status: 'Active',
        source: 'Online' // <--- CHANGED: Reset to 'Online'
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.complainant || !formData.respondent) {
      alert("Please fill in required fields.");
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '550px', height: 'auto', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '20px' }}>{initialData ? "Edit Case" : "File Complaint (Resident)"}</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-body">
          {/* Row 1: Complainant & Respondent */}
          <div className="form-group">
            <label className="label-upper">COMPLAINANT <span style={{color:'red'}}>*</span></label>
            <input type="text" className="form-input" placeholder="Full Name"
              value={formData.complainant} onChange={(e) => handleChange('complainant', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label-upper">RESPONDENT <span style={{color:'red'}}>*</span></label>
            <input type="text" className="form-input" placeholder="Name of person being complained"
              value={formData.respondent} onChange={(e) => handleChange('respondent', e.target.value)} />
          </div>

          {/* Row 2: Incident Type & Source */}
          <div className="row-2" style={{ display: 'flex', gap: '15px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label-upper">INCIDENT TYPE</label>
              <select className="form-input" value={formData.type} onChange={(e) => handleChange('type', e.target.value)}>
                <option value="" disabled>Select incident type...</option>
                <option value="Theft">Theft / Robbery</option>
                <option value="Physical Injury">Physical Injury</option>
                <option value="Noise Complaint">Noise Complaint</option>
                <option value="Property Damage">Property Damage</option>
                <option value="Harassment">Harassment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* SOURCE DROPDOWN - Allows you to verify it is "Online" */}
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label-upper">SOURCE</label>
              <select className="form-input" value={formData.source} onChange={(e) => handleChange('source', e.target.value)}>
                <option value="Online">Online (Resident)</option>
                <option value="Walk-In">Walk-In (Manual)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Date & Location */}
           <div className="row-2" style={{ display: 'flex', gap: '15px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label-upper">DATE & TIME</label>
              <input 
                type="datetime-local" 
                className="form-input" 
                value={formData.date} 
                onChange={(e) => handleChange('date', e.target.value)}
                onClick={(e) => e.currentTarget.showPicker()} 
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label-upper">LOCATION</label>
              <input type="text" className="form-input" placeholder="Location"
                value={formData.location} onChange={(e) => handleChange('location', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label-upper">NARRATIVE</label>
            <textarea className="form-input" placeholder="Describe what happened..." style={{ height: '100px' }}
              value={formData.narrative} onChange={(e) => handleChange('narrative', e.target.value)}></textarea>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-white" onClick={onClose}>Cancel</button>
          <button className="btn-red" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : (initialData ? "Update Case" : "File Case")}
          </button>
        </div>
      </div>
    </div>
  );
}