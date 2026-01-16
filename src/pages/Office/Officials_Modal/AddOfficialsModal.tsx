import React, { useState, useEffect, useRef } from 'react';
import './AddOfficialsModal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  officialToEdit?: any | null;
}

const BASE_URL = "https://capstone1-project.onrender.com";

export default function AddOfficialModal({ isOpen, onClose, onSuccess, officialToEdit }: ModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- SEARCH & DROPDOWN STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // For clicking outside

  // --- VALIDATION STATE ---
  const [errors, setErrors] = useState({
    contact: '',
    email: ''
  });

  // --- FORM STATE ---
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

  // --- 1. RESET / POPULATE ON OPEN ---
  useEffect(() => {
    if (isOpen && officialToEdit) {
      setFormData({
        name: officialToEdit.name || '',
        position: officialToEdit.position || 'Kagawad',
        committee: officialToEdit.committee || '',
        contact: officialToEdit.contact || '',
        email: officialToEdit.email || '',
        termStart: officialToEdit.termStart ? officialToEdit.termStart.split('T')[0] : '',
        termEnd: officialToEdit.termEnd ? officialToEdit.termEnd.split('T')[0] : '',
        status: officialToEdit.status || 'Active'
      });
      setSearchTerm(officialToEdit.name || '');
    } else if (isOpen && !officialToEdit) {
      setFormData(initialFormState);
      setSearchTerm('');
      setSuggestions([]);
    }
    setErrors({ contact: '', email: '' });
    setShowSuggestions(false);
  }, [isOpen, officialToEdit]);

  // --- 2. CLICK OUTSIDE TO CLOSE DROPDOWN ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // --- 3. RESIDENT SEARCH ALGORITHM (Debounced) ---
  useEffect(() => {
    if (!isOpen || !searchTerm) {
      setSuggestions([]);
      return;
    }

    // Stop search if term matches current selected name exactly
    if (searchTerm === formData.name) return;

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/residents`); 
        if (response.ok) {
          const data = await response.json();
          
          // Fuzzy Search Logic
          const lowerTerm = searchTerm.toLowerCase();
          const matches = data.filter((r: any) => {
             const fullName = (r.name || `${r.firstName} ${r.lastName}`).toLowerCase();
             return fullName.includes(lowerTerm);
          }); // We don't slice here, we let the CSS scroll handle the list size

          setSuggestions(matches);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Error fetching residents:", err);
      }
    }, 300); // 300ms delay for typing
  }, [searchTerm, isOpen]);


  // --- HANDLERS ---
  const validateContact = (val: string) => {
    const digitRegex = /^\d{11}$/;
    if (!digitRegex.test(val)) {
      setErrors(prev => ({ ...prev, contact: 'Must be exactly 11 digits (09...)' }));
    } else {
      setErrors(prev => ({ ...prev, contact: '' }));
    }
  };

  const validateEmail = (val: string) => {
    if (!val) {
      setErrors(prev => ({ ...prev, email: '' })); 
      return;
    }
    // Simple email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
    } else {
      setErrors(prev => ({ ...prev, email: '' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'contact') validateContact(value);
    if (name === 'email') validateEmail(value);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNameSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setFormData(prev => ({ ...prev, name: val }));
    setShowSuggestions(true);
  };

  const selectResident = (resident: any) => {
    const fullName = resident.name || `${resident.firstName} ${resident.lastName}`;
    
    setFormData(prev => ({
      ...prev,
      name: fullName,
      // Optional: Auto-fill contact if available in resident DB
      // contact: resident.contactNumber || prev.contact
    }));
    
    setSearchTerm(fullName);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (errors.contact || errors.email) {
      alert("Please fix the highlighted errors.");
      return;
    }
    if (formData.contact.length !== 11) {
       alert("Contact number must be exactly 11 digits.");
       return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    // LOGIC: Even if "officialToEdit" exists, if we are starting a NEW term (e.g. re-election),
    // we technically might want a POST. But based on typical flow:
    // Edit = PUT (Update current record)
    // Add = POST (Create new term/record)
    
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

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to save official');
      }

      alert(`Official ${officialToEdit ? 'updated' : 'added'} successfully!`);
      onSuccess(); 
      onClose();   
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ height: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2>{officialToEdit ? 'Edit Official' : 'Add New Official'}</h2>
            <button type="button" onClick={onClose} className="close-btn">&times;</button>
          </div>

          <div className="modal-body">
            <h3 className="section-title" style={{ marginTop: 0 }}>Official Profile</h3>
            
            {/* --- NAME SEARCH WITH SCROLLABLE DROPDOWN --- */}
            <div className="form-group full-width" ref={wrapperRef} style={{ position: 'relative' }}>
              <label>Full Name (Search Resident) *</label>
              <input 
                type="text" 
                name="name" 
                value={searchTerm} 
                onChange={handleNameSearchChange} 
                className="form-input" 
                placeholder="Type to search database..."
                required 
                autoComplete="off"
              />
              
              {/* DROPDOWN LOGIC */}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-dropdown" style={{
                    /* Overriding CSS slightly here to ensure exact "3 box" height requirement */
                    maxHeight: '145px', /* Fits approx 3 items (40px each + padding) */
                    overflowY: 'auto',  /* Enables vertical scroll */
                    overflowX: 'hidden' /* Prevents horizontal mess */
                }}>
                  {suggestions.map((resident: any, index) => (
                    <li 
                      key={index} 
                      onClick={() => selectResident(resident)}
                      className="suggestion-item"
                    >
                      {resident.name || `${resident.firstName} ${resident.lastName}`}
                    </li>
                  ))}
                </ul>
              )}
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
                <input 
                  type="text" 
                  name="contact" 
                  value={formData.contact} 
                  onChange={handleChange} 
                  className={`form-input ${errors.contact ? 'input-error' : ''}`}
                  placeholder="09XXXXXXXXX"
                  required
                  maxLength={11}
                />
                {errors.contact && <div className="error-msg">⚠️ {errors.contact}</div>}
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                  placeholder="official@example.com"
                />
                {errors.email && <div className="error-msg">⚠️ {errors.email}</div>}
              </div>
            </div>

            <h3 className="section-title">Term of Office</h3>
            <div className="row-2">
              <div className="form-group">
                <label>Term Start *</label>
                <input 
                  type="date" 
                  name="termStart" 
                  value={formData.termStart} 
                  onChange={handleChange} 
                  className="form-input date-picker" 
                  onClick={(e) => e.currentTarget.showPicker()} 
                  required
                />
              </div>
              <div className="form-group">
                <label>Term End *</label>
                <input 
                  type="date" 
                  name="termEnd" 
                  value={formData.termEnd} 
                  onChange={handleChange} 
                  className="form-input date-picker" 
                  onClick={(e) => e.currentTarget.showPicker()} 
                  required
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="form-input">
                <option value="Active">Active</option>
                <option value="End of Term">End of Term</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-white" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button 
              type="submit" 
              className="btn-black" 
              disabled={isSubmitting || !!errors.contact || !!errors.email}
            >
              {isSubmitting ? 'Saving...' : (officialToEdit ? 'Update Official' : 'Add Official')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
