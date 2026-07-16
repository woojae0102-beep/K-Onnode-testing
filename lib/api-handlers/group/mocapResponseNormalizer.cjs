/**
 * 외부 MoCap API 응답 → AnalysisResult 정규화.
 * 지원 형식:
 * 1) { analysisResult: {...} } — K-Onnode 네이티브
 * 2) { frames: [{ timestamp, members: [{ memberId, joints }] }] } — Choreography 스타일
 * 3) { tracks: [{ trackId, frames: [...] }] } — 트랙 기반
 */

function toJointMap(joints) {
  if (!joints || typeof joints !== 'object') return {};
  return Object.fromEntries(
    Object.entries(joints).map(([name, j]) => [
      name,
      {
        x: Number(j.x ?? 0),
        y: Number(j.y ?? 0),
        z: Number(j.z ?? 0),
        visibility: Number(j.visibility ?? j.confidence ?? 1),
        confidence: Number(j.confidence ?? j.visibility ?? 1),
      },
    ]),
  );
}

function serializeTrackMap(trackMap) {
  if (!trackMap) return {};
  if (trackMap instanceof Map) {
    return Object.fromEntries(
      [...trackMap.entries()].map(([k, v]) => [String(k), v]),
    );
  }
  return trackMap;
}

function fromChoreographyFrames(data, groupId, songId) {
  const frames = Array.isArray(data.frames) ? data.frames : [];
  const members = Array.isArray(data.members) ? data.members : [];
  const memberIds = members.map((m) => m.memberId).filter(Boolean);
  const trackIdByMember = new Map(memberIds.map((id, i) => [id, i + 1]));

  const detectionFrames = frames.map((frame, idx) => {
    const timestamp = Number(frame.timestamp ?? idx / 30);
    const detectedPeople = (frame.members || []).map((m) => {
      const memberId = m.memberId || m.estimatedMemberId;
      const trackId = trackIdByMember.get(memberId) || 1;
      const joints = toJointMap(m.joints);
      return {
        trackId,
        joints,
        worldJoints: joints,
        lastSeenTimestamp: timestamp,
        confidence: 1,
        isEstimated: Boolean(m.isEstimated),
      };
    });
    return {
      timestamp,
      timestampMs: Math.round(timestamp * 1000),
      sourceVideoTime: timestamp,
      videoWidth: data.videoWidth || 1920,
      videoHeight: data.videoHeight || 1080,
      detectedPeople,
    };
  });

  const trackIdToInitialPosition = {};
  const first = detectionFrames[0];
  if (first) {
    first.detectedPeople.forEach((p) => {
      const hip = p.joints.left_hip || p.joints.right_hip || p.joints.nose;
      if (hip) trackIdToInitialPosition[p.trackId] = { x: hip.x, y: hip.y };
    });
  }

  const durationSec = Number(
    data.durationSec
    || data.meta?.durationSec
    || detectionFrames[detectionFrames.length - 1]?.timestamp
    || 0,
  );

  return {
    analysisResult: {
      detectedMemberCount: memberIds.length || first?.detectedPeople?.length || 0,
      peakTrackCount: memberIds.length || first?.detectedPeople?.length || 0,
      groupMemberCount: memberIds.length,
      frames: detectionFrames,
      trackIdToInitialPosition,
      videoWidth: data.videoWidth || 1920,
      videoHeight: data.videoHeight || 1080,
      sourceVideoDurationSec: durationSec,
      sampleFps: Number(data.sampleFps || data.meta?.fps || 30),
      groupId,
      songId,
    },
    providerLabel: data.providerLabel || 'MoCap API',
  };
}

function fromTrackPayload(data, groupId, songId) {
  const tracks = Array.isArray(data.tracks) ? data.tracks : [];
  const byTime = new Map();

  tracks.forEach((track) => {
    const trackId = Number(track.trackId ?? track.id ?? 1);
    (track.frames || []).forEach((frame) => {
      const t = Number(frame.timestamp ?? frame.time ?? 0);
      if (!byTime.has(t)) byTime.set(t, []);
      byTime.get(t).push({
        trackId,
        joints: toJointMap(frame.joints),
        worldJoints: toJointMap(frame.joints),
        lastSeenTimestamp: t,
        confidence: 1,
      });
    });
  });

  const detectionFrames = [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, people]) => ({
      timestamp,
      timestampMs: Math.round(timestamp * 1000),
      sourceVideoTime: timestamp,
      detectedPeople: people,
    }));

  const trackIdToInitialPosition = {};
  const first = detectionFrames[0];
  if (first) {
    first.detectedPeople.forEach((p) => {
      const hip = p.joints.left_hip || p.joints.right_hip || p.joints.nose;
      if (hip) trackIdToInitialPosition[p.trackId] = { x: hip.x, y: hip.y };
    });
  }

  return {
    analysisResult: {
      detectedMemberCount: tracks.length,
      peakTrackCount: tracks.length,
      frames: detectionFrames,
      trackIdToInitialPosition,
      sourceVideoDurationSec: detectionFrames[detectionFrames.length - 1]?.timestamp || 0,
      sampleFps: Number(data.sampleFps || 30),
      groupId,
      songId,
    },
    providerLabel: data.providerLabel || 'MoCap API',
  };
}

function normalizeAnalysisResult(raw, groupId, songId) {
  const ar = raw.analysisResult || raw;
  if (!ar?.frames?.length) return null;

  const frames = ar.frames.map((frame, idx) => {
    const timestamp = Number(frame.timestamp ?? frame.sourceVideoTime ?? idx / 30);
    const people = frame.detectedPeople || frame.members || [];
    const detectedPeople = people.map((p, pIdx) => {
      const trackId = Number(p.trackId ?? pIdx + 1);
      const joints = toJointMap(p.joints);
      return {
        trackId,
        joints,
        worldJoints: p.worldJoints ? toJointMap(p.worldJoints) : joints,
        lastSeenTimestamp: timestamp,
        confidence: Number(p.confidence ?? 1),
        isEstimated: Boolean(p.isEstimated),
      };
    });
    return {
      timestamp,
      timestampMs: frame.timestampMs ?? Math.round(timestamp * 1000),
      sourceVideoTime: frame.sourceVideoTime ?? timestamp,
      videoWidth: frame.videoWidth || ar.videoWidth || 1920,
      videoHeight: frame.videoHeight || ar.videoHeight || 1080,
      detectedPeople,
    };
  });

  const trackMap = serializeTrackMap(ar.trackIdToInitialPosition);
  const trackIdToInitialPosition = Object.fromEntries(
    Object.entries(trackMap).map(([k, v]) => [k, { x: v.x, y: v.y }]),
  );

  return {
    analysisResult: {
      ...ar,
      frames,
      trackIdToInitialPosition,
      groupId: ar.groupId || groupId,
      songId: ar.songId || songId,
    },
    providerLabel: raw.providerLabel || 'MoCap API',
  };
}

function normalizeMocapResponse(raw, { groupId, songId }) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('mocap_empty_response');
  }

  if (raw.analysisResult?.frames?.length) {
    const normalized = normalizeAnalysisResult(raw, groupId, songId);
    if (normalized) return normalized;
  }

  if (Array.isArray(raw.frames) && raw.frames[0]?.members) {
    return fromChoreographyFrames(raw, groupId, songId);
  }

  if (Array.isArray(raw.tracks)) {
    return fromTrackPayload(raw, groupId, songId);
  }

  if (Array.isArray(raw.frames) && raw.frames[0]?.detectedPeople) {
    const normalized = normalizeAnalysisResult({ analysisResult: raw }, groupId, songId);
    if (normalized) return normalized;
  }

  throw new Error('mocap_unrecognized_format');
}

module.exports = { normalizeMocapResponse, toJointMap };
