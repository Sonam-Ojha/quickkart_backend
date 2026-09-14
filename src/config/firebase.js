const admin = require('firebase-admin');

// Place your serviceAccountKey.json at the project root
// Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key
let serviceAccount;
try {
  serviceAccount = require('../../serviceAccountKey.json');
} catch {
  console.warn('[FCM] serviceAccountKey.json not found — push notifications disabled');
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
