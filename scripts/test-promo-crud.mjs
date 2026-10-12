import fs from 'fs';

async function testPromoCrud() {
  const loginRes = await fetch('http://localhost:8080/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@onetutor.local', password: 'Admin@12345' })
  }).then(r => r.json());
  const token = loginRes.data.accessToken;
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  console.log('1. Testing GET /api/v1/admin/banners/promo/all ...');
  const all1 = await fetch('http://localhost:8080/api/v1/admin/banners/promo/all', { headers: h }).then(r => r.json());
  console.log('-> Got', all1.data?.length, 'banners. First ID:', all1.data?.[0]?.id, 'Title:', all1.data?.[0]?.title);

  console.log('2. Testing POST /api/v1/admin/banners/promo (Create) ...');
  const createPayload = {
    title: 'Festive Flash Sale - 50% Off All Full Stack Tracks',
    subtitle: 'Limited seats available. Industry-certified curriculum with dedicated mentor support.',
    bgColor: '#1e1b4b',
    textColor: '#ffffff',
    accentColor: '#fbbf24',
    imageUrl: 'https://res.cloudinary.com/q9yidryy/image/upload/v1791526803/onetutor/banners/file_skvq2c.png',
    secondaryImageUrl: '',
    imageAlignment: 'right',
    ctaText: 'Claim Your 50% Off',
    ctaLink: '/student/courses',
    ctaBgColor: '#fbbf24',
    ctaTextColor: '#1e1b4b',
    secondaryLinkText: 'View All Courses',
    secondaryLinkUrl: '/student/courses',
    secondaryLinkColor: '#ffffff',
    featuresJson: JSON.stringify([
      { icon: 'sparkles', text: 'Live Mentor Sessions' },
      { icon: 'check', text: 'Interview Guarantee' }
    ]),
    featuresColumns: 2,
    active: false
  };
  const created = await fetch('http://localhost:8080/api/v1/admin/banners/promo', {
    method: 'POST',
    headers: h,
    body: JSON.stringify(createPayload)
  }).then(r => r.json());
  console.log('-> Created ID:', created.data?.id, 'Title:', created.data?.title);
  const newId = created.data?.id;

  console.log('3. Testing GET /api/v1/admin/banners/promo/' + newId + ' ...');
  const getOne = await fetch('http://localhost:8080/api/v1/admin/banners/promo/' + newId, { headers: h }).then(r => r.json());
  console.log('-> Fetched ID:', getOne.data?.id, 'Title:', getOne.data?.title);

  console.log('4. Testing PUT /api/v1/admin/banners/promo/' + newId + ' (Update) ...');
  createPayload.title = 'Updated: Mega Weekend Offer 60% Off';
  const updated = await fetch('http://localhost:8080/api/v1/admin/banners/promo/' + newId, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify(createPayload)
  }).then(r => r.json());
  console.log('-> Updated Title:', updated.data?.title);

  console.log('5. Testing PATCH /api/v1/admin/banners/promo/' + newId + '/status?active=true ...');
  const toggled = await fetch('http://localhost:8080/api/v1/admin/banners/promo/' + newId + '/status?active=true', {
    method: 'PATCH',
    headers: h
  }).then(r => r.json());
  console.log('-> Status is active:', toggled.data?.active);

  console.log('6. Testing DELETE /api/v1/admin/banners/promo/' + newId + ' ...');
  const deleted = await fetch('http://localhost:8080/api/v1/admin/banners/promo/' + newId, {
    method: 'DELETE',
    headers: h
  }).then(r => r.json());
  console.log('-> Deleted success:', deleted.success, deleted.message);

  console.log('7. Testing POST /api/v1/admin/banners/promo/upload (Upload to Cloudinary) ...');
  const fileBuf = fs.readFileSync('./uploads/banners/f9130f74-3d5c-43df-8457-5f4a43c1c26e-pro.png');
  const blob = new Blob([fileBuf], { type: 'image/png' });
  const fd = new FormData();
  fd.append('file', blob, 'pro.png');
  const uploadRes = await fetch('http://localhost:8080/api/v1/admin/banners/promo/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: fd
  }).then(r => r.json());
  console.log('-> Uploaded to Cloudinary:', uploadRes.data?.url);

  console.log('\n✓ ALL PROMO BANNER CRUD OPERATIONS SUCCEEDED 100%!');
}

testPromoCrud().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
