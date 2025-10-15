// Simple test function without IAM policy requirements
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    response.end();
    return;
  }
  
  response.json({message: "Hello from Firebase!"});
});

// Secure function to set admin by email, protected by a secret set in functions config.
// Usage: set functions config with: firebase functions:config:set admin.secret="YOUR_SECRET"
exports.setAdminByEmail = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const secret = functions.config().admin && functions.config().admin.secret;
    const provided = req.headers['x-admin-secret'] || req.query.secret || (req.body && req.body.secret);
    if (!secret || !provided || secret !== String(provided)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const email = req.body && req.body.email;
    const makeAdmin = req.body && (req.body.admin === true || req.body.admin === 'true');
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      const currentClaims = user.customClaims || {};
      const newClaims = { ...currentClaims, admin: !!makeAdmin };
      await admin.auth().setCustomUserClaims(user.uid, newClaims);
      // Also mirror to Firestore roles/{uid}
      await admin.firestore().doc(`roles/${user.uid}`).set({
        email: user.email,
        admin: !!makeAdmin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.json({ uid: user.uid, email: user.email, claims: newClaims });
    } catch (err) {
      console.error('setAdminByEmail error', err);
      return res.status(500).json({ error: String(err && err.message || err) });
    }
  });
});

// Keep custom claims in sync with roles/{uid} document changes.
exports.syncUserRoles = functions.firestore.document('roles/{uid}').onWrite(async (change, context) => {
  const uid = context.params.uid;
  const after = change.after.exists ? change.after.data() : null;
  if (!after) {
    // on delete, remove admin claim
    try {
      const user = await admin.auth().getUser(uid);
      const current = user.customClaims || {};
      const { admin: _drop, ...rest } = current;
      await admin.auth().setCustomUserClaims(uid, rest);
    } catch (e) {
      console.warn('syncUserRoles(delete) warn', e);
    }
    return null;
  }

  const shouldBeAdmin = !!after.admin;
  try {
    const user = await admin.auth().getUser(uid);
    const current = user.customClaims || {};
    if (current.admin === shouldBeAdmin) return null;
    const newClaims = { ...current, admin: shouldBeAdmin };
    await admin.auth().setCustomUserClaims(uid, newClaims);
    return null;
  } catch (e) {
    console.error('syncUserRoles error', e);
    return null;
  }
});
