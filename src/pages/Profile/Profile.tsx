import React, { useState, useEffect, useRef } from "react";
import "./Profile.css"; 

// --- FIXED: Use Live Backend URL ---
const BASE_URL = "https://capstone1-project.onrender.com";

export default function Profile() {
  // --- STATE & API LOGIC ---
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [uploading, setUploading] = useState(false); 

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    contactNumber: "",
    photo: "", 
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Reference for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const token = localStorage.getItem("token");

  // --- API CALLS ---

  const fetchProfile = async () => {
    try {
      // UPDATED URL
      const res = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setUser(data);
      setForm({
        fullName: data.fullName || "",
        username: data.username || "",
        email: data.email || "",
        contactNumber: data.contactNumber || "",
        photo: data.photo || "",
      });
    } catch (err) {
      console.error(err);
      // Fallback for demo/error purposes
      setUser({ role: "Administrator" });
      setForm({
        fullName: "Admin User",
        username: "admin_01",
        email: "admin@system.ph",
        contactNumber: "09123456789",
        photo: "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      // UPDATED URL
      const res = await fetch(`${BASE_URL}/api/users/update-info`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form), 
      });
      if (!res.ok) throw new Error("Save failed");
      alert("Profile updated!");
      setUser((prev: any) => ({ ...prev, ...form }));
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      // UPDATED URL
      const res = await fetch(`${BASE_URL}/api/users/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      if (!res.ok) throw new Error("Password update failed");
      alert("Password updated!");
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      alert("Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  // --- FIXED FILE UPLOAD LOGIC ---

  const handleAvatarClick = () => {
    // Trigger the click event on the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    // 1. Create FormData object
    const formData = new FormData();
    formData.append("photo", file); 
    
    try {
      // 2. Upload to the CORRECT endpoint defined in server.ts (UPDATED URL)
      const res = await fetch(`${BASE_URL}/api/users/upload-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Image upload failed");
      }

      const data = await res.json();
      
      // 3. Update BOTH states so the UI refreshes instantly
      setForm((prev) => ({ ...prev, photo: data.photoUrl }));
      setUser((prev: any) => ({ ...prev, photo: data.photoUrl }));

      alert("Photo uploaded successfully!");

    } catch (err) {
      console.error("Upload Error:", err);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
      // Clear the input value to allow re-uploading the same file
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  if (loading) return <div className="loading-screen">Loading...</div>;

  // --- RENDER ---
  return (
    <div className="profile-page-wrapper">
      
      {/* === FIXED TOP SECTION === */}
      <div className="fixed-top-section">
        <div className="profile-banner"></div>
        
        <div className="profile-header-container">
          <div className="profile-header">
            
            {/* Avatar Area */}
            <div className="profile-avatar-wrapper">
              
              {/* HIDDEN FILE INPUT */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                accept="image/*"
              />

              {/* Clickable Avatar */}
              <div 
                className="avatar-circle-new clickable" 
                onClick={handleAvatarClick} 
                title="Click to change profile photo"
              >
                <img 
                  src={form.photo || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"} 
                  alt="Profile" 
                  className="avatar-img"
                />
              </div>
              
              <button 
                className="edit-avatar-btn" 
                onClick={handleAvatarClick}
                disabled={uploading}
              >
                {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-camera"></i>}
              </button>

            </div>

            {/* Identity & Actions */}
            <div className="profile-identity-actions">
              <div className="profile-identity">
                <h1>{form.fullName}</h1>
                <p className="meta-text">{user?.role || "USER"} &bull; {form.username}</p>
              </div>
              <div className="profile-actions">
                <button className="btn-save" onClick={saveProfile} disabled={saving || uploading}>
                    {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* === END FIXED TOP SECTION === */}


      {/* === SCROLLABLE CONTENT SECTION === */}
      <div className="scrollable-content">
        <div className="profile-form-container">
          
          {/* Card 1: Personal Details */}
          <div className="profile-form-card">
            <div className="section-title">
              <h3>Personal Details</h3>
            </div>

            <div className="form-grid">
              <div className="input-group">
                  <label>Full Name</label>
                  <input 
                      type="text" 
                      value={form.fullName} 
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
              </div>
              <div className="input-group">
                  <label>Username</label>
                  <input 
                      type="text" 
                      value={form.username} 
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      disabled 
                  />
              </div>
              <div className="input-group">
                  <label>Email ID</label>
                  <input 
                      type="email" 
                      value={form.email} 
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
              </div>
              <div className="input-group">
                  <label>Contact Number</label>
                  <input 
                      type="text" 
                      value={form.contactNumber} 
                      onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                  />
              </div>
            </div>
          </div>

          {/* Card 2: Security */}
          <div className="profile-form-card">
            <div className="section-title">
              <h3>Security</h3>
            </div>

            <div className="form-grid">
               <div className="input-group full-width">
                 <label>Current Password</label>
                 <input 
                     type="password" 
                     value={passwordForm.oldPassword} 
                     onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                 />
               </div>
               <div className="input-group">
                 <label>New Password</label>
                 <input 
                     type="password" 
                     value={passwordForm.newPassword} 
                     onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                 />
               </div>
               <div className="input-group">
                 <label>Confirm Password</label>
                 <input 
                     type="password" 
                     value={passwordForm.confirmPassword} 
                     onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                 />
               </div>
            </div>

            <div className="btn-row-right">
               <button className="btn-danger-outline" onClick={changePassword} disabled={passwordSaving}>
                  {passwordSaving ? "Updating..." : "Update Password"}
               </button>
            </div>
          </div>

        </div>
      </div>
      {/* === END SCROLLABLE CONTENT === */}

    </div>
  );
}
