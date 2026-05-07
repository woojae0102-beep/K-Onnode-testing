/** 심사위원 발화자 문자열 ↔ agency judges[].id 매핑 (TTS) */
export function resolveJudgeIdForCue(
  agencyId: string,
  judges: { id: string; name: string }[],
  speaker: string,
): string {
  if (!judges?.length) return `${agencyId}-anon`;
  const s = String(speaker || '').toLowerCase().replace(/\s/g, '');
  if (/david|davidlim/.test(s)) {
    const d = judges.find((j) => /david/i.test(j.name) || /david/i.test(j.id));
    if (d) return d.id;
  }
  if (/marcus|marcuskim/.test(s)) {
    const m = judges.find((j) => /marcus/i.test(j.name) || /marcus/i.test(j.id));
    if (m) return m.id;
  }
  const flat = speaker.replace(/\s/g, '');
  for (let i = 0; i < judges.length; i += 1) {
    const nm = judges[i].name.replace(/\s/g, '');
    const head = nm.slice(0, 2);
    if (speaker.includes(judges[i].name)) return judges[i].id;
    if (head && flat.includes(nm)) return judges[i].id;
    if (head && s.includes(nm.toLowerCase())) return judges[i].id;
  }
  return judges[0].id;
}

export type ApplicantProfile = {
  age?: number | null;
  appliedField?: 'vocal' | 'dance' | 'total';
  practiceYears?: number | null;
  selfIntroKeywords?: string[];
};

export type GeneratedQuestionPack = {
  phaseQuestions?: {
    phase0_followup?: string;
    phase1_interruption_hint?: string;
    phase2_mission?: string;
    phase3_main?: string[];
    phase3_followup?: string[];
    phase4_final?: string;
  };
  generationBasis?: Record<string, string | null>;
  randomSeed?: string;
};

export type FlowCue = Record<string, any>;

export async function fetchGeneratedQuestions(payload: Record<string, any>): Promise<GeneratedQuestionPack> {
  const res = await fetch('/api/audition/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('generate-questions failed');
  return res.json();
}

export async function fetchAgencyFlow(agencyId: string, body: Record<string, any>): Promise<{
  cues: FlowCue[];
  phase?: number;
  source?: string;
  advance?: { nextPhaseSuggested?: number; hint?: string };
}> {
  const res = await fetch(`/api/audition/${agencyId}/flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agencyId, ...body }),
  });
  if (!res.ok) throw new Error(`${agencyId} flow failed`);
  return res.json();
}
