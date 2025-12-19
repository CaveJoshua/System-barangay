import React, { useState, useEffect } from 'react';
import './ResidentModal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  residentToEdit?: any;
}

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

// Initial State helper
const INITIAL_STATE = {
  firstName: '', middleName: '', lastName: '',
  dob: '', gender: 'Male',
  birthPlace: '', nationality: 'Filipino',
  contact: '', email: '', address: '',
  zone: '', householdCount: 1,
  barangayId: '', householdNumber: '',
  civilStatus: 'Single', religion: '',
  education: 'None', employment: 'Unemployed',
  occupation: '', income: 'Below ₱5,000',
  
  // Checkboxes
  isVoter: false, isPwd: false, is4ps: false,
  isSoloParent: false, isOsy: false, isIndigenous: false,
  isFarmer: false,
  
  // Health
  bloodType: 'Unknown', height: '', weight: '',
  isMalnourished: false, isPregnant: false, isLactating: false, hasChronicIllness: false,
  
  // Emergency (Flattened for form)
  emergencyName: '', emergencyContact: '', emergencyRelation: ''
};

export default function AddResidentModal({ isOpen, onClose, onSuccess, residentToEdit }: ModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_STATE);

  // --- 1. POPULATE FORM ON OPEN ---
  useEffect(() => {
    if (isOpen) {
      if (residentToEdit) {
        // EDIT MODE: Populate fields
        setFormData({
          ...INITIAL_STATE, // Fallback defaults
          ...residentToEdit, // Overwrite with DB data
          
          // Specific mappings if DB field names differ slightly
          firstName: residentToEdit.firstName || residentToEdit.name?.split(' ')[0] || '',
          lastName: residentToEdit.lastName || residentToEdit.name?.split(' ').slice(1).join(' ') || '',
          
          // Handle Dates (Extract YYYY-MM-DD)
          dob: residentToEdit.dob ? new Date(residentToEdit.dob).toISOString().split('T')[0] : '',
          
          // Handle Nested Emergency Contact Object from DB
          emergencyName: residentToEdit.emergencyContact?.name || '',
          emergencyContact: residentToEdit.emergencyContact?.contact || '',
          emergencyRelation: residentToEdit.emergencyContact?.relation || '',
        });
      } else {
        // ADD MODE: Reset to empty
        setFormData(INITIAL_STATE);
      }
    }
  }, [isOpen, residentToEdit]);


  // --- 2. HANDLE INPUT CHANGES ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };


  // Helper to calculate age from DOB
  const calculateAge = (dobString: string) => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
  };

  // --- 3. SUBMIT HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Clone state to prepare payload
      const payload: any = { ...formData };

      // Auto-Calculate Age
      payload.age = calculateAge(payload.dob);

      // Convert Numbers
      payload.householdCount = Number(payload.householdCount) || 1;
      payload.height = Number(payload.height) || 0;
      payload.weight = Number(payload.weight) || 0;

      // Structure Emergency Contact
      payload.emergencyContact = {
        name: payload.emergencyName,
        contact: payload.emergencyContact,
        relation: payload.emergencyRelation,
      };
      // Remove flat emergency fields
      delete payload.emergencyName;
      delete payload.emergencyContact;
      delete payload.emergencyRelation;

      // Determine URL & Method
      const token = localStorage.getItem('token'); 
      const headers = { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      let response;
      
      if (residentToEdit) {
        // --- UPDATE (PUT) ---
        const id = residentToEdit._id || residentToEdit.id;
        // UPDATED URL
        response = await fetch(`${BASE_URL}/api/residents/${id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        // --- CREATE (POST) ---
        // UPDATED URL
        response = await fetch(`${BASE_URL}/api/residents`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        alert(residentToEdit ? "Resident updated successfully!" : "Resident added successfully!");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const resData = await response.json();
        alert("Failed: " + (resData.message || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Error:", error);
      alert("Server error: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        
        <div className="modal-header">
          <h2>{residentToEdit ? 'Edit Resident' : 'Add New Resident'}</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            
            {/* 1. PERSONAL INFORMATION */}
            <h3 className="section-title" style={{marginTop: 0}}>Personal Information</h3>
            
            <div className="row-3">
               <div className="form-group">
                 <label>First Name *</label>
                 <input name="firstName" value={formData.firstName} onChange={handleChange} type="text" className="form-input" required />
               </div>
               <div className="form-group">
                 <label>Middle Name</label>
                 <input name="middleName" value={formData.middleName} onChange={handleChange} type="text" className="form-input" />
               </div>
               <div className="form-group">
                 <label>Last Name *</label>
                 <input name="lastName" value={formData.lastName} onChange={handleChange} type="text" className="form-input" required />
               </div>
            </div>
            
            <div className="row-2">
              <div className="form-group">
                <label>Date of Birth *</label>
                <input 
                  name="dob" 
                  value={formData.dob}
                  onChange={handleChange}
                  type="date" 
                  className="form-input date-picker"
                  required 
                  onClick={(e) => e.currentTarget.showPicker()} 
                />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="form-input">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="row-2">
              <div className="form-group">
                <label>Birth Place</label>
                <input name="birthPlace" value={formData.birthPlace} onChange={handleChange} type="text" className="form-input" />
              </div>
              <div className="form-group">
                <label>Nationality</label>
                <input name="nationality" value={formData.nationality} onChange={handleChange} type="text" className="form-input" />
              </div>
            </div>

            {/* 2. CONTACT INFO */}
            <h3 className="section-title">Contact Information</h3>
            <div className="row-2">
              <div className="form-group">
                <label>Contact Number</label>
                <input name="contact" value={formData.contact} onChange={handleChange} type="text" className="form-input" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" value={formData.email} onChange={handleChange} type="email" className="form-input" />
              </div>
            </div>
            <div className="form-group full-width">
              <label>Current Address *</label>
              <input name="address" value={formData.address} onChange={handleChange} type="text" className="form-input" required />
            </div>

            {/* 3. LOCATION - UPDATED: Zone Dropdown & Household Min Value */}
            <div className="row-2">
              <div className="form-group">
                <label>Zone / Purok *</label>
                <select 
                  name="zone" 
                  value={formData.zone} 
                  onChange={handleChange} 
                  className="form-input" 
                  required
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
              <div className="form-group">
                <label>Number of Households</label>
                <input 
                  name="householdCount" 
                  value={formData.householdCount} 
                  onChange={handleChange} 
                  type="number" 
                  min="1" 
                  className="form-input" 
                />
              </div>
            </div>

            {/* 4. BARANGAY INFO */}
            <h3 className="section-title">Barangay Information</h3>
            <div className="row-2">
              <div className="form-group">
                <label>Barangay ID Number</label>
                <input name="barangayId" value={formData.barangayId} onChange={handleChange} type="text" className="form-input" />
              </div>
              <div className="form-group">
                <label>Household Number</label>
                <input name="householdNumber" value={formData.householdNumber} onChange={handleChange} type="text" className="form-input" />
              </div>
            </div>
            <div className="row-2">
              <div className="form-group">
                <label>Civil Status</label>
                <select name="civilStatus" value={formData.civilStatus} onChange={handleChange} className="form-input">
                  <option>Single</option>
                  <option>Married</option>
                  <option>Widowed</option>
                  <option>Separated</option>
                </select>
              </div>
              <div className="form-group">
                <label>Religion</label>
                <input name="religion" value={formData.religion} onChange={handleChange} type="text" className="form-input" />
              </div>
            </div>

            {/* 5. SOCIO-ECONOMIC */}
            <h3 className="section-title">Socio-Economic Information</h3>
            <div className="row-2">
              <div className="form-group">
                <label>Education Level</label>
                <select name="education" value={formData.education} onChange={handleChange} className="form-input">
                  <option>Elementary</option>
                  <option>High School</option>
                  <option>College</option>
                  <option>Vocational</option>
                  <option>None</option>
                </select>
              </div>
              <div className="form-group">
                <label>Employment Status</label>
                <select name="employment" value={formData.employment} onChange={handleChange} className="form-input">
                  <option>Unemployed</option>
                  <option>Employed</option>
                  <option>Self-Employed</option>
                  <option>Student</option>
                </select>
              </div>
            </div>
            <div className="row-2">
              <div className="form-group">
                <label>Occupation</label>
                <input name="occupation" value={formData.occupation} onChange={handleChange} type="text" className="form-input" />
              </div>
              <div className="form-group">
                <label>Monthly Income</label>
                <select name="income" value={formData.income} onChange={handleChange} className="form-input">
                  <option>Below ₱5,000</option>
                  <option>₱5,000 - ₱10,000</option>
                  <option>Above ₱10,000</option>
                </select>
              </div>
            </div>

            {/* 6. SPECIAL CATEGORIES */}
            <h3 className="section-title">Special Categories</h3>
            <div className="checkbox-grid">
              <label className="checkbox-item"><input name="isVoter" checked={formData.isVoter} onChange={handleChange} type="checkbox" /> Registered Voter</label>
              <label className="checkbox-item"><input name="isPwd" checked={formData.isPwd} onChange={handleChange} type="checkbox" /> PWD</label>
              <label className="checkbox-item"><input name="is4ps" checked={formData.is4ps} onChange={handleChange} type="checkbox" /> 4Ps Beneficiary</label>
              <label className="checkbox-item"><input name="isSoloParent" checked={formData.isSoloParent} onChange={handleChange} type="checkbox" /> Solo Parent</label>
              <label className="checkbox-item"><input name="isOsy" checked={formData.isOsy} onChange={handleChange} type="checkbox" /> Out-of-School Youth</label>
              <label className="checkbox-item"><input name="isIndigenous" checked={formData.isIndigenous} onChange={handleChange} type="checkbox" /> Indigenous Person</label>
            </div>

            {/* 7. FARMING */}
            <h3 className="section-title">Farming & Livelihood</h3>
            <div className="checkbox-grid">
              <label className="checkbox-item"><input name="isFarmer" checked={formData.isFarmer} onChange={handleChange} type="checkbox" /> Farmer / Agricultural Worker</label>
            </div>

            {/* 8. HEALTH - UPDATED: Min Values */}
            <h3 className="section-title">Health Information</h3>
            <div className="row-3">
              <div className="form-group">
                <label>Blood Type</label>
                <select name="bloodType" value={formData.bloodType} onChange={handleChange} className="form-input"><option>O+</option><option>A+</option><option>B+</option><option>Unknown</option></select>
              </div>
              <div className="form-group">
                <label>Height (cm)</label>
                <input 
                  name="height" 
                  value={formData.height} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  className="form-input" 
                />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input 
                  name="weight" 
                  value={formData.weight} 
                  onChange={handleChange} 
                  type="number" 
                  min="0" 
                  step="0.1"
                  className="form-input" 
                />
              </div>
            </div>
            <div className="checkbox-grid">
              <label className="checkbox-item"><input name="isMalnourished" checked={formData.isMalnourished} onChange={handleChange} type="checkbox" /> Malnourished</label>
              
              <label className="checkbox-item"><input name="hasChronicIllness" checked={formData.hasChronicIllness} onChange={handleChange} type="checkbox" /> Has Chronic Illness</label>
            </div>

            {/* 9. EMERGENCY CONTACT */}
            <h3 className="section-title">Emergency Contact</h3>
            <div className="row-3">
              <div className="form-group">
                <label>Name</label>
                <input name="emergencyName" value={formData.emergencyName} onChange={handleChange} type="text" className="form-input" />
              </div>
              <div className="form-group">
                <label>Contact</label>
                <input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} type="text" className="form-input" />
              </div>
              <div className="form-group">
                <label>Relation</label>
                <input name="emergencyRelation" value={formData.emergencyRelation} onChange={handleChange} type="text" className="form-input" />
              </div>
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" className="btn-white" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-black" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (residentToEdit ? 'Update Resident' : 'Create Resident')}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
