import React, { useState, useEffect } from 'react';
import './DocsModal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: any | null; 
}

export default function DocsModal({ isOpen, onClose, onSuccess, editData }: ModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Default empty state
  const initialState = {
    residentName: '',
    age: '',
    certificateType: '',
    dateRequested: new Date().toISOString().split('T')[0],
    referenceNo: '',
    purpose: ''
  };

  const [formData, setFormData] = useState(initialState);

  // ============================================================
  // 1. LOAD DATA
  // ============================================================
  useEffect(() => {
    if (isOpen && editData) {
      setFormData({
        residentName: editData.residentName || '',
        age: editData.age || '', 
        certificateType: editData.certificateType || '',
        dateRequested: editData.dateRequested 
          ? new Date(editData.dateRequested).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0],
        referenceNo: editData.referenceNo || '',
        purpose: editData.purpose || ''
      });
    } else if (isOpen && !editData) {
      setFormData(initialState);
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  // UPDATED HANDLE CHANGE: Prevents negative age
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Check if the field is 'age' and if the value is negative
    if (name === 'age' && Number(value) < 0) {
        return; // Do not update state if value is negative
    }

    setFormData({ ...formData, [name]: value });
  };

  // ============================================================
  // 2. MAIN SUBMIT (Create New or Update Text Details)
  // ============================================================
  const handleSubmit = async () => {
    if (!formData.residentName || !formData.certificateType) {
      alert("Please fill in the required fields");
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    const isEdit = !!editData;
    
    const url = isEdit 
      ? `http://localhost:5000/api/certificates/${editData._id}`
      : 'http://localhost:5000/api/certificates';
    
    const method = isEdit ? 'PUT' : 'POST';

    // RULE 1: Manual Walk-ins start as 'Pending'
    const payload = isEdit 
      ? { ...formData } 
      : { ...formData, source: 'Walk-in', status: 'Pending' };

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      alert(isEdit ? "Details Updated!" : "Request Created (Status: Pending)");
      onSuccess();
      onClose();
      setFormData(initialState);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 3. ACTION: APPROVE (Pending -> Issued)
  // ============================================================
  const handleApprove = async () => {
    if (!window.confirm("Approve this request and mark as Settled/Issued?")) return;
    
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`http://localhost:5000/api/certificates/${editData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Issued' }), // Change status to Issued
      });

      if (!res.ok) throw new Error('Failed to approve');

      alert("Request Approved and Settled!");
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 4. ACTION: ARCHIVE (Issued -> Archive)
  // ============================================================
  const handleArchive = async () => {
    if (!window.confirm("Move this settled document to the Archive?")) return;

    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      // Calls the DELETE endpoint which performs a Soft Delete (Archive)
      const res = await fetch(`http://localhost:5000/api/certificates/${editData._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to archive');

      alert("Document moved to Archive successfully.");
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* HEADER */}
        <div className="modal-header">
          <h2 style={{ fontSize: '20px' }}>
            {editData ? `Manage Request (${editData.status})` : 'New Walk-in Request'}
          </h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        {/* BODY */}
        <div className="modal-body">
          <div className="row-2">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="label-upper">FULL NAME</label>
              <div className="input-icon-wrapper">
                <i className="fas fa-user input-icon"></i>
                <input 
                  type="text" className="form-input with-icon" name="residentName"
                  value={formData.residentName} onChange={handleChange} placeholder="Last Name, First Name"
                />
              </div>
            </div>
            
            {/* UPDATED AGE INPUT */}
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label-upper">AGE</label>
              <input 
                type="number" 
                min="0" // HTML Constraint: Prevents browser arrows from going below 0
                className="form-input" 
                name="age"
                value={formData.age} 
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label-upper">SERVICE TYPE</label>
            <div className="input-icon-wrapper">
                <i className="fas fa-file-alt input-icon"></i>
                <select className="form-input with-icon" name="certificateType" value={formData.certificateType} onChange={handleChange}>
                  <option value="">Select a service...</option>
                  <option value="Certificate of Indigency">Certificate of Indigency</option>
                  <option value="Barangay Clearance">Barangay Clearance</option>
                  <option value="Business Permit">Business Permit</option>
                  <option value="Cedula">Cedula</option>
                </select>
            </div>
          </div>

          <div className="form-group">
             <label className="label-upper">PURPOSE</label>
             <textarea 
               name="purpose" value={formData.purpose} onChange={handleChange}
               placeholder="Reason for request..." className="purpose-textarea"
             />
          </div>

          <div className="form-group">
            <label className="label-upper">PREFERRED DATE</label>
            <div className="input-icon-wrapper">
                <i className="fas fa-calendar-alt input-icon"></i>
                <input 
                  type="date" className="form-input date-picker with-icon" 
                  name="dateRequested" value={formData.dateRequested} onChange={handleChange}
                  onClick={(e) => e.currentTarget.showPicker()}
                />
            </div>
          </div>

          <div className="verification-box">
            <div className="form-group" style={{marginBottom: 0}}>
              <label className="label-upper">ID NUMBER / REF NO.</label>
              <div className="input-icon-wrapper">
                <i className="fas fa-id-card input-icon"></i>
                <input 
                    type="text" className="form-input with-icon" name="referenceNo"
                    value={formData.referenceNo} onChange={handleChange} placeholder="e.g. 123-456-789" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER - DYNAMIC BUTTONS */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          
          <button className="btn-white" onClick={onClose} disabled={loading}>Close</button>

          <div style={{ display: 'flex', gap: '10px' }}>
            
            {/* 1. NEW MODE: Show Save */}
            {!editData && (
               <button className="btn-black" onClick={handleSubmit} disabled={loading}>
                 {loading ? 'Saving...' : 'Submit Request'}
               </button>
            )}

            {/* 2. EDIT MODE - PENDING: Show Approve */}
            {editData && editData.status === 'Pending' && (
               <>
                 <button className="btn-white" onClick={handleSubmit} disabled={loading}>Update Details</button>
                 <button className="btn-black" style={{background: '#10b981', borderColor: '#10b981'}} onClick={handleApprove} disabled={loading}>
                   <i className="fas fa-check"></i> Approve & Settle
                 </button>
               </>
            )}

            {/* 3. EDIT MODE - ISSUED: Show Archive */}
            {editData && editData.status === 'Issued' && (
               <>
                 <button className="btn-white" onClick={handleSubmit} disabled={loading}>Update Details</button>
                 <button className="btn-black" style={{background: '#ef4444', borderColor: '#ef4444'}} onClick={handleArchive} disabled={loading}>
                   <i className="fas fa-archive"></i> Archive
                 </button>
               </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}