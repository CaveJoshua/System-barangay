import { useState, useEffect } from 'react';
import './addAnnouncementModal.css'; // Ensure this CSS file exists
import { AnnouncementData } from '../Announcement';

// FIX: Added 'isOpen' to the interface
interface AddAnnouncementModalProps {
  isOpen: boolean;
  editData: AnnouncementData | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AddAnnouncementModal: React.FC<AddAnnouncementModalProps> = ({ isOpen, editData, onClose, onSuccess }) => {
  // If not open, do not render
  if (!isOpen) return null;

  // -- Your existing form logic (State) --
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    primaryTag: 'LOW',
    secondaryTag: 'Info',
    expiresAt: '',
    imageUrl: ''
  });

  const [loading, setLoading] = useState(false);

  // -- Populate form on Edit --
  useEffect(() => {
    if (editData) {
      setFormData({
        title: editData.title || '',
        description: editData.description || '',
        primaryTag: editData.primaryTag || 'LOW',
        secondaryTag: editData.secondaryTag || 'Info',
        expiresAt: editData.expiresAt ? new Date(editData.expiresAt).toISOString().split('T')[0] : '',
        imageUrl: editData.imageUrl || ''
      });
    }
  }, [editData]);

  // -- Submit Handler --
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = editData 
        ? `http://localhost:5000/api/announcements/${editData.id}`
        : 'http://localhost:5000/api/announcements';
      
      const method = editData ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to save announcement');
      }
    } catch (error) {
      console.error(error);
      alert('Error saving announcement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{editData ? 'Edit Announcement' : 'New Announcement'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input 
              type="text" 
              required 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea 
              required 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select 
                value={formData.primaryTag}
                onChange={(e) => setFormData({...formData, primaryTag: e.target.value})}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="form-group">
              <label>Type</label>
              <select 
                value={formData.secondaryTag}
                onChange={(e) => setFormData({...formData, secondaryTag: e.target.value})}
              >
                <option value="Info">Info</option>
                <option value="Warning">Warning</option>
                <option value="Success">Success</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Expiration Date</label>
            <input 
              type="date" 
              required 
              value={formData.expiresAt} 
              onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
            />
          </div>

           <div className="form-group">
            <label>Image URL</label>
            <input 
              type="text" 
              value={formData.imageUrl} 
              placeholder="http://..."
              onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Saving...' : (editData ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAnnouncementModal;
