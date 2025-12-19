import React, { useState, useEffect } from 'react';
import './AddOfficialsModal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  officialToEdit?: any | null; 
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

export default function AddOfficialModal({ isOpen, onClose, onSuccess, officialToEdit }: ModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initial State
  const initialFormState = {
    name: '',
    position: 'Kagawad',
    committee: '',
    contact: '',
    email: '',
    termStart: '',
    termEnd: '',
    status: 'Active'
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- POPULATE FORM IF EDITING ---
  useEffect(() => {
    if (isOpen && officialToEdit) {
      // If editing, fill fields. note: ensure date format is yyyy-MM-dd
      setFormData({
        name: officialToEdit.name || '',
        position: officialToEdit.position || 'Kagawad',
        committee: officialToEdit.committee || '',
        contact: officialToEdit.contact || '',
        email: officialToEdit.email || '',
        // Handle date formatting safe check
        termStart: officialToEdit.termStart ? officialToEdit.termStart.split('T')[0] : '',
        termEnd: officialToEdit.termEnd ? officialToEdit.termEnd.split('T')[0] : '',
        status: officialToEdit.status || 'Active'
      });
    } else if (isOpen && !officialToEdit) {
      // If adding new, reset form
      setFormData(initialFormState);
    }
  }, [isOpen, officialToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    // DECIDE: URL and METHOD based on Edit vs Add
    // --- FIXED: Use BASE_URL variable ---
    const url = officialToEdit 
      ? `${BASE_URL}/api/officials/${officialToEdit._id}`
      : `${BASE_URL}/api/officials`;
    
    const method = officialToEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save official');

      alert(`Official ${officialToEdit ? 'updated' : 'added'} successfully!`);
      onSuccess(); 
      onClose();   

    } catch (error) {
      console.error('Error:', error);
      alert('Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ height: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            {/* DYNAMIC TITLE */}
            <h2>{officialToEdit ? 'Edit Official' : 'Add New Official'}</h2>
            <button type="button" onClick={onClose} className="close-btn">&times;</button>
          </div>

          <div className="modal-body">
            <h3 className="section-title" style={{ marginTop: 0 }}>Official Profile</h3>
            
            <div className="form-group full-width">
              <label>Full Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-input" required />
            </div>

            <div className="row-2">
              <div className="form-group">
                <label>Position / Title *</label>
                <select name="position" value={formData.position} onChange={handleChange} className="form-input">
                  <option value="Barangay Captain">Barangay Captain</option>
                  <option value="Kagawad">Kagawad</option>
                  <option value="Secretary">Secretary</option>
                  <option value="Treasurer">Treasurer</option>
                  <option value="SK Chairman">SK Chairman</option>
                  <option value="Tanod">Tanod</option>
                </select>
              </div>
              <div className="form-group">
                <label>Committee (Optional)</label>
                <input type="text" name="committee" value={formData.committee} onChange={handleChange} className="form-input" />
              </div>
            </div>

            <h3 className="section-title">Contact Details</h3>
            <div className="row-2">
              <div className="form-group">
                <label>Contact Number *</label>
                <input type="text" name="contact" value={formData.contact} onChange={handleChange} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" />
              </div>
            </div>

            <h3 className="section-title">Term of Office</h3>
            <div className="row-2">
              <div className="form-group">
                <label>Term Start *</label>
                <input type="date" name="termStart" value={formData.termStart} onChange={handleChange} className="form-input date-picker" onClick={(e) => e.currentTarget.showPicker()} required/>
              </div>
              <div className="form-group">
                <label>Term End *</label>
                <input type="date" name="termEnd" value={formData.termEnd} onChange={handleChange} className="form-input date-picker" onClick={(e) => e.currentTarget.showPicker()} required/>
              </div>
            </div>

            <div className="form-group full-width">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="form-input">
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="End of Term">End of Term</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-white" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-black" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (officialToEdit ? 'Update Official' : 'Add Official')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
