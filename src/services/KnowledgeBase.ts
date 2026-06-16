// @ts-nocheck
export type KnowledgeTopic = 'dance' | 'vocal' | 'korean' | 'audition';

export interface KnowledgeEntry {
  id?: string;
  topic: KnowledgeTopic;
  tags: string[];
  content: string;
  source?: string;
  createdAt?: unknown;
  isActive?: boolean;
}

async function postKnowledge(action: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`/api/knowledge/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `${action} 요청에 실패했습니다.`);
  }
  return data;
}

export class KnowledgeBase {
  private cache = new Map<string, KnowledgeEntry[]>();

  async search(topic: KnowledgeTopic, query: string, topK = 10): Promise<KnowledgeEntry[]> {
    const cacheKey = `${topic}:${query}:${topK}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) || [];
    const data = await postKnowledge('search', {
      query,
      domain: topic,
      topK,
    });
    const rows = (data.results || []).map((row: any) => ({
      id: row.id,
      topic: row.domain || topic,
      tags: [row.skill].filter(Boolean),
      content: row.text || row.content || row.trainerCue || row.title || '',
      source: data.source,
      isActive: true,
    }));
    this.cache.set(cacheKey, rows);
    return rows;
  }

  async loadRecent(topic: KnowledgeTopic, topK = 50): Promise<KnowledgeEntry[]> {
    return this.search(topic, topic, topK);
  }

  async buildFromText(params: {
    topic: KnowledgeTopic;
    transcript?: string;
    text?: string;
    audioUrl?: string;
    metadata?: Record<string, unknown>;
    idPrefix?: string;
  }) {
    return postKnowledge('process-transcript', {
      domain: params.topic,
      transcript: params.transcript,
      text: params.text,
      audioUrl: params.audioUrl,
      metadata: params.metadata,
      idPrefix: params.idPrefix,
    });
  }

  async collectYouTubeMetadata(params: {
    query: string;
    topic?: KnowledgeTopic;
    maxResults?: number;
  }) {
    return postKnowledge('collect-metadata', {
      query: params.query,
      domain: params.topic,
      maxResults: params.maxResults,
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

export const trainerKnowledgeBase = new KnowledgeBase();
export default KnowledgeBase;
