import { useState, useEffect, useMemo } from 'react';
import {
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  toggleAdminCouponStatus,
  deleteAdminCoupon
} from '../../api/coupons';
import { listCategories } from '../../api/categories';
import { listAdminCourses } from '../../api/courses';
import { toast, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';
import AlertBanner from '../../components/AlertBanner';

export default function AdminCouponsPage() {
  const { isReadOnly } = usePermission();

  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState('PERCENTAGE');
  const [formValue, setFormValue] = useState('');
  const [formScope, setFormScope] = useState('ALL_COURSES');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formCategoryIds, setFormCategoryIds] = useState([]);
  const [formCourseId, setFormCourseId] = useState('');
  const [formCourseIds, setFormCourseIds] = useState([]);
  const [formMinPurchase, setFormMinPurchase] = useState('0');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formPerUserLimit, setFormPerUserLimit] = useState('1');
  const [formActive, setFormActive] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState('');

  // Fetch categories and courses on mount
  useEffect(() => {
    Promise.allSettled([
      listCategories({ size: 100 }),
      listAdminCourses({ size: 150 })
    ]).then(([catRes, courseRes]) => {
      if (catRes.status === 'fulfilled') {
        const catList = catRes.value?.content || (Array.isArray(catRes.value) ? catRes.value : []);
        setCategories(catList);
      }
      if (courseRes.status === 'fulfilled') {
        const crsList = courseRes.value?.content || (Array.isArray(courseRes.value) ? courseRes.value : []);
        setCourses(crsList);
      }
    });
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [search, statusFilter, page]);

  async function loadCoupons() {
    setLoading(true);
    try {
      let activeParam = 'ALL';
      if (statusFilter === 'ACTIVE') activeParam = 'true';
      if (statusFilter === 'INACTIVE') activeParam = 'false';

      const data = await getAdminCoupons({
        search,
        active: activeParam,
        page,
        size: 15
      });
      setCoupons(data?.content || []);
      setTotalPages(data?.totalPages || 1);
      setTotalElements(data?.totalElements || 0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  }

  // Filter client-side by type, scope, and expired if selected
  const displayedCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (typeFilter !== 'ALL' && c.discountType !== typeFilter) {
        return false;
      }
      if (scopeFilter !== 'ALL') {
        const cScope = c.scope || 'ALL_COURSES';
        if (cScope !== scopeFilter) return false;
      }
      if (statusFilter === 'EXPIRED') {
        return c.expired || (c.expiryDate && new Date(c.expiryDate) < new Date());
      }
      return true;
    });
  }, [coupons, typeFilter, scopeFilter, statusFilter]);

  // Platform KPIs
  const stats = useMemo(() => {
    const total = totalElements || coupons.length;
    const activeCount = coupons.filter(c => c.active && !c.expired).length;
    const expiredCount = coupons.filter(c => c.expired || (c.expiryDate && new Date(c.expiryDate) < new Date())).length;
    const totalUses = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    return { total, activeCount, expiredCount, totalUses };
  }, [coupons, totalElements]);

  function openCreateModal() {
    if (isReadOnly) return;
    setEditingCoupon(null);
    setFormCode('');
    setFormType('PERCENTAGE');
    setFormValue('');
    setFormScope('ALL_COURSES');
    setFormCategoryId('');
    setFormCategoryIds([]);
    setFormCourseId('');
    setFormCourseIds([]);
    setFormMinPurchase('0');
    setFormMaxDiscount('');
    setFormStartDate('');
    setFormExpiryDate('');
    setFormUsageLimit('');
    setFormPerUserLimit('1');
    setFormActive(true);
    setFormDescription('');
    setModalError('');
    setShowModal(true);
  }

  function openEditModal(coupon) {
    if (isReadOnly) return;
    setEditingCoupon(coupon);
    setFormCode(coupon.code || '');
    setFormType(coupon.discountType || 'PERCENTAGE');
    setFormValue(coupon.discountValue != null ? String(coupon.discountValue) : '');
    setFormScope(coupon.scope || 'ALL_COURSES');
    setFormCategoryId(coupon.categoryId ? String(coupon.categoryId) : '');
    setFormCategoryIds(
      coupon.categoryIds && coupon.categoryIds.length > 0
        ? coupon.categoryIds.map(Number)
        : (coupon.categoryId ? [Number(coupon.categoryId)] : [])
    );
    setFormCourseId(coupon.courseId ? String(coupon.courseId) : '');
    setFormCourseIds(
      coupon.courseIds && coupon.courseIds.length > 0
        ? coupon.courseIds.map(Number)
        : (coupon.courseId ? [Number(coupon.courseId)] : [])
    );
    setFormMinPurchase(coupon.minPurchaseAmount != null ? String(coupon.minPurchaseAmount) : '0');
    setFormMaxDiscount(coupon.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : '');
    setFormStartDate(coupon.startDate ? coupon.startDate.substring(0, 16) : '');
    setFormExpiryDate(coupon.expiryDate ? coupon.expiryDate.substring(0, 16) : '');
    setFormUsageLimit(coupon.usageLimit != null ? String(coupon.usageLimit) : '');
    setFormPerUserLimit(coupon.perUserLimit != null ? String(coupon.perUserLimit) : '1');
    setFormActive(Boolean(coupon.active));
    setFormDescription(coupon.description || '');
    setModalError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCoupon(null);
    setModalError('');
  }

  async function handleSaveCoupon(e) {
    e.preventDefault();
    if (isReadOnly) return;
    setModalError('');

    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      setModalError('Coupon code is required.');
      return;
    }

    const valNum = parseFloat(formValue);
    if (isNaN(valNum) || valNum <= 0) {
      setModalError('Discount value must be greater than zero.');
      return;
    }

    if (formType === 'PERCENTAGE' && valNum > 100) {
      setModalError('Percentage discount cannot exceed 100%.');
      return;
    }

    if (formScope === 'CATEGORY') {
      const hasCat = Boolean(formCategoryId) || (formCategoryIds && formCategoryIds.length > 0);
      if (!hasCat) {
        setModalError('Please select at least one applicable course category, or choose "All Categories".');
        return;
      }
    }

    if (formScope === 'COURSE' && !formCourseId && (!formCourseIds || formCourseIds.length === 0)) {
      setModalError('Please select the applicable course.');
      return;
    }

    if (formStartDate && formExpiryDate && new Date(formExpiryDate) <= new Date(formStartDate)) {
      setModalError('Expiration date must be after the start date.');
      return;
    }

    const payload = {
      code: cleanCode,
      discountType: formType,
      discountValue: valNum,
      scope: formScope,
      categoryId: formScope === 'CATEGORY' ? (formCategoryIds.length > 0 ? formCategoryIds[0] : (formCategoryId ? parseInt(formCategoryId, 10) : null)) : null,
      categoryIds: formScope === 'CATEGORY' ? (formCategoryIds.length > 0 ? formCategoryIds : (formCategoryId ? [parseInt(formCategoryId, 10)] : null)) : null,
      courseId: formScope === 'COURSE' ? (formCourseIds.length > 0 ? formCourseIds[0] : (formCourseId ? parseInt(formCourseId, 10) : null)) : null,
      courseIds: formScope === 'COURSE' ? (formCourseIds.length > 0 ? formCourseIds : (formCourseId ? [parseInt(formCourseId, 10)] : null)) : null,
      minPurchaseAmount: formMinPurchase ? parseFloat(formMinPurchase) : 0,
      maxDiscountAmount: formMaxDiscount ? parseFloat(formMaxDiscount) : null,
      startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
      expiryDate: formExpiryDate ? new Date(formExpiryDate).toISOString() : null,
      usageLimit: formUsageLimit ? parseInt(formUsageLimit, 10) : null,
      perUserLimit: formPerUserLimit ? parseInt(formPerUserLimit, 10) : 1,
      active: formActive,
      description: formDescription.trim() || null
    };

    setModalSaving(true);
    try {
      if (editingCoupon) {
        await updateAdminCoupon(editingCoupon.id, payload);
        toast.success(`Coupon "${cleanCode}" updated successfully!`);
      } else {
        await createAdminCoupon(payload);
        toast.success(`Coupon "${cleanCode}" created successfully!`);
      }
      closeModal();
      loadCoupons();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error?.message || 'Failed to save coupon.';
      setModalError(msg);
      toast.error(msg);
    } finally {
      setModalSaving(false);
    }
  }

  async function handleToggleStatus(coupon) {
    if (isReadOnly) return;
    try {
      const updated = await toggleAdminCouponStatus(coupon.id, !coupon.active);
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: updated.active } : c));
      toast.success(`Coupon "${coupon.code}" is now ${updated.active ? 'active' : 'inactive'}.`);
    } catch (err) {
      toast.error('Failed to change coupon status.');
    }
  }

  async function handleDeleteCoupon(coupon) {
    if (isReadOnly) return;
    const confirmed = await confirmDialog({
      title: `Delete Coupon "${coupon.code}"?`,
      description: `This action will permanently delete this coupon. If students have existing un-redeemed codes, they will no longer apply.`,
      confirmText: 'Delete Permanently',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteAdminCoupon(coupon.id);
      toast.success(`Coupon "${coupon.code}" deleted successfully.`);
      loadCoupons();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete coupon.';
      toast.error(msg);
    }
  }

  function copyToClipboard(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.info(`Copied "${code}" to clipboard!`);
      setTimeout(() => setCopiedCode(''), 2000);
    });
  }

  return (
    <div className="admin-page-container coupon-page" style={{ padding: '24px 32px' }}>
      <style>{`
        .coupon-main-grid {
          width: 100%;
        }
        @media (max-width: 600px) {
          .admin-page-container.coupon-page {
            padding: 16px !important;
          }
        }
        .scope-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Coupons &amp; Discount Management
            </h1>
            <span className="badge" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontWeight: '700', padding: '4px 10px', borderRadius: '12px' }}>
              Super Admin
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Create and manage sitewide, category-specific, or single-course discount incentives.
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontSize: '0.95rem',
              fontWeight: '600',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)'
            }}
          >
            <i className="fa-solid fa-plus"></i> Create New Coupon
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Coupons
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-ticket"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)' }}>
            {stats.total}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Now
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: '#22c55e' }}>
            {stats.activeCount}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Expired / Inactive
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-clock"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)' }}>
            {stats.expiredCount}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Redemptions
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)' }}>
            {stats.totalUses}
          </div>
        </div>
      </div>

      {/* Main Section: Coupon List */}
      <div className="coupon-main-grid">
        {/* Left Column: Table & Filters */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
              <input
                type="text"
                placeholder="Search code or description…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
                <option value="EXPIRED">Expired Only</option>
              </select>

              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              >
                <option value="ALL">All Scopes</option>
                <option value="ALL_COURSES">🌐 Sitewide (All Courses)</option>
                <option value="ALL_CATEGORIES">🗂️ All Categories</option>
                <option value="CATEGORY">🏷️ Category Specific</option>
                <option value="COURSE">🎓 Course Specific</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              >
                <option value="ALL">All Types</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }}></i>
              <div>Loading coupon directory…</div>
            </div>
          ) : displayedCoupons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px', color: 'var(--text-muted)' }}>🎟️</div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>No coupons found</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {search ? 'Try adjusting your search criteria.' : 'Create your first promotional discount code to get started.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Coupon Code</th>
                    <th style={{ padding: '12px 14px' }}>Scope &amp; Target</th>
                    <th style={{ padding: '12px 14px' }}>Discount</th>
                    <th style={{ padding: '12px 14px' }}>Min Order &amp; Cap</th>
                    <th style={{ padding: '12px 14px' }}>Redemptions</th>
                    <th style={{ padding: '12px 14px' }}>Validity</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCoupons.map((c) => {
                    const isExpired = c.expired || (c.expiryDate && new Date(c.expiryDate) < new Date());
                    const scope = c.scope || 'ALL_COURSES';

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                        {/* Code */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                letterSpacing: '0.5px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: '#6366f1',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px dashed rgba(99, 102, 241, 0.4)'
                              }}
                            >
                              {c.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(c.code)}
                              title="Copy Code"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: copiedCode === c.code ? '#22c55e' : 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '0.85rem'
                              }}
                            >
                              <i className={`fa-solid ${copiedCode === c.code ? 'fa-check' : 'fa-copy'}`}></i>
                            </button>
                          </div>
                          {c.description && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.description}
                            </div>
                          )}
                        </td>

                        {/* Scope & Target */}
                        <td style={{ padding: '14px' }}>
                          {scope === 'ALL_CATEGORIES' ? (
                            <div>
                              <span className="scope-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                <i className="fa-solid fa-folder-tree"></i> All Categories
                              </span>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                All catalog categories
                              </div>
                            </div>
                          ) : scope === 'CATEGORY' ? (
                            <div>
                              <span className="scope-badge" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7' }}>
                                <i className="fa-solid fa-tags"></i> Category
                              </span>
                              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.categoryNames?.join(', ') || c.categoryName}>
                                {c.categoryNames && c.categoryNames.length > 1
                                  ? `${c.categoryNames.length} Categories (${c.categoryNames.join(', ')})`
                                  : (c.categoryName || 'Designated Category')}
                              </div>
                            </div>
                          ) : scope === 'COURSE' ? (
                            <div>
                              <span className="scope-badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#9333ea' }}>
                                <i className="fa-solid fa-book-open"></i> Course
                              </span>
                              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.courseName}>
                                {c.courseName || 'Designated Course'}
                              </div>
                            </div>
                          ) : (
                            <span className="scope-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-primary)' }}>
                              <i className="fa-solid fa-globe"></i> All Courses
                            </span>
                          )}
                        </td>

                        {/* Discount */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                            {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {c.discountType === 'PERCENTAGE' ? 'Percentage-based' : 'Flat deduction'}
                          </div>
                        </td>

                        {/* Min Order & Cap */}
                        <td style={{ padding: '14px', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Min: </span>
                            <strong>{c.minPurchaseAmount > 0 ? `₹${c.minPurchaseAmount}` : 'None'}</strong>
                          </div>
                          {c.discountType === 'PERCENTAGE' && c.maxDiscountAmount && (
                            <div style={{ marginTop: '2px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Cap: </span>
                              <strong style={{ color: '#f59e0b' }}>₹{c.maxDiscountAmount}</strong>
                            </div>
                          )}
                        </td>

                        {/* Redemptions */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {c.usedCount} {c.usageLimit ? `/ ${c.usageLimit}` : 'used'}
                          </div>
                          {c.usageLimit && (
                            <div style={{ width: '80px', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100))}%`,
                                  height: '100%',
                                  background: c.usedCount >= c.usageLimit ? '#ef4444' : 'var(--accent-primary)'
                                }}
                              />
                            </div>
                          )}
                        </td>

                        {/* Validity */}
                        <td style={{ padding: '14px', fontSize: '0.82rem' }}>
                          {c.expiryDate ? (
                            <div>
                              <div style={{ color: isExpired ? '#ef4444' : 'var(--text-primary)' }}>
                                Exp: {new Date(c.expiryDate).toLocaleDateString()}
                              </div>
                              {isExpired && (
                                <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.75rem' }}>
                                  Expired
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Lifetime</span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              background: !c.active
                                ? 'rgba(100, 116, 139, 0.12)'
                                : isExpired
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(34, 197, 94, 0.12)',
                              color: !c.active
                                ? '#64748b'
                                : isExpired
                                ? '#ef4444'
                                : '#22c55e'
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: !c.active ? '#64748b' : isExpired ? '#ef4444' : '#22c55e'
                              }}
                            />
                            {!c.active ? 'Disabled' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {!isReadOnly && (
                              <>
                                <button
                                  onClick={() => handleToggleStatus(c)}
                                  title={c.active ? 'Deactivate Coupon' : 'Activate Coupon'}
                                  style={{
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-primary)',
                                    color: c.active ? '#ef4444' : '#22c55e',
                                    borderRadius: '6px',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <i className={`fa-solid ${c.active ? 'fa-ban' : 'fa-check'}`}></i>
                                </button>
                                <button
                                  onClick={() => openEditModal(c)}
                                  title="Edit Coupon"
                                  style={{
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '6px',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button
                                  onClick={() => handleDeleteCoupon(c)}
                                  title="Delete Coupon"
                                  style={{
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-primary)',
                                    color: '#ef4444',
                                    borderRadius: '6px',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>


      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {editingCoupon ? 'Edit Coupon' : 'Create Promotional Coupon'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {editingCoupon ? `Updating configuration for ${editingCoupon.code}` : 'Define promo rules, category/course scope, and deductions'}
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCoupon} style={{ padding: '24px' }}>
              <AlertBanner type="error" message={modalError} onClose={() => setModalError('')} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Code */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. REACT50, AI300, FESTIVE2026"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontWeight: '700',
                      letterSpacing: '0.5px'
                    }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Auto-uppercased. Letters, digits, underscores, and hyphens only.
                  </small>
                </div>

                {/* Scope Selection: All Courses, All Categories, Category, or Single Course */}
                <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Coupon Applicability / Scope *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    {/* Option 1: All Courses */}
                    <button
                      type="button"
                      onClick={() => setFormScope('ALL_COURSES')}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: formScope === 'ALL_COURSES' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        background: formScope === 'ALL_COURSES' ? 'var(--accent-subtle)' : 'var(--bg-card)',
                        color: formScope === 'ALL_COURSES' ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🌐</span> All Courses
                    </button>

                    {/* Option 2: All Categories */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormScope('ALL_CATEGORIES');
                        setFormCategoryIds(categories.map(c => c.id));
                      }}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: formScope === 'ALL_CATEGORIES' ? '2px solid #059669' : '1px solid var(--border-subtle)',
                        background: formScope === 'ALL_CATEGORIES' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                        color: formScope === 'ALL_CATEGORIES' ? '#059669' : 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🗂️</span> All Categories
                    </button>

                    {/* Option 3: Specific Category */}
                    <button
                      type="button"
                      onClick={() => setFormScope('CATEGORY')}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: formScope === 'CATEGORY' ? '2px solid #0284c7' : '1px solid var(--border-subtle)',
                        background: formScope === 'CATEGORY' ? 'rgba(14, 165, 233, 0.15)' : 'var(--bg-card)',
                        color: formScope === 'CATEGORY' ? '#0284c7' : 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🏷️</span> Category
                    </button>

                    {/* Option 4: Specific Course */}
                    <button
                      type="button"
                      onClick={() => setFormScope('COURSE')}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: formScope === 'COURSE' ? '2px solid #9333ea' : '1px solid var(--border-subtle)',
                        background: formScope === 'COURSE' ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-card)',
                        color: formScope === 'COURSE' ? '#9333ea' : 'var(--text-primary)',
                        fontWeight: '700',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🎓</span> Course
                    </button>
                  </div>

                  {/* Scope: All Courses Notice */}
                  {formScope === 'ALL_COURSES' && (
                    <div style={{ padding: '10px 12px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>🌐 Sitewide Promotion:</strong> Applies to every paid course across the entire platform.
                    </div>
                  )}

                  {/* Scope: All Categories Details & Category Badges */}
                  {formScope === 'ALL_CATEGORIES' && (
                    <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.83rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontWeight: '700', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-folder-tree"></i>
                          <span>All Categories Scope Active</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                          {categories.length} Categories Included
                        </span>
                      </div>
                      <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        This coupon discount will apply to any course that belongs to any category in the catalog.
                      </p>
                      {categories.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', padding: '6px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          {categories.map((cat) => (
                            <span key={cat.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', fontWeight: '600' }}>
                              <i className="fa-solid fa-check" style={{ fontSize: '0.65rem' }}></i> {cat.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scope: Category Specific with All Categories option & Multi-Select */}
                  {formScope === 'CATEGORY' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                          Applicable Category / Categories *
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = categories.map(c => c.id);
                              setFormCategoryIds(allIds);
                              if (categories.length > 0) setFormCategoryId(String(categories[0].id));
                            }}
                            style={{
                              background: 'rgba(14, 165, 233, 0.1)',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                              color: '#0284c7',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa-solid fa-check-double"></i> Select All Categories
                          </button>
                          {formCategoryIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormCategoryIds([]);
                                setFormCategoryId('');
                              }}
                              style={{
                                background: 'none',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-muted)',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Primary Category Selector with "All Categories" as an option */}
                      <div style={{ marginBottom: '10px' }}>
                        <select
                          value={
                            formCategoryIds.length === categories.length && categories.length > 0
                              ? 'ALL'
                              : (formCategoryId || (formCategoryIds.length === 1 ? String(formCategoryIds[0]) : ''))
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'ALL') {
                              setFormScope('ALL_CATEGORIES');
                              setFormCategoryIds(categories.map(c => c.id));
                              setFormCategoryId('');
                            } else if (val) {
                              const num = parseInt(val, 10);
                              setFormCategoryId(val);
                              if (!formCategoryIds.includes(num)) {
                                setFormCategoryIds([num]);
                              }
                            } else {
                              setFormCategoryId('');
                              setFormCategoryIds([]);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem'
                          }}
                        >
                          <option value="">-- Choose Category or All Categories --</option>
                          <option value="ALL" style={{ fontWeight: '700', color: '#059669' }}>
                            🌐 All Categories ({categories.length} Categories)
                          </option>
                          <optgroup label="Specific Categories">
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Category Multi-select Checklist Pills */}
                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Or check specific categories:</span>
                          <span style={{ fontWeight: '600', color: formCategoryIds.length > 0 ? '#0284c7' : 'var(--text-muted)' }}>
                            {formCategoryIds.length === categories.length && categories.length > 0
                              ? 'All Categories Selected'
                              : `${formCategoryIds.length} of ${categories.length} selected`}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                            gap: '6px',
                            maxHeight: '130px',
                            overflowY: 'auto',
                            padding: '8px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          {categories.map((cat) => {
                            const isSelected = formCategoryIds.includes(cat.id);
                            return (
                              <label
                                key={cat.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--bg-primary)',
                                  border: isSelected ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid transparent',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  color: isSelected ? '#0284c7' : 'var(--text-primary)',
                                  fontWeight: isSelected ? '700' : 'normal',
                                  userSelect: 'none',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      const next = formCategoryIds.filter(id => id !== cat.id);
                                      setFormCategoryIds(next);
                                      if (String(cat.id) === formCategoryId) {
                                        setFormCategoryId(next.length > 0 ? String(next[0]) : '');
                                      }
                                    } else {
                                      const next = [...formCategoryIds, cat.id];
                                      setFormCategoryIds(next);
                                      if (!formCategoryId) setFormCategoryId(String(cat.id));
                                    }
                                  }}
                                  style={{ accentColor: '#0284c7', cursor: 'pointer' }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat.name}>
                                  {cat.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Target Course Selector */}
                  {formScope === 'COURSE' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Select Target Course *
                      </label>
                      <select
                        required
                        value={formCourseId}
                        onChange={(e) => setFormCourseId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem'
                        }}
                      >
                        <option value="">-- Choose Course --</option>
                        {courses.map((crs) => (
                          <option key={crs.id} value={crs.id}>
                            {crs.name}
                          </option>
                        ))}
                      </select>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        Discount will exclusively apply to this course at checkout.
                      </small>
                    </div>
                  )}
                </div>

                {/* Discount Type & Value */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Discount Type *
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FLAT">Flat Amount (₹)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Discount Value *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder={formType === 'PERCENTAGE' ? '25' : '500'}
                        value={formValue}
                        onChange={(e) => setFormValue(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 28px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: '600' }}>
                        {formType === 'PERCENTAGE' ? '%' : '₹'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Minimum Order & Max Cap */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Min Order Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={formMinPurchase}
                      onChange={(e) => setFormMinPurchase(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>0 = No minimum purchase required</small>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="Optional ceiling (e.g. 1000)"
                      value={formMaxDiscount}
                      onChange={(e) => setFormMaxDiscount(e.target.value)}
                      disabled={formType === 'FLAT'}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: formType === 'FLAT' ? 'var(--bg-card)' : 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>For % discounts only</small>
                  </div>
                </div>

                {/* Validity Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Start Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Expiry Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                {/* Usage Limits */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Total Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Leave blank for unlimited"
                      value={formUsageLimit}
                      onChange={(e) => setFormUsageLimit(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Per-User Redemption Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="1"
                      value={formPerUserLimit}
                      onChange={(e) => setFormPerUserLimit(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Description / Promo Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50% discount for learners this festival season"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                {/* Active Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="coupon-active-toggle"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="coupon-active-toggle" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Active (immediate eligibility on student checkout)
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary"
                  disabled={modalSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalSaving}
                  style={{ minWidth: '130px' }}
                >
                  {modalSaving ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>
                  ) : (
                    editingCoupon ? 'Update Coupon' : 'Create Coupon'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
