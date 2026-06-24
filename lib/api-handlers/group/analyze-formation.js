const GROUP_FORMATIONS = {
  blackpink: {
    memberCount: 4,
    members: [
      { id: 'jennie', defaultX: 0.5, defaultY: 0.3 },
      { id: 'lisa', defaultX: 0.75, defaultY: 0.5 },
      { id: 'rose', defaultX: 0.25, defaultY: 0.5 },
      { id: 'jisoo', defaultX: 0.5, defaultY: 0.7 },
    ],
  },
  ive: {
    memberCount: 6,
    members: [
      { id: 'yujin', defaultX: 0.2, defaultY: 0.5 },
      { id: 'gaeul', defaultX: 0.35, defaultY: 0.4 },
      { id: 'rei', defaultX: 0.5, defaultY: 0.5 },
      { id: 'wonyoung', defaultX: 0.65, defaultY: 0.4 },
      { id: 'liz', defaultX: 0.8, defaultY: 0.5 },
      { id: 'leeseo', defaultX: 0.5, defaultY: 0.7 },
    ],
  },
  aespa: {
    memberCount: 4,
    members: [
      { id: 'karina', defaultX: 0.5, defaultY: 0.3 },
      { id: 'giselle', defaultX: 0.75, defaultY: 0.5 },
      { id: 'winter', defaultX: 0.25, defaultY: 0.5 },
      { id: 'ningning', defaultX: 0.5, defaultY: 0.7 },
    ],
  },
  newjeans: {
    memberCount: 5,
    members: [
      { id: 'minji', defaultX: 0.2, defaultY: 0.5 },
      { id: 'hanni', defaultX: 0.35, defaultY: 0.4 },
      { id: 'danielle', defaultX: 0.5, defaultY: 0.5 },
      { id: 'haerin', defaultX: 0.65, defaultY: 0.4 },
      { id: 'hyein', defaultX: 0.8, defaultY: 0.5 },
    ],
  },
  twice: {
    memberCount: 9,
    members: [
      { id: 'nayeon', defaultX: 0.15, defaultY: 0.5 },
      { id: 'jeongyeon', defaultX: 0.25, defaultY: 0.4 },
      { id: 'momo', defaultX: 0.35, defaultY: 0.5 },
      { id: 'sana', defaultX: 0.45, defaultY: 0.4 },
      { id: 'jihyo', defaultX: 0.55, defaultY: 0.5 },
      { id: 'mina', defaultX: 0.65, defaultY: 0.4 },
      { id: 'dahyun', defaultX: 0.75, defaultY: 0.5 },
      { id: 'chaeyoung', defaultX: 0.85, defaultY: 0.4 },
      { id: 'tzuyu', defaultX: 0.5, defaultY: 0.7 },
    ],
  },
  bts: {
    memberCount: 7,
    members: [
      { id: 'rm', defaultX: 0.5, defaultY: 0.25 },
      { id: 'jin', defaultX: 0.2, defaultY: 0.5 },
      { id: 'suga', defaultX: 0.35, defaultY: 0.45 },
      { id: 'jhope', defaultX: 0.65, defaultY: 0.45 },
      { id: 'jimin', defaultX: 0.8, defaultY: 0.5 },
      { id: 'v', defaultX: 0.4, defaultY: 0.65 },
      { id: 'jk', defaultX: 0.6, defaultY: 0.65 },
    ],
  },
  itzy: {
    memberCount: 5,
    members: [
      { id: 'yeji', defaultX: 0.5, defaultY: 0.3 },
      { id: 'lia', defaultX: 0.25, defaultY: 0.5 },
      { id: 'ryujin', defaultX: 0.75, defaultY: 0.5 },
      { id: 'chaeryeong', defaultX: 0.35, defaultY: 0.7 },
      { id: 'yuna', defaultX: 0.65, defaultY: 0.7 },
    ],
  },
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function dist2(a, b) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}

/** 트랙 위치와 멤버 기본 포지션 거리 기반 greedy 매칭 */
function suggestFormation(groupId, myMemberId, tracks) {
  const group = GROUP_FORMATIONS[groupId];
  if (!group || !Array.isArray(tracks) || !tracks.length) {
    return { suggestions: {}, method: 'none' };
  }

  const aiMembers = group.members.filter((m) => m.id !== myMemberId);
  const suggestions = {};
  const usedMembers = new Set();

  const sortedTracks = [...tracks].sort((a, b) => a.x - b.x);

  sortedTracks.forEach((track) => {
    let bestMember = null;
    let bestDist = Infinity;

    aiMembers.forEach((member) => {
      if (usedMembers.has(member.id)) return;
      const d = dist2(track, member);
      if (d < bestDist) {
        bestDist = d;
        bestMember = member;
      }
    });

    if (bestMember) {
      suggestions[track.trackId] = bestMember.id;
      usedMembers.add(bestMember.id);
    }
  });

  return {
    suggestions,
    method: 'spatial-greedy',
    detectedTrackCount: tracks.length,
    expectedMemberCount: group.memberCount,
    aiMemberCount: aiMembers.length,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const { groupId, myMemberId, tracks = [] } = body;

  if (!groupId) {
    return res.status(400).json({ error: 'groupId required' });
  }

  const result = suggestFormation(groupId, myMemberId, tracks);
  const group = GROUP_FORMATIONS[groupId];

  return res.json({
    ok: true,
    groupId,
    myMemberId: myMemberId || null,
    memberCount: group?.memberCount || 0,
    countMismatch: group ? tracks.length !== group.memberCount : false,
    ...result,
  });
};
