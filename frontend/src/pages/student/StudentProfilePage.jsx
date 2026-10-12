import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { updateProfile } from '../../api/users';
import { uploadUserMedia } from '../../api/media';
import { useNotification } from '../../context/NotificationContext';

export default function StudentProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useNotification();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('profile'); // profile | security
  const [name, setName] = useState(user?.name || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.profileImage !== undefined) {
        setProfileImage(user.profileImage || '');
        setProfileImgError(false);
      }
    }
  }, [user]);

  async function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so selecting the same file again triggers change
    e.target.value = '';

    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      toast.error('Please select an image file (PNG, JPG, or WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size exceeds 10MB limit.');
      return;
    }

    // Instant local preview
    const previewUrl = URL.createObjectURL(file);
    setProfileImage(previewUrl);

    setUploadingImage(true);
    setError(null);
    try {
      const asset = await uploadUserMedia(file);
      const uploadedUrl = asset.url || asset.storagePath;
      setProfileImage(uploadedUrl);

      // Auto-save the new avatar to user profile
      await updateProfile({
        name,
        profileImage: uploadedUrl,
      });
      await refreshUser();
      toast.success('Profile photo uploaded and saved successfully!');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to upload photo. Please try again.';
      toast.error(errMsg);
      // Revert preview on failure
      setProfileImage(user?.profileImage || '');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveAvatar() {
    setProfileImage('');
    setSaving(true);
    try {
      await updateProfile({
        name,
        profileImage: null,
      });
      await refreshUser();
      toast.success('Profile photo removed.');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to remove photo';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  }


  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (activeTab === 'security') {
      if (!currentPassword) {
        const err = 'Please enter your current password';
        setError(err);
        toast.error(err);
        return;
      }
      if (!newPassword) {
        const err = 'Please enter a new password';
        setError(err);
        toast.error(err);
        return;
      }
      if (newPassword.length < 8) {
        const err = 'New password must be at least 8 characters';
        setError(err);
        toast.error(err);
        return;
      }
      if (newPassword !== confirmPassword) {
        const err = 'New passwords do not match';
        setError(err);
        toast.error(err);
        return;
      }
    } else {
      if (newPassword && newPassword !== confirmPassword) {
        const err = 'New passwords do not match';
        setError(err);
        toast.error(err);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name,
        profileImage: profileImage || null,
      };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      await updateProfile(payload);
      await refreshUser();
      const successMsg = activeTab === 'security' ? 'Password changed successfully!' : 'Profile updated successfully!';
      setMessage(successMsg);
      toast.success(successMsg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      const errMsg = err.response?.data?.message || (activeTab === 'security' ? 'Failed to change password' : 'Failed to update profile');
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'ST';

  return (
    <div className="ud-main-container" style={{ maxWidth: '840px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="ud-section-title" style={{ fontSize: '2.2rem' }}>
          Profile & Settings
        </h1>
        <p className="ud-section-subtitle">
          Manage your personal account details, avatar image, and security password.
        </p>
      </div>

      {/* Tabs */}
      <div className="ud-tabs-strip" style={{ marginBottom: '32px' }}>
        <button
          className={`ud-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          OneTutor Profile
        </button>
        <button
          className={`ud-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Account Security
        </button>
      </div>

      {/* Profile Card */}
      <div
        style={{
          background: 'var(--ud-white)',
          border: '1px solid var(--ud-border)',
          borderRadius: '8px',
          boxShadow: 'var(--ud-shadow-sm)',
          padding: '32px'
        }}
      >
        {/* Hidden native file picker for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          style={{ display: 'none' }}
          onChange={handleAvatarFileChange}
        />

        {/* User Hero Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '24px', borderBottom: '1px solid var(--ud-border)', marginBottom: '28px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'relative',
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Click to choose a new profile photo"
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)',
                color: '#ffffff',
                fontSize: '1.8rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '2px solid var(--ud-border)',
                boxShadow: 'var(--ud-shadow-sm)'
              }}
            >
              {profileImage && !profileImgError ? (
                <img
                  src={profileImage}
                  alt={user?.name || name}
                  referrerPolicy="no-referrer"
                  onError={() => setProfileImgError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>

            {uploadingImage ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <i className="fa-solid fa-spinner fa-spin"></i>
              </div>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary, #6366f1)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
                }}
              >
                <i className="fa-solid fa-camera"></i>
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '2px' }}>
              {user?.name}
            </h2>
            <p style={{ color: 'var(--ud-gray)', fontSize: '0.88rem', margin: '0 0 8px 0' }}>
              {user?.email}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="ud-badge-bestseller" style={{ textTransform: 'uppercase' }}>
                {user?.role || 'STUDENT'}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-circle-check"></i>
                <span>VERIFIED</span>
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {message && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-check"></i>
              <span>{message}</span>
            </div>
          )}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ud-black)', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--ud-border)',
                    borderRadius: '4px',
                    fontSize: '0.92rem',
                    background: 'var(--ud-white)',
                    color: 'var(--ud-dark-gray)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ud-black)', marginBottom: '6px' }}>
                  Email Address (Read-only)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--ud-border)',
                    borderRadius: '4px',
                    fontSize: '0.92rem',
                    background: 'var(--ud-light-gray)',
                    color: 'var(--ud-gray)',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              {/* Professional Profile Photo Uploader */}
              <div
                style={{
                  marginBottom: '28px',
                  padding: '24px 20px',
                  background: 'var(--ud-light-gray, #f7f9fa)',
                  borderRadius: '8px',
                  border: '1px solid var(--ud-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.92rem', color: 'var(--ud-black)', marginBottom: '14px', width: '100%', textAlign: 'center' }}>
                  Profile Photo
                </label>

                {/* Centered Avatar */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '2px solid var(--ud-border)',
                    background: 'var(--ud-black)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    marginBottom: '16px'
                  }}
                  title="Click to choose a new photo"
                >
                  {profileImage && !profileImgError ? (
                    <img
                      src={profileImage}
                      alt="Avatar preview"
                      referrerPolicy="no-referrer"
                      onError={() => setProfileImgError(true)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ color: '#ffffff', fontSize: '1.7rem', fontWeight: 800 }}>{userInitials}</span>
                  )}

                  {uploadingImage && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.3rem' }}></i>
                    </div>
                  )}
                </div>

                {/* Choose Photo + Dustbin Icon side by side on same line */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px', width: '100%', maxWidth: '320px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || saving}
                    style={{
                      flex: 1,
                      fontSize: '0.86rem',
                      padding: '9px 18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <span>{uploadingImage ? 'Uploading…' : 'Choose New Photo'}</span>
                  </button>

                  {profileImage && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingImage || saving}
                      aria-label="Remove photo"
                      title="Remove photo"
                      style={{
                        width: '40px',
                        height: '40px',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc2626',
                        borderColor: 'rgba(220, 38, 38, 0.3)',
                        flexShrink: 0
                      }}
                    >
                      <i className="fa-solid fa-trash-can" style={{ fontSize: '0.95rem' }}></i>
                    </button>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ud-gray)', lineHeight: 1.4, textAlign: 'center', maxWidth: '360px' }}>
                  Choose a file from your computer (PNG, JPG, or WEBP, max 10MB). A square photo works best.
                </p>
              </div>
            </div>
          )}

            {activeTab === 'security' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ud-black)', margin: 0 }}>
                      Current Password
                    </label>
                    <Link
                      to="/forgot-password"
                      state={{ email: user?.email }}
                      style={{
                        color: 'var(--accent-primary, #5A70D3)',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      <i className="fa-solid fa-key" style={{ fontSize: '0.74rem' }}></i>
                      <span>Forgot password?</span>
                    </Link>
                  </div>
                  <div className="password-input-wrap">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 14px',
                        border: '1px solid var(--ud-border)',
                        borderRadius: '4px',
                        fontSize: '0.92rem',
                        background: 'var(--ud-white)',
                        color: 'var(--ud-dark-gray)'
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    >
                      <i className={`fa-solid ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ud-black)', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div className="password-input-wrap">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      minLength={8}
                      placeholder="Min 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 14px',
                        border: '1px solid var(--ud-border)',
                        borderRadius: '4px',
                        fontSize: '0.92rem',
                        background: 'var(--ud-white)',
                        color: 'var(--ud-dark-gray)'
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      <i className={`fa-solid ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ud-black)', marginBottom: '6px' }}>
                    Confirm Password
                  </label>
                  <div className="password-input-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      minLength={8}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 14px',
                        border: '1px solid var(--ud-border)',
                        borderRadius: '4px',
                        fontSize: '0.92rem',
                        background: 'var(--ud-white)',
                        color: 'var(--ud-dark-gray)'
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid var(--ud-border)' }}>
              <button
                type="submit"
                className="ud-btn-primary"
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {activeTab === 'security' ? (
                  <>
                    <i className="fa-solid fa-key" style={{ fontSize: '0.85rem' }}></i>
                    <span>{saving ? 'Changing password...' : 'Change Password'}</span>
                  </>
                ) : (
                  <span>{saving ? 'Saving changes...' : 'Save Profile Changes'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
