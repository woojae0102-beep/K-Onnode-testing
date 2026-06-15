const { getAdmin } = require('../../../api/_lib/firebaseAdmin');

function json(res, code, body) {
  return res.status(code).json(body);
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return {};
}

async function verifyUser(idToken) {
  const { admin, error } = getAdmin();
  if (!admin) throw new Error(error || 'Firebase Admin 초기화 실패');
  if (!idToken) throw new Error('idToken이 필요합니다.');
  const decoded = await admin.auth().verifyIdToken(idToken);
  return { admin, uid: decoded.uid };
}

async function getAccount(admin, uid, platform) {
  const doc = await admin.firestore().collection('users').doc(uid).collection('social_accounts').doc(platform).get();
  if (!doc.exists || !doc.data()?.connected) throw new Error(`${platform} 계정이 연동되어 있지 않습니다.`);
  return { ...doc.data(), _ref: doc.ref };
}

async function fetchVideoBuffer(videoUrl) {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error('Firebase Storage 영상 다운로드에 실패했습니다.');
  return Buffer.from(await res.arrayBuffer());
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean) : [];
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

function shouldRefreshAccessToken(account, skewMs = 10 * 60 * 1000) {
  const expiresAt = timestampMillis(account.expiresAt);
  return !account.accessToken || !expiresAt || expiresAt - Date.now() <= skewMs;
}

async function refreshTikTokAccount(admin, account) {
  const clientKey = process.env.VITE_TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = account.refreshToken;
  if (!clientKey || !clientSecret) throw new Error('TikTok OAuth 환경 변수가 필요합니다.');
  if (!refreshToken) throw new Error('TikTok refresh token이 없습니다. 다시 연동해주세요.');

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error?.message || data.error || 'TikTok 토큰 갱신 실패');
  }

  const expiresIn = Number(data.expires_in || 0) || 24 * 60 * 60;
  const refreshExpiresIn = Number(data.refresh_expires_in || 0) || null;
  const update = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn,
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expiresIn * 1000),
    tokenRefreshStatus: 'success',
    tokenRefreshError: '',
    lastTokenRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (refreshExpiresIn) {
    update.refreshExpiresIn = refreshExpiresIn;
    update.refreshExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + refreshExpiresIn * 1000);
  }
  await account._ref.set(update, { merge: true });
  return { ...account, ...update, accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken };
}

async function ensureTikTokAccessToken(admin, account) {
  if (!shouldRefreshAccessToken(account)) return account;
  try {
    return await refreshTikTokAccount(admin, account);
  } catch (err) {
    await account._ref.set({
      tokenRefreshStatus: 'failed',
      tokenRefreshError: err.message || String(err),
      lastTokenRefreshAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    throw err;
  }
}

async function uploadYouTube(account, payload) {
  const accessToken = account.accessToken;
  if (!accessToken) throw new Error('YouTube access token이 없습니다.');
  const buffer = await fetchVideoBuffer(payload.videoUrl);
  const tags = normalizeTags(payload.tags);
  const metadata = {
    snippet: {
      title: String(payload.title || 'ONNODE Shorts').slice(0, 100),
      description: `${payload.caption || ''}\n\n#Shorts ${tags.map((t) => `#${t}`).join(' ')}`.trim(),
      tags: ['Shorts', 'ONNODE', ...tags].slice(0, 30),
      categoryId: '24',
    },
    status: {
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
  };
  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(buffer.length),
    },
    body: JSON.stringify(metadata),
  });
  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`YouTube 업로드 세션 생성 실패: ${err}`);
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube resumable upload URL이 없습니다.');
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });
  const data = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) throw new Error(data.error?.message || 'YouTube 영상 업로드 실패');
  return {
    platform: 'youtube',
    id: data.id,
    url: data.id ? `https://youtube.com/shorts/${data.id}` : '',
  };
}

async function uploadInstagram(account, payload) {
  const accessToken = account.pageAccessToken || account.accessToken;
  const igUserId = account.accountId;
  if (!accessToken || !igUserId) throw new Error('Instagram Business 계정 또는 토큰이 없습니다.');
  const caption = `${payload.caption || ''}\n${normalizeTags(payload.tags).map((t) => `#${t}`).join(' ')}`.trim();
  const createRes = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'REELS',
      video_url: payload.videoUrl,
      caption,
      access_token: accessToken,
    }).toString(),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created.error?.message || 'Instagram 릴스 컨테이너 생성 실패');

  const creationId = created.id;
  let ready = false;
  for (let i = 0; i < 12; i += 1) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(`https://graph.facebook.com/v18.0/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`);
    const status = await statusRes.json().catch(() => ({}));
    if (status.status_code === 'FINISHED') {
      ready = true;
      break;
    }
    if (status.status_code === 'ERROR') throw new Error('Instagram 릴스 처리 중 오류가 발생했습니다.');
  }
  if (!ready) throw new Error('Instagram 릴스 처리 시간이 초과되었습니다.');

  const publishRes = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    }).toString(),
  });
  const published = await publishRes.json();
  if (!publishRes.ok) throw new Error(published.error?.message || 'Instagram 릴스 게시 실패');
  return { platform: 'instagram', id: published.id, url: published.id ? `https://www.instagram.com/reel/${published.id}` : '' };
}

async function uploadTikTok(account, payload) {
  const accessToken = account.accessToken;
  if (!accessToken) throw new Error('TikTok access token이 없습니다.');
  const buffer = await fetchVideoBuffer(payload.videoUrl);
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: `${payload.caption || 'ONNODE Shorts'} ${normalizeTags(payload.tags).map((t) => `#${t}`).join(' ')}`.slice(0, 2200),
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: buffer.length,
        chunk_size: buffer.length,
        total_chunk_count: 1,
      },
    }),
  });
  const init = await initRes.json();
  if (!initRes.ok || init.error?.code !== 'ok') throw new Error(init.error?.message || 'TikTok 업로드 초기화 실패');
  const uploadUrl = init.data?.upload_url;
  const publishId = init.data?.publish_id;
  if (!uploadUrl) throw new Error('TikTok upload_url이 없습니다.');
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${buffer.length - 1}/${buffer.length}`,
    },
    body: buffer,
  });
  if (!uploadRes.ok) throw new Error(`TikTok chunk upload 실패: ${await uploadRes.text()}`);
  return { platform: 'tiktok', id: publishId, url: '', status: 'processing' };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
    const body = await readJson(req);
    const { admin, uid } = await verifyUser(body.idToken);
    const platform = body.platform;
    if (!['youtube', 'instagram', 'tiktok'].includes(platform)) {
      return json(res, 400, { error: '지원하지 않는 플랫폼입니다.' });
    }
    if (!body.videoUrl) return json(res, 400, { error: 'videoUrl이 필요합니다.' });
    let account = await getAccount(admin, uid, platform);
    if (platform === 'tiktok') {
      account = await ensureTikTokAccessToken(admin, account);
    }
    let result;
    if (platform === 'youtube') result = await uploadYouTube(account, body);
    if (platform === 'instagram') result = await uploadInstagram(account, body);
    if (platform === 'tiktok') result = await uploadTikTok(account, body);

    await admin.firestore().collection('users').doc(uid).collection('shorts_uploads').add({
      platform,
      storagePath: body.storagePath || '',
      videoUrl: body.videoUrl,
      caption: body.caption || '',
      tags: normalizeTags(body.tags),
      trackType: body.trackType || '',
      result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return json(res, 200, { ok: true, ...result });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
};
