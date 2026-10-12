import http from 'http';

const BASE = 'http://localhost:8080/api/v1';

async function req(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const fullUrl = `${BASE}/${cleanEndpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('Testing Razorpay setup and endpoints...\n');

  // 1. Test public Razorpay config endpoint
  console.log('1. Checking GET /api/v1/payments/razorpay/config');
  const configRes = await req('/payments/razorpay/config');
  console.log('   Status:', configRes.status);
  console.log('   Response:', JSON.stringify(configRes.data, null, 2));

  if (configRes.status !== 200) {
    console.error('FAILED: Razorpay config endpoint not responding properly');
    process.exit(1);
  }

  // 2. Authenticate test student
  console.log('\n2. Authenticating test student (student@onetutor.local)...');
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: {
      email: 'student@onetutor.local',
      password: 'Student@12345',
    },
  });

  const token = loginRes.data?.data?.accessToken;
  console.log('   Student authenticated:', token ? 'SUCCESS' : 'FAILED');
  if (!token) {
    console.error('Failed to log in student:', loginRes.data);
    process.exit(1);
  }

  // 3. Fetch courses
  console.log('\n3. Fetching published courses...');
  const coursesRes = await req('/courses?size=10');
  const courseList = coursesRes.data?.data?.content || coursesRes.data?.data || [];
  const course = courseList.find(c => c.status === 'published' || c.status === 'PUBLISHED') || courseList[0];

  if (!course) {
    console.log('   No courses found, skipping order creation test.');
    return;
  }
  console.log(`   Selected course: "${course.name}" (ID: ${course.id}, Price: ${course.price})`);

  // 4. Test Razorpay Order creation
  console.log('\n4. Testing POST /api/v1/payments/razorpay/create-order');
  const orderRes = await req('/payments/razorpay/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      courseId: course.id,
      amount: course.price && course.price > 0 ? course.price : 499,
      currency: 'INR',
    },
  });

  console.log('   Status:', orderRes.status);
  console.log('   Response:', JSON.stringify(orderRes.data, null, 2));

  if (orderRes.status === 200) {
    const orderData = orderRes.data?.data;
    console.log('\n>>> SUCCESS: Razorpay Order Creation works properly!');
    console.log(`    Order ID: ${orderData.orderId}`);
    console.log(`    Amount in Paise: ${orderData.amountInPaise}`);
    console.log(`    Key ID: ${orderData.keyId}`);
    console.log(`    Is Configured: ${orderData.isConfigured}`);

    // 5. Test Payment Verification
    console.log('\n5. Testing POST /api/v1/payments/razorpay/verify');
    const verifyRes = await req('/payments/razorpay/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        courseId: course.id,
        amount: orderData.amount,
        currency: orderData.currency,
        razorpayOrderId: orderData.orderId,
        razorpayPaymentId: 'pay_sim_' + Math.random().toString(36).substring(2, 12),
        razorpaySignature: 'simulated_test_signature',
      },
    });

    console.log('   Verify Status:', verifyRes.status);
    console.log('   Verify Response:', JSON.stringify(verifyRes.data, null, 2));
    if (verifyRes.status === 200) {
      console.log('\n>>> SUCCESS: Payment Verified & Student Enrolled via Razorpay Pipeline!');
    }
  } else if (orderRes.data?.error?.code === 'ALREADY_ENROLLED') {
    console.log('   Student is already enrolled in this course (order creation validated enrollment guard)');
  } else {
    console.log('   Order creation error:', orderRes.data?.message || orderRes.data);
  }

  console.log('\n==============================================');
  console.log(' Razorpay Architecture Verification Complete');
  console.log('==============================================');
}

main().catch(console.error);
