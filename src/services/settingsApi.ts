async function request(url: string, options: globalThis.RequestInit = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${url} failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getSubscription() {
  return request('/api/user/subscription');
}

export async function upgradeSubscription(payload: Record<string, unknown>) {
  return request('/api/subscription/upgrade', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function cancelSubscription() {
  return request('/api/subscription', { method: 'DELETE' });
}

export async function getSNSConnections() {
  return request('/api/user/sns-connections');
}

export async function saveSNSConnection(payload: Record<string, unknown>) {
  return request('/api/user/sns-connections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function disconnectSNS(platform: string) {
  return request(`/api/user/sns-connections/${encodeURIComponent(platform)}`, { method: 'DELETE' });
}

export async function patchUserSettings(payload: Record<string, unknown>) {
  return request('/api/user/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function generateCoachPlan(payload: Record<string, unknown>) {
  return request('/api/coach/generate-plan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
