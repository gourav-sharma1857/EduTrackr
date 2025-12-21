import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth, storage } from "../firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "../styles/Profile.css";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    display_name: "",
    custom_links: [],
    profile_picture_url: "",
    major: "",
    school_year: "",
    linkedin_url: "",
    github_url: "",
    handshake_url: "",
    portfolio_url: "",
    plans: "",
    degree_credit_requirement: 120,
    current_gpa: 0,
    completed_credit_hours: 0
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        setFormData({
          display_name: data.display_name || user.displayName || "",
          custom_links: data.custom_links || [],
          major: data.major || "",
          school_year: data.school_year || "",
          linkedin_url: data.linkedin_url || "",
          github_url: data.github_url || "",
          handshake_url: data.handshake_url || "",
          portfolio_url: data.portfolio_url || "",
          plans: data.plans || "",
          degree_credit_requirement: data.degree_credit_requirement || 120,
          current_gpa: data.current_gpa ?? null,
          completed_credit_hours: data.completed_credit_hours || 0
        });
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), formData, { merge: true });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
    setIsSaving(false);
  };

  const handleAddCustomLink = () => {
  setFormData({
    ...formData,
    custom_links: [...formData.custom_links, { label: "", url: "" }]
  });
};

const handleCustomLinkChange = (index, field, value) => {
  const updatedLinks = [...formData.custom_links];
  updatedLinks[index][field] = value;
  setFormData({ ...formData, custom_links: updatedLinks });
};

const handleRemoveCustomLink = (index) => {
  const updatedLinks = formData.custom_links.filter((_, i) => i !== index);
  setFormData({ ...formData, custom_links: updatedLinks });
};

  if (!user) {
    return <div className="empty-state">Please sign in to view profile</div>;
  }

 return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <h1>My Profile</h1>
          <p>Manage your personal information</p>
        </div>
        <button 
          className={isEditing ? "btn-primary" : "btn-secondary"} 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : isEditing ? "💾 Save Changes" : "✏️ Edit Profile"}
        </button>
      </div>

      <div className="profile-cards">
        {/* Personal Information */}
        <div className="profile-card">
          <div className="card-header">
            <h2>👤 Personal Information</h2>
          </div>
          <div className="card-content">

            <div className="form-grid">
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Your display name"
                  disabled={!isEditing}
                />
                <span className="input-hint">This name will be shown on Dashboard & Sidebar</span>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="email" value={user?.email || ""} disabled />
              </div>

              <div className="form-group">
                <label>Major</label>
                <input
                  type="text"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                  placeholder="e.g., Computer Science"
                  disabled={!isEditing}
                />
              </div>

              <div className="form-group">
                <label>School Year</label>
                <select
                  value={formData.school_year}
                  onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                  disabled={!isEditing}
                >
                  <option value="">Select year</option>
                  <option value="Freshman">Freshman</option>
                  <option value="Sophomore">Sophomore</option>
                  <option value="Junior">Junior</option>
                  <option value="Senior">Senior</option>
                  <option value="Graduate">Graduate</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Future Plans & Goals</label>
                <textarea
                  value={formData.plans}
                  onChange={(e) => setFormData({ ...formData, plans: e.target.value })}
                  placeholder="What are your career goals and aspirations?"
                  rows={3}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Academic Settings */}
        <div className="profile-card">
          <div className="card-header">
            <h2>🎓 Academic Settings</h2>
          </div>
          <div className="card-content">
            <p className="card-description">These values affect your Dashboard and Degree Planner calculations</p>
            <div className="form-grid three-cols">
              <div className="form-group">
                <label>Degree Credit Requirement</label>
                <input
                  type="number"
                  value={formData.degree_credit_requirement}
                  onChange={(e) => setFormData({ ...formData, degree_credit_requirement: Number(e.target.value) })}
                  disabled={!isEditing}
                />
                <span className="input-hint">Total credits needed to graduate</span>
              </div>

              <div className="form-group">
                <label>Current Cumulative GPA</label>
                <input
                  type="number"
                  step="0.01"
                  max="4.0"
                  value={formData.current_gpa || ""} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ 
                      ...formData, 
                      current_gpa: val === "" ? null : Number(val) 
                    });
                  }}
                  disabled={!isEditing}
                />
              </div>

              <div className="form-group">
                <label>Completed Credit Hours</label>
                <input
                  type="number"
                  value={formData.completed_credit_hours}
                  onChange={(e) => setFormData({ ...formData, completed_credit_hours: Number(e.target.value) })}
                  disabled={!isEditing}
                />
                <span className="input-hint">Credits completed before this semester</span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Links */}
        <div className="profile-card">
          <div className="card-header">
            <h2>🔗 Professional Links</h2>
          </div>
          <div className="card-content">
            <div className="form-grid">
              <div className="form-group">
                <label>LinkedIn</label>
                <input
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/yourprofile"
                  disabled={!isEditing}
                />
              </div>

              <div className="form-group">
                <label>GitHub</label>
                <input
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                  placeholder="https://github.com/yourusername"
                  disabled={!isEditing}
                />
              </div>
              

              <div className="form-group">
                <label>Handshake</label>
                <input
                  type="url"
                  value={formData.handshake_url}
                  onChange={(e) => setFormData({ ...formData, handshake_url: e.target.value })}
                  placeholder="https://handshake.com/yourprofile"
                  disabled={!isEditing}
                />
              </div>

              <div className="form-group">
                <label>Portfolio</label>
                <input
                  type="url"
                  value={formData.portfolio_url}
                  onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                  placeholder="https://yourportfolio.com"
                  disabled={!isEditing}
                />
              </div>
              <div className="custom-links-section form-group">
                <h3>Custom Links</h3>
                {formData.custom_links.map((link, index) => (
                  <div key={index} className="form-row custom-link-row">
                    <input
                      type="text"
                      placeholder="Label (e.g. Twitter)"
                      value={link.label}
                      onChange={(e) => handleCustomLinkChange(index, "label", e.target.value)}
                      disabled={!isEditing}
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={link.url}
                      onChange={(e) => handleCustomLinkChange(index, "url", e.target.value)}
                      disabled={!isEditing}
                    />
                    {isEditing && (
                      <button className="btn-delete" onClick={() => handleRemoveCustomLink(index)}>
                        🗑️
                      </button>
                    )}
                  </div>
                      ))}
  
                  {isEditing && (
                    <button type="button" className="btn-add-link" onClick={handleAddCustomLink}>
                      + Add Custom Link
                    </button>
                  )}
                </div>
            </div>

            {!isEditing && (formData.linkedin_url || formData.github_url || formData.handshake_url || formData.portfolio_url) && (
              <div className="quick-links">
                {formData.linkedin_url && <a href__={formData.linkedin_url} target="_blank" rel="noopener noreferrer" className="link-btn">🔗 LinkedIn</a>}
                {formData.github_url && <a href__={formData.github_url} target="_blank" rel="noopener noreferrer" className="link-btn">💻 GitHub</a>}
                {formData.handshake_url && <a href__={formData.handshake_url} target="_blank" rel="noopener noreferrer" className="link-btn">🤝 Handshake</a>}
                {formData.portfolio_url && <a href__={formData.portfolio_url} target="_blank" rel="noopener noreferrer" className="link-btn">🌐 Portfolio</a>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}