/**
 * GX10 Production Motion REST API contract (PHASE 15).
 *
 * K-ONNODE server ↔ GX10 workstation service endpoints.
 * Base URL: GX10_API_URL (e.g. http://192.168.1.50:8787/v1)
 */
const GX10_OUTPUT_CONTRACT_VERSION = 1;

const PATHS = {
  health: '/health',
  jobs: '/production-motion/jobs',
  job: (jobId) => `/production-motion/jobs/${encodeURIComponent(jobId)}`,
  cancel: (jobId) => `/production-motion/jobs/${encodeURIComponent(jobId)}/cancel`,
  result: (jobId) => `/production-motion/jobs/${encodeURIComponent(jobId)}/result`,
  memberMotion: (jobId, memberId) => `/production-motion/jobs/${encodeURIComponent(jobId)}/members/${encodeURIComponent(memberId)}/motion.glb`,
};

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function normalizeJobStatus(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'processing';
  if (value === 'complete' || value === 'completed' || value === 'succeeded' || value === 'success') {
    return 'completed';
  }
  if (value === 'failed' || value === 'error') return 'failed';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'queued' || value === 'pending') return 'queued';
  return 'processing';
}

function normalizeSubmitResponse(data) {
  const jobId = data?.jobId || data?.id || data?.job_id;
  if (!jobId) return null;
  return {
    jobId: String(jobId),
    status: normalizeJobStatus(data.status || 'queued'),
    productionAssetId: data.productionAssetId || data.production_asset_id || null,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
  };
}

function normalizeStatusResponse(data) {
  const jobId = data?.jobId || data?.id || data?.job_id;
  if (!jobId) return null;
  return {
    jobId: String(jobId),
    status: normalizeJobStatus(data.status || data.state),
    productionAssetId: data.productionAssetId || data.production_asset_id || null,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    errorCode: data.errorCode || data.error_code || data.error,
    message: data.message || data.detail,
    updatedAt: data.updatedAt || data.updated_at || new Date().toISOString(),
  };
}

function normalizeJobResult(data) {
  if (!data || typeof data !== 'object') return null;
  const contract = data.result || data.jobOutput || data;
  if (contract.contractVersion != null || contract.jobId) {
    return contract;
  }
  return null;
}

module.exports = {
  GX10_OUTPUT_CONTRACT_VERSION,
  PATHS,
  TERMINAL_STATUSES,
  normalizeJobStatus,
  normalizeSubmitResponse,
  normalizeStatusResponse,
  normalizeJobResult,
};
