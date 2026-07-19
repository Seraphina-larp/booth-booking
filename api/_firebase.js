const admin = require('firebase-admin');

function credentialFromEnvironment() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const value = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (value.private_key) value.private_key = value.private_key.replace(/\\n/g, '\n');
    return admin.credential.cert(value);
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin 環境變數尚未設定');
  }
  return admin.credential.cert({ projectId, clientEmail, privateKey });
}

function getAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: credentialFromEnvironment(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'booth-booking-31111',
    });
  }
  return admin;
}

async function requireAdmin(req) {
  const bearer = String(req.headers.authorization || '');
  if (!bearer.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const token = await getAdmin().auth().verifyIdToken(bearer.slice(7));
  const profile = await getAdmin().firestore().collection('profiles').doc(token.uid).get();
  if (!profile.exists || profile.data().role !== 'admin') throw new Error('ADMIN_REQUIRED');
  return token;
}

module.exports = { getAdmin, requireAdmin };
