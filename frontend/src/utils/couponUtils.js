export const AVAILABLE_COUPONS = [
  { code: 'ONETUTOR20', discountPercent: 20, label: '20% OFF', description: '20% discount on all courses' },
  { code: 'LEARN50', discountPercent: 50, label: '50% OFF', description: 'Mega 50% discount for learners' },
  { code: 'STUDENT50', discountPercent: 50, label: '50% OFF', description: 'Special 50% student scholarship discount' },
  { code: 'FLAT500', flatDiscount: 500, label: '₹500 OFF', description: 'Flat ₹500 discount' },
  { code: 'WELCOME10', discountPercent: 10, label: '10% OFF', description: '10% welcome discount for new learners' }
];

export function validateAndApplyCoupon(couponCode, originalPrice, currency = 'INR') {
  if (!couponCode || typeof couponCode !== 'string' || !couponCode.trim()) {
    return { valid: false, error: 'Please enter a coupon code.' };
  }

  const cleanCode = couponCode.trim().toUpperCase();
  const found = AVAILABLE_COUPONS.find(c => c.code === cleanCode);

  if (!found) {
    return {
      valid: false,
      error: `Coupon "${cleanCode}" is invalid or expired. Try ONETUTOR20 or LEARN50.`
    };
  }

  const numPrice = Number(originalPrice) || 0;
  if (numPrice <= 0) {
    return {
      valid: false,
      error: 'Coupons can only be applied to paid courses.'
    };
  }

  let discount = 0;
  if (found.discountPercent) {
    discount = Math.round((numPrice * found.discountPercent) / 100);
  } else if (found.flatDiscount) {
    const flat = currency === 'INR' ? found.flatDiscount : Math.round(found.flatDiscount / 80);
    discount = Math.min(numPrice, flat);
  }

  const finalPrice = Math.max(0, numPrice - discount);

  return {
    valid: true,
    code: found.code,
    label: found.label,
    description: found.description,
    discount,
    finalPrice
  };
}
