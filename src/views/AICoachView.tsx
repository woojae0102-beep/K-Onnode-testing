// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DanceTrainingView from './DanceTrainingView';
import VocalTrainingView from './VocalTrainingView';
import PronunciationMode from '../components/korean/PronunciationMode';
import FollowAlongMode from '../components/korean/FollowAlongMode';
import CorrectionMode from '../components/korean/CorrectionMode';
import LyricsVocabMode from '../components/korean/LyricsVocabMode';
import ReportListView from './ReportListView';
import { useLanguageStore } from '../store/languageStore';

const QUICK_COMMANDS = [
  { id: 'dance', label: '/댄스' },
  { id: 'vocal', label: '/보컬' },
  { id: 'korean-pronunciation', label: '/한국어 발음연습' },
  { id: 'korean-follow', label: '/한국어 따라말하기' },
  { id: 'korean-correction', label: '/한국어 ai교정' },
  { id: 'korean-lyrics', label: '/한국어 가사학습' },
  { id: 'report', label: '/오늘 리포트 보여줘' },
  { id: 'trend', label: '/최근 추이 보여줘' },
  { id: 'growth', label: '/성장 리포트 보여줘' },
];
const BOTTOM_TABS = [
  { id: 'chat', label: 'AI코칭', feature: 'none' },
  { id: 'report', label: '리포트', feature: 'report' },
];

const MODE_REPLY = {
  dance: '댄스 연습을 실행합니다. 카메라를 켜고 자세/동작 피드백을 확인해보세요.',
  vocal: '보컬 연습을 실행합니다. 마이크를 켜고 실시간 음정 피드백을 확인해보세요.',
  'korean-pronunciation': '한국어 발음 연습 모드를 실행합니다. 문장을 말하면 실시간 발음 피드백이 나옵니다.',
  'korean-follow': '문장 따라 말하기 모드를 실행합니다. 라인별로 녹음해서 점수를 확인해보세요.',
  'korean-correction': 'AI 발음 교정 모드를 실행합니다. 말한 문장을 기준으로 교정 피드백을 제공합니다.',
  'korean-lyrics': '가사 기반 학습 모드를 실행합니다. 어휘 인식과 문장 일치 점수를 실시간으로 확인하세요.',
  none: '채팅 모드로 복귀했습니다. "댄스", "보컬", "한국어 발음연습"처럼 입력하면 기능을 다시 열 수 있어요.',
};
const MODE_REPLY_EN = {
  dance: 'Launching Dance training. Turn on your camera and check posture/movement feedback.',
  vocal: 'Launching Vocal training. Turn on your mic and check real-time pitch feedback.',
  'korean-pronunciation': 'Launching Korean pronunciation mode. Speak a sentence for live pronunciation feedback.',
  'korean-follow': 'Launching Korean follow-along mode. Record each line and check line-by-line scores.',
  'korean-correction': 'Launching AI pronunciation correction mode. You will get correction feedback from spoken sentences.',
  'korean-lyrics': 'Launching lyrics-based Korean learning mode. Check vocabulary recognition and sentence matching.',
  none: 'Back to chat mode. Type dance/vocal/korean practice to reopen a feature.',
};
const MODE_REPLY_BY_LANG = {
  ko: MODE_REPLY,
  en: MODE_REPLY_EN,
  ja: {
    dance: 'ダンス練習を開始します。カメラをオンにして姿勢/動作フィードバックを確認してください。',
    vocal: 'ボーカル練習を開始します。マイクをオンにしてリアルタイム音程フィードバックを確認してください。',
    'korean-pronunciation': '韓国語の発音練習モードを開始します。文を話すとリアルタイムで発音フィードバックが表示されます。',
    'korean-follow': '文まねモードを開始します。各ラインを録音してスコアを確認してください。',
    'korean-correction': 'AI発音矯正モードを開始します。話した文をもとに矯正フィードバックを提供します。',
    'korean-lyrics': '歌詞ベース学習モードを開始します。語彙認識と文一致スコアをリアルタイムで確認できます。',
    none: 'チャットモードに戻りました。ダンス/ボーカル/韓国語練習と入力すると再開できます。',
  },
  th: {
    dance: 'เริ่มโหมดฝึกเต้น เปิดกล้องแล้วตรวจสอบฟีดแบ็กท่าทาง/การเคลื่อนไหวได้เลย',
    vocal: 'เริ่มโหมดฝึกร้องเพลง เปิดไมค์แล้วดูฟีดแบ็กคีย์แบบเรียลไทม์',
    'korean-pronunciation': 'เริ่มโหมดฝึกออกเสียงเกาหลี พูดประโยคแล้วรับฟีดแบ็กการออกเสียงแบบเรียลไทม์',
    'korean-follow': 'เริ่มโหมดพูดตามประโยค บันทึกทีละบรรทัดแล้วตรวจคะแนนรายบรรทัด',
    'korean-correction': 'เริ่มโหมด AI แก้การออกเสียง ระบบจะวิเคราะห์จากประโยคที่พูดและให้คำแนะนำแก้ไข',
    'korean-lyrics': 'เริ่มโหมดเรียนจากเนื้อเพลง ตรวจการรู้จำคำศัพท์และความตรงของประโยคแบบเรียลไทม์',
    none: 'กลับสู่โหมดแชตแล้ว พิมพ์ dance/vocal/korean เพื่อเปิดโหมดอีกครั้ง',
  },
  vi: {
    dance: 'Bat dau che do luyen nhay. Bat camera de xem phan hoi tu the/chuyen dong.',
    vocal: 'Bat dau che do luyen vocal. Bat micro de xem phan hoi cao do theo thoi gian thuc.',
    'korean-pronunciation': 'Bat dau che do luyen phat am tieng Han. Noi cau va nhan phan hoi phat am theo thoi gian thuc.',
    'korean-follow': 'Bat dau che do noi theo cau. Thu am tung dong va xem diem tung dong.',
    'korean-correction': 'Bat dau che do AI sua phat am. He thong se dua tren cau noi de dua phan hoi sua loi.',
    'korean-lyrics': 'Bat dau che do hoc qua loi bai hat. Kiem tra nhan dien tu vung va do khop cau theo thoi gian thuc.',
    none: 'Da quay lai che do chat. Hay nhap dance/vocal/korean de mo lai che do.',
  },
  es: {
    dance: 'Iniciando entrenamiento de baile. Activa la camara y revisa la retroalimentacion de postura/movimiento.',
    vocal: 'Iniciando entrenamiento vocal. Activa el microfono y revisa la retroalimentacion de tono en tiempo real.',
    'korean-pronunciation': 'Iniciando modo de pronunciacion coreana. Habla una frase para recibir feedback en tiempo real.',
    'korean-follow': 'Iniciando modo de repetir frases. Graba cada linea y revisa la puntuacion por linea.',
    'korean-correction': 'Iniciando modo de correccion de pronunciacion por IA. Recibiras correcciones segun lo que digas.',
    'korean-lyrics': 'Iniciando modo de aprendizaje con letras. Revisa reconocimiento de vocabulario y coincidencia de frases.',
    none: 'Volviste al modo chat. Escribe dance/vocal/korean para abrir un modo de nuevo.',
  },
  fr: {
    dance: "Demarrage de l'entrainement danse. Activez la camera pour verifier le feedback de posture et de mouvement.",
    vocal: "Demarrage de l'entrainement vocal. Activez le micro pour verifier le feedback de justesse en temps reel.",
    'korean-pronunciation': "Demarrage du mode prononciation coreenne. Parlez une phrase pour recevoir un retour en temps reel.",
    'korean-follow': 'Demarrage du mode repetition de phrases. Enregistrez chaque ligne et verifiez le score par ligne.',
    'korean-correction': "Demarrage du mode correction de prononciation IA. Vous recevrez des corrections selon votre phrase.",
    'korean-lyrics': "Demarrage du mode apprentissage base sur les paroles. Verifiez la reconnaissance du vocabulaire et des phrases.",
    none: 'Retour au mode chat. Tapez dance/vocal/korean pour relancer un mode.',
  },
  zh: {
    dance: '正在启动舞蹈训练。请打开摄像头，查看姿态/动作反馈。',
    vocal: '正在启动声乐训练。请打开麦克风，查看实时音准反馈。',
    'korean-pronunciation': '正在启动韩语发音训练模式。说出句子即可获得实时发音反馈。',
    'korean-follow': '正在启动韩语跟读模式。可逐句录音并查看逐句评分。',
    'korean-correction': '正在启动 AI 发音纠正模式。系统会根据你说的内容给出纠正建议。',
    'korean-lyrics': '正在启动歌词学习模式。可实时查看词汇识别与句子匹配分数。',
    none: '已返回聊天模式。输入 dance/vocal/korean 可再次打开训练模式。',
  },
};

function getModeReply(feature, language = 'ko') {
  const lang = normalizeLanguage(language);
  const pack = MODE_REPLY_BY_LANG[lang] || MODE_REPLY_BY_LANG.en;
  return pack[feature] || pack.none;
}
const STORAGE_KEY = 'onnode_growth_sessions_v1';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';
const COACH_TONES = [
  { id: 'friendly', label: '친절형' },
  { id: 'strict', label: '엄격형' },
  { id: 'brief', label: '짧은형' },
];
const SUPPORTED_LANGUAGES = ['ko', 'en', 'th', 'vi', 'ja', 'es', 'fr', 'zh'];
const LANGUAGE_OPTIONS = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
  { id: 'th', label: 'ไทย' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'ja', label: '日本語' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'zh', label: '简体中文' },
];
const UI_TEXT = {
  ko: {
    tabs: { chat: 'AI코칭', dance: '댄스', vocal: '보컬', korean: '한국어', report: '리포트' },
    languageLabel: '언어',
    toneLabel: '코치 스타일',
    tone: { friendly: '친절형', strict: '엄격형', brief: '짧은형' },
    report: {
      periodSummaryTitle: '기간별 요약',
      noDataForPeriod: '선택한 기간의 데이터가 없습니다. 날짜를 바꾸거나 연습 데이터를 더 쌓아보세요.',
      daily: '일간 요약',
      weekly: '주간 요약',
      monthly: '월간 요약',
      avg: '평균',
      best: '최고',
      worst: '최저',
      sessions: '세션',
      totalSessions: '세션',
      trendTitle: '최근 추이',
      trendNeedMore: '최근 추이 데이터를 더 수집하면 변화량을 보여드릴 수 있어요.',
      up: '상승',
      down: '하락',
      growthTitle: '성장 분석 (어제/지난주 대비)',
      growthReportTitle: '성장 리포트',
      noGrowthData: '누적된 연습 기록이 아직 없습니다. 오늘 2~3회 연습하면 성장 리포트가 생성됩니다.',
      noGrowthRoutine: '추천 루틴을 계산하려면 연습 기록을 먼저 2회 이상 쌓아주세요.',
      todayAverage: '오늘 평균 점수',
      compareYesterday: '어제 대비',
      compareLastWeek: '지난주 평균 대비',
      noCompare: '비교 데이터 부족',
      noData: '데이터 없음',
      noDataShort: '데이터 부족',
      goalRate: '목표 달성률',
      weeklyGoalRate: '주간 달성 진행률',
      goalBased: '목표 {{score}}점 기준',
      achievedDays: '최근 7일 중 {{days}}일 목표 달성',
      lowGrowth: '성장 폭이 아직 크지 않습니다. 짧게 자주 연습하는 방식(1회 5~10분)을 추천합니다.',
      upYesterday: '어제 대비 점수 상승이 확인됩니다. 현재 연습 루틴을 유지하세요.',
      upLastWeek: '지난주 평균보다 안정적으로 향상 중입니다.',
      needMoreTips: '개선 포인트를 계산하려면 각 모드에서 실시간 연습 데이터를 조금 더 수집해 주세요.',
      danceTip: '댄스 개선 포인트',
      vocalTip: '보컬 개선 포인트',
      koreanTip: '한국어 개선 포인트',
      koreanTipTail: '속도보다 정확도(문장 일치)를 우선 유지해보세요.',
      goalScore: '목표 점수',
      todayRate: '오늘 달성률',
      weeklyProgress: '주간 진행률',
      routineTitle: '추천 루틴 / 연습 추천',
      run: '실행',
      refresh: '기간 리포트 갱신',
      generateSample: '실전형 샘플 데이터 생성',
      reportEmpty: '아직 생성된 리포트가 없습니다. 먼저 댄스/보컬/한국어를 연습해 주세요.',
      reportTitle: '오늘의 통합 리포트',
      reportFallbackTitle: '연습 리포트',
      reportBodyNoData1: '아직 수집된 연습 데이터가 없습니다.',
      reportBodyNoData2: '먼저 댄스/보컬/한국어 모드를 실행하고 10초 이상 연습해 주세요.',
      reportTextNoData: '아직 리포트 데이터가 없어요. 모드를 실행해서 먼저 연습 데이터를 쌓아주세요.',
      reportTextReady: '요청하신 {{target}} 리포트에 성장 분석(어제/지난주 비교)까지 정리해드릴게요.',
      allTarget: '오늘의 통합',
      danceLabel: '댄스',
      vocalLabel: '보컬',
      koreanLabel: '한국어',
      scoreLabel: '점수',
      needsLabel: '개선포인트',
      liveLabel: '라이브',
      noteLabel: '현재음',
      noMeasure: '미측정',
      overallLabel: '종합',
      transcriptLabel: '인식문장',
      noTranscript: '없음',
      sampleCreated: '실전형 샘플 연습 데이터 {{count}}건을 생성해 리포트를 갱신했어요. 추세/성장/추천 루틴을 바로 확인해보세요.',
    },
  },
  en: {
    tabs: { chat: 'AI Coach', dance: 'Dance', vocal: 'Vocal', korean: 'Korean', report: 'Report' },
    languageLabel: 'Language',
    toneLabel: 'Coach tone',
    tone: { friendly: 'Friendly', strict: 'Strict', brief: 'Brief' },
    report: {
      periodSummaryTitle: 'Period summary',
      noDataForPeriod: 'No data for this period. Change the date or add more practice sessions.',
      daily: 'Daily summary',
      weekly: 'Weekly summary',
      monthly: 'Monthly summary',
      avg: 'Avg',
      best: 'Best',
      worst: 'Worst',
      sessions: 'Sessions',
      totalSessions: 'Sessions',
      trendTitle: 'Recent trend',
      trendNeedMore: 'Collect more trend data to show score change.',
      up: 'up',
      down: 'down',
      growthTitle: 'Growth analysis (vs yesterday / last week)',
      growthReportTitle: 'Growth report',
      noGrowthData: 'No accumulated practice data yet. Practice 2-3 times today to generate a growth report.',
      noGrowthRoutine: 'To calculate recommended routines, collect at least 2 practice records first.',
      todayAverage: 'Today average score',
      compareYesterday: 'Vs yesterday',
      compareLastWeek: 'Vs last week avg',
      noCompare: 'Not enough comparison data',
      noData: 'No data',
      noDataShort: 'Insufficient data',
      goalRate: 'Goal achievement rate',
      weeklyGoalRate: 'Weekly goal progress',
      goalBased: 'Based on target {{score}}',
      achievedDays: 'Target achieved on {{days}} of last 7 days',
      lowGrowth: 'Growth is still small. Short and frequent practice (5-10 min) is recommended.',
      upYesterday: 'Score improved vs yesterday. Keep your current routine.',
      upLastWeek: 'You are improving steadily compared with last week.',
      needMoreTips: 'Collect more real-time data in each mode to calculate improvement tips.',
      danceTip: 'Dance improvement',
      vocalTip: 'Vocal improvement',
      koreanTip: 'Korean improvement',
      koreanTipTail: 'Prioritize accuracy (sentence matching) over speed.',
      goalScore: 'Target score',
      todayRate: 'Today rate',
      weeklyProgress: 'Weekly progress',
      routineTitle: 'Recommended routine',
      run: 'Run',
      refresh: 'Refresh report',
      generateSample: 'Generate realistic sample data',
      reportEmpty: 'No report has been generated yet. Practice Dance/Vocal/Korean first.',
      reportTitle: "Today's integrated report",
      reportFallbackTitle: 'Practice report',
      reportBodyNoData1: 'No practice data collected yet.',
      reportBodyNoData2: 'Run Dance/Vocal/Korean mode and practice for at least 10 seconds first.',
      reportTextNoData: 'There is no report data yet. Run a mode and build practice data first.',
      reportTextReady: 'I will summarize your {{target}} report including growth analysis.',
      allTarget: "today's integrated",
      danceLabel: 'Dance',
      vocalLabel: 'Vocal',
      koreanLabel: 'Korean',
      scoreLabel: 'score',
      needsLabel: 'focus',
      liveLabel: 'live',
      noteLabel: 'note',
      noMeasure: 'not measured',
      overallLabel: 'overall',
      transcriptLabel: 'transcript',
      noTranscript: 'none',
      sampleCreated: 'Generated {{count}} realistic practice records and refreshed the report. Check trend/growth/routines now.',
    },
  },
};
UI_TEXT.ja = {
  ...UI_TEXT.en,
  tabs: { chat: 'AIコーチ', dance: 'ダンス', vocal: 'ボーカル', korean: '韓国語', report: 'レポート' },
  languageLabel: '言語',
  toneLabel: 'コーチトーン',
  tone: { friendly: '親切', strict: '厳格', brief: '簡潔' },
  report: {
    ...UI_TEXT.en.report,
    periodSummaryTitle: '期間サマリー',
    noDataForPeriod: '選択した期間のデータがありません。日付を変更するか、練習データを追加してください。',
    daily: '日次',
    weekly: '週次',
    monthly: '月次',
    avg: '平均',
    best: '最高',
    worst: '最低',
    sessions: 'セッション',
    totalSessions: 'セッション',
    trendTitle: '最近の推移',
    trendNeedMore: '推移データをもう少し集めると、変化量を表示できます。',
    up: '上昇',
    down: '下降',
    growthTitle: '成長分析（昨日 / 先週比較）',
    growthReportTitle: '成長レポート',
    noGrowthData: '蓄積データがまだありません。今日2〜3回練習すると成長レポートが生成されます。',
    noGrowthRoutine: 'おすすめルーティンの算出には、まず2回以上の練習記録が必要です。',
    todayAverage: '今日の平均スコア',
    compareYesterday: '昨日比',
    compareLastWeek: '先週平均比',
    noCompare: '比較データ不足',
    noData: 'データなし',
    noDataShort: 'データ不足',
    goalRate: '目標達成率',
    weeklyGoalRate: '週間達成進捗',
    goalBased: '目標 {{score}} 点基準',
    achievedDays: '直近7日で {{days}} 日達成',
    lowGrowth: '成長幅はまだ小さいです。短時間を高頻度で練習する方法をおすすめします。',
    upYesterday: '昨日よりスコアが上がっています。今のルーティンを維持しましょう。',
    upLastWeek: '先週平均より安定して向上しています。',
    needMoreTips: '改善ポイントを計算するには、各モードで実時間データをもう少し集めてください。',
    danceTip: 'ダンス改善ポイント',
    vocalTip: 'ボーカル改善ポイント',
    koreanTip: '韓国語改善ポイント',
    koreanTipTail: '速度より正確さ（文一致）を優先してください。',
    goalScore: '目標スコア',
    todayRate: '本日の達成率',
    weeklyProgress: '週間進捗',
    routineTitle: 'おすすめルーティン',
    run: '実行',
    refresh: 'レポート更新',
    generateSample: '実戦型サンプルデータ生成',
    reportEmpty: 'まだレポートがありません。まずダンス / ボーカル / 韓国語を練習してください。',
    reportTitle: '本日の統合レポート',
    reportFallbackTitle: '練習レポート',
    reportBodyNoData1: '収集された練習データがまだありません。',
    reportBodyNoData2: 'まず各モードを実行し、10秒以上練習してください。',
    reportTextNoData: 'レポートデータがまだありません。先に練習データを蓄積してください。',
    reportTextReady: '{{target}}レポートを成長分析まで含めてまとめます。',
    allTarget: '本日の統合',
    danceLabel: 'ダンス',
    vocalLabel: 'ボーカル',
    koreanLabel: '韓国語',
    scoreLabel: 'スコア',
    needsLabel: '改善ポイント',
    liveLabel: 'ライブ',
    noteLabel: '現在音',
    noMeasure: '未測定',
    overallLabel: '総合',
    transcriptLabel: '認識文',
    noTranscript: 'なし',
    sampleCreated: '実戦型サンプルデータ {{count}} 件を生成し、レポートを更新しました。推移/成長/ルーティンを確認してください。',
  },
};
UI_TEXT.th = {
  ...UI_TEXT.en,
  tabs: { chat: 'AI โค้ช', dance: 'เต้น', vocal: 'ร้องเพลง', korean: 'เกาหลี', report: 'รายงาน' },
  languageLabel: 'ภาษา',
  toneLabel: 'โทนโค้ช',
  tone: { friendly: 'เป็นมิตร', strict: 'เข้มงวด', brief: 'สั้นกระชับ' },
  report: {
    ...UI_TEXT.en.report,
    periodSummaryTitle: 'สรุปตามช่วงเวลา',
    noDataForPeriod: 'ไม่มีข้อมูลในช่วงเวลาที่เลือก ลองเปลี่ยนวันที่หรือฝึกเพิ่ม',
    daily: 'รายวัน',
    weekly: 'รายสัปดาห์',
    monthly: 'รายเดือน',
    avg: 'เฉลี่ย',
    best: 'สูงสุด',
    worst: 'ต่ำสุด',
    sessions: 'เซสชัน',
    totalSessions: 'เซสชัน',
    trendTitle: 'แนวโน้มล่าสุด',
    trendNeedMore: 'เก็บข้อมูลแนวโน้มเพิ่มอีกเล็กน้อยเพื่อดูการเปลี่ยนแปลง',
    up: 'เพิ่มขึ้น',
    down: 'ลดลง',
    growthTitle: 'วิเคราะห์การพัฒนา (เทียบเมื่อวาน / สัปดาห์ที่แล้ว)',
    growthReportTitle: 'รายงานการพัฒนา',
    noGrowthData: 'ยังไม่มีข้อมูลสะสม ฝึก 2-3 ครั้งวันนี้เพื่อสร้างรายงานการพัฒนา',
    noGrowthRoutine: 'ต้องมีบันทึกการฝึกอย่างน้อย 2 ครั้งเพื่อคำนวณรูทีนแนะนำ',
    todayAverage: 'คะแนนเฉลี่ยวันนี้',
    compareYesterday: 'เทียบเมื่อวาน',
    compareLastWeek: 'เทียบค่าเฉลี่ยสัปดาห์ที่แล้ว',
    noCompare: 'ข้อมูลเปรียบเทียบไม่พอ',
    noData: 'ไม่มีข้อมูล',
    noDataShort: 'ข้อมูลไม่พอ',
    goalRate: 'อัตราบรรลุเป้าหมาย',
    weeklyGoalRate: 'ความคืบหน้าเป้าหมายรายสัปดาห์',
    goalBased: 'อิงเป้าหมาย {{score}} คะแนน',
    achievedDays: 'บรรลุเป้าหมาย {{days}} วันใน 7 วันที่ผ่านมา',
    lowGrowth: 'การพัฒนายังไม่มาก แนะนำฝึกสั้นแต่บ่อย (ครั้งละ 5-10 นาที)',
    upYesterday: 'คะแนนดีขึ้นจากเมื่อวาน รักษารูทีนปัจจุบันไว้ได้เลย',
    upLastWeek: 'คะแนนพัฒนาดีขึ้นอย่างสม่ำเสมอเมื่อเทียบกับสัปดาห์ก่อน',
    needMoreTips: 'เก็บข้อมูลเรียลไทม์ในแต่ละโหมดเพิ่ม เพื่อคำนวณคำแนะนำได้แม่นยำขึ้น',
    danceTip: 'จุดปรับปรุงด้านเต้น',
    vocalTip: 'จุดปรับปรุงด้านร้องเพลง',
    koreanTip: 'จุดปรับปรุงภาษาเกาหลี',
    koreanTipTail: 'เน้นความแม่นยำของประโยคมากกว่าความเร็ว',
    goalScore: 'คะแนนเป้าหมาย',
    todayRate: 'อัตราสำเร็จวันนี้',
    weeklyProgress: 'ความคืบหน้ารายสัปดาห์',
    routineTitle: 'รูทีนแนะนำ',
    run: 'เริ่ม',
    refresh: 'รีเฟรชรายงาน',
    generateSample: 'สร้างข้อมูลตัวอย่างเสมือนจริง',
    reportEmpty: 'ยังไม่มีรายงาน กรุณาฝึกเต้น/ร้องเพลง/เกาหลีก่อน',
    reportTitle: 'รายงานรวมของวันนี้',
    reportFallbackTitle: 'รายงานการฝึก',
    reportBodyNoData1: 'ยังไม่มีข้อมูลการฝึกที่บันทึกไว้',
    reportBodyNoData2: 'กรุณาเริ่มโหมดฝึกและฝึกอย่างน้อย 10 วินาที',
    reportTextNoData: 'ยังไม่มีข้อมูลรายงาน กรุณาสะสมข้อมูลการฝึกก่อน',
    reportTextReady: 'จะสรุปรายงาน {{target}} พร้อมวิเคราะห์การพัฒนาให้ทันที',
    allTarget: 'ภาพรวมของวันนี้',
    danceLabel: 'เต้น',
    vocalLabel: 'ร้องเพลง',
    koreanLabel: 'เกาหลี',
    scoreLabel: 'คะแนน',
    needsLabel: 'จุดโฟกัส',
    liveLabel: 'สด',
    noteLabel: 'โน้ตปัจจุบัน',
    noMeasure: 'ยังไม่วัด',
    overallLabel: 'รวม',
    transcriptLabel: 'ข้อความที่รู้จำ',
    noTranscript: 'ไม่มี',
    sampleCreated: 'สร้างข้อมูลฝึกเสมือนจริง {{count}} รายการและอัปเดตรายงานแล้ว ตรวจสอบแนวโน้ม/การพัฒนา/รูทีนได้ทันที',
  },
};
UI_TEXT.vi = {
  ...UI_TEXT.en,
  tabs: { chat: 'AI Coach', dance: 'Nhảy', vocal: 'Thanh nhạc', korean: 'Tiếng Hàn', report: 'Báo cáo' },
  languageLabel: 'Ngôn ngữ',
  toneLabel: 'Giọng điệu huấn luyện',
  tone: { friendly: 'Thân thiện', strict: 'Nghiêm khắc', brief: 'Ngắn gọn' },
  report: {
    ...UI_TEXT.en.report,
    periodSummaryTitle: 'Tổng hợp theo giai đoạn',
    noDataForPeriod: 'Không có dữ liệu trong giai đoạn đã chọn. Hãy đổi ngày hoặc luyện tập thêm.',
    daily: 'Theo ngày',
    weekly: 'Theo tuần',
    monthly: 'Theo tháng',
    avg: 'TB',
    best: 'Cao nhất',
    worst: 'Thấp nhất',
    sessions: 'Phiên',
    totalSessions: 'Phiên',
    trendTitle: 'Xu hướng gần đây',
    trendNeedMore: 'Cần thêm dữ liệu xu hướng để hiển thị mức thay đổi.',
    up: 'tăng',
    down: 'giảm',
    growthTitle: 'Phân tích tiến bộ (so với hôm qua / tuần trước)',
    growthReportTitle: 'Báo cáo tiến bộ',
    noGrowthData: 'Chưa có dữ liệu tích lũy. Hãy luyện 2-3 lần hôm nay để tạo báo cáo tiến bộ.',
    noGrowthRoutine: 'Cần ít nhất 2 bản ghi luyện tập để tính lộ trình đề xuất.',
    todayAverage: 'Điểm trung bình hôm nay',
    compareYesterday: 'So với hôm qua',
    compareLastWeek: 'So với TB tuần trước',
    noCompare: 'Thiếu dữ liệu so sánh',
    noData: 'Không có dữ liệu',
    noDataShort: 'Thiếu dữ liệu',
    goalRate: 'Tỷ lệ đạt mục tiêu',
    weeklyGoalRate: 'Tiến độ mục tiêu tuần',
    goalBased: 'Theo mục tiêu {{score}} điểm',
    achievedDays: 'Đạt mục tiêu {{days}}/7 ngày gần nhất',
    lowGrowth: 'Mức tăng trưởng còn thấp. Nên luyện ngắn nhưng đều (5-10 phút/lần).',
    upYesterday: 'Điểm đã tăng so với hôm qua. Hãy giữ nhịp luyện tập hiện tại.',
    upLastWeek: 'Bạn đang cải thiện ổn định so với tuần trước.',
    needMoreTips: 'Hãy thu thập thêm dữ liệu thời gian thực ở từng chế độ để tính gợi ý cải thiện.',
    danceTip: 'Điểm cần cải thiện khi nhảy',
    vocalTip: 'Điểm cần cải thiện thanh nhạc',
    koreanTip: 'Điểm cần cải thiện tiếng Hàn',
    koreanTipTail: 'Ưu tiên độ chính xác khớp câu hơn tốc độ.',
    goalScore: 'Điểm mục tiêu',
    todayRate: 'Tỷ lệ hôm nay',
    weeklyProgress: 'Tiến độ tuần',
    routineTitle: 'Lộ trình đề xuất',
    run: 'Chạy',
    refresh: 'Làm mới báo cáo',
    generateSample: 'Tạo dữ liệu mẫu thực tế',
    reportEmpty: 'Chưa có báo cáo nào. Hãy luyện Dance/Vocal/Korean trước.',
    reportTitle: 'Báo cáo tổng hợp hôm nay',
    reportFallbackTitle: 'Báo cáo luyện tập',
    reportBodyNoData1: 'Chưa thu thập dữ liệu luyện tập.',
    reportBodyNoData2: 'Hãy chạy chế độ Dance/Vocal/Korean và luyện ít nhất 10 giây.',
    reportTextNoData: 'Chưa có dữ liệu báo cáo. Hãy luyện để tích lũy dữ liệu trước.',
    reportTextReady: 'Tôi sẽ tóm tắt báo cáo {{target}} kèm phân tích tiến bộ.',
    allTarget: 'tổng hợp hôm nay',
    danceLabel: 'Nhảy',
    vocalLabel: 'Thanh nhạc',
    koreanLabel: 'Tiếng Hàn',
    scoreLabel: 'điểm',
    needsLabel: 'trọng tâm',
    liveLabel: 'trực tiếp',
    noteLabel: 'nốt',
    noMeasure: 'chưa đo',
    overallLabel: 'tổng',
    transcriptLabel: 'nội dung nhận dạng',
    noTranscript: 'không có',
    sampleCreated: 'Đã tạo {{count}} bản ghi luyện tập mẫu và cập nhật báo cáo. Hãy xem xu hướng/tiến bộ/lộ trình.',
  },
};
UI_TEXT.es = {
  ...UI_TEXT.en,
  tabs: { chat: 'AI Coach', dance: 'Baile', vocal: 'Vocal', korean: 'Coreano', report: 'Informe' },
  languageLabel: 'Idioma',
  toneLabel: 'Tono del coach',
  tone: { friendly: 'Amable', strict: 'Estricto', brief: 'Breve' },
  report: {
    ...UI_TEXT.en.report,
    periodSummaryTitle: 'Resumen por periodo',
    noDataForPeriod: 'No hay datos en el periodo seleccionado. Cambia la fecha o practica más.',
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
    avg: 'Prom',
    best: 'Mejor',
    worst: 'Peor',
    sessions: 'Sesiones',
    totalSessions: 'Sesiones',
    trendTitle: 'Tendencia reciente',
    trendNeedMore: 'Recopila más datos de tendencia para mostrar el cambio.',
    up: 'sube',
    down: 'baja',
    growthTitle: 'Análisis de progreso (vs ayer / semana pasada)',
    growthReportTitle: 'Informe de progreso',
    noGrowthData: 'Aún no hay datos acumulados. Practica 2-3 veces hoy para generar el informe.',
    noGrowthRoutine: 'Para calcular rutinas recomendadas, primero acumula al menos 2 registros.',
    todayAverage: 'Promedio de hoy',
    compareYesterday: 'Vs ayer',
    compareLastWeek: 'Vs promedio semanal',
    noCompare: 'Faltan datos para comparar',
    noData: 'Sin datos',
    noDataShort: 'Datos insuficientes',
    goalRate: 'Tasa de objetivo',
    weeklyGoalRate: 'Progreso semanal',
    goalBased: 'Basado en objetivo de {{score}}',
    achievedDays: 'Objetivo logrado {{days}} de los últimos 7 días',
    lowGrowth: 'El progreso aún es bajo. Se recomienda practicar poco pero frecuente (5-10 min).',
    upYesterday: 'Tu puntuación mejoró frente a ayer. Mantén la rutina actual.',
    upLastWeek: 'Vas mejorando de forma estable respecto a la semana pasada.',
    needMoreTips: 'Recolecta más datos en tiempo real en cada modo para calcular mejoras.',
    danceTip: 'Mejora en baile',
    vocalTip: 'Mejora en vocal',
    koreanTip: 'Mejora en coreano',
    koreanTipTail: 'Prioriza la precisión de la frase sobre la velocidad.',
    goalScore: 'Puntaje objetivo',
    todayRate: 'Tasa de hoy',
    weeklyProgress: 'Progreso semanal',
    routineTitle: 'Rutina recomendada',
    run: 'Ejecutar',
    refresh: 'Actualizar informe',
    generateSample: 'Generar datos de muestra realistas',
    reportEmpty: 'Aún no hay informe. Practica primero Dance/Vocal/Korean.',
    reportTitle: 'Informe integrado de hoy',
    reportFallbackTitle: 'Informe de práctica',
    reportBodyNoData1: 'Aún no se recopilaron datos de práctica.',
    reportBodyNoData2: 'Ejecuta Dance/Vocal/Korean y practica al menos 10 segundos.',
    reportTextNoData: 'Todavía no hay datos de informe. Practica primero para acumular datos.',
    reportTextReady: 'Voy a resumir tu informe de {{target}} con análisis de progreso.',
    allTarget: 'integrado de hoy',
    danceLabel: 'Baile',
    vocalLabel: 'Vocal',
    koreanLabel: 'Coreano',
    scoreLabel: 'puntuación',
    needsLabel: 'enfoque',
    liveLabel: 'en vivo',
    noteLabel: 'nota',
    noMeasure: 'sin medir',
    overallLabel: 'global',
    transcriptLabel: 'transcripción',
    noTranscript: 'ninguna',
    sampleCreated: 'Se generaron {{count}} registros de práctica simulados y se actualizó el informe. Revisa tendencia/progreso/rutinas.',
  },
};
UI_TEXT.fr = {
  ...UI_TEXT.en,
  tabs: { chat: 'AI Coach', dance: 'Danse', vocal: 'Vocal', korean: 'Coréen', report: 'Rapport' },
  languageLabel: 'Langue',
  toneLabel: 'Ton du coach',
  tone: { friendly: 'Bienveillant', strict: 'Strict', brief: 'Bref' },
  report: {
    ...UI_TEXT.en.report,
    periodSummaryTitle: 'Resume par periode',
    noDataForPeriod: "Aucune donnee sur cette periode. Changez la date ou ajoutez plus d'entrainement.",
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
    avg: 'Moy',
    best: 'Meilleur',
    worst: 'Plus bas',
    sessions: 'Sessions',
    totalSessions: 'Sessions',
    trendTitle: 'Tendance recente',
    trendNeedMore: "Collectez plus de donnees pour afficher l'evolution.",
    up: 'hausse',
    down: 'baisse',
    growthTitle: 'Analyse de progression (vs hier / semaine derniere)',
    growthReportTitle: 'Rapport de progression',
    noGrowthData: "Pas encore de donnees cumulees. Pratiquez 2-3 fois aujourd'hui pour generer le rapport.",
    noGrowthRoutine: 'Pour calculer une routine recommandee, enregistrez au moins 2 sessions.',
    todayAverage: "Moyenne d'aujourd'hui",
    compareYesterday: 'Vs hier',
    compareLastWeek: 'Vs moyenne hebdo',
    noCompare: 'Donnees comparatives insuffisantes',
    noData: 'Aucune donnee',
    noDataShort: 'Donnees insuffisantes',
    goalRate: "Taux d'objectif",
    weeklyGoalRate: 'Progression hebdomadaire',
    goalBased: 'Base sur un objectif de {{score}}',
    achievedDays: 'Objectif atteint {{days}} jours sur les 7 derniers',
    lowGrowth: "La progression reste limitee. Pratiquez court mais souvent (5-10 min).",
    upYesterday: "Le score a progresse par rapport a hier. Gardez votre routine actuelle.",
    upLastWeek: 'Votre progression est stable par rapport a la semaine derniere.',
    needMoreTips: "Collectez plus de donnees en temps reel dans chaque mode pour affiner les conseils.",
    danceTip: 'Point de progression danse',
    vocalTip: 'Point de progression vocal',
    koreanTip: 'Point de progression coreen',
    koreanTipTail: 'Priorisez la precision de phrase plutot que la vitesse.',
    goalScore: 'Score cible',
    todayRate: "Taux d'aujourd'hui",
    weeklyProgress: 'Progression semaine',
    routineTitle: 'Routine recommandee',
    run: 'Lancer',
    refresh: 'Actualiser le rapport',
    generateSample: 'Generer des donnees de test realistes',
    reportEmpty: "Aucun rapport genere pour le moment. Pratiquez d'abord Dance/Vocal/Korean.",
    reportTitle: "Rapport integre d'aujourd'hui",
    reportFallbackTitle: 'Rapport de pratique',
    reportBodyNoData1: "Aucune donnee d'entrainement collecte.",
    reportBodyNoData2: 'Lancez un mode Dance/Vocal/Korean et pratiquez au moins 10 secondes.',
    reportTextNoData: "Aucune donnee de rapport pour le moment. Accumulez d'abord des donnees d'entrainement.",
    reportTextReady: 'Je vais resumer votre rapport {{target}} avec analyse de progression.',
    allTarget: "integre d'aujourd'hui",
    danceLabel: 'Danse',
    vocalLabel: 'Vocal',
    koreanLabel: 'Coreen',
    scoreLabel: 'score',
    needsLabel: 'focus',
    liveLabel: 'live',
    noteLabel: 'note',
    noMeasure: 'non mesure',
    overallLabel: 'global',
    transcriptLabel: 'transcription',
    noTranscript: 'aucune',
    sampleCreated: 'Creation de {{count}} donnees de pratique simulees terminee, rapport mis a jour. Consultez tendance/progression/routines.',
  },
};
UI_TEXT.zh = {
  ...UI_TEXT.en,
  tabs: { chat: 'AI 教练', dance: '舞蹈', vocal: '声乐', korean: '韩语', report: '报告' },
  languageLabel: '语言',
  toneLabel: '教练语气',
  tone: { friendly: '友好型', strict: '严格型', brief: '简洁型' },
  report: {
    ...UI_TEXT.en.report,
    periodSummaryTitle: '周期总结',
    noDataForPeriod: '所选时间范围暂无数据。请切换日期或继续练习后再查看。',
    daily: '日度',
    weekly: '周度',
    monthly: '月度',
    avg: '平均',
    best: '最高',
    worst: '最低',
    sessions: '次',
    totalSessions: '训练次数',
    trendTitle: '近期趋势',
    trendNeedMore: '再积累一些趋势数据后，就可以显示变化幅度。',
    up: '上升',
    down: '下降',
    growthTitle: '成长分析（对比昨天/上周）',
    growthReportTitle: '成长报告',
    noGrowthData: '目前还没有累计练习数据。今天练习 2~3 次后即可生成成长报告。',
    noGrowthRoutine: '至少需要 2 条练习记录，才能计算推荐训练方案。',
    todayAverage: '今日平均分',
    compareYesterday: '较昨天',
    compareLastWeek: '较上周平均',
    noCompare: '对比数据不足',
    noData: '暂无数据',
    noDataShort: '数据不足',
    goalRate: '目标达成率',
    weeklyGoalRate: '周目标进度',
    goalBased: '按目标 {{score}} 分计算',
    achievedDays: '近 7 天中达标 {{days}} 天',
    lowGrowth: '当前成长幅度较小，建议采用“短时高频”练习（每次 5~10 分钟）。',
    upYesterday: '相比昨天分数有所提升，建议保持当前练习节奏。',
    upLastWeek: '与上周相比，你正在稳定进步。',
    needMoreTips: '请在各模式继续积累实时数据，以便生成更准确的改进建议。',
    danceTip: '舞蹈改进点',
    vocalTip: '声乐改进点',
    koreanTip: '韩语改进点',
    koreanTipTail: '建议优先保证句子匹配准确度，再提升语速。',
    goalScore: '目标分数',
    todayRate: '今日达成率',
    weeklyProgress: '周进度',
    routineTitle: '推荐训练方案',
    run: '执行',
    refresh: '刷新报告',
    generateSample: '生成真实感样本数据',
    reportEmpty: '当前还没有生成报告。请先进行舞蹈/声乐/韩语练习。',
    reportTitle: '今日综合报告',
    reportFallbackTitle: '练习报告',
    reportBodyNoData1: '尚未收集到练习数据。',
    reportBodyNoData2: '请先进入舞蹈/声乐/韩语模式并练习至少 10 秒。',
    reportTextNoData: '当前暂无报告数据。请先完成练习并积累记录。',
    reportTextReady: '我将为你整理 {{target}} 报告，并附上成长分析。',
    allTarget: '今日综合',
    danceLabel: '舞蹈',
    vocalLabel: '声乐',
    koreanLabel: '韩语',
    scoreLabel: '分数',
    needsLabel: '改进重点',
    liveLabel: '实时',
    noteLabel: '当前音高',
    noMeasure: '未检测',
    overallLabel: '综合',
    transcriptLabel: '识别文本',
    noTranscript: '无',
    sampleCreated: '已生成 {{count}} 条真实感练习数据，并刷新报告。现在可查看趋势/成长/推荐方案。',
  },
};

function normalizeLanguage(lang) {
  const code = String(lang || 'ko').slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'ko';
}

function textPack(lang) {
  const code = normalizeLanguage(lang);
  return UI_TEXT[code] || UI_TEXT.ko;
}

function applyVars(template, vars = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

function scoreUnit(lang) {
  const code = normalizeLanguage(lang);
  if (code === 'ko') return '점';
  if (code === 'zh') return '分';
  return '';
}

function translateFeedbackText(text, language = 'ko') {
  const lang = normalizeLanguage(language);
  const raw = String(text || '').trim();
  if (!raw || lang === 'ko') return raw;
  const map = {
    en: {
      arm: 'Arm angle alignment and movement size',
      symmetry: 'Left-right symmetry and center balance',
      detail: 'Movement detail and rhythm precision',
      high: 'Pitch is slightly high.',
      low: 'Pitch is slightly low.',
      stable: 'Pitch is stable and on target.',
    },
    ja: {
      arm: '腕の角度調整と動作の大きさ',
      symmetry: '左右対称と重心バランス',
      detail: '動作ディテールとリズム精度',
      high: '音程が少し高いです。',
      low: '音程が少し低いです。',
      stable: '音程が安定していて目標に合っています。',
    },
    th: {
      arm: 'จัดมุมแขนและขยายขนาดการเคลื่อนไหว',
      symmetry: 'สมดุลซ้ายขวาและการทรงตัวศูนย์กลาง',
      detail: 'รายละเอียดท่าทางและความแม่นของจังหวะ',
      high: 'คีย์สูงเล็กน้อย',
      low: 'คีย์ต่ำเล็กน้อย',
      stable: 'คีย์นิ่งและตรงเป้าหมาย',
    },
    vi: {
      arm: 'Canh goc tay va do mo rong dong tac',
      symmetry: 'Doi xung trai-phai va can bang trong tam',
      detail: 'Chi tiet dong tac va do chinh xac nhip',
      high: 'Cao do hoi cao.',
      low: 'Cao do hoi thap.',
      stable: 'Cao do on dinh va dung muc tieu.',
    },
    es: {
      arm: 'Alineacion del angulo del brazo y amplitud del movimiento',
      symmetry: 'Simetria izquierda-derecha y balance del centro',
      detail: 'Detalle del movimiento y precision ritmica',
      high: 'La afinacion esta un poco alta.',
      low: 'La afinacion esta un poco baja.',
      stable: 'La afinacion esta estable y en objetivo.',
    },
    fr: {
      arm: "Alignement de l'angle des bras et amplitude du mouvement",
      symmetry: 'Symetrie gauche-droite et equilibre du centre',
      detail: 'Details du mouvement et precision rythmique',
      high: 'La justesse est legerement haute.',
      low: 'La justesse est legerement basse.',
      stable: 'La justesse est stable et correcte.',
    },
    zh: {
      arm: '手臂角度与动作幅度需要优化',
      symmetry: '左右对称性与重心稳定性需要加强',
      detail: '动作细节与节奏准确度需要提升',
      high: '当前音高偏高一些。',
      low: '当前音高偏低一些。',
      stable: '音高较稳定，基本贴合目标。',
    },
  };
  const pack = map[lang] || map.en;
  if (raw.includes('팔 각도')) return pack.arm;
  if (raw.includes('좌우 대칭')) return pack.symmetry;
  if (raw.includes('동작 디테일')) return pack.detail;
  if (raw.includes('조금 높')) return pack.high;
  if (raw.includes('조금 낮')) return pack.low;
  if (raw.includes('안정적으로 맞')) return pack.stable;
  return raw;
}

function createMessage(role, text, extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
    timestamp: Date.now(),
    ...extra,
  };
}

function detectReportTarget(text) {
  if (text.includes('댄스') || text.includes('춤') || text.includes('dance') || text.includes('舞蹈')) return 'dance';
  if (text.includes('보컬') || text.includes('노래') || text.includes('음정') || text.includes('vocal') || text.includes('sing') || text.includes('声乐') || text.includes('唱歌')) return 'vocal';
  if (text.includes('한국어') || text.includes('발음') || text.includes('가사') || text.includes('korean') || text.includes('韩语')) return 'korean';
  return 'all';
}

function tabFromFeature(feature) {
  if (feature === 'dance') return 'dance';
  if (feature === 'vocal') return 'vocal';
  if (String(feature || '').startsWith('korean')) return 'korean';
  return 'chat';
}

function parseDayKey(key) {
  if (!key) return new Date();
  const [y, m, d] = String(key).split('-').map((x) => Number(x));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function inSelectedPeriod(at, period, reportDate) {
  const date = new Date(at);
  const anchor = parseDayKey(reportDate);
  if (period === 'daily') return dayKey(date.getTime()) === dayKey(anchor.getTime());
  if (period === 'weekly') {
    const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59, 999);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    return date >= start && date <= end;
  }
  const monthMatch = date.getFullYear() === anchor.getFullYear() && date.getMonth() === anchor.getMonth();
  return monthMatch;
}

function buildPeriodSummary(target, persistedSessions, period, reportDate, lang = 'ko') {
  const tr = textPack(lang).report;
  const scoped = (persistedSessions || []).filter((item) => (target === 'all' ? true : item.domain === target || (target === 'korean' && item.domain === 'korean')));
  const filtered = scoped.filter((item) => inSelectedPeriod(item.at, period, reportDate));
  if (!filtered.length) {
    return {
      title: tr.periodSummaryTitle,
      lines: [tr.noDataForPeriod],
      stats: { sessions: 0, average: null, best: null, worst: null },
    };
  }
  const scores = filtered.map((item) => Number(item.score)).filter((v) => Number.isFinite(v));
  const avg = average(scores);
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  const byDomain = filtered.reduce((acc, item) => {
    if (!acc[item.domain]) acc[item.domain] = [];
    acc[item.domain].push(item.score);
    return acc;
  }, {});
  const lines = Object.keys(byDomain).map((domain) => {
    const ds = byDomain[domain];
    const domainLabel = domain === 'dance' ? tr.danceLabel : domain === 'vocal' ? tr.vocalLabel : tr.koreanLabel;
    return `${domainLabel.toUpperCase()}: ${tr.avg} ${round1(average(ds))} · ${tr.best} ${Math.max(...ds)} · ${tr.sessions} ${ds.length}`;
  });
  return {
    title: period === 'daily' ? tr.daily : period === 'weekly' ? tr.weekly : tr.monthly,
    lines,
    stats: {
      sessions: filtered.length,
      average: round1(avg),
      best,
      worst,
    },
  };
}

function getLatestKoreanReport(koreanReports) {
  const latest = Object.values(koreanReports || {})
    .filter((item) => item?.updatedAt)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
  return latest || null;
}

function extractScoreFromPayload(domain, payload) {
  if (!payload) return null;
  if (domain === 'dance') return Number(payload.score ?? payload.summary?.totalScore ?? 0);
  if (domain === 'vocal') return Number(payload.liveScore ?? payload.summary?.total ?? 0);
  if (domain.startsWith('korean-')) return Number(payload.metrics?.overall ?? payload.overall ?? 0);
  return null;
}

function summarizeTrend(name, historyItems, lang = 'ko') {
  const tr = textPack(lang).report;
  const valid = (historyItems || []).filter((item) => Number.isFinite(item?.score));
  if (valid.length < 2) return `${name}: ${tr.trendNeedMore}`;
  const first = valid[0];
  const latest = valid[valid.length - 1];
  const avg = Math.round(valid.reduce((acc, cur) => acc + cur.score, 0) / valid.length);
  const min = Math.min(...valid.map((v) => v.score));
  const max = Math.max(...valid.map((v) => v.score));
  const delta = Math.round(latest.score - first.score);
  const direction = delta >= 0 ? tr.up : tr.down;
  return `${name}: ${valid.length} ${first.score} -> ${latest.score} (${direction} ${Math.abs(delta)}) · ${tr.avg} ${avg} · ${tr.best} ${max} · ${tr.worst} ${min}`;
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function round1(num) {
  return Math.round(num * 10) / 10;
}

function average(list) {
  if (!list.length) return null;
  return list.reduce((acc, n) => acc + n, 0) / list.length;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampScore(value, min = 45, max = 98) {
  return Math.max(min, Math.min(max, value));
}

function choose(list) {
  return list[randInt(0, list.length - 1)];
}

function buildPracticeLikeSeedData(days = 21) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const domains = ['dance', 'vocal', 'korean'];
  const baseScore = { dance: 62, vocal: 60, korean: 58 };
  const persistedSessions = [];
  const domainHistory = { dance: [], vocal: [], korean: [] };
  const notePool = ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const ratio = (days - dayOffset) / days;
    const dayStart = now - dayOffset * dayMs;
    for (const domain of domains) {
      const sessionCount = randInt(1, 3) + (dayOffset < 6 ? 1 : 0);
      for (let index = 0; index < sessionCount; index += 1) {
        const trendBoost = ratio * randInt(8, 14);
        const fatigueWave = Math.sin((dayOffset + index) * 0.7) * 2;
        const noise = randInt(-5, 5);
        const score = clampScore(Math.round(baseScore[domain] + trendBoost + fatigueWave + noise));
        const at = dayStart + randInt(7 * 60 * 60 * 1000, 22 * 60 * 60 * 1000);
        const record = { at, domain, score };
        persistedSessions.push(record);
        domainHistory[domain].push({ at, score });
      }
    }
  }

  persistedSessions.sort((a, b) => a.at - b.at);
  domainHistory.dance.sort((a, b) => a.at - b.at);
  domainHistory.vocal.sort((a, b) => a.at - b.at);
  domainHistory.korean.sort((a, b) => a.at - b.at);

  const latestDance = domainHistory.dance.at(-1)?.score ?? 70;
  const latestVocal = domainHistory.vocal.at(-1)?.score ?? 70;
  const latestKorean = domainHistory.korean.at(-1)?.score ?? 70;
  const danceNeeds =
    latestDance < 68 ? '팔 각도 정렬 · 동작 크기' : latestDance < 78 ? '좌우 대칭 · 중심 이동 안정화' : '동작 디테일 · 박자 정확도 유지';
  const pitchFeedback =
    latestVocal < 68 ? '음정이 조금 낮습니다. 시작음을 1~2도 올려보세요.' : latestVocal < 78 ? '조금 높습니다.' : '목표 음정에 안정적으로 맞고 있어요.';

  const reports = {
    dance: {
      updatedAt: now,
      score: latestDance,
      summary: { needs: danceNeeds },
      metrics: {
        activity: randInt(72, 92),
        confidence: randInt(74, 96),
      },
    },
    vocal: {
      updatedAt: now,
      liveScore: latestVocal,
      pitchScore: clampScore(latestVocal + randInt(-4, 3), 40, 100),
      rhythmScore: clampScore(latestVocal + randInt(-5, 4), 40, 100),
      currentNote: choose(notePool),
      currentHz: Number((randInt(200, 460) + Math.random()).toFixed(1)),
      pitchFeedback,
      tuningState: latestVocal >= 75 ? 'on-target' : 'adjust',
    },
    korean: {
      pronunciation: {
        updatedAt: now - 90 * 1000,
        transcript: '오늘은 발음과 억양을 천천히 정확하게 맞춰보겠습니다',
        metrics: { overall: clampScore(latestKorean + randInt(-3, 2), 40, 100) },
      },
      follow: {
        updatedAt: now - 60 * 1000,
        transcript: '문장 따라 말하기를 통해 호흡과 리듬을 맞추고 있습니다',
        metrics: { overall: clampScore(latestKorean + randInt(-2, 3), 40, 100) },
      },
      correction: {
        updatedAt: now - 40 * 1000,
        transcript: 'ai 교정 피드백으로 자주 틀리는 발음을 다시 연습했어요',
        metrics: { overall: clampScore(latestKorean + randInt(-3, 2), 40, 100) },
      },
      lyrics: {
        updatedAt: now - 20 * 1000,
        transcript: '가사 기반 학습으로 단어 인식과 문장 정확도를 점검 중입니다',
        metrics: { overall: clampScore(latestKorean + randInt(-2, 3), 40, 100) },
      },
    },
  };

  const reportHistory = {
    dance: domainHistory.dance.slice(-40),
    vocal: domainHistory.vocal.slice(-40),
    korean: domainHistory.korean.slice(-40),
  };

  return {
    persistedSessions: persistedSessions.slice(-1000),
    reportHistory,
    reports,
  };
}

function loadPersistedSessions() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => Number.isFinite(item?.at) && Number.isFinite(item?.score) && item?.domain);
  } catch {
    return [];
  }
}

function targetScoreByDomain(target) {
  if (target === 'dance') return 80;
  if (target === 'vocal') return 80;
  if (target === 'korean') return 78;
  return 80;
}

function buildRecommendedRoutines(target, latestReports, growthSummary, lang = 'ko') {
  const code = normalizeLanguage(lang);
  const isKorean = code === 'ko';
  const isChinese = code === 'zh';
  const defaultFeatureForTarget = target === 'dance' ? 'dance' : target === 'vocal' ? 'vocal' : 'korean-pronunciation';
  const routines = [];
  const dance = latestReports?.dance;
  const vocal = latestReports?.vocal;
  const korean = getLatestKoreanReport(latestReports?.korean || {});

  if (target === 'all' || target === 'dance') {
    const needs = dance?.summary?.needs || '';
    if (needs.includes('팔 각도')) routines.push({ label: isKorean ? '댄스 8분: 팔 라인 고정 드릴(좌/우 각 2분) + 전신 루틴 4분' : isChinese ? '舞蹈8分钟：手臂线条固定训练（左右各2分钟）+ 全身组合4分钟' : 'Dance 8 min: arm-line drill (2 min per side) + full-body combo 4 min', feature: 'dance' });
    else if (needs.includes('좌우 대칭')) routines.push({ label: isKorean ? '댄스 8분: 거울 모드에서 좌우 대칭 체크 루틴(4세트)' : isChinese ? '舞蹈8分钟：镜像模式下做左右对称检查（4组）' : 'Dance 8 min: mirror symmetry check routine (4 sets)', feature: 'dance' });
    else routines.push({ label: isKorean ? '댄스 8분: 현재 안무 2구간 반복 + 동작 크기 10% 확장' : isChinese ? '舞蹈8分钟：重复当前编舞2个片段 + 动作幅度提高10%' : 'Dance 8 min: repeat two choreo sections + increase movement size by 10%', feature: 'dance' });
  }
  if (target === 'all' || target === 'vocal') {
    const fb = String(vocal?.pitchFeedback || '');
    if (fb.includes('높')) routines.push({ label: isKorean ? '보컬 7분: 목표음보다 반음 낮게 시작 후 슬라이드 업(롱톤 6회)' : isChinese ? '声乐7分钟：先从目标音低半音起唱，再滑音上行（长音6次）' : 'Vocal 7 min: start a semitone lower than target and slide up (6 long tones)', feature: 'vocal' });
    else if (fb.includes('낮')) routines.push({ label: isKorean ? '보컬 7분: 복식호흡 1분 + 목표음 직상행 롱톤 6회' : isChinese ? '声乐7分钟：腹式呼吸1分钟 + 目标音直上长音6次' : 'Vocal 7 min: 1 min diaphragmatic breathing + straight-up long tones x6', feature: 'vocal' });
    else routines.push({ label: isKorean ? '보컬 7분: 목표 MIDI 고정 롱톤 4회 + 3음계 연결 4세트' : isChinese ? '声乐7分钟：目标 MIDI 固定长音4次 + 三音阶连接4组' : 'Vocal 7 min: target MIDI hold x4 + 3-note connection x4 sets', feature: 'vocal' });
  }
  if (target === 'all' || target === 'korean') {
    const kScore = Number(korean?.metrics?.overall ?? korean?.overall ?? 0);
    if (kScore && kScore < 70) routines.push({ label: isKorean ? '한국어 8분: 기준 문장 4개를 2회씩 천천히 낭독(정확도 우선)' : isChinese ? '韩语8分钟：4个基准句各慢读2遍（优先准确度）' : 'Korean 8 min: read 4 reference sentences twice slowly (accuracy first)', feature: 'korean-pronunciation' });
    else routines.push({ label: isKorean ? '한국어 8분: 문장 따라 말하기 4라인 + AI 교정 모드로 즉시 수정' : isChinese ? '韩语8分钟：跟读4行句子 + AI 纠音模式即时修正' : 'Korean 8 min: follow-along 4 lines + instant correction in AI mode', feature: 'korean-follow' });
  }
  if ((growthSummary?.vsYesterday ?? 0) < 0) routines.push({ label: isKorean ? '회복 루틴 5분: 가장 점수 낮은 모드 1개만 집중해 짧게 재연습' : isChinese ? '恢复训练5分钟：只针对最低分模式做短时强化复练' : 'Recovery 5 min: focus only on the lowest-scoring mode for a short repeat', feature: target === 'all' ? 'dance' : defaultFeatureForTarget });
  if ((growthSummary?.vsLastWeek ?? 0) >= 3) routines.push({ label: isKorean ? '상향 루틴 5분: 현재 난이도 유지 + 속도만 10% 상향' : isChinese ? '进阶训练5分钟：保持当前难度，仅将速度提升10%' : 'Boost 5 min: keep current difficulty and increase speed by 10%', feature: target === 'all' ? 'vocal' : defaultFeatureForTarget });
  return routines.slice(0, 4);
}

function savePersistedSessions(sessions) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-1000)));
  } catch {}
}

function buildGrowthSection(target, persistedSessions, latestReports, lang = 'ko') {
  const tr = textPack(lang).report;
  if (!persistedSessions.length) {
    return {
      title: tr.growthReportTitle,
      lines: [tr.noGrowthData],
      achievement: {
        targetScore: targetScoreByDomain(target),
        todayAchievementRate: null,
        weeklyGoalProgress: null,
      },
      routines: [{ label: tr.noGrowthRoutine, feature: 'none' }],
      summary: {
        todayAverage: null,
        yesterdayAverage: null,
        weeklyAverage: null,
        vsYesterday: null,
        vsLastWeek: null,
      },
    };
  }

  const now = Date.now();
  const today = dayKey(now);
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
  const weekAgoTs = now - 7 * 24 * 60 * 60 * 1000;

  const scoped = persistedSessions.filter((item) => (target === 'all' ? true : item.domain === target || (target === 'korean' && item.domain === 'korean')));
  const todayScores = scoped.filter((item) => dayKey(item.at) === today).map((item) => item.score);
  const yesterdayScores = scoped.filter((item) => dayKey(item.at) === yesterday).map((item) => item.score);
  const weekScores = scoped.filter((item) => item.at >= weekAgoTs && dayKey(item.at) !== today).map((item) => item.score);

  const todayAvg = average(todayScores);
  const yesterdayAvg = average(yesterdayScores);
  const weekAvg = average(weekScores);

  const vsYesterday = todayAvg != null && yesterdayAvg != null ? todayAvg - yesterdayAvg : null;
  const vsLastWeek = todayAvg != null && weekAvg != null ? todayAvg - weekAvg : null;
  const targetScore = targetScoreByDomain(target);
  const todayAchievementRate = todayAvg != null ? round1((todayAvg / targetScore) * 100) : null;

  const recent7Days = Array.from({ length: 7 }).map((_, idx) => dayKey(now - idx * 24 * 60 * 60 * 1000));
  const dailyMap = scoped.reduce((acc, item) => {
    const key = dayKey(item.at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item.score);
    return acc;
  }, {});
  const achievedDays = recent7Days.filter((key) => {
    const avg = average(dailyMap[key] || []);
    return avg != null && avg >= targetScore;
  }).length;
  const weeklyGoalProgress = round1((achievedDays / 7) * 100);

  const lines = [];
  lines.push(`${tr.todayAverage}: ${todayAvg != null ? round1(todayAvg) : tr.noData}`);
  lines.push(`${tr.compareYesterday}: ${vsYesterday == null ? tr.noCompare : `${vsYesterday >= 0 ? '+' : ''}${round1(vsYesterday)}${scoreUnit(lang)}`}`);
  lines.push(`${tr.compareLastWeek}: ${vsLastWeek == null ? tr.noCompare : `${vsLastWeek >= 0 ? '+' : ''}${round1(vsLastWeek)}${scoreUnit(lang)}`}`);
  lines.push(`${tr.goalRate}: ${todayAchievementRate == null ? tr.noDataShort : `${todayAchievementRate}%`} (${applyVars(tr.goalBased, { score: targetScore })})`);
  lines.push(`${tr.weeklyGoalRate}: ${weeklyGoalProgress}% (${applyVars(tr.achievedDays, { days: achievedDays })})`);

  const latestDance = latestReports?.dance;
  const latestVocal = latestReports?.vocal;
  const latestKorean = getLatestKoreanReport(latestReports?.korean || {});

  const improveTips = [];
  if (target === 'all' || target === 'dance') {
    const needs = latestDance?.summary?.needs || '';
    if (needs) improveTips.push(`${tr.danceTip}: ${translateFeedbackText(needs, lang)}`);
  }
  if (target === 'all' || target === 'vocal') {
    const pitchText = latestVocal?.pitchFeedback || '';
    if (pitchText) improveTips.push(`${tr.vocalTip}: ${translateFeedbackText(pitchText, lang)}`);
  }
  if (target === 'all' || target === 'korean') {
    const kScore = Number(latestKorean?.metrics?.overall ?? latestKorean?.overall ?? 0);
    if (kScore > 0) improveTips.push(`${tr.koreanTip}: ${tr.overallLabel} ${kScore}${scoreUnit(lang)}, ${tr.koreanTipTail}`);
  }
  if (!improveTips.length) improveTips.push(tr.needMoreTips);

  const strongLines = [];
  if (vsYesterday != null && vsYesterday >= 2) strongLines.push(tr.upYesterday);
  if (vsLastWeek != null && vsLastWeek >= 2) strongLines.push(tr.upLastWeek);
  if (!strongLines.length) strongLines.push(tr.lowGrowth);
  const growthSummary = {
    todayAverage: todayAvg != null ? round1(todayAvg) : null,
    yesterdayAverage: yesterdayAvg != null ? round1(yesterdayAvg) : null,
    weeklyAverage: weekAvg != null ? round1(weekAvg) : null,
    vsYesterday: vsYesterday != null ? round1(vsYesterday) : null,
    vsLastWeek: vsLastWeek != null ? round1(vsLastWeek) : null,
  };
  const routines = buildRecommendedRoutines(target, latestReports, growthSummary, lang);

  return {
    title: tr.growthReportTitle,
    lines: [...lines, ...strongLines, ...improveTips],
    achievement: {
      targetScore,
      todayAchievementRate,
      weeklyGoalProgress,
    },
    routines,
    summary: growthSummary,
  };
}

function detectIntent(rawText) {
  const text = String(rawText || '').trim().toLowerCase();
  if (!text) return { type: 'chat' };

  const reportKeywords = ['리포트', '보고서', '결과', '요약', '피드백', 'report', 'summary', 'result', 'feedback', '报告', '报表', '结果', '总结', '反馈'];
  const trendKeywords = ['추이', '트렌드', '변화', '최근', '주간', 'trend', 'recent', '趋势', '最近', '变化'];
  const growthKeywords = ['성장', '어제', '지난주', '개선', '좋아졌', '향상', 'growth', 'improve', 'yesterday', 'last week', '成长', '提升', '改进', '昨天', '上周'];
  const monthlyKeywords = ['월간', '이번달', '이번 달', 'month', '月度', '本月'];
  const dailyKeywords = ['일간', '오늘', 'day', '日度', '今天'];
  const jsonKeywords = ['json', '원본', '상세', '디테일', '데이터'];
  if (reportKeywords.some((k) => text.includes(k)) || trendKeywords.some((k) => text.includes(k)) || growthKeywords.some((k) => text.includes(k))) {
    let period = 'weekly';
    if (monthlyKeywords.some((k) => text.includes(k))) period = 'monthly';
    else if (dailyKeywords.some((k) => text.includes(k))) period = 'daily';
    return {
      type: 'report',
      target: detectReportTarget(text),
      period,
      includeTrend: true,
      includeGrowth: true,
      includeJson: jsonKeywords.some((k) => text.includes(k)) || text.includes('리포트'),
    };
  }

  if (['종료', '닫기', '그만', '홈으로', '/종료', 'exit', 'close', '退出', '关闭'].some((k) => text.includes(k))) return { type: 'feature', feature: 'none' };
  if (text.includes('/댄스') || text.includes('댄스') || text.includes('춤') || text.includes('/dance') || text.includes('dance') || text.includes('舞蹈')) return { type: 'feature', feature: 'dance' };
  if (text.includes('/보컬') || text.includes('보컬') || text.includes('노래') || text.includes('음정') || text.includes('/vocal') || text.includes('vocal') || text.includes('sing') || text.includes('声乐') || text.includes('唱歌')) return { type: 'feature', feature: 'vocal' };
  if (text.includes('가사') && text.includes('학습')) return { type: 'feature', feature: 'korean-lyrics' };
  if (text.includes('ai') && (text.includes('교정') || text.includes('발음교정'))) return { type: 'feature', feature: 'korean-correction' };
  if (text.includes('문장') && text.includes('따라')) return { type: 'feature', feature: 'korean-follow' };
  if (text.includes('발음') && text.includes('연습')) return { type: 'feature', feature: 'korean-pronunciation' };
  if (text.includes('/한국어') || text.includes('한국어') || text.includes('/korean') || text.includes('korean') || text.includes('韩语')) return { type: 'feature', feature: 'korean-pronunciation' };
  return { type: 'chat' };
}

function buildReportCard(target, reports, reportHistory, persistedSessions, period = 'weekly', reportDate = dayKey(Date.now()), options = {}) {
  const lang = normalizeLanguage(options.language || 'ko');
  const tr = textPack(lang).report;
  const includeTrend = options.includeTrend !== false;
  const includeGrowth = options.includeGrowth !== false;
  const lines = [];
  const trendLines = [];
  const periodSummary = buildPeriodSummary(target, persistedSessions, period, reportDate, lang);
  const jsonPayload = {
    generatedAt: new Date().toISOString(),
    target,
    period,
    reportDate,
    latest: {},
    recentHistory: {},
    periodSummary,
  };

  if (target === 'all' || target === 'dance') {
    const dance = reports.dance;
    if (dance?.updatedAt) {
      lines.push(`${tr.danceLabel}: ${tr.scoreLabel} ${dance.score ?? '—'} · ${tr.needsLabel} ${translateFeedbackText(dance?.summary?.needs || '—', lang)}`);
      jsonPayload.latest.dance = dance;
      jsonPayload.recentHistory.dance = (reportHistory.dance || []).slice(-8);
      if (includeTrend) trendLines.push(summarizeTrend(tr.danceLabel, (reportHistory.dance || []).slice(-8), lang));
    }
  }
  if (target === 'all' || target === 'vocal') {
    const vocal = reports.vocal;
    if (vocal?.updatedAt) {
      const hz = vocal.currentHz ? `${Number(vocal.currentHz).toFixed(1)}Hz` : tr.noMeasure;
      lines.push(`${tr.vocalLabel}: ${tr.liveLabel} ${vocal.liveScore ?? '—'} · ${tr.noteLabel} ${vocal.currentNote || '-'} (${hz})`);
      jsonPayload.latest.vocal = vocal;
      jsonPayload.recentHistory.vocal = (reportHistory.vocal || []).slice(-8);
      if (includeTrend) trendLines.push(summarizeTrend(tr.vocalLabel, (reportHistory.vocal || []).slice(-8), lang));
    }
  }
  if (target === 'all' || target === 'korean') {
    const latest = getLatestKoreanReport(reports.korean);
    if (latest) {
      lines.push(`${tr.koreanLabel}: ${tr.overallLabel} ${latest?.metrics?.overall ?? latest?.overall ?? '—'} · ${tr.transcriptLabel} ${latest?.transcript || tr.noTranscript}`);
      jsonPayload.latest.korean = {
        latest,
        modes: reports.korean,
      };
      jsonPayload.recentHistory.korean = (reportHistory.korean || []).slice(-8);
      if (includeTrend) trendLines.push(summarizeTrend(tr.koreanLabel, (reportHistory.korean || []).slice(-8), lang));
    }
  }
  if (!lines.length) {
    return {
      title: tr.reportFallbackTitle,
      body: [tr.reportBodyNoData1, tr.reportBodyNoData2],
      text: tr.reportTextNoData,
      periodSummary,
      trend: [],
      growth: null,
    };
  }
  const growth = includeGrowth ? buildGrowthSection(target, persistedSessions, reports, lang) : null;
  return {
    title: target === 'all' ? tr.reportTitle : `${target.toUpperCase()} ${tr.reportFallbackTitle}`,
    body: lines,
    periodSummary,
    trend: includeTrend ? trendLines : [],
    growth,
    text: applyVars(tr.reportTextReady, { target: target === 'all' ? tr.allTarget : target }),
  };
}

function buildCompactContext({ activeFeature, reports, reportHistory, persistedSessions, reportPeriod, reportDate, reportCard }) {
  const latestKorean = getLatestKoreanReport(reports?.korean || {});
  return {
    activeFeature,
    reportPeriod,
    reportDate,
    latest: {
      dance: reports?.dance
        ? {
            score: reports.dance.score,
            needs: reports.dance?.summary?.needs,
            issue: reports.dance?.issue,
            updatedAt: reports.dance.updatedAt,
          }
        : null,
      vocal: reports?.vocal
        ? {
            liveScore: reports.vocal.liveScore,
            note: reports.vocal.currentNote,
            hz: reports.vocal.currentHz,
            pitchFeedback: reports.vocal.pitchFeedback,
            tuningState: reports.vocal.tuningState,
            updatedAt: reports.vocal.updatedAt,
          }
        : null,
      korean: latestKorean
        ? {
            overall: latestKorean?.metrics?.overall ?? latestKorean?.overall,
            transcript: latestKorean?.transcript,
            updatedAt: latestKorean?.updatedAt,
          }
        : null,
    },
    trend: {
      dance: (reportHistory?.dance || []).slice(-8),
      vocal: (reportHistory?.vocal || []).slice(-8),
      korean: (reportHistory?.korean || []).slice(-8),
    },
    growth: reportCard?.growth
      ? {
          achievement: reportCard.growth.achievement,
          routines: (reportCard.growth.routines || []).map((item) => item?.label || item).slice(0, 4),
        }
      : null,
    sessionCount: (persistedSessions || []).length,
  };
}

function buildFallbackCoachReply(input, reportCard, context, language = 'ko') {
  const lang = normalizeLanguage(language);
  const replyPack = {
    ko: {
      improveHints: ['부족', '개선'],
      routineHints: ['연습', '루틴', '해야'],
      danceLine: (v) => `댄스는 ${v} 보완이 우선이에요.`,
      vocalLine: (v) => `보컬은 현재 "${v}" 피드백이 핵심입니다.`,
      koreanLine: (v) => `한국어는 현재 종합 ${v}점으로 정확도 유지 훈련이 필요해요.`,
      noData: '아직 데이터가 적어요. 각 모드를 5분 이상 연습하면 정확하게 분석해줄 수 있어요.',
      routineOrder: (a, b) => `추천 루틴은 다음 순서로 진행해보세요: 1) ${a} 2) ${b || '보컬/한국어 5분 보완 루틴'}`,
      routineNeedMore: '먼저 댄스/보컬/한국어 중 하나를 3~5분 연습하면 개인 맞춤 루틴을 바로 추천해줄게요.',
      general: '좋아요. 지금 데이터 기준으로 연습 우선순위와 개선 포인트를 바로 분석해줄게요. "부족한 게 뭐야?" 또는 "오늘 뭐 연습해야 돼?"라고 물어봐줘도 됩니다.',
    },
    en: {
      improveHints: ['improve', 'weak', 'better'],
      routineHints: ['practice', 'routine', 'train'],
      danceLine: (v) => `Dance priority: improve "${v}".`,
      vocalLine: (v) => `Vocal priority feedback: "${v}".`,
      koreanLine: (v) => `Korean overall score is ${v}; focus on accuracy training.`,
      noData: 'Data is still limited. Practice each mode for at least 5 minutes for accurate analysis.',
      routineOrder: (a, b) => `Try this order: 1) ${a} 2) ${b || 'Vocal/Korean 5-minute supplement routine'}`,
      routineNeedMore: 'Practice one of Dance/Vocal/Korean for 3-5 minutes first, then I can recommend a personalized routine.',
      general: 'Great. I can analyze your current priorities and improvement points. Ask "What is weak?" or "What should I practice today?"',
    },
    ja: {
      improveHints: ['改善', '不足', '弱い'],
      routineHints: ['練習', 'ルーティン'],
      danceLine: (v) => `ダンスは「${v}」の補強が最優先です。`,
      vocalLine: (v) => `ボーカルは「${v}」への対応が重要です。`,
      koreanLine: (v) => `韓国語は現在総合 ${v} 点で、正確性を維持する練習が必要です。`,
      noData: 'データがまだ少ないです。各モードを5分以上練習すると、より正確に分析できます。',
      routineOrder: (a, b) => `おすすめ順: 1) ${a} 2) ${b || 'ボーカル/韓国語 5分補強ルーティン'}`,
      routineNeedMore: 'まずいずれかのモードを3〜5分練習すると、個別ルーティンを提案できます。',
      general: '現在のデータを基に、優先練習と改善ポイントをすぐ分析できます。「何が不足？」と聞いてみてください。',
    },
    th: {
      improveHints: ['ปรับปรุง', 'จุดอ่อน'],
      routineHints: ['ฝึก', 'รูทีน'],
      danceLine: (v) => `ด้านเต้นควรโฟกัสที่ "${v}" ก่อน`,
      vocalLine: (v) => `ด้านร้องเพลง ตอนนี้ประเด็นหลักคือ "${v}"`,
      koreanLine: (v) => `ภาษาเกาหลีตอนนี้อยู่ที่ ${v} คะแนน ควรเน้นความแม่นยำเป็นหลัก`,
      noData: 'ข้อมูลยังน้อยอยู่ ลองฝึกแต่ละโหมดอย่างน้อย 5 นาทีเพื่อวิเคราะห์ได้แม่นขึ้น',
      routineOrder: (a, b) => `ลำดับรูทีนแนะนำ: 1) ${a} 2) ${b || 'เสริม Vocal/Korean 5 นาที'}`,
      routineNeedMore: 'ลองฝึกโหมดใดโหมดหนึ่ง 3-5 นาที แล้วฉันจะแนะนำรูทีนเฉพาะบุคคลให้ทันที',
      general: 'ฉันสามารถวิเคราะห์ลำดับการฝึกและจุดที่ควรปรับปรุงจากข้อมูลตอนนี้ได้เลย',
    },
    vi: {
      improveHints: ['cai thien', 'yeu', 'thieu'],
      routineHints: ['luyen', 'routine', 'thuc hanh'],
      danceLine: (v) => `Voi nhay, uu tien cai thien "${v}".`,
      vocalLine: (v) => `Voi vocal, phan hoi quan trong hien tai la "${v}".`,
      koreanLine: (v) => `Tieng Han hien tai dat ${v} diem, nen uu tien do chinh xac.`,
      noData: 'Du lieu van con it. Hay luyen moi che do toi thieu 5 phut de phan tich chinh xac hon.',
      routineOrder: (a, b) => `Thu tu routine de xuat: 1) ${a} 2) ${b || 'Bo sung Vocal/Korean 5 phut'}`,
      routineNeedMore: 'Hay luyen mot trong cac che do 3-5 phut, minh se de xuat routine ca nhan ngay.',
      general: 'Minh co the phan tich uu tien luyen tap va diem can cai thien tu du lieu hien tai.',
    },
    es: {
      improveHints: ['mejorar', 'debil', 'falta'],
      routineHints: ['practica', 'rutina', 'entrenar'],
      danceLine: (v) => `En baile, la prioridad es mejorar "${v}".`,
      vocalLine: (v) => `En vocal, el punto clave ahora es "${v}".`,
      koreanLine: (v) => `En coreano tienes ${v} puntos; conviene priorizar la precision.`,
      noData: 'Aun hay pocos datos. Practica cada modo al menos 5 minutos para un analisis mas preciso.',
      routineOrder: (a, b) => `Orden recomendado: 1) ${a} 2) ${b || 'Refuerzo Vocal/Coreano de 5 minutos'}`,
      routineNeedMore: 'Practica un modo 3-5 minutos primero y te recomendare una rutina personalizada.',
      general: 'Puedo analizar tus prioridades de practica y puntos de mejora con los datos actuales.',
    },
    fr: {
      improveHints: ['ameliorer', 'faible', 'manque'],
      routineHints: ['pratique', 'routine', 'entrainement'],
      danceLine: (v) => `En danse, la priorite est d'ameliorer "${v}".`,
      vocalLine: (v) => `En vocal, le point principal est "${v}".`,
      koreanLine: (v) => `En coreen, vous etes a ${v} points; il faut prioriser la precision.`,
      noData: "Les donnees sont encore limitees. Pratiquez chaque mode au moins 5 minutes pour une analyse plus fiable.",
      routineOrder: (a, b) => `Ordre recommande: 1) ${a} 2) ${b || 'Renfort Vocal/Coreen 5 minutes'}`,
      routineNeedMore: 'Pratiquez un mode 3-5 minutes, puis je proposerai une routine personnalisee.',
      general: "Je peux analyser vos priorites d'entrainement et les points a corriger avec les donnees actuelles.",
    },
    zh: {
      improveHints: ['改进', '不足', '薄弱', '提升'],
      routineHints: ['练习', '训练', '方案', '路线'],
      danceLine: (v) => `舞蹈方面当前优先改进「${v}」。`,
      vocalLine: (v) => `声乐方面目前最关键的反馈是「${v}」。`,
      koreanLine: (v) => `韩语当前综合分为 ${v} 分，建议先强化准确度。`,
      noData: '当前数据还不够。每个模式至少练习 5 分钟后，分析会更准确。',
      routineOrder: (a, b) => `建议按这个顺序练习：1) ${a} 2) ${b || '声乐/韩语 5 分钟补强训练'}`,
      routineNeedMore: '先进行 3~5 分钟舞蹈/声乐/韩语中的任一练习，我就能给你个性化训练方案。',
      general: '我可以基于当前数据，直接分析你的训练优先级和改进重点。你也可以问我“我现在最该练什么？”',
    },
  }[lang] || {
    improveHints: [],
    routineHints: [],
    danceLine: (v) => `Dance priority: improve "${v}".`,
    vocalLine: (v) => `Vocal priority feedback: "${v}".`,
    koreanLine: (v) => `Korean overall score is ${v}; focus on accuracy training.`,
    noData: 'Data is still limited. Practice each mode for at least 5 minutes for accurate analysis.',
    routineOrder: (a, b) => `Try this order: 1) ${a} 2) ${b || 'Vocal/Korean 5-minute supplement routine'}`,
    routineNeedMore: 'Practice one of Dance/Vocal/Korean for 3-5 minutes first, then I can recommend a personalized routine.',
    general: 'Great. I can analyze your current priorities and improvement points. Ask "What is weak?" or "What should I practice today?"',
  };
  const text = String(input || '');
  const lowered = text.toLowerCase();
  const danceNeeds = context?.latest?.dance?.needs;
  const vocalFeedback = context?.latest?.vocal?.pitchFeedback;
  const koreanScore = context?.latest?.korean?.overall;
  if (replyPack.improveHints.some((k) => lowered.includes(String(k).toLowerCase())) || text.includes('부족') || text.includes('개선')) {
    const lines = [];
    if (danceNeeds) lines.push(replyPack.danceLine(danceNeeds));
    if (vocalFeedback) lines.push(replyPack.vocalLine(vocalFeedback));
    if (koreanScore != null) lines.push(replyPack.koreanLine(koreanScore));
    if (!lines.length) lines.push(replyPack.noData);
    return lines.join(' ');
  }
  if (replyPack.routineHints.some((k) => lowered.includes(String(k).toLowerCase())) || text.includes('연습') || text.includes('루틴') || text.includes('해야')) {
    const routines = reportCard?.growth?.routines || [];
    if (routines.length) return replyPack.routineOrder(routines[0].label || routines[0], routines[1]?.label || routines[1]);
    return replyPack.routineNeedMore;
  }
  return replyPack.general;
}

function toneInstruction(tone, language = 'ko') {
  const lang = normalizeLanguage(language);
  if (lang === 'ko') {
    if (tone === 'strict') return '톤: 코치처럼 엄격하고 직설적이되 무례하지 않게.';
    if (tone === 'brief') return '톤: 핵심만 짧고 명확하게. 문장 수를 최소화.';
    return '톤: 친절하고 동기부여 중심.';
  }
  if (lang === 'zh') {
    if (tone === 'strict') return '语气：像教练一样严格直接，但保持礼貌。';
    if (tone === 'brief') return '语气：简短明确，只说核心要点。';
    return '语气：友好且有激励感。';
  }
  if (tone === 'strict') return 'Tone: strict and direct like a coach, but respectful.';
  if (tone === 'brief') return 'Tone: brief and clear, keep sentences minimal.';
  return 'Tone: friendly and motivating.';
}

async function requestGeminiCoachReply({ input, conversationSnapshot, context, reportCard, coachTone = 'friendly', language = 'ko' }) {
  if (!GEMINI_API_KEY) return buildFallbackCoachReply(input, reportCard, context, language);
  const lang = normalizeLanguage(language);
  const langNameMap = {
    ko: 'Korean',
    en: 'English',
    th: 'Thai',
    vi: 'Vietnamese',
    ja: 'Japanese',
    es: 'Spanish',
    fr: 'French',
    zh: 'Chinese (Simplified)',
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;
  const recentMessages = (conversationSnapshot || []).slice(-8).map((msg) => `${msg.role === 'assistant' ? 'AI' : 'USER'}: ${msg.text}`).join('\n');
  const prompt = [
    '당신은 ONNODE의 AI 코치입니다.',
    '목표: 사용자의 질문 의도를 파악하고, 주어진 실시간 연습/리포트 데이터를 근거로 개인화 피드백을 제공합니다.',
    toneInstruction(coachTone, lang),
    '규칙:',
    `- 반드시 ${langNameMap[lang]}로 답변`,
    '- 3~6문장으로 간결하게',
    '- 가능하면 수치(점수/추이/달성률)를 1개 이상 포함',
    '- 마지막 문장에는 바로 실행 가능한 다음 연습 1개 제시',
    `현재 코칭 데이터(JSON): ${JSON.stringify(context)}`,
    reportCard ? `최근 리포트 카드(JSON): ${JSON.stringify(reportCard)}` : '',
    recentMessages ? `최근 대화:\n${recentMessages}` : '',
    `사용자 질문: ${input}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.55,
        topP: 0.9,
        maxOutputTokens: 380,
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    const reason = data?.error?.message || `Gemini 호출 실패 (${response.status})`;
    throw new Error(reason);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();
  if (!text) throw new Error('Gemini response is empty.');
  return text;
}

function renderFeatureComponent(feature, onReportUpdate) {
  if (feature === 'dance') return <DanceTrainingView onNavigate={() => {}} onReportUpdate={(payload) => onReportUpdate('dance', payload)} />;
  if (feature === 'vocal') return <VocalTrainingView onNavigate={() => {}} onReportUpdate={(payload) => onReportUpdate('vocal', payload)} />;
  if (feature === 'korean-pronunciation') return <PronunciationMode onReportUpdate={(payload) => onReportUpdate('korean-pronunciation', payload)} />;
  if (feature === 'korean-follow') return <FollowAlongMode onReportUpdate={(payload) => onReportUpdate('korean-follow', payload)} />;
  if (feature === 'korean-correction') return <CorrectionMode onReportUpdate={(payload) => onReportUpdate('korean-correction', payload)} />;
  if (feature === 'korean-lyrics') return <LyricsVocabMode onReportUpdate={(payload) => onReportUpdate('korean-lyrics', payload)} />;
  return null;
}

export default function AICoachView() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState([
    createMessage(
      'assistant',
      '안녕하세요! 이 화면은 채팅으로 모든 기능을 실행합니다.\n예) "댄스 연습 시작", "보컬 연습하고 싶어", "오늘 연습 리포트 보여줘"'
    ),
  ]);
  const [inputValue, setInputValue] = useState('');
  const [activeFeature, setActiveFeature] = useState('none');
  const [activeTab, setActiveTab] = useState('chat');
  const [coachTone, setCoachTone] = useState('friendly');
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportDate, setReportDate] = useState(dayKey(Date.now()));
  const [coachLoading, setCoachLoading] = useState(false);
  const [lastReportCard, setLastReportCard] = useState(null);
  const [reports, setReports] = useState({
    dance: null,
    vocal: null,
    korean: {
      pronunciation: null,
      follow: null,
      correction: null,
      lyrics: null,
    },
  });
  const [reportHistory, setReportHistory] = useState({
    dance: [],
    vocal: [],
    korean: [],
  });
  const [persistedSessions, setPersistedSessions] = useState(() => loadPersistedSessions());
  const historyMetaRef = useRef({
    dance: { lastAt: 0, lastScore: null },
    vocal: { lastAt: 0, lastScore: null },
    korean: { lastAt: 0, lastScore: null },
  });
  const storeLanguage = useLanguageStore((s) => s.language);
  const setStoreLanguage = useLanguageStore((s) => s.setLanguage);
  const currentLanguage = normalizeLanguage(storeLanguage || i18n.resolvedLanguage || i18n.language);
  const ui = textPack(currentLanguage);
  const bottomTabs = useMemo(
    () =>
      BOTTOM_TABS.map((tab) => ({
        ...tab,
        label: ui.tabs[tab.id] || tab.label,
      })),
    [ui.tabs]
  );

  const onReportUpdate = useCallback((domain, payload) => {
    setReports((prev) => {
      const next = { ...prev };
      if (domain === 'dance') next.dance = payload;
      else if (domain === 'vocal') next.vocal = payload;
      else if (domain === 'korean-pronunciation') next.korean = { ...next.korean, pronunciation: payload };
      else if (domain === 'korean-follow') next.korean = { ...next.korean, follow: payload };
      else if (domain === 'korean-correction') next.korean = { ...next.korean, correction: payload };
      else if (domain === 'korean-lyrics') next.korean = { ...next.korean, lyrics: payload };
      return next;
    });

    const rootDomain = domain.startsWith('korean-') ? 'korean' : domain;
    const score = extractScoreFromPayload(domain, payload);
    if (!Number.isFinite(score)) return;
    const now = Date.now();
    const meta = historyMetaRef.current[rootDomain] || { lastAt: 0, lastScore: null };
    const shouldPush = now - Number(meta.lastAt || 0) > 4500 || Math.abs(score - Number(meta.lastScore ?? score)) >= 3;
    if (!shouldPush) return;
    historyMetaRef.current[rootDomain] = { lastAt: now, lastScore: score };
    setReportHistory((prev) => {
      const next = { ...prev };
      const list = [...(next[rootDomain] || []), { at: now, score: Math.round(score) }];
      next[rootDomain] = list.slice(-40);
      return next;
    });
    setPersistedSessions((prev) => {
      const next = [...prev, { at: now, domain: rootDomain, score: Math.round(score) }].slice(-1000);
      savePersistedSessions(next);
      return next;
    });
  }, []);

  const showQuickCommands = inputValue.startsWith('/');
  const featureComponent = useMemo(() => renderFeatureComponent(activeFeature, onReportUpdate), [activeFeature, onReportUpdate]);

  const handleSubmitMessage = async (rawText) => {
    if (coachLoading) return;
    const content = rawText.trim();
    if (!content) return;
    const userMessage = createMessage('user', content);
    const conversationSnapshot = [...messages, { role: 'user', text: content }];
    setMessages((prev) => [...prev, userMessage]);
    const intent = detectIntent(content);

    if (intent.type === 'feature') {
      setActiveFeature(intent.feature);
      setActiveTab(tabFromFeature(intent.feature));
      const reply = getModeReply(intent.feature, currentLanguage);
      setMessages((prev) => [...prev, createMessage('assistant', reply)]);
      setInputValue('');
      return;
    }

    if (intent.type === 'report') {
      setActiveTab('report');
      setActiveFeature('none');
      setReportPeriod(intent.period || 'weekly');
      const card = buildReportCard(intent.target, reports, reportHistory, persistedSessions, intent.period || reportPeriod, reportDate, {
        includeTrend: intent.includeTrend,
        includeGrowth: intent.includeGrowth,
        language: currentLanguage,
      });
      setLastReportCard(card);
      setMessages((prev) => [...prev, createMessage('assistant', card.text)]);
      setInputValue('');
      setCoachLoading(true);
      try {
        const coachReply = await generateCoachReply(content, [...conversationSnapshot, { role: 'assistant', text: card.text }], card);
        setMessages((prev) => [...prev, createMessage('assistant', coachReply)]);
      } finally {
        setCoachLoading(false);
      }
      return;
    }

    setInputValue('');
    setCoachLoading(true);
    try {
      const coachReply = await generateCoachReply(content, conversationSnapshot, lastReportCard);
      setMessages((prev) => [...prev, createMessage('assistant', coachReply)]);
    } finally {
      setCoachLoading(false);
    }
  };

  const runRoutine = (routine) => {
    const feature = routine?.feature || 'none';
    if (feature === 'none') return;
    setActiveFeature(feature);
    setActiveTab(tabFromFeature(feature));
    const baseReply = getModeReply(feature, currentLanguage);
    setMessages((prev) => [
      ...prev,
      createMessage('assistant', `${ui.report.routineTitle}: ${routine.label}\n${baseReply}`),
    ]);
  };

  const refreshReportCard = useCallback(
    (target = 'all', period = reportPeriod, date = reportDate) => {
      const card = buildReportCard(target, reports, reportHistory, persistedSessions, period, date, {
        includeTrend: true,
        includeGrowth: true,
        language: currentLanguage,
      });
      setLastReportCard(card);
    },
    [currentLanguage, persistedSessions, reportDate, reportHistory, reportPeriod, reports]
  );

  const createPracticeLikeReportData = useCallback(() => {
    const generated = buildPracticeLikeSeedData(21);
    setPersistedSessions(generated.persistedSessions);
    savePersistedSessions(generated.persistedSessions);
    setReportHistory(generated.reportHistory);
    setReports(generated.reports);
    historyMetaRef.current = {
      dance: { lastAt: 0, lastScore: null },
      vocal: { lastAt: 0, lastScore: null },
      korean: { lastAt: 0, lastScore: null },
    };
    const card = buildReportCard('all', generated.reports, generated.reportHistory, generated.persistedSessions, reportPeriod, reportDate, {
      includeTrend: true,
      includeGrowth: true,
      language: currentLanguage,
    });
    setLastReportCard(card);
    setActiveTab('report');
    setActiveFeature('none');
    setMessages((prev) => [
      ...prev,
      createMessage('assistant', applyVars(ui.report.sampleCreated, { count: generated.persistedSessions.length })),
    ]);
  }, [currentLanguage, reportDate, reportPeriod, ui.report.sampleCreated]);

  const generateCoachReply = useCallback(
    async (userInput, conversationSnapshot, reportCard = null) => {
      const context = buildCompactContext({
        activeFeature,
        reports,
        reportHistory,
        persistedSessions,
        reportPeriod,
        reportDate,
        reportCard,
      });
      try {
        return await requestGeminiCoachReply({
          input: userInput,
          conversationSnapshot,
          context,
          reportCard,
          coachTone,
          language: currentLanguage,
        });
      } catch (error) {
        const fallback = buildFallbackCoachReply(userInput, reportCard, context, currentLanguage);
        const noteMap = {
          ko: '참고: AI 연결 오류',
          en: 'Note: AI connection error',
          ja: '参考: AI接続エラー',
          th: 'หมายเหตุ: เกิดข้อผิดพลาดการเชื่อมต่อ AI',
          vi: 'Luu y: loi ket noi AI',
          es: 'Nota: error de conexion con AI',
          fr: 'Note: erreur de connexion AI',
          zh: '提示：AI 连接错误',
        };
        const note = noteMap[currentLanguage] || noteMap.en;
        return `${fallback}\n\n(${note} - ${error?.message || 'unknown error'})`;
      }
    },
    [activeFeature, coachTone, currentLanguage, persistedSessions, reportDate, reportHistory, reportPeriod, reports]
  );

  const handleBottomTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'chat') {
      setActiveFeature('none');
      return;
    }
    if (tabId === 'report') {
      setActiveFeature('none');
      refreshReportCard('all', reportPeriod, reportDate);
      return;
    }
    const tab = BOTTOM_TABS.find((item) => item.id === tabId);
    if (tab?.feature) {
      setActiveFeature(tab.feature);
      setMessages((prev) => [...prev, createMessage('assistant', getModeReply(tab.feature, currentLanguage))]);
    }
  };

  useEffect(() => {
    if (activeTab !== 'report') return;
    refreshReportCard('all', reportPeriod, reportDate);
  }, [activeTab, reportDate, reportPeriod, refreshReportCard]);

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="h-16 border-b border-[#E5E5E5] px-6 flex items-center justify-between">
        <div>
          <p className="font-bold text-[#111111]">{t('views.aicoach')}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-[#666666]">{ui.languageLabel}</p>
          <select
            value={currentLanguage}
            onChange={(e) => setStoreLanguage(normalizeLanguage(e.target.value))}
            className="rounded-md border border-[#E5E5E5] px-2 py-1 text-xs bg-white"
          >
            {LANGUAGE_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {activeTab === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F5F5F7]">
            <div className="rounded-xl border border-[#E5E5E5] bg-white p-3">
              <p className="text-[11px] text-[#666666] mb-2">{ui.toneLabel}</p>
              <div className="flex gap-2">
                {COACH_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setCoachTone(tone.id)}
                    className={`rounded-md px-2 py-1 text-[11px] border ${
                      coachTone === tone.id ? 'bg-[#FF1F8E] text-white border-[#FF1F8E]' : 'bg-white text-[#666666] border-[#E5E5E5]'
                    }`}
                  >
                    {ui.tone[tone.id] || tone.label}
                  </button>
                ))}
              </div>
            </div>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="w-9 h-9 bg-white border border-[#E5E5E5] rounded-xl grid place-items-center">
                  <User size={16} className="text-slate-400" />
                </div>
                <div className={`max-w-[72%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-[#FF1F8E] text-white rounded-[16px_16px_4px_16px]'
                        : 'bg-white text-[#111111] rounded-[16px_16px_16px_4px] border border-[#E5E5E5]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {coachLoading ? (
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-white border border-[#E5E5E5] rounded-xl grid place-items-center">
                  <User size={16} className="text-slate-400" />
                </div>
                <div className="inline-block px-4 py-2 text-sm bg-white text-[#111111] rounded-[16px_16px_16px_4px] border border-[#E5E5E5]">
                  {t('aicoach.loading')}
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitMessage(inputValue);
            }}
            className="p-4 border-t border-[#E5E5E5] bg-white"
          >
            <div className="relative">
              {showQuickCommands && (
                <div className="absolute left-0 right-0 bottom-[56px] rounded-xl border border-[#E5E5E5] bg-white shadow-lg p-2 z-20">
                  {QUICK_COMMANDS.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-pink-50 hover:text-pink-500 transition"
                      onClick={() => handleSubmitMessage(command.label)}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-2xl border border-[#E5E5E5] px-3 py-2 flex items-center gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={t('aicoach.placeholder')}
                  disabled={coachLoading}
                  className="flex-1 text-sm outline-none bg-transparent"
                />
                <button type="submit" disabled={coachLoading} className="w-9 h-9 rounded-xl bg-[#FF1F8E] text-white grid place-items-center disabled:opacity-60">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </form>
        </>
      ) : null}

      {activeTab === 'report' ? (
        <div className="flex-1 min-h-0 bg-[#F5F5F7]">
          <ReportListView onSwitchSubTab={handleBottomTab} />
        </div>
      ) : null}

      {activeTab !== 'chat' && activeTab !== 'report' ? (
        <div className="flex-1 overflow-y-auto bg-[#F5F5F7]">{featureComponent}</div>
      ) : null}
      <nav className="border-t border-[#E5E5E5] bg-white">
        <div className="grid grid-cols-5 gap-1 p-2">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleBottomTab(tab.id)}
              className={`rounded-lg py-2 text-[11px] font-semibold ${
                activeTab === tab.id ? 'bg-[#FF1F8E] text-white' : 'bg-[#F5F5F7] text-[#666666]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
