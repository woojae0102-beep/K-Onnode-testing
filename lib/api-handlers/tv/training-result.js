const { getAdmin } = require(`${process.cwd()}/lib/api-lib/firebaseAdmin.js`);

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const receivedAt = new Date().toISOString();

  const summary = {
    ok: true,
    receivedAt,
    overallScore: body.overallScore ?? 0,
    agency: body.agency ?? 'hybe',
    mode: body.mode ?? 'dance',
    sessionTime: body.sessionTime ?? 0,
    passProbability: body.passProbability ?? 0,
    growthRate: body.growthRate ?? 0,
    scores: body.scores ?? {},
    strengths: body.strengths ?? [],
    weaknesses: body.weaknesses ?? [],
    recommendations: body.recommendations ?? [],
  };

  const { admin, error } = getAdmin();
  if (!admin) {
    return res.json({
      ...summary,
      persisted: false,
      message: 'TV 트레이닝 결과 수신 (Firestore 미설정)',
      firebaseError: error || null,
    });
  }

  try {
    const db = admin.firestore();
    const userId = body.userId || 'anonymous';
    const docRef = db.collection('tv_training_results').doc();

    await docRef.set({
      ...summary,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (userId !== 'anonymous') {
      await db
        .collection('users')
        .doc(userId)
        .collection('tv_sessions')
        .doc(docRef.id)
        .set({
          ...summary,
          sessionId: docRef.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    return res.json({
      ...summary,
      persisted: true,
      sessionId: docRef.id,
      message: 'TV 트레이닝 결과가 저장되었습니다.',
    });
  } catch (err) {
    return res.status(500).json({
      ...summary,
      persisted: false,
      error: String(err?.message || err),
    });
  }
};
