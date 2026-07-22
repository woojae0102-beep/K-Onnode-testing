/**
 * GX10 Production Motion REST client (PHASE 15).
 *
 * Real fetch-based client — retry, timeout, cancel via AbortSignal.
 */
const { PATHS, normalizeSubmitResponse, normalizeStatusResponse, normalizeJobResult } = require('./gx10RestApiContract.cjs');

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND']);

class GX10RestClientError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = 'GX10RestClientError';
    this.code = code;
    this.meta = meta;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeSignals(signals) {
  const active = signals.filter(Boolean);
  if (!active.length) return undefined;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

function createTimeoutSignal(timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new GX10RestClientError('GX10_REQUEST_TIMEOUT', `request timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

class GX10RestClient {
  constructor(config = {}) {
    this.apiUrl = String(config.apiUrl || '').replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
    this.defaultTimeoutMs = Number(config.defaultTimeoutMs || process.env.GX10_API_TIMEOUT_MS || 30000);
    this.maxRetries = Number(config.maxRetries ?? process.env.GX10_API_MAX_RETRIES ?? 3);
    this.retryBaseDelayMs = Number(config.retryBaseDelayMs ?? process.env.GX10_API_RETRY_DELAY_MS ?? 1000);
    this.pollIntervalMs = Number(config.pollIntervalMs ?? process.env.GX10_POLL_INTERVAL_MS ?? 2000);
    this.pollTimeoutMs = Number(config.pollTimeoutMs ?? process.env.GX10_POLL_TIMEOUT_MS ?? 600000);
    this.jobAbortControllers = new Map();
  }

  isConfigured() {
    return Boolean(this.apiUrl && this.apiKey);
  }

  buildUrl(path) {
    if (!this.apiUrl) throw new GX10RestClientError('GX10_API_NOT_CONFIGURED', 'GX10_API_URL not configured');
    return `${this.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  buildHeaders(extra = {}) {
    const headers = { Accept: 'application/json', ...extra };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async fetchWithRetry(path, options = {}, retryOptions = {}) {
    const maxRetries = retryOptions.maxRetries ?? this.maxRetries;
    const timeoutMs = retryOptions.timeoutMs ?? this.defaultTimeoutMs;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const { signal: timeoutSignal, cancel: cancelTimeout } = createTimeoutSignal(timeoutMs);
      const signal = mergeSignals([options.signal, timeoutSignal]);
      try {
        const res = await fetch(this.buildUrl(path), {
          ...options,
          signal,
          headers: this.buildHeaders(options.headers),
        });
        cancelTimeout();

        if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
          await sleep(this.retryBaseDelayMs * (attempt + 1));
          continue;
        }

        return res;
      } catch (err) {
        cancelTimeout();
        lastError = err;
        const code = err?.cause?.code || err?.code;
        const isAbort = err?.name === 'AbortError';
        if (isAbort) {
          if (err instanceof GX10RestClientError && err.code === 'GX10_REQUEST_TIMEOUT') {
            throw err;
          }
          throw new GX10RestClientError('GX10_REQUEST_ABORTED', err?.message || 'request aborted', { path });
        }
        const retryable = RETRYABLE_CODES.has(code) || /network|fetch failed/i.test(String(err?.message));
        if (retryable && attempt < maxRetries) {
          await sleep(this.retryBaseDelayMs * (attempt + 1));
          continue;
        }
        throw new GX10RestClientError('GX10_NETWORK_FAILURE', err?.message || String(err), { path, code });
      }
    }

    throw lastError || new GX10RestClientError('GX10_NETWORK_FAILURE', 'request failed after retries', { path });
  }

  async probeHealth() {
    const res = await this.fetchWithRetry(PATHS.health, { method: 'GET' }, { maxRetries: 1 });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new GX10RestClientError('GX10_HEALTH_CHECK_FAILED', data.message || data.error || res.statusText, { status: res.status });
    }
    return { ok: true, ...data };
  }

  async submitJob(input, options = {}) {
    const form = new FormData();
    form.append('groupId', input.groupId);
    form.append('songId', input.songId);
    form.append('productionAssetId', input.productionAssetId);
    form.append('fps', String(input.fps || 30));
    form.append('memberMapping', JSON.stringify(input.memberMapping || []));
    if (input.sourceVideoMetadata) {
      form.append('sourceVideoMetadata', JSON.stringify(input.sourceVideoMetadata));
    }
    if (input.markAsRealProduction) {
      form.append('markAsRealProduction', 'true');
    }
    if (input.videoBuffer?.length) {
      form.append('video', new Blob([input.videoBuffer]), input.videoFilename || 'upload.mp4');
    }

    const res = await this.fetchWithRetry(PATHS.jobs, {
      method: 'POST',
      body: form,
      signal: options.signal,
    }, { timeoutMs: options.timeoutMs });

    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      throw new GX10RestClientError('GX10_AUTH_FAILED', data.message || data.error || 'GX10 auth failed');
    }
    if (!res.ok) {
      throw new GX10RestClientError('GX10_JOB_SUBMIT_FAILED', data.message || data.error || res.statusText, { status: res.status });
    }

    const normalized = normalizeSubmitResponse(data);
    if (!normalized) {
      throw new GX10RestClientError('GX10_JOB_SUBMIT_FAILED', 'GX10 API did not return jobId');
    }
    return normalized;
  }

  async getJobStatus(jobId, options = {}) {
    const res = await this.fetchWithRetry(PATHS.job(jobId), {
      method: 'GET',
      signal: options.signal,
    }, { timeoutMs: options.timeoutMs });

    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new GX10RestClientError('GX10_JOB_NOT_FOUND', `job ${jobId} not found`, { jobId });
    }
    if (!res.ok) {
      throw new GX10RestClientError('GX10_JOB_STATUS_FAILED', data.message || data.error || res.statusText, { jobId, status: res.status });
    }

    const normalized = normalizeStatusResponse(data);
    if (!normalized) {
      throw new GX10RestClientError('GX10_JOB_STATUS_FAILED', 'invalid status response', { jobId });
    }
    return normalized;
  }

  createJobAbortController(jobId) {
    const controller = new AbortController();
    this.jobAbortControllers.set(jobId, controller);
    return controller;
  }

  clearJobAbortController(jobId) {
    this.jobAbortControllers.delete(jobId);
  }

  async cancelJob(jobId, options = {}) {
    const controller = this.jobAbortControllers.get(jobId);
    if (controller) controller.abort();

    const res = await this.fetchWithRetry(PATHS.cancel(jobId), {
      method: 'POST',
      signal: options.signal,
    }, { timeoutMs: options.timeoutMs, maxRetries: 1 });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new GX10RestClientError('GX10_JOB_CANCEL_FAILED', data.message || data.error || res.statusText, { jobId });
    }
    this.clearJobAbortController(jobId);
    return normalizeStatusResponse(data) || { jobId, status: 'cancelled' };
  }

  async getJobResult(jobId, options = {}) {
    const res = await this.fetchWithRetry(PATHS.result(jobId), {
      method: 'GET',
      signal: options.signal,
    }, { timeoutMs: options.timeoutMs });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new GX10RestClientError('GX10_JOB_RESULT_FAILED', data.message || data.error || res.statusText, { jobId, status: res.status });
    }

    const result = normalizeJobResult(data);
    if (!result) {
      throw new GX10RestClientError('GX10_JOB_RESULT_FAILED', 'invalid result payload', { jobId });
    }
    return result;
  }

  async downloadMemberMotionGlb(jobId, memberId, options = {}) {
    const res = await this.fetchWithRetry(PATHS.memberMotion(jobId, memberId), {
      method: 'GET',
      headers: { Accept: 'model/gltf-binary' },
      signal: options.signal,
    }, { timeoutMs: options.timeoutMs ?? Math.max(this.defaultTimeoutMs, 120000) });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GX10RestClientError('GX10_MOTION_DOWNLOAD_FAILED', text || res.statusText, { jobId, memberId, status: res.status });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) {
      throw new GX10RestClientError('GX10_MOTION_DOWNLOAD_FAILED', 'empty GLB response', { jobId, memberId });
    }
    return buffer;
  }

  async pollUntilComplete(jobId, options = {}) {
    const pollTimeoutMs = options.pollTimeoutMs ?? this.pollTimeoutMs;
    const pollIntervalMs = options.pollIntervalMs ?? this.pollIntervalMs;
    const deadline = Date.now() + pollTimeoutMs;
    const abortController = this.createJobAbortController(jobId);

    try {
      while (Date.now() < deadline) {
        if (abortController.signal.aborted) {
          throw new GX10RestClientError('GX10_REQUEST_ABORTED', `poll aborted for job ${jobId}`, { jobId });
        }

        const status = await this.getJobStatus(jobId, {
          signal: mergeSignals([options.signal, abortController.signal]),
          timeoutMs: options.statusTimeoutMs,
        });

        if (options.onPoll) {
          await options.onPoll(status);
        }

        if (status.status === 'completed') {
          return status;
        }
        if (status.status === 'failed') {
          throw new GX10RestClientError('GX10_JOB_FAILED', status.message || status.errorCode || 'GX10 job failed', { jobId, status });
        }
        if (status.status === 'cancelled') {
          throw new GX10RestClientError('GX10_JOB_CANCELLED', 'GX10 job cancelled', { jobId, status });
        }

        await sleep(pollIntervalMs);
      }

      throw new GX10RestClientError('GX10_POLL_TIMEOUT', `poll timed out after ${pollTimeoutMs}ms`, { jobId });
    } finally {
      this.clearJobAbortController(jobId);
    }
  }
}

function createGX10RestClientFromEnv() {
  const apiUrl = (process.env.GX10_API_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.GX10_API_KEY || '';
  return new GX10RestClient({ apiUrl, apiKey });
}

module.exports = {
  GX10RestClient,
  GX10RestClientError,
  createGX10RestClientFromEnv,
  createTimeoutSignal,
  mergeSignals,
  sleep,
};
