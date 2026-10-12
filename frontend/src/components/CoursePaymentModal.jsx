import { useState, useEffect, useId, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkoutPayment, createRazorpayOrder, verifyRazorpayPayment } from '../api/payment';
import { loadRazorpayScript } from '../utils/razorpayUtils';
import { useAuth } from '../auth/AuthContext';
import { resolveMediaUrl } from '../utils/mediaUtils';
import { validateAndApplyCoupon, AVAILABLE_COUPONS } from '../utils/couponUtils';
import { validateCoupon, getAvailableCoupons } from '../api/coupons';

export default function CoursePaymentModal({ course, batchId, isOpen, onClose, onSuccess, initialCoupon = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY'); // 'RAZORPAY' | 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET'
  const [submitting, setSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState(initialCoupon?.code || '');
  const [appliedCoupon, setAppliedCoupon] = useState(initialCoupon || null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    getAvailableCoupons()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableCoupons(data);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (initialCoupon) {
      setAppliedCoupon(initialCoupon);
      setCouponInput(initialCoupon.code);
    }
  }, [initialCoupon, isOpen]);

  const suggestedCoupons = useMemo(() => {
    if (availableCoupons && availableCoupons.length > 0) {
      const filtered = availableCoupons.filter(c => {
        if (c.scope === 'COURSE' && c.courseId && course?.id && c.courseId !== course.id) return false;
        if (c.scope === 'CATEGORY' && c.categoryId && course?.categoryId && c.categoryId !== course.categoryId) return false;
        return true;
      });
      return (filtered.length > 0 ? filtered : availableCoupons).slice(0, 4);
    }
    return AVAILABLE_COUPONS.slice(0, 3);
  }, [availableCoupons, course]);

  // Card details
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // UPI details
  const [upiApp, setUpiApp] = useState('gpay');
  const [upiId, setUpiId] = useState('');
  const [showQr, setShowQr] = useState(false);

  // Net banking details
  const [selectedBank, setSelectedBank] = useState('HDFC');

  // Wallet details
  const [selectedWallet, setSelectedWallet] = useState('paytm');

  if (!isOpen || !course) return null;

  const currencySymbol = course.currency === 'USD' ? '$' : course.currency === 'EUR' ? '€' : course.currency === 'GBP' ? '£' : '₹';
  const originalPrice = Number(course.price) || 0;
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalPrice = appliedCoupon ? appliedCoupon.finalPrice : originalPrice;
  const isMonthly = course.subscriptionPeriod === 'monthly';
  const isYearly = course.subscriptionPeriod === 'yearly';

  const handleApplyCoupon = async (codeToUse) => {
    setCouponError('');
    const code = (codeToUse || couponInput).trim();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    try {
      const res = await validateCoupon(code, originalPrice, course.id);
      if (!res.valid) {
        setCouponError(res.message || 'Invalid or inapplicable coupon.');
        return;
      }
      setAppliedCoupon({
        valid: true,
        code: res.code,
        discount: Number(res.discount),
        finalPrice: Number(res.finalPrice),
        label: res.discountType === 'PERCENTAGE' ? `${res.discountValue}% OFF` : `₹${res.discountValue} OFF`,
        description: res.description
      });
      setCouponInput(res.code);
    } catch (err) {
      const fallback = validateAndApplyCoupon(code, originalPrice, course.currency);
      if (!fallback.valid) {
        setCouponError(err.response?.data?.message || fallback.error || 'Invalid or expired coupon.');
        return;
      }
      setAppliedCoupon(fallback);
      setCouponInput(fallback.code);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  // Format card number with spaces (16 digits: 4-4-4-4)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  // Format expiry MM/YY
  const handleExpiryChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    setCardExpiry(raw);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');

    // Razorpay Checkout flow
    if (paymentMethod === 'RAZORPAY') {
      setSubmitting(true);
      setProcessingStep('Preparing Razorpay checkout…');
      try {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded && typeof window.Razorpay === 'undefined') {
          throw new Error('Razorpay payment gateway script could not load. Please verify your connection.');
        }

        setProcessingStep('Creating secure order with Razorpay…');
        const orderData = await createRazorpayOrder({
          courseId: course.id,
          batchId: batchId ? Number(batchId) : null,
          amount: finalPrice,
          currency: course.currency || 'INR',
          couponCode: appliedCoupon?.code || null
        });

        if (!orderData || !orderData.orderId) {
          throw new Error('Failed to generate Razorpay order ID.');
        }

        // Test/Simulated mode fallback ONLY when Razorpay keys are not configured (simulated order ID)
        const isSimulatedOrder = (!orderData.isConfigured && orderData.isConfigured !== undefined) ||
          orderData.orderId?.startsWith('order_sim_') ||
          orderData.keyId?.includes('placeholder');

        if (isSimulatedOrder) {
          setProcessingStep('Processing test checkout in OneTutor sandbox mode…');
          await new Promise(r => setTimeout(r, 900));

          const verifyPayload = {
            courseId: course.id,
            batchId: batchId ? Number(batchId) : null,
            amount: finalPrice,
            currency: course.currency || 'INR',
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: 'pay_sim_' + Math.random().toString(36).substring(2, 12),
            razorpaySignature: 'simulated_test_signature',
            couponCode: appliedCoupon?.code || null
          };

          setProcessingStep('Enrolling student into course…');
          const verified = await verifyRazorpayPayment(verifyPayload);
          setCompletedOrder(verified);
          if (onSuccess) onSuccess(verified);
          return;
        }

        // Official Razorpay Checkout Modal
        setProcessingStep('Awaiting completion in Razorpay…');
        const options = {
          key: orderData.keyId,
          amount: orderData.amountInPaise,
          currency: orderData.currency || 'INR',
          name: 'OneTutor Academy',
          description: `Enrollment for ${course.name}`,
          image: 'https://cdn.razorpay.com/static/assets/logo/rzp.svg',
          order_id: orderData.orderId,
          handler: async function (response) {
            setSubmitting(true);
            setProcessingStep('Verifying payment signature with OneTutor…');
            try {
              const verifyPayload = {
                courseId: course.id,
                batchId: batchId ? Number(batchId) : null,
                amount: finalPrice,
                currency: course.currency || 'INR',
                razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                couponCode: appliedCoupon?.code || null
              };
              const verified = await verifyRazorpayPayment(verifyPayload);
              setCompletedOrder(verified);
              if (onSuccess) onSuccess(verified);
            } catch (verifyErr) {
              console.error('Signature verification error:', verifyErr);
              setError(verifyErr.response?.data?.message || 'Payment signature verification failed. Please contact support.');
            } finally {
              setSubmitting(false);
              setProcessingStep('');
            }
          },
          prefill: {
            name: orderData.studentName || user?.fullName || '',
            email: orderData.studentEmail || user?.email || '',
            contact: user?.phoneNumber || ''
          },
          notes: {
            courseId: String(course.id),
            courseName: course.name,
            couponCode: appliedCoupon?.code || ''
          },
          theme: {
            color: '#5A70D3'
          },
          modal: {
            ondismiss: function () {
              setSubmitting(false);
              setProcessingStep('');
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          setError(resp.error?.description || 'Razorpay payment was cancelled or failed.');
          setSubmitting(false);
          setProcessingStep('');
        });
        rzp.open();
      } catch (err) {
        console.error('Razorpay flow failed:', err);
        setError(err.response?.data?.message || err.message || 'Razorpay checkout could not be initiated.');
        setSubmitting(false);
        setProcessingStep('');
      }
      return;
    }

    // Validation for simulated direct methods
    if (paymentMethod === 'CARD') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.length < 15) {
        setError('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setError('Please enter a valid expiration date (MM/YY).');
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setError('Please enter a valid 3-digit security code (CVV).');
        return;
      }
    } else if (paymentMethod === 'UPI' && !showQr) {
      if (!upiId || !upiId.includes('@')) {
        setError('Please enter a valid UPI ID (e.g. mobile@upi, name@okaxis).');
        return;
      }
    }

    setSubmitting(true);
    setProcessingStep('Connecting to secure payment gateway…');

    try {
      await new Promise(r => setTimeout(r, 600));
      setProcessingStep('Authorizing transaction with bank…');
      await new Promise(r => setTimeout(r, 700));
      setProcessingStep('Securing enrollment credentials…');

      let paymentDetailsStr = '';
      if (paymentMethod === 'CARD') {
        const last4 = cardNumber.replace(/\s/g, '').slice(-4);
        paymentDetailsStr = `Card ending in ${last4} (${cardName || 'Cardholder'})`;
      } else if (paymentMethod === 'UPI') {
        paymentDetailsStr = showQr ? 'UPI QR Code Instant Scan' : `UPI ID: ${upiId}`;
      } else if (paymentMethod === 'NET_BANKING') {
        paymentDetailsStr = `Net Banking (${selectedBank} Bank)`;
      } else {
        paymentDetailsStr = `Digital Wallet (${selectedWallet.toUpperCase()})`;
      }

      const couponNote = appliedCoupon ? ` | Coupon ${appliedCoupon.code} applied (-${currencySymbol}${discountAmount})` : '';

      const payload = {
        courseId: course.id,
        batchId: batchId ? Number(batchId) : null,
        amount: finalPrice,
        currency: course.currency || 'INR',
        paymentMethod,
        paymentDetails: paymentDetailsStr + couponNote,
        couponCode: appliedCoupon?.code || null,
        couponDiscount: appliedCoupon ? appliedCoupon.discount : 0
      };

      const result = await checkoutPayment(payload);
      setCompletedOrder(result);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      console.error('Payment checkout failed:', err);
      const msg = err.response?.data?.message || 'Payment processing could not be completed. Please try again or use another payment method.';
      setError(msg);
    } finally {
      setSubmitting(false);
      setProcessingStep('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={!submitting ? onClose : undefined}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: completedOrder ? '540px' : '880px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid var(--border-default, #e2e8f0)',
          animation: 'modalSlideUp 0.25s ease-out',
          color: 'var(--text-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= COMPLETED RECEIPT VIEW ================= */}
        {completedOrder ? (
          <div style={{ padding: '36px 32px', textAlign: 'center' }}>
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.4rem',
                marginBottom: '20px',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)'
              }}
            >
              <i className="fa-solid fa-check"></i>
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 850, margin: '0 0 6px 0', color: '#0f172a' }}>
              Payment &amp; Enrollment Confirmed!
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '0.94rem' }}>
              Thank you for purchasing <strong>{course.name}</strong>. You have gained full lifetime access to curriculum lessons and live sessions.
            </p>

            {/* Receipt Summary Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                textAlign: 'left',
                marginBottom: '28px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px dashed #cbd5e1', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b' }}>Transaction ID:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{completedOrder.transactionId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b' }}>Course Name:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', maxWidth: '280px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {course.name}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #cbd5e1', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b' }}>Payment Mode:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{completedOrder.paymentMethod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontSize: '1.05rem' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Total Amount Paid:</span>
                <span style={{ fontWeight: 850, color: '#059669' }}>{currencySymbol}{completedOrder?.amount ?? finalPrice}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ flex: 1, padding: '12px', fontSize: '0.92rem', fontWeight: 700 }}
              >
                Close Receipt
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  navigate(`/student/learn/${course.id}`);
                }}
                style={{
                  flex: 1.6,
                  padding: '12px',
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #5A70D3, #4338ca)',
                  border: 'none',
                  boxShadow: '0 6px 20px rgba(90, 112, 211, 0.4)'
                }}
              >
                <i className="fa-solid fa-circle-play" style={{ marginRight: '8px' }}></i>
                Start Learning Now
              </button>
            </div>
          </div>
        ) : (
          /* ================= ACTIVE CHECKOUT FLOW ================= */
          <div>
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-default, #e2e8f0)',
                background: 'linear-gradient(to right, #0f172a, #1e293b)',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(90, 112, 211, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                    border: '1px solid rgba(129, 140, 248, 0.4)'
                  }}
                >
                  <i className="fa-solid fa-shield-halved" style={{ fontSize: '1rem' }}></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                    Secure Course Checkout
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: '0.68rem', color: '#10b981' }}></i>
                    <span>256-Bit Bank Grade SSL Encrypted</span>
                  </div>
                </div>
              </div>

              {!submitting && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '4px'
                  }}
                  aria-label="Close checkout"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Modal Body: Split 2 columns on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              {/* LEFT COLUMN: Order Summary */}
              <div
                style={{
                  padding: '24px',
                  background: 'var(--bg-surface, #f8fafc)',
                  borderRight: '1px solid var(--border-default, #e2e8f0)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--accent-primary, #5A70D3)', marginBottom: '8px' }}>
                    Order Summary
                  </div>

                  {/* Course Card Summary */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
                    <div
                      style={{
                        width: '84px',
                        height: '62px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#0f172a',
                        flexShrink: 0
                      }}
                    >
                      {course.thumbnail ? (
                        <img src={resolveMediaUrl(course.thumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                          <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {course.name}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {course.categoryName || 'Technical Course'} • {course.level || 'All Levels'}
                      </div>
                    </div>
                  </div>

                  {/* Coupon Code Section */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-tag" style={{ color: 'var(--accent-primary, #5A70D3)', fontSize: '0.8rem' }}></i>
                        <span>Apply Coupon Code</span>
                      </span>
                      {appliedCoupon && (
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Remove Coupon
                        </button>
                      )}
                    </div>

                    {!appliedCoupon ? (
                      <div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input
                              type="text"
                              placeholder="Enter coupon code (e.g. ONETUTOR20)"
                              value={couponInput}
                              onChange={(e) => {
                                setCouponInput(e.target.value.toUpperCase());
                                setCouponError('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleApplyCoupon();
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: couponError ? '1px solid #ef4444' : '1px solid var(--border-default, #cbd5e1)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                outline: 'none',
                                background: '#ffffff',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyCoupon()}
                            style={{
                              padding: '10px 18px',
                              background: 'var(--accent-primary, #5A70D3)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '0.84rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 6px rgba(90, 112, 211, 0.25)'
                            }}
                          >
                            Apply
                          </button>
                        </div>

                        {couponError && (
                          <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <i className="fa-solid fa-circle-exclamation"></i>
                            <span>{couponError}</span>
                          </div>
                        )}

                        {/* Available Coupon Chips */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Available:</span>
                          {suggestedCoupons.map((cpn) => (
                            <button
                              key={cpn.code}
                              type="button"
                              onClick={() => {
                                setCouponInput(cpn.code);
                                handleApplyCoupon(cpn.code);
                              }}
                              style={{
                                background: 'rgba(90, 112, 211, 0.08)',
                                border: '1px dashed rgba(90, 112, 211, 0.45)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'var(--accent-primary, #5A70D3)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              title={cpn.description}
                            >
                              <i className="fa-solid fa-tag" style={{ fontSize: '0.62rem' }}></i>
                              <span>{cpn.code} ({cpn.discountType === 'PERCENTAGE' ? `${cpn.discountValue}% OFF` : (cpn.label || `₹${cpn.discountValue || 500} OFF`)})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: '#10b981',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              flexShrink: 0
                            }}
                          >
                            <i className="fa-solid fa-check"></i>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#065f46' }}>
                              Coupon "{appliedCoupon.code}" Applied!
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#047857' }}>
                              {appliedCoupon.description} • Saved {currencySymbol}{discountAmount}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#047857',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '4px'
                          }}
                          title="Remove coupon"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '10px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tuition Fee</span>
                      <span style={{ fontWeight: 700, textDecoration: appliedCoupon ? 'line-through' : 'none', color: appliedCoupon ? '#94a3b8' : 'inherit' }}>
                        {currencySymbol}{originalPrice}
                      </span>
                    </div>

                    {appliedCoupon && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '10px', color: '#10b981', fontWeight: 700 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <i className="fa-solid fa-tag" style={{ fontSize: '0.75rem' }}></i>
                          <span>Coupon Discount ({appliedCoupon.code})</span>
                        </span>
                        <span>-{currencySymbol}{discountAmount}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '10px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Live Class &amp; Community Access</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>Included</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tax &amp; Service Fee</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>₹0.00 (Waived)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-default, #e2e8f0)', fontSize: '1.05rem', fontWeight: 800 }}>
                      <span>Total Due Today:</span>
                      <span style={{ color: 'var(--accent-primary, #5A70D3)', fontSize: '1.25rem' }}>
                        {currencySymbol}{finalPrice}
                        {isMonthly && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/mo</span>}
                        {isYearly && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/yr</span>}
                      </span>
                    </div>
                  </div>

                  {/* Guarantee Perks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-check" style={{ color: '#10b981' }}></i>
                      <span>Instant Unrestricted Access Upon Payment</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-certificate" style={{ color: '#f59e0b' }}></i>
                      <span>Official Certificate of Completion Included</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-infinity" style={{ color: '#6366f1' }}></i>
                      <span>Lifetime Access to Video Lessons &amp; Updates</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  By completing this purchase, you agree to OneTutor's Terms of Service and refund policy.
                </div>
              </div>

              {/* RIGHT COLUMN: Payment Method & Payment Form */}
              <div style={{ padding: '24px' }}>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--accent-primary, #5A70D3)', marginBottom: '12px' }}>
                  Select Payment Method
                </div>

                {/* Method Tabs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '20px' }}>
                  {[
                    { id: 'RAZORPAY', label: 'Razorpay', icon: 'fa-bolt', badge: 'Fast' },
                    { id: 'CARD', label: 'Cards', icon: 'fa-credit-card' },
                    { id: 'UPI', label: 'UPI / QR', icon: 'fa-qrcode' },
                    { id: 'NET_BANKING', label: 'NetBanking', icon: 'fa-building-columns' },
                    { id: 'WALLET', label: 'Wallets', icon: 'fa-wallet' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { setPaymentMethod(tab.id); setError(''); }}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '10px',
                        border: paymentMethod === tab.id ? '2px solid var(--accent-primary, #5A70D3)' : '1px solid var(--border-default, #cbd5e1)',
                        background: paymentMethod === tab.id ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'var(--bg-card, #ffffff)',
                        color: paymentMethod === tab.id ? 'var(--accent-primary, #5A70D3)' : 'var(--text-secondary, #475569)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: paymentMethod === tab.id ? 800 : 600,
                        fontSize: '0.72rem',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      {tab.badge && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-2px',
                            background: '#0284c7',
                            color: '#ffffff',
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '999px',
                            letterSpacing: '0.3px',
                            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)'
                          }}
                        >
                          {tab.badge}
                        </span>
                      )}
                      <i className={`fa-solid ${tab.icon}`} style={{ fontSize: '1rem', color: tab.id === 'RAZORPAY' && paymentMethod === tab.id ? '#0284c7' : 'inherit' }}></i>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, marginBottom: '16px' }}>
                    <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handlePay}>
                  {/* ====== RAZORPAY METHOD ====== */}
                  {paymentMethod === 'RAZORPAY' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div
                        style={{
                          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(90, 112, 211, 0.1) 100%)',
                          border: '1.5px solid rgba(90, 112, 211, 0.3)',
                          borderRadius: '14px',
                          padding: '18px 20px',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontWeight: 900,
                                fontSize: '1.2rem',
                                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                              }}
                            >
                              <i className="fa-solid fa-bolt"></i>
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Razorpay Payment Gateway</span>
                                <i className="fa-solid fa-circle-check" style={{ color: '#0284c7', fontSize: '0.88rem' }}></i>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Fastest, Trusted &amp; RBI Approved Indian Gateway</div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: '#0284c7',
                              background: 'rgba(2, 132, 199, 0.12)',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Recommended
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.5, marginBottom: '14px' }}>
                          One single checkout window supporting all major Indian payment options:
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', color: '#475569' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <i className="fa-solid fa-mobile-screen-button" style={{ color: '#0284c7', fontSize: '1rem' }}></i>
                            <span><strong>UPI</strong> (GPay, PhonePe, Paytm, CRED)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <i className="fa-regular fa-credit-card" style={{ color: '#0284c7', fontSize: '1rem' }}></i>
                            <span><strong>Debit &amp; Credit</strong> (Visa, MC, RuPay)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <i className="fa-solid fa-building-columns" style={{ color: '#0284c7', fontSize: '1rem' }}></i>
                            <span><strong>NetBanking</strong> (50+ Indian Banks)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <i className="fa-solid fa-wallet" style={{ color: '#0284c7', fontSize: '1rem' }}></i>
                            <span><strong>Wallets &amp; EMI</strong> (Paytm, Mobikwik)</span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.78rem',
                          color: '#64748b'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-shield-halved" style={{ color: '#10b981' }}></i>
                          <span>PCI-DSS Level 1 Certified</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-lock" style={{ color: '#0284c7' }}></i>
                          <span>256-Bit Bank Grade SSL</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== CARD METHOD ====== */}
                  {paymentMethod === 'CARD' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                          Card Number
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={cardNumber}
                            onChange={handleCardNumberChange}
                            placeholder="4532 •••• •••• 8920"
                            className="form-control"
                            style={{ paddingRight: '48px', fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 700 }}
                            required
                          />
                          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px', opacity: 0.7 }}>
                            <i className="fa-brands fa-cc-visa" style={{ fontSize: '1.4rem', color: '#1e40af' }}></i>
                            <i className="fa-brands fa-cc-mastercard" style={{ fontSize: '1.4rem', color: '#ea580c' }}></i>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                            Expires (MM/YY)
                          </label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="form-control"
                            style={{ textAlign: 'center', fontWeight: 700 }}
                            required
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                            CVV / CVC
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="password"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="•••"
                              maxLength={4}
                              className="form-control"
                              style={{ textAlign: 'center', fontWeight: 700 }}
                              required
                            />
                            <i className="fa-solid fa-lock" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem' }}></i>
                          </div>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                          Name on Card
                        </label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="form-control"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* ====== UPI METHOD ====== */}
                  {paymentMethod === 'UPI' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setShowQr(false)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: !showQr ? '2px solid var(--accent-primary, #5A70D3)' : '1px solid #cbd5e1',
                            background: !showQr ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          <i className="fa-solid fa-mobile-screen-button" style={{ marginRight: '6px' }}></i>
                          UPI ID / VPA
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQr(true)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: showQr ? '2px solid var(--accent-primary, #5A70D3)' : '1px solid #cbd5e1',
                            background: showQr ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                          }}
                        >
                          <i className="fa-solid fa-qrcode" style={{ marginRight: '6px' }}></i>
                          Instant QR Code
                        </button>
                      </div>

                      {showQr ? (
                        <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                          <div style={{ width: '160px', height: '160px', margin: '0 auto 12px auto', background: '#ffffff', padding: '10px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=onetutor@axis&pn=OneTutor%20Academy&am=${finalPrice}&cu=INR&tn=Course%20${course.id}`)}`}
                              alt="Scan UPI QR"
                              style={{ width: '100%', height: '100%' }}
                            />
                          </div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>Scan with Any UPI App</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Google Pay, PhonePe, Paytm, BHIM, CRED</div>
                        </div>
                      ) : (
                        <div>
                          <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                              Enter your UPI ID / Virtual Payment Address
                            </label>
                            <input
                              type="text"
                              value={upiId}
                              onChange={(e) => setUpiId(e.target.value)}
                              placeholder="e.g. yourname@okhdfcbank or mobile@upi"
                              className="form-control"
                              required
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {['@okhdfcbank', '@okaxis', '@ybl', '@paytm', '@ibl'].map(handle => (
                              <button
                                key={handle}
                                type="button"
                                onClick={() => setUpiId(prev => (prev ? prev.split('@')[0] : 'user') + handle)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  fontSize: '0.74rem',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                {handle}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ====== NET BANKING ====== */}
                  {paymentMethod === 'NET_BANKING' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '10px' }}>
                        Popular Banks
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                        {['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'PNB'].map(bank => (
                          <button
                            key={bank}
                            type="button"
                            onClick={() => setSelectedBank(bank)}
                            style={{
                              padding: '10px 4px',
                              borderRadius: '8px',
                              border: selectedBank === bank ? '2px solid var(--accent-primary, #5A70D3)' : '1px solid #cbd5e1',
                              background: selectedBank === bank ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : '#ffffff',
                              color: selectedBank === bank ? 'var(--accent-primary, #5A70D3)' : '#334155',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            {bank} Bank
                          </button>
                        ))}
                      </div>
                      <select className="form-control" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
                        <option value="HDFC">HDFC Bank</option>
                        <option value="ICICI">ICICI Bank</option>
                        <option value="SBI">State Bank of India</option>
                        <option value="Axis">Axis Bank</option>
                        <option value="Kotak">Kotak Mahindra Bank</option>
                        <option value="PNB">Punjab National Bank</option>
                        <option value="BOB">Bank of Baroda</option>
                        <option value="YES">Yes Bank</option>
                      </select>
                    </div>
                  )}

                  {/* ====== WALLETS ====== */}
                  {paymentMethod === 'WALLET' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { id: 'paytm', name: 'Paytm Wallet & Postpaid', icon: 'fa-wallet' },
                        { id: 'phonepe', name: 'PhonePe Wallet', icon: 'fa-wallet' },
                        { id: 'amazon', name: 'Amazon Pay Balance', icon: 'fa-brands fa-amazon' },
                        { id: 'mobikwik', name: 'MobiKwik Zip', icon: 'fa-wallet' },
                      ].map(w => (
                        <div
                          key={w.id}
                          onClick={() => setSelectedWallet(w.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: selectedWallet === w.id ? '2px solid var(--accent-primary, #5A70D3)' : '1px solid #cbd5e1',
                            background: selectedWallet === w.id ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '0.86rem' }}>
                            <i className={`fa-solid ${w.icon}`} style={{ color: 'var(--accent-primary, #5A70D3)' }}></i>
                            <span>{w.name}</span>
                          </div>
                          <input type="radio" checked={selectedWallet === w.id} onChange={() => setSelectedWallet(w.id)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div style={{ marginTop: '24px' }}>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #5A70D3, #4338ca)',
                        color: '#ffffff',
                        fontWeight: 850,
                        fontSize: '1rem',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        boxShadow: submitting ? 'none' : '0 8px 25px rgba(90, 112, 211, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {submitting ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>{processingStep || 'Processing Payment…'}</span>
                        </>
                      ) : paymentMethod === 'RAZORPAY' ? (
                        <>
                          <i className="fa-solid fa-bolt"></i>
                          <span>Proceed with Razorpay ({currencySymbol}{finalPrice})</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-lock"></i>
                          <span>Pay {currencySymbol}{finalPrice} Securely</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
