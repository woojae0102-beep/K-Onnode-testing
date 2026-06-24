// @ts-nocheck
/** 핵심 8그룹(groupPracticeData) 외 K-POP 그룹 카탈로그 — 멤버·별칭 포함 */

const COLORS = ['#FF6348', '#FFD700', '#FF1F8E', '#A78BFA', '#6EE7B7', '#93C5FD', '#FCD34D', '#F87171', '#34D399', '#60A5FA', '#FB7185', '#818CF8', '#4ADE80'];
const AVATARS = ['⭐', '💫', '🌟', '✨', '💖', '🔥', '💜', '💙', '💚', '💛', '🌸', '🦋', '🐰'];

function layoutLine(members, formation = 'line') {
  const n = members.length;
  return members.map((m, i) => {
    const t = (i + 1) / (n + 1);
    const defaultX = formation === 'v_shape'
      ? 0.5 + (i - (n - 1) / 2) * 0.18
      : t;
    const defaultY = formation === 'v_shape'
      ? 0.25 + Math.abs(i - (n - 1) / 2) * 0.12
      : 0.4;
    return {
      ...m,
      id: m.id || `m${i + 1}`,
      color: COLORS[i % COLORS.length],
      avatar: m.avatar || AVATARS[i % AVATARS.length],
      defaultX,
      defaultY,
      position: { default: { x: defaultX, y: defaultY } },
    };
  });
}

function g(id, name, nameKr, aliases, members, formation = 'line') {
  const laid = layoutLine(members, formation);
  return {
    [id]: {
      name,
      nameKr,
      memberCount: laid.length,
      defaultFormation: formation,
      aliases: [name, nameKr, id, ...aliases].filter(Boolean),
      members: laid,
    },
  };
}

/** groupPracticeData에 없는 그룹만 — 키는 groupId */
export const KPOP_EXTENDED_GROUPS = {
  ...g('enhypen', 'ENHYPEN', '엔하이픈', ['엔하이픈'], [
    { id: 'jungwon', name: 'Jungwon', nameKr: '정원' },
    { id: 'heeseung', name: 'Heeseung', nameKr: '희승' },
    { id: 'jay', name: 'Jay', nameKr: '제이' },
    { id: 'jake', name: 'Jake', nameKr: '제이크' },
    { id: 'sunghoon', name: 'Sunghoon', nameKr: '성훈' },
    { id: 'sunoo', name: 'Sunoo', nameKr: '선우' },
    { id: 'ni-ki', name: 'Ni-ki', nameKr: '니키' },
  ], 'v_shape'),

  ...g('txt', 'TXT', '투모로우바이투게더', ['tomorrow x together', '투바투', '투모로우바이투게더'], [
    { id: 'soobin', name: 'Soobin', nameKr: '수빈' },
    { id: 'yeonjun', name: 'Yeonjun', nameKr: '연준' },
    { id: 'beomgyu', name: 'Beomgyu', nameKr: '범규' },
    { id: 'taehyun', name: 'Taehyun', nameKr: '태현' },
    { id: 'hueningkai', name: 'Hueningkai', nameKr: '휴닝카이' },
  ], 'line'),

  ...g('le-sserafim', 'LE SSERAFIM', '르세라핌', ['lesserafim', '르세라핌'], [
    { id: 'sakura', name: 'Sakura', nameKr: '사쿠라' },
    { id: 'chaewon', name: 'Chaewon', nameKr: '채원' },
    { id: 'yunjin', name: 'Yunjin', nameKr: '윤진' },
    { id: 'kazuha', name: 'Kazuha', nameKr: '카즈하' },
    { id: 'eunchae', name: 'Eunchae', nameKr: '은채' },
  ], 'line'),

  ...g('illit', 'ILLIT', '아일릿', ['아일릿'], [
    { id: 'yunah', name: 'Yunah', nameKr: '윤아' },
    { id: 'minju', name: 'Minju', nameKr: '민주' },
    { id: 'moka', name: 'Moka', nameKr: '모카' },
    { id: 'wonhee', name: 'Wonhee', nameKr: '원희' },
    { id: 'iroha', name: 'Iroha', nameKr: '이로하' },
  ], 'scattered'),

  ...g('babymonster', 'BABYMONSTER', '베이비몬스터', ['baby monster', '베이비몬스터'], [
    { id: 'ruka', name: 'Ruka', nameKr: '루카' },
    { id: 'pharita', name: 'Pharita', nameKr: '파리타' },
    { id: 'asa', name: 'Asa', nameKr: '아사' },
    { id: 'ahyeon', name: 'Ahyeon', nameKr: '아현' },
    { id: 'rami', name: 'Rami', nameKr: '라미' },
    { id: 'rora', name: 'Rora', nameKr: '로라' },
    { id: 'chiquita', name: 'Chiquita', nameKr: '치키타' },
  ], 'line'),

  ...g('stray-kids', 'Stray Kids', '스트레이키즈', ['straykids', 'skz', '스트레이키즈'], [
    { id: 'bang-chan', name: 'Bang Chan', nameKr: '방찬' },
    { id: 'lee-know', name: 'Lee Know', nameKr: '리노' },
    { id: 'changbin', name: 'Changbin', nameKr: '창빈' },
    { id: 'hyunjin', name: 'Hyunjin', nameKr: '현진' },
    { id: 'han', name: 'Han', nameKr: '한' },
    { id: 'felix', name: 'Felix', nameKr: '필릭스' },
    { id: 'seungmin', name: 'Seungmin', nameKr: '승민' },
    { id: 'in', name: 'I.N', nameKr: '아이엔' },
  ], 'line'),

  ...g('seventeen', 'SEVENTEEN', '세븐틴', ['svt', '세븐틴'], [
    { id: 's-coups', name: 'S.Coups', nameKr: '에스쿱스' },
    { id: 'jeonghan', name: 'Jeonghan', nameKr: '정한' },
    { id: 'joshua', name: 'Joshua', nameKr: '조슈아' },
    { id: 'jun', name: 'Jun', nameKr: '준' },
    { id: 'hoshi', name: 'Hoshi', nameKr: '호시' },
    { id: 'wonwoo', name: 'Wonwoo', nameKr: '원우' },
    { id: 'woozi', name: 'Woozi', nameKr: '우지' },
    { id: 'dk', name: 'DK', nameKr: '도겸' },
    { id: 'mingyu', name: 'Mingyu', nameKr: '민규' },
    { id: 'the8', name: 'The8', nameKr: '디에잇' },
    { id: 'seungkwan', name: 'Seungkwan', nameKr: '승관' },
    { id: 'vernon', name: 'Vernon', nameKr: '버논' },
    { id: 'dino', name: 'Dino', nameKr: '디노' },
  ], 'v_shape'),

  ...g('ateez', 'ATEEZ', '에이티즈', ['에이티즈'], [
    { id: 'hongjoong', name: 'Hongjoong', nameKr: '홍중' },
    { id: 'seonghwa', name: 'Seonghwa', nameKr: '성화' },
    { id: 'yunho', name: 'Yunho', nameKr: '윤호' },
    { id: 'yeosang', name: 'Yeosang', nameKr: '여상' },
    { id: 'san', name: 'San', nameKr: '산' },
    { id: 'mingi', name: 'Mingi', nameKr: '민기' },
    { id: 'wooyoung', name: 'Wooyoung', nameKr: '우영' },
    { id: 'jongho', name: 'Jongho', nameKr: '종호' },
  ], 'line'),

  ...g('nct-dream', 'NCT DREAM', 'NCT DREAM', ['nct dream', '엔시티 드림'], [
    { id: 'mark', name: 'Mark', nameKr: '마크' },
    { id: 'renjun', name: 'Renjun', nameKr: '런쥔' },
    { id: 'jeno', name: 'Jeno', nameKr: '제노' },
    { id: 'haechan', name: 'Haechan', nameKr: '해찬' },
    { id: 'jaemin', name: 'Jaemin', nameKr: '재민' },
    { id: 'chenle', name: 'Chenle', nameKr: '천러' },
    { id: 'jisung', name: 'Jisung', nameKr: '지성' },
  ], 'line'),

  ...g('riize', 'RIIZE', '라이즈', ['라이즈'], [
    { id: 'shotaro', name: 'Shotaro', nameKr: '쇼타로' },
    { id: 'eunseok', name: 'Eunseok', nameKr: '은석' },
    { id: 'sungchan', name: 'Sungchan', nameKr: '성찬' },
    { id: 'wonbin', name: 'Wonbin', nameKr: '원빈' },
    { id: 'seunghan', name: 'Seunghan', nameKr: '승한' },
    { id: 'sohee', name: 'Sohee', nameKr: '소희' },
    { id: 'anton', name: 'Anton', nameKr: '앤톤' },
  ], 'line'),

  ...g('nmixx', 'NMIXX', '엔믹스', ['엔믹스'], [
    { id: 'lily', name: 'Lily', nameKr: '릴리' },
    { id: 'haewon', name: 'Haewon', nameKr: '해원' },
    { id: 'sullyoon', name: 'Sullyoon', nameKr: '설윤' },
    { id: 'bae', name: 'Bae', nameKr: '배이' },
    { id: 'jiwoo', name: 'Jiwoo', nameKr: '지우' },
    { id: 'kyujin', name: 'Kyujin', nameKr: '규진' },
  ], 'line'),

  ...g('g-idle', '(G)I-DLE', '아이들', ['gidle', 'g-idle', '여자아이들', '(g)i-dle'], [
    { id: 'miyeon', name: 'Miyeon', nameKr: '미연' },
    { id: 'minnie', name: 'Minnie', nameKr: '민니' },
    { id: 'soyeon', name: 'Soyeon', nameKr: '소연' },
    { id: 'yuqi', name: 'Yuqi', nameKr: '우기' },
    { id: 'shuhua', name: 'Shuhua', nameKr: '슈화' },
  ], 'line'),

  ...g('kiss-of-life', 'KISS OF LIFE', '키스오브라이프', ['kissoflife', '키스오브라이프'], [
    { id: 'julie', name: 'Julie', nameKr: '쥴리' },
    { id: 'natty', name: 'Natty', nameKr: '나띠' },
    { id: 'belle', name: 'Belle', nameKr: '벨' },
    { id: 'haneul', name: 'Haneul', nameKr: '하늘' },
  ], 'diamond'),

  ...g('fromis-9', 'fromis_9', '프로미스나인', ['fromis', 'fromis 9', '프로미스나인'], [
    { id: 'saerom', name: 'Saerom', nameKr: '새롬' },
    { id: 'hayoung', name: 'Hayoung', nameKr: '하영' },
    { id: 'jiwon', name: 'Jiwon', nameKr: '지원' },
    { id: 'jiheon', name: 'Jiheon', nameKr: '지헌' },
    { id: 'seoyeon', name: 'Seoyeon', nameKr: '서연' },
  ], 'line'),

  ...g('red-velvet', 'Red Velvet', '레드벨벳', ['redvelvet', '레드벨벳'], [
    { id: 'irene', name: 'Irene', nameKr: '아이린' },
    { id: 'seulgi', name: 'Seulgi', nameKr: '슬기' },
    { id: 'wendy', name: 'Wendy', nameKr: '웬디' },
    { id: 'joy', name: 'Joy', nameKr: '조이' },
    { id: 'yeri', name: 'Yeri', nameKr: '예리' },
  ], 'diamond'),

  ...g('zerobaseone', 'ZEROBASEONE', '제로베이스원', ['zb1', 'zerobase one', '제로베이스원'], [
    { id: 'jiwoong', name: 'Jiwoong', nameKr: '지웅' },
    { id: 'zhanghao', name: 'Zhang Hao', nameKr: '장하오' },
    { id: 'hanbin', name: 'Hanbin', nameKr: '성한빈' },
    { id: 'matthew', name: 'Matthew', nameKr: '석매튜' },
    { id: 'taerae', name: 'Taerae', nameKr: '김태래' },
    { id: 'ricky', name: 'Ricky', nameKr: '리키' },
    { id: 'gyuvin', name: 'Gyuvin', nameKr: '김규빈' },
    { id: 'gunwook', name: 'Gunwook', nameKr: '박건욱' },
    { id: 'yujin', name: 'Yujin', nameKr: '한유진' },
  ], 'v_shape'),

  ...g('mamamoo', 'MAMAMOO', '마마무', ['마마무'], [
    { id: 'solar', name: 'Solar', nameKr: '솔라' },
    { id: 'moonbyul', name: 'Moonbyul', nameKr: '문별' },
    { id: 'wheein', name: 'Wheein', nameKr: '휘인' },
    { id: 'hwasa', name: 'Hwasa', nameKr: '화사' },
  ], 'line'),

  ...g('iu', 'IU', '아이유', ['아이유', 'lee ji-eun'], [
    { id: 'iu', name: 'IU', nameKr: '아이유', avatar: '🌙' },
  ], 'line'),
};

/** 별칭 → groupId 역색인 (긴 별칭 우선) */
export function buildAliasIndex(catalog) {
  const rows = [];
  Object.entries(catalog).forEach(([groupId, group]) => {
    const aliases = group.aliases || [group.name, group.nameKr, groupId];
    aliases.forEach((alias) => {
      if (alias) rows.push({ groupId, alias: String(alias).toLowerCase().trim(), len: String(alias).length });
    });
    (group.members || []).forEach((m) => {
      [m.name, m.nameKr, m.id].filter(Boolean).forEach((alias) => {
        rows.push({ groupId, alias: String(alias).toLowerCase().trim(), len: String(alias).length });
      });
    });
  });
  return rows.sort((a, b) => b.len - a.len);
}
