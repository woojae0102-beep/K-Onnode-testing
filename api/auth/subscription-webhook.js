// POST /api/auth/subscription-webhook
// Paddle / Stripe 등 결제 게이트웨이의 웹훅을 수신해
// Firestore users/{uid}.subscription 필드를 갱신합니다.
//
// 본 핸들러는 두 가지 페이로드 포맷을 처리합니다:
//
// (A) 자체 표준 포맷 (테스트/내부 호출용)
// {
//   "uid": "abc123",
//   "event": "subscription.activated" | "subscription.cancelled" | "subscription.renewed",
//   "plan": "premium" | "pro",
//   "status": "active" | "cancelled",
//   "expiresAt": "2026-12-31T00:00:00.000Z"
// }
//
// (B) Paddle webhook (간이 변환)
// (C) Stripe webhook (간이 변환)
//
// 운영시에는 서명검증(signature verification)을 반드시 추가해야 합니다.

const { getAdmin } = require('../_lib/firebaseAdmin');

const FREE_FEATURES = [
  'dance_basic',
  'vocal_basic',
  'korean_basic',
  'ai_coach_basic',
  'report_basic',
];

const PREMIUM_FEATURES = [
  'dance_basic', 'dance_persona', 'dance_advanced',
  'vocal_basic', 'vocal_soul', 'vocal_advanced',
  'korean_basic', 'korean_advanced',
  'ai_coach_basic', 'ai_coach_advanced',
  'audition_mode', 'agency_audition',
  'monthly_eval',
  'instrument_training',
  'report_basic', 'report_advanced',
  'unlimited_storage',
];

const PRO_FEATURES = [
  ...PREMIUM_FEATURES,
  'pro_coaching',
  'priority_review',
  'one_to_one_session',
];

function featuresForPlan(plan) {
  if (plan === 'pro') return PRO_FEATURES;
  if (plan === 'premium') return PREMIUM_FEATURES;
  return FREE_FEATURES;
}

function normalizeEvent(rawBody) {
  if (!rawBody || typeof rawBody !== 'object') return null;

  // (A) 자체 포맷
  if (rawBody.uid && rawBody.event) {
    return {
      uid: String(rawBody.uid),
      event: String(rawBody.event),
      plan: rawBody.plan || 'free',
      status: rawBody.status || 'active',
      expiresAt: rawBody.expiresAt || null,
      source: 'internal',
    };
  }

  // (B) Paddle (간이)
  // https://developer.paddle.com/webhooks/overview
  if (rawBody.alert_name && rawBody.passthrough) {
    try {
      const pt =
        typeof rawBody.passthrough === 'string'
          ? JSON.parse(rawBody.passthrough)
          : rawBody.passthrough;
      const uid = pt?.uid;
      if (!uid) return null;
      const plan = pt?.plan || 'premium';
      const event = rawBody.alert_name;
      const isCancel = /cancelled|paused/i.test(event);
      return {
        uid,
        event: isCancel ? 'subscription.cancelled' : 'subscription.activated',
        plan,
        status: isCancel ? 'cancelled' : 'active',
        expiresAt: rawBody.next_bill_date || null,
        source: 'paddle',
      };
    } catch {
      return null;
    }
  }

  // (C) Stripe (간이)
  // https://stripe.com/docs/webhooks
  if (rawBody.type && rawBody.data) {
    const obj = rawBody.data?.object || {};
    const uid = obj.metadata?.uid || obj.client_reference_id;
    if (!uid) return null;
    const plan = obj.metadata?.plan || 'premium';
    const isCancel = /deleted|canceled/i.test(rawBody.type);
    return {
      uid,
      event: isCancel ? 'subscription.cancelled' : 'subscription.activated',
      plan,
      status: isCancel ? 'cancelled' : 'active',
      expiresAt: obj.current_period_end
        ? new Date(obj.current_period_end * 1000).toISOString()
        : null,
      source: 'stripe',
    };
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { admin, error } = getAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'firebase_admin_unavailable', detail: error });
  }

  const evt = normalizeEvent(req.body);
  if (!evt) {
    return res.status(400).json({ error: 'unrecognized_payload' });
  }

  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(evt.uid);
    const plan = evt.status === 'cancelled' ? 'free' : evt.plan;
    const subscription = {
      plan,
      status: evt.status,
      expiresAt: evt.expiresAt ? new Date(evt.expiresAt) : null,
      features: featuresForPlan(plan),
      lastEvent: evt.event,
      source: evt.source,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set({ subscription }, { merge: true });

    return res.status(200).json({ ok: true, applied: { uid: evt.uid, plan, status: evt.status } });
  } catch (err) {
    console.error('[subscription-webhook] failed:', err);
    return res.status(500).json({
      error: 'update_failed',
      detail: err && err.message ? err.message : String(err),
    });
  }
};
