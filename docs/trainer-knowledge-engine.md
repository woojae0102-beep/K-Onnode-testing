# Trainer Knowledge Engine

ONNODE의 AI 코칭은 이제 단순 LLM 답변이 아니라 Trainer Knowledge Base를 검색한 뒤 피드백을 생성하는 RAG 구조를 사용합니다.

## 흐름

1. 매일 YouTube Data API v3로 KPOP vocal/dance/audition/pronunciation training 영상을 검색합니다.
2. 영상/오디오 직접 다운로드 없이 제목, 설명, 자막 존재 여부와 언어 메타데이터만 저장합니다.
3. 제공된 transcript 또는 영상 description/title을 기반으로 GPT/Claude가 트레이닝 지식을 추출합니다.
4. 추출된 지식은 Firestore `trainer_knowledge_chunks`에 저장됩니다.
5. Pinecone 또는 Supabase Vector 설정이 있으면 embedding과 함께 upsert됩니다.
6. 코칭 API는 사용자의 연습 결과를 query로 변환해 관련 지식을 검색합니다.
7. AI 코치는 검색된 지식과 트레이너 페르소나 기준을 근거로 "왜/어떻게/오늘 연습" 형식의 피드백을 생성합니다.

## 주요 파일

- `lib/trainer-knowledge/engine.js`
- `api/knowledge.js`
- `api/cron/collect-trainer-knowledge.js`
- `scripts/trainer-knowledge-scheduler.cjs`

## 환경변수

필수:

```env
YOUTUBE_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

선택:

```env
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
PINECONE_API_KEY=
PINECONE_INDEX_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TRAINER_KNOWLEDGE_DAILY_MAX_RESULTS=3
CRON_SECRET=
SCHEDULER_BASE_URL=http://localhost:5173
```

Pinecone 또는 Supabase Vector가 없어도 Firestore lexical fallback으로 동작합니다.

저작권 안전 원칙상 YouTube 영상/오디오 직접 다운로드는 하지 않습니다. Whisper 전사는 사용자가 직접 업로드했거나 권리가 확인된 오디오 URL을 `api/knowledge/process-transcript`에 전달할 때만 사용합니다.

## 수동 실행

앱 서버를 먼저 켭니다.

```bash
npm run dev
```

수동 수집:

```bash
npm run collect:knowledge
```

상시 Node 서버에서 매일 자동 수집:

```bash
npm run scheduler:knowledge
```

Vercel 배포에서는 `vercel.json`의 `/api/cron/collect-trainer-knowledge` cron이 매일 `02:30`에 실행됩니다.

## Supabase Vector 예시

Supabase를 사용할 경우 `pgvector`를 켜고 아래와 비슷한 테이블/RPC를 준비합니다.

```sql
create extension if not exists vector;

create table if not exists trainer_knowledge (
  id text primary key,
  title text,
  domain text,
  skill text,
  content text,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamptz default now()
);

create or replace function match_trainer_knowledge(
  query_embedding vector(1536),
  match_count int,
  filter_domain text
)
returns table (
  id text,
  title text,
  domain text,
  skill text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    trainer_knowledge.id,
    trainer_knowledge.title,
    trainer_knowledge.domain,
    trainer_knowledge.skill,
    trainer_knowledge.content,
    trainer_knowledge.metadata,
    1 - (trainer_knowledge.embedding <=> query_embedding) as similarity
  from trainer_knowledge
  where filter_domain is null or trainer_knowledge.domain = filter_domain
  order by trainer_knowledge.embedding <=> query_embedding
  limit match_count;
$$;
```

## 페르소나

현재 내장 페르소나:

- `liaKim`
- `kpopVocalMaster`
- `yg`
- `jyp`
- `starship`

각 페르소나는 평가 기준, 말투, 피드백 방식, 우선순위를 별도로 가지고 있습니다.
