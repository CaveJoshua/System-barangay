import React, { useState, useRef, useEffect } from 'react';
import './addAnnouncementModal.css';

// Expiration options
const EXPIRATION_OPTIONS = [
  { label: '3 Days', days: 3 },
  { label: '7 Days (1 week)', days: 7 },
  { label: '30 Days (1 month)', days: 30 },
  { label: '90 Days (3 months)', days: 90 },
  { label: 'Custom Date', days: -1 },
];

interface AddAnnouncementModalProps {
  isOpen: boolean; // <--- ADDED: Required to fix TS2322 error
  onClose: () => void;
  onSuccess: () => void;
  editData?: any;
}

const API_URL = 'http://localhost:5000/api/announcements';

const AddAnnouncementModal: React.FC<AddAnnouncementModalProps> = ({ isOpen, onClose, onSuccess, editData }) => {
  // If the parent passes isOpen but doesn't unmount the component, we can return null here.
  // If the parent unmounts it conditionally, this line is redundant but harmless.
  if (!isOpen) return null; 

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [organizer, setOrganizer] = useState('');
  
  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [expirationDays, setExpirationDays] = useState(7);
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [status, setStatus] = useState<'Active' | 'Ended'>('Active');
  const [priority, setPriority] = useState('MEDIUM');
  const [type, setType] = useState('Info');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- POPULATE FORM IF EDITING ---
  useEffect(() => {
    if (editData) {
      setTitle(editData.title || '');
      setDescription(editData.description || '');
      setLocation(editData.location || '');
      setEventTime(editData.eventTime || '');
      setOrganizer(editData.organizer || '');
      setPriority(editData.primaryTag || 'MEDIUM');
      setType(editData.secondaryTag || 'Info');
      
      // Map boolean isActive to String status
      setStatus(editData.isActive ? 'Active' : 'Ended');

      // Show existing image as preview
      if (editData.imageUrl) {
        setPreviewUrl(editData.imageUrl);
      }

      // Handle Date: Switch to "Custom Date" mode to show the specific expiration
      setExpirationDays(-1);
      if (editData.expiresAt) {
        // Convert to YYYY-MM-DDTHH:mm format for HTML input
        const dateObj = new Date(editData.expiresAt);
        // Adjust for local timezone offset so input shows correct local time
        const localIso = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setCustomExpiryDate(localIso);
      }
    }
  }, [editData]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Create local preview
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('User not authenticated');

      // Calculate Date
      let expiresAt = '';
      if (expirationDays === -1 && customExpiryDate) {
        expiresAt = new Date(customExpiryDate).toISOString();
      } else {
        const date = new Date();
        date.setDate(date.getDate() + expirationDays);
        expiresAt = date.toISOString();
      }

      const finalStatus = status === 'Ended' ? 'Archived' : 'Active';

      // --- USE FORMDATA FOR FILE UPLOAD ---
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('location', location || "Barangay Hall");
      formData.append('eventTime', eventTime || "See Description");
      formData.append('organizer', organizer || "Barangay Council");
      formData.append('primaryTag', priority);
      formData.append('secondaryTag', type);
      formData.append('expiresAt', expiresAt);
      formData.append('status', finalStatus);

      // Append image ONLY if a new file is selected
      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      // --- SWITCH BETWEEN POST (CREATE) AND PUT (UPDATE) ---
      let url = API_URL;
      let method = 'POST';

      if (editData) {
        url = `${API_URL}/${editData.id}`; // Append ID for update
        method = 'PUT';
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          // Content-Type is auto-set by browser for FormData
        },
        body: formData, 
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `Failed with status ${response.status}`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isCustomDateSelected = expirationDays === -1;

  return (
    <div className="modal-backdrop">
      <div className="add-announcement-modal" style={{maxHeight: '90vh', overflowY: 'auto'}}>
        <div className="modal-header">
          {/* Change Title Dynamically */}
          <h2>{editData ? 'Edit Announcement' : 'Create New Announcement'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="form-group">
            <label>Title <span className="req">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Content <span className="req">*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required />
          </div>

          {/* Event Details */}
          <div className="form-row-2">
             <div className="form-group">
                <label>Location</label>
                <input type="text" placeholder="e.g. Barangay Hall" value={location} onChange={e => setLocation(e.target.value)} />
             </div>
             <div className="form-group">
                <label>Time / Schedule</label>
                <input type="text" placeholder="e.g. 8:00 AM" value={eventTime} onChange={e => setEventTime(e.target.value)} />
             </div>
          </div>

          <div className="form-group">
             <label>Organizer</label>
             <input type="text" placeholder="e.g. Health Committee" value={organizer} onChange={e => setOrganizer(e.target.value)} />
          </div>

          {/* --- IMAGE UPLOAD SECTION --- */}
          <div className="form-group">
            <label>Upload Image {editData && '(Optional - Leave empty to keep current)'}</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    style={{padding: '5px'}}
                />
            </div>
            {previewUrl && (
                <div style={{marginTop: '10px', width: '100px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #ddd'}}>
                    <img src={previewUrl} alt="Preview" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                </div>
            )}
          </div>

          {/* Expiration */}
          <div className="form-group">
            <label>Expiration Time</label>
            <select value={expirationDays} onChange={e => setExpirationDays(parseInt(e.target.value))}>
              {EXPIRATION_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.days}>{opt.label}</option>
              ))}
            </select>
            {isCustomDateSelected && (
              <input type="datetime-local" value={customExpiryDate} onChange={e => setCustomExpiryDate(e.target.value)} required />
            )}
          </div>

          {/* Status, Priority, Type */}
          <div className="form-row-3">
             <div className="form-group">
                <label>Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
             </div>
             <div className="form-group">
                <label>Type</label>
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value="Info">Info</option>
                  <option value="Warning">Warning</option>
                  <option value="Success">Success</option>
                </select>
             </div>
             <div className="form-group">
                <label>Status</label>
                <div className="radio-group">
                  <label><input type="radio" checked={status === 'Active'} onChange={() => setStatus('Active')} /> Active</label>
                  <label><input type="radio" checked={status === 'Ended'} onChange={() => setStatus('Ended')} /> Ended</label>
                </div>
             </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-cancel">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (editData ? 'Updating...' : 'Uploading...') : (editData ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAnnouncementModal;
