// src/config/choreoExtractConfig.ts
var CHOREO_DEFAULT_SAMPLE_FPS = 10;

// src/data/kpopGroupRegistry.ts
var COLORS = ["#FF6348", "#FFD700", "#FF1F8E", "#A78BFA", "#6EE7B7", "#93C5FD", "#FCD34D", "#F87171", "#34D399", "#60A5FA", "#FB7185", "#818CF8", "#4ADE80"];
var AVATARS = ["\u2B50", "\u{1F4AB}", "\u{1F31F}", "\u2728", "\u{1F496}", "\u{1F525}", "\u{1F49C}", "\u{1F499}", "\u{1F49A}", "\u{1F49B}", "\u{1F338}", "\u{1F98B}", "\u{1F430}"];
function layoutLine(members, formation = "line") {
  const n = members.length;
  return members.map((m, i) => {
    const t = (i + 1) / (n + 1);
    const defaultX = formation === "v_shape" ? 0.5 + (i - (n - 1) / 2) * 0.18 : t;
    const defaultY = formation === "v_shape" ? 0.25 + Math.abs(i - (n - 1) / 2) * 0.12 : 0.4;
    return {
      ...m,
      id: m.id || `m${i + 1}`,
      color: COLORS[i % COLORS.length],
      avatar: m.avatar || AVATARS[i % AVATARS.length],
      defaultX,
      defaultY,
      position: { default: { x: defaultX, y: defaultY } }
    };
  });
}
function g(id, name, nameKr, aliases, members, formation = "line") {
  const laid = layoutLine(members, formation);
  return {
    [id]: {
      name,
      nameKr,
      memberCount: laid.length,
      defaultFormation: formation,
      aliases: [name, nameKr, id, ...aliases].filter(Boolean),
      members: laid
    }
  };
}
var KPOP_EXTENDED_GROUPS = {
  ...g("enhypen", "ENHYPEN", "\uC5D4\uD558\uC774\uD508", ["\uC5D4\uD558\uC774\uD508"], [
    { id: "jungwon", name: "Jungwon", nameKr: "\uC815\uC6D0" },
    { id: "heeseung", name: "Heeseung", nameKr: "\uD76C\uC2B9" },
    { id: "jay", name: "Jay", nameKr: "\uC81C\uC774" },
    { id: "jake", name: "Jake", nameKr: "\uC81C\uC774\uD06C" },
    { id: "sunghoon", name: "Sunghoon", nameKr: "\uC131\uD6C8" },
    { id: "sunoo", name: "Sunoo", nameKr: "\uC120\uC6B0" },
    { id: "ni-ki", name: "Ni-ki", nameKr: "\uB2C8\uD0A4" }
  ], "v_shape"),
  ...g("txt", "TXT", "\uD22C\uBAA8\uB85C\uC6B0\uBC14\uC774\uD22C\uAC8C\uB354", ["tomorrow x together", "\uD22C\uBC14\uD22C", "\uD22C\uBAA8\uB85C\uC6B0\uBC14\uC774\uD22C\uAC8C\uB354"], [
    { id: "soobin", name: "Soobin", nameKr: "\uC218\uBE48" },
    { id: "yeonjun", name: "Yeonjun", nameKr: "\uC5F0\uC900" },
    { id: "beomgyu", name: "Beomgyu", nameKr: "\uBC94\uADDC" },
    { id: "taehyun", name: "Taehyun", nameKr: "\uD0DC\uD604" },
    { id: "hueningkai", name: "Hueningkai", nameKr: "\uD734\uB2DD\uCE74\uC774" }
  ], "line"),
  ...g("le-sserafim", "LE SSERAFIM", "\uB974\uC138\uB77C\uD54C", ["lesserafim", "\uB974\uC138\uB77C\uD54C"], [
    { id: "sakura", name: "Sakura", nameKr: "\uC0AC\uCFE0\uB77C" },
    { id: "chaewon", name: "Chaewon", nameKr: "\uCC44\uC6D0" },
    { id: "yunjin", name: "Yunjin", nameKr: "\uC724\uC9C4" },
    { id: "kazuha", name: "Kazuha", nameKr: "\uCE74\uC988\uD558" },
    { id: "eunchae", name: "Eunchae", nameKr: "\uC740\uCC44" }
  ], "line"),
  ...g("illit", "ILLIT", "\uC544\uC77C\uB9BF", ["\uC544\uC77C\uB9BF"], [
    { id: "yunah", name: "Yunah", nameKr: "\uC724\uC544" },
    { id: "minju", name: "Minju", nameKr: "\uBBFC\uC8FC" },
    { id: "moka", name: "Moka", nameKr: "\uBAA8\uCE74" },
    { id: "wonhee", name: "Wonhee", nameKr: "\uC6D0\uD76C" },
    { id: "iroha", name: "Iroha", nameKr: "\uC774\uB85C\uD558" }
  ], "scattered"),
  ...g("babymonster", "BABYMONSTER", "\uBCA0\uC774\uBE44\uBAAC\uC2A4\uD130", ["baby monster", "\uBCA0\uC774\uBE44\uBAAC\uC2A4\uD130"], [
    { id: "ruka", name: "Ruka", nameKr: "\uB8E8\uCE74" },
    { id: "pharita", name: "Pharita", nameKr: "\uD30C\uB9AC\uD0C0" },
    { id: "asa", name: "Asa", nameKr: "\uC544\uC0AC" },
    { id: "ahyeon", name: "Ahyeon", nameKr: "\uC544\uD604" },
    { id: "rami", name: "Rami", nameKr: "\uB77C\uBBF8" },
    { id: "rora", name: "Rora", nameKr: "\uB85C\uB77C" },
    { id: "chiquita", name: "Chiquita", nameKr: "\uCE58\uD0A4\uD0C0" }
  ], "line"),
  ...g("stray-kids", "Stray Kids", "\uC2A4\uD2B8\uB808\uC774\uD0A4\uC988", ["straykids", "skz", "\uC2A4\uD2B8\uB808\uC774\uD0A4\uC988"], [
    { id: "bang-chan", name: "Bang Chan", nameKr: "\uBC29\uCC2C" },
    { id: "lee-know", name: "Lee Know", nameKr: "\uB9AC\uB178" },
    { id: "changbin", name: "Changbin", nameKr: "\uCC3D\uBE48" },
    { id: "hyunjin", name: "Hyunjin", nameKr: "\uD604\uC9C4" },
    { id: "han", name: "Han", nameKr: "\uD55C" },
    { id: "felix", name: "Felix", nameKr: "\uD544\uB9AD\uC2A4" },
    { id: "seungmin", name: "Seungmin", nameKr: "\uC2B9\uBBFC" },
    { id: "in", name: "I.N", nameKr: "\uC544\uC774\uC5D4" }
  ], "line"),
  ...g("seventeen", "SEVENTEEN", "\uC138\uBE10\uD2F4", ["svt", "\uC138\uBE10\uD2F4"], [
    { id: "s-coups", name: "S.Coups", nameKr: "\uC5D0\uC2A4\uCFF1\uC2A4" },
    { id: "jeonghan", name: "Jeonghan", nameKr: "\uC815\uD55C" },
    { id: "joshua", name: "Joshua", nameKr: "\uC870\uC288\uC544" },
    { id: "jun", name: "Jun", nameKr: "\uC900" },
    { id: "hoshi", name: "Hoshi", nameKr: "\uD638\uC2DC" },
    { id: "wonwoo", name: "Wonwoo", nameKr: "\uC6D0\uC6B0" },
    { id: "woozi", name: "Woozi", nameKr: "\uC6B0\uC9C0" },
    { id: "dk", name: "DK", nameKr: "\uB3C4\uACB8" },
    { id: "mingyu", name: "Mingyu", nameKr: "\uBBFC\uADDC" },
    { id: "the8", name: "The8", nameKr: "\uB514\uC5D0\uC787" },
    { id: "seungkwan", name: "Seungkwan", nameKr: "\uC2B9\uAD00" },
    { id: "vernon", name: "Vernon", nameKr: "\uBC84\uB17C" },
    { id: "dino", name: "Dino", nameKr: "\uB514\uB178" }
  ], "v_shape"),
  ...g("ateez", "ATEEZ", "\uC5D0\uC774\uD2F0\uC988", ["\uC5D0\uC774\uD2F0\uC988"], [
    { id: "hongjoong", name: "Hongjoong", nameKr: "\uD64D\uC911" },
    { id: "seonghwa", name: "Seonghwa", nameKr: "\uC131\uD654" },
    { id: "yunho", name: "Yunho", nameKr: "\uC724\uD638" },
    { id: "yeosang", name: "Yeosang", nameKr: "\uC5EC\uC0C1" },
    { id: "san", name: "San", nameKr: "\uC0B0" },
    { id: "mingi", name: "Mingi", nameKr: "\uBBFC\uAE30" },
    { id: "wooyoung", name: "Wooyoung", nameKr: "\uC6B0\uC601" },
    { id: "jongho", name: "Jongho", nameKr: "\uC885\uD638" }
  ], "line"),
  ...g("nct-dream", "NCT DREAM", "NCT DREAM", ["nct dream", "\uC5D4\uC2DC\uD2F0 \uB4DC\uB9BC"], [
    { id: "mark", name: "Mark", nameKr: "\uB9C8\uD06C" },
    { id: "renjun", name: "Renjun", nameKr: "\uB7F0\uC954" },
    { id: "jeno", name: "Jeno", nameKr: "\uC81C\uB178" },
    { id: "haechan", name: "Haechan", nameKr: "\uD574\uCC2C" },
    { id: "jaemin", name: "Jaemin", nameKr: "\uC7AC\uBBFC" },
    { id: "chenle", name: "Chenle", nameKr: "\uCC9C\uB7EC" },
    { id: "jisung", name: "Jisung", nameKr: "\uC9C0\uC131" }
  ], "line"),
  ...g("riize", "RIIZE", "\uB77C\uC774\uC988", ["\uB77C\uC774\uC988"], [
    { id: "shotaro", name: "Shotaro", nameKr: "\uC1FC\uD0C0\uB85C" },
    { id: "eunseok", name: "Eunseok", nameKr: "\uC740\uC11D" },
    { id: "sungchan", name: "Sungchan", nameKr: "\uC131\uCC2C" },
    { id: "wonbin", name: "Wonbin", nameKr: "\uC6D0\uBE48" },
    { id: "seunghan", name: "Seunghan", nameKr: "\uC2B9\uD55C" },
    { id: "sohee", name: "Sohee", nameKr: "\uC18C\uD76C" },
    { id: "anton", name: "Anton", nameKr: "\uC564\uD1A4" }
  ], "line"),
  ...g("nmixx", "NMIXX", "\uC5D4\uBBF9\uC2A4", ["\uC5D4\uBBF9\uC2A4"], [
    { id: "lily", name: "Lily", nameKr: "\uB9B4\uB9AC" },
    { id: "haewon", name: "Haewon", nameKr: "\uD574\uC6D0" },
    { id: "sullyoon", name: "Sullyoon", nameKr: "\uC124\uC724" },
    { id: "bae", name: "Bae", nameKr: "\uBC30\uC774" },
    { id: "jiwoo", name: "Jiwoo", nameKr: "\uC9C0\uC6B0" },
    { id: "kyujin", name: "Kyujin", nameKr: "\uADDC\uC9C4" }
  ], "line"),
  ...g("g-idle", "(G)I-DLE", "\uC544\uC774\uB4E4", ["gidle", "g-idle", "\uC5EC\uC790\uC544\uC774\uB4E4", "(g)i-dle"], [
    { id: "miyeon", name: "Miyeon", nameKr: "\uBBF8\uC5F0" },
    { id: "minnie", name: "Minnie", nameKr: "\uBBFC\uB2C8" },
    { id: "soyeon", name: "Soyeon", nameKr: "\uC18C\uC5F0" },
    { id: "yuqi", name: "Yuqi", nameKr: "\uC6B0\uAE30" },
    { id: "shuhua", name: "Shuhua", nameKr: "\uC288\uD654" }
  ], "line"),
  ...g("kiss-of-life", "KISS OF LIFE", "\uD0A4\uC2A4\uC624\uBE0C\uB77C\uC774\uD504", ["kissoflife", "\uD0A4\uC2A4\uC624\uBE0C\uB77C\uC774\uD504"], [
    { id: "julie", name: "Julie", nameKr: "\uC974\uB9AC" },
    { id: "natty", name: "Natty", nameKr: "\uB098\uB760" },
    { id: "belle", name: "Belle", nameKr: "\uBCA8" },
    { id: "haneul", name: "Haneul", nameKr: "\uD558\uB298" }
  ], "diamond"),
  ...g("fromis-9", "fromis_9", "\uD504\uB85C\uBBF8\uC2A4\uB098\uC778", ["fromis", "fromis 9", "\uD504\uB85C\uBBF8\uC2A4\uB098\uC778"], [
    { id: "saerom", name: "Saerom", nameKr: "\uC0C8\uB86C" },
    { id: "hayoung", name: "Hayoung", nameKr: "\uD558\uC601" },
    { id: "jiwon", name: "Jiwon", nameKr: "\uC9C0\uC6D0" },
    { id: "jiheon", name: "Jiheon", nameKr: "\uC9C0\uD5CC" },
    { id: "seoyeon", name: "Seoyeon", nameKr: "\uC11C\uC5F0" }
  ], "line"),
  ...g("red-velvet", "Red Velvet", "\uB808\uB4DC\uBCA8\uBCB3", ["redvelvet", "\uB808\uB4DC\uBCA8\uBCB3"], [
    { id: "irene", name: "Irene", nameKr: "\uC544\uC774\uB9B0" },
    { id: "seulgi", name: "Seulgi", nameKr: "\uC2AC\uAE30" },
    { id: "wendy", name: "Wendy", nameKr: "\uC6EC\uB514" },
    { id: "joy", name: "Joy", nameKr: "\uC870\uC774" },
    { id: "yeri", name: "Yeri", nameKr: "\uC608\uB9AC" }
  ], "diamond"),
  ...g("zerobaseone", "ZEROBASEONE", "\uC81C\uB85C\uBCA0\uC774\uC2A4\uC6D0", ["zb1", "zerobase one", "\uC81C\uB85C\uBCA0\uC774\uC2A4\uC6D0"], [
    { id: "jiwoong", name: "Jiwoong", nameKr: "\uC9C0\uC6C5" },
    { id: "zhanghao", name: "Zhang Hao", nameKr: "\uC7A5\uD558\uC624" },
    { id: "hanbin", name: "Hanbin", nameKr: "\uC131\uD55C\uBE48" },
    { id: "matthew", name: "Matthew", nameKr: "\uC11D\uB9E4\uD29C" },
    { id: "taerae", name: "Taerae", nameKr: "\uAE40\uD0DC\uB798" },
    { id: "ricky", name: "Ricky", nameKr: "\uB9AC\uD0A4" },
    { id: "gyuvin", name: "Gyuvin", nameKr: "\uAE40\uADDC\uBE48" },
    { id: "gunwook", name: "Gunwook", nameKr: "\uBC15\uAC74\uC6B1" },
    { id: "yujin", name: "Yujin", nameKr: "\uD55C\uC720\uC9C4" }
  ], "v_shape"),
  ...g("mamamoo", "MAMAMOO", "\uB9C8\uB9C8\uBB34", ["\uB9C8\uB9C8\uBB34"], [
    { id: "solar", name: "Solar", nameKr: "\uC194\uB77C" },
    { id: "moonbyul", name: "Moonbyul", nameKr: "\uBB38\uBCC4" },
    { id: "wheein", name: "Wheein", nameKr: "\uD718\uC778" },
    { id: "hwasa", name: "Hwasa", nameKr: "\uD654\uC0AC" }
  ], "line"),
  ...g("iu", "IU", "\uC544\uC774\uC720", ["\uC544\uC774\uC720", "lee ji-eun"], [
    { id: "iu", name: "IU", nameKr: "\uC544\uC774\uC720", avatar: "\u{1F319}" }
  ], "line")
};

// src/data/groupPracticeData.ts
var GROUP_DATA = {
  blackpink: {
    name: "BLACKPINK",
    nameKr: "\uBE14\uB799\uD551\uD06C",
    memberCount: 4,
    defaultFormation: "diamond",
    members: [
      {
        id: "jennie",
        name: "Jennie",
        nameKr: "\uC81C\uB2C8",
        color: "#FF6B9D",
        defaultX: 0.5,
        defaultY: 0.3,
        avatar: "\u{1F497}",
        position: { default: { x: 0.5, y: 0.3 } }
      },
      {
        id: "lisa",
        name: "Lisa",
        nameKr: "\uB9AC\uC0AC",
        color: "#FFD700",
        defaultX: 0.75,
        defaultY: 0.5,
        avatar: "\u{1F49B}",
        position: { default: { x: 0.75, y: 0.5 } }
      },
      {
        id: "rose",
        name: "Ros\xE9",
        nameKr: "\uB85C\uC81C",
        color: "#A78BFA",
        defaultX: 0.25,
        defaultY: 0.5,
        avatar: "\u{1F49C}",
        position: { default: { x: 0.25, y: 0.5 } }
      },
      {
        id: "jisoo",
        name: "Jisoo",
        nameKr: "\uC9C0\uC218",
        color: "#6EE7B7",
        defaultX: 0.5,
        defaultY: 0.7,
        avatar: "\u{1F49A}",
        position: { default: { x: 0.5, y: 0.7 } }
      }
    ]
  },
  twice: {
    name: "TWICE",
    nameKr: "\uD2B8\uC640\uC774\uC2A4",
    memberCount: 9,
    defaultFormation: "v_shape",
    members: [
      { id: "nayeon", name: "Nayeon", nameKr: "\uB098\uC5F0", color: "#FF6348", defaultX: 0.5, defaultY: 0.2, avatar: "\u{1F338}", position: { default: { x: 0.5, y: 0.2 } } },
      { id: "jeongyeon", name: "Jeongyeon", nameKr: "\uC815\uC5F0", color: "#FFD700", defaultX: 0.35, defaultY: 0.35, avatar: "\u2B50", position: { default: { x: 0.35, y: 0.35 } } },
      { id: "momo", name: "Momo", nameKr: "\uBAA8\uBAA8", color: "#FF1F8E", defaultX: 0.65, defaultY: 0.35, avatar: "\u{1F495}", position: { default: { x: 0.65, y: 0.35 } } },
      { id: "sana", name: "Sana", nameKr: "\uC0AC\uB098", color: "#A78BFA", defaultX: 0.2, defaultY: 0.5, avatar: "\u{1F31F}", position: { default: { x: 0.2, y: 0.5 } } },
      { id: "jihyo", name: "Jihyo", nameKr: "\uC9C0\uD6A8", color: "#6EE7B7", defaultX: 0.5, defaultY: 0.5, avatar: "\u{1F451}", position: { default: { x: 0.5, y: 0.5 } } },
      { id: "mina", name: "Mina", nameKr: "\uBBF8\uB098", color: "#93C5FD", defaultX: 0.8, defaultY: 0.5, avatar: "\u{1F9A2}", position: { default: { x: 0.8, y: 0.5 } } },
      { id: "dahyun", name: "Dahyun", nameKr: "\uB2E4\uD604", color: "#FCD34D", defaultX: 0.3, defaultY: 0.65, avatar: "\u{1F430}", position: { default: { x: 0.3, y: 0.65 } } },
      { id: "chaeyoung", name: "Chaeyoung", nameKr: "\uCC44\uC601", color: "#F87171", defaultX: 0.5, defaultY: 0.72, avatar: "\u{1F33A}", position: { default: { x: 0.5, y: 0.72 } } },
      { id: "tzuyu", name: "Tzuyu", nameKr: "\uCBD4\uC704", color: "#34D399", defaultX: 0.7, defaultY: 0.65, avatar: "\u{1F33F}", position: { default: { x: 0.7, y: 0.65 } } }
    ]
  },
  bts: {
    name: "BTS",
    nameKr: "\uBC29\uD0C4\uC18C\uB144\uB2E8",
    memberCount: 7,
    defaultFormation: "v_shape",
    members: [
      { id: "rm", name: "RM", nameKr: "RM", color: "#6C5CE7", defaultX: 0.5, defaultY: 0.2, avatar: "\u{1F3A4}", position: { default: { x: 0.5, y: 0.2 } } },
      { id: "jin", name: "Jin", nameKr: "\uC9C4", color: "#FF6B9D", defaultX: 0.3, defaultY: 0.35, avatar: "\u{1F49C}", position: { default: { x: 0.3, y: 0.35 } } },
      { id: "suga", name: "Suga", nameKr: "\uC288\uAC00", color: "#A78BFA", defaultX: 0.7, defaultY: 0.35, avatar: "\u26A1", position: { default: { x: 0.7, y: 0.35 } } },
      { id: "jhope", name: "J-Hope", nameKr: "\uC81C\uC774\uD649", color: "#FCD34D", defaultX: 0.15, defaultY: 0.5, avatar: "\u2600\uFE0F", position: { default: { x: 0.15, y: 0.5 } } },
      { id: "jimin", name: "Jimin", nameKr: "\uC9C0\uBBFC", color: "#F87171", defaultX: 0.5, defaultY: 0.5, avatar: "\u{1F31F}", position: { default: { x: 0.5, y: 0.5 } } },
      { id: "v", name: "V", nameKr: "\uBDD4", color: "#34D399", defaultX: 0.85, defaultY: 0.5, avatar: "\u{1F3A8}", position: { default: { x: 0.85, y: 0.5 } } },
      { id: "jungkook", name: "Jungkook", nameKr: "\uC815\uAD6D", color: "#60A5FA", defaultX: 0.5, defaultY: 0.7, avatar: "\u{1F430}", position: { default: { x: 0.5, y: 0.7 } } }
    ]
  },
  itzy: {
    name: "ITZY",
    nameKr: "\uC788\uC9C0",
    memberCount: 5,
    defaultFormation: "line",
    members: [
      { id: "yeji", name: "Yeji", nameKr: "\uC608\uC9C0", color: "#FF6348", defaultX: 0.1, defaultY: 0.4, avatar: "\u{1F525}", position: { default: { x: 0.1, y: 0.4 } } },
      { id: "lia", name: "Lia", nameKr: "\uB9AC\uC544", color: "#A78BFA", defaultX: 0.3, defaultY: 0.4, avatar: "\u{1F49C}", position: { default: { x: 0.3, y: 0.4 } } },
      { id: "ryujin", name: "Ryujin", nameKr: "\uB958\uC9C4", color: "#FF1F8E", defaultX: 0.5, defaultY: 0.35, avatar: "\u{1F451}", position: { default: { x: 0.5, y: 0.35 } } },
      { id: "chaeryeong", name: "Chaeryeong", nameKr: "\uCC44\uB839", color: "#6EE7B7", defaultX: 0.7, defaultY: 0.4, avatar: "\u{1F33F}", position: { default: { x: 0.7, y: 0.4 } } },
      { id: "yuna", name: "Yuna", nameKr: "\uC720\uB098", color: "#FCD34D", defaultX: 0.9, defaultY: 0.4, avatar: "\u2B50", position: { default: { x: 0.9, y: 0.4 } } }
    ]
  },
  aespa: {
    name: "aespa",
    nameKr: "\uC5D0\uC2A4\uD30C",
    memberCount: 4,
    defaultFormation: "diamond",
    members: [
      { id: "karina", name: "Karina", nameKr: "\uCE74\uB9AC\uB098", color: "#E91E63", defaultX: 0.5, defaultY: 0.25, avatar: "\u{1F47E}", position: { default: { x: 0.5, y: 0.25 } } },
      { id: "giselle", name: "Giselle", nameKr: "\uC9C0\uC824", color: "#9C27B0", defaultX: 0.75, defaultY: 0.5, avatar: "\u{1F49C}", position: { default: { x: 0.75, y: 0.5 } } },
      { id: "winter", name: "Winter", nameKr: "\uC708\uD130", color: "#00BCD4", defaultX: 0.25, defaultY: 0.5, avatar: "\u2744\uFE0F", position: { default: { x: 0.25, y: 0.5 } } },
      { id: "ningning", name: "Ningning", nameKr: "\uB2DD\uB2DD", color: "#FF9800", defaultX: 0.5, defaultY: 0.75, avatar: "\u{1F31F}", position: { default: { x: 0.5, y: 0.75 } } }
    ]
  },
  ive: {
    name: "IVE",
    nameKr: "\uC544\uC774\uBE0C",
    memberCount: 6,
    defaultFormation: "line",
    members: [
      { id: "wonyoung", name: "Wonyoung", nameKr: "\uC7A5\uC6D0\uC601", color: "#FF6B9D", defaultX: 0.5, defaultY: 0.3, avatar: "\u{1F9A2}", position: { default: { x: 0.5, y: 0.3 } } },
      { id: "yujin", name: "Yujin", nameKr: "\uC548\uC720\uC9C4", color: "#FFD700", defaultX: 0.2, defaultY: 0.45, avatar: "\u2B50", position: { default: { x: 0.2, y: 0.45 } } },
      { id: "rei", name: "Rei", nameKr: "\uB808\uC774", color: "#A78BFA", defaultX: 0.8, defaultY: 0.45, avatar: "\u{1F49C}", position: { default: { x: 0.8, y: 0.45 } } },
      { id: "gaeul", name: "Gaeul", nameKr: "\uAC00\uC744", color: "#6EE7B7", defaultX: 0.35, defaultY: 0.6, avatar: "\u{1F342}", position: { default: { x: 0.35, y: 0.6 } } },
      { id: "liz", name: "Liz", nameKr: "\uB9AC\uC988", color: "#93C5FD", defaultX: 0.65, defaultY: 0.6, avatar: "\u{1F48E}", position: { default: { x: 0.65, y: 0.6 } } },
      { id: "leeseo", name: "Leeseo", nameKr: "\uC774\uC11C", color: "#FCD34D", defaultX: 0.5, defaultY: 0.75, avatar: "\u{1F338}", position: { default: { x: 0.5, y: 0.75 } } }
    ]
  },
  newjeans: {
    name: "NewJeans",
    nameKr: "\uB274\uC9C4\uC2A4",
    memberCount: 5,
    defaultFormation: "scattered",
    members: [
      { id: "minji", name: "Minji", nameKr: "\uBBFC\uC9C0", color: "#FF6348", defaultX: 0.2, defaultY: 0.4, avatar: "\u{1F430}", position: { default: { x: 0.2, y: 0.4 } } },
      { id: "hanni", name: "Hanni", nameKr: "\uD558\uB2C8", color: "#FF1F8E", defaultX: 0.4, defaultY: 0.35, avatar: "\u{1F496}", position: { default: { x: 0.4, y: 0.35 } } },
      { id: "danielle", name: "Danielle", nameKr: "\uB2E4\uB2C8\uC5D8", color: "#FFD700", defaultX: 0.6, defaultY: 0.35, avatar: "\u2600\uFE0F", position: { default: { x: 0.6, y: 0.35 } } },
      { id: "haerin", name: "Haerin", nameKr: "\uD574\uB9B0", color: "#A78BFA", defaultX: 0.8, defaultY: 0.4, avatar: "\u{1F431}", position: { default: { x: 0.8, y: 0.4 } } },
      { id: "hyein", name: "Hyein", nameKr: "\uD61C\uC778", color: "#6EE7B7", defaultX: 0.5, defaultY: 0.65, avatar: "\u{1F33F}", position: { default: { x: 0.5, y: 0.65 } } }
    ]
  },
  cortis: {
    name: "CORTIS",
    nameKr: "\uCF54\uB974\uD2F0\uC2A4",
    memberCount: 5,
    defaultFormation: "line",
    members: [
      { id: "martin", name: "Martin", nameKr: "\uB9C8\uD2F4", color: "#F87171", defaultX: 0.1, defaultY: 0.4, avatar: "\u{1F992}", position: { default: { x: 0.1, y: 0.4 } } },
      { id: "james", name: "James", nameKr: "\uC81C\uC784\uC2A4", color: "#34D399", defaultX: 0.3, defaultY: 0.35, avatar: "\u{1F985}", position: { default: { x: 0.3, y: 0.35 } } },
      { id: "juhoon", name: "Juhoon", nameKr: "\uC8FC\uD6C8", color: "#60A5FA", defaultX: 0.5, defaultY: 0.3, avatar: "\u{1F422}", position: { default: { x: 0.5, y: 0.3 } } },
      { id: "seonghyeon", name: "Seonghyeon", nameKr: "\uC131\uD604", color: "#A78BFA", defaultX: 0.7, defaultY: 0.35, avatar: "\u{1F98A}", position: { default: { x: 0.7, y: 0.35 } } },
      { id: "keonho", name: "Keonho", nameKr: "\uAC74\uD638", color: "#FCD34D", defaultX: 0.9, defaultY: 0.4, avatar: "\u{1F436}", position: { default: { x: 0.9, y: 0.4 } } }
    ]
  }
};
Object.assign(GROUP_DATA, KPOP_EXTENDED_GROUPS);

// src/types/groupMotionEngine.ts
var EMPTY_GROUP_MOTION_DEBUG = {
  frameIndex: 0,
  timestamp: 0,
  pipelineStage: "idle",
  trackedCount: 0,
  visibleCount: 0,
  estimatedCount: 0,
  occlusionRecoveries: 0,
  activeTrackIds: [],
  releasedTrackIds: [],
  avgPoseConfidence: 0,
  avgIdentityConfidence: 0,
  formationType: null,
  formationTransition: null,
  orientationLabels: [],
  avgMemberVelocity: 0,
  motionTimelineCoverage: {},
  interpolationActive: false,
  cacheHit: false,
  singleDancerMode: false
};

// src/utils/jointConfidenceFilter.ts
var JOINT_CONFIDENCE_INTERPOLATE_MAX = 0.6;
var JOINT_CONFIDENCE_DISCARD_MAX = 0.3;
function resolveJointConfidence(visibility, presence) {
  const vis = Number.isFinite(visibility) ? Number(visibility) : 1;
  const pres = Number.isFinite(presence) ? Number(presence) : vis;
  return Math.min(vis, pres);
}
function resolveJointScore(joint) {
  if (!joint) return 0;
  const fromFields = resolveJointConfidence(joint.visibility, joint.presence);
  const explicit = Number.isFinite(joint.confidence) ? Number(joint.confidence) : fromFields;
  return Math.min(1, Math.max(0, Math.min(explicit, fromFields)));
}
function computeMemberPoseConfidence(member, jointNames) {
  if (!member) return 0.5;
  const names = jointNames ?? [
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "left_elbow",
    "right_elbow",
    "left_knee",
    "right_knee"
  ];
  let sum2 = 0;
  let count = 0;
  names.forEach((key) => {
    const score = resolveJointScore(member.joints?.[key]);
    if (score > 0) {
      sum2 += score;
      count += 1;
    }
  });
  if (count) return sum2 / count;
  return Number.isFinite(member.confidence) ? Math.min(1, Math.max(0, member.confidence)) : 0.5;
}
function classifyJointConfidence(score) {
  if (score <= JOINT_CONFIDENCE_DISCARD_MAX) return "discard";
  if (score <= JOINT_CONFIDENCE_INTERPOLATE_MAX) return "interpolate";
  return "keep";
}
function applyJointConfidenceFilter(joints, worldJoints = {}) {
  const outJoints = {};
  const outWorld = {};
  const jointsNeedingInterpolation = [];
  let discardedJointCount = 0;
  const names = /* @__PURE__ */ new Set([...Object.keys(joints), ...Object.keys(worldJoints)]);
  names.forEach((name) => {
    const joint = joints[name];
    const world = worldJoints[name];
    const score = resolveJointConfidence(
      joint?.visibility ?? world?.visibility,
      joint?.presence ?? world?.presence
    );
    const action = classifyJointConfidence(score);
    if (action === "discard") {
      discardedJointCount += 1;
      return;
    }
    if (action === "interpolate") {
      jointsNeedingInterpolation.push(name);
      return;
    }
    if (joint) {
      outJoints[name] = { ...joint, confidence: score };
    }
    if (world) {
      outWorld[name] = { ...world, confidence: score };
    } else if (joint) {
      outWorld[name] = {
        x: joint.x,
        y: joint.y,
        z: joint.z ?? 0,
        visibility: joint.visibility,
        presence: joint.presence,
        confidence: score
      };
    }
  });
  return {
    joints: outJoints,
    worldJoints: outWorld,
    jointsNeedingInterpolation,
    discardedJointCount
  };
}
function interpolateJointPoint(a, b, ratio) {
  const score = resolveJointConfidence(
    (a.visibility ?? 1) * (1 - ratio) + (b.visibility ?? 1) * ratio,
    (a.presence ?? 1) * (1 - ratio) + (b.presence ?? 1) * ratio
  ) * 0.85;
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * ratio,
    visibility: score,
    presence: score,
    confidence: score
  };
}
function memberKey(member) {
  return String(member.estimatedMemberId ?? member.trackId ?? member.personIndex ?? "");
}
function findMemberInFrame(frame, key) {
  if (!frame || !key) return null;
  return frame.members.find((m) => memberKey(m) === key) ?? frame.members.find((m) => String(m.trackId) === key) ?? null;
}
function findNeighborJoint(frames, fromIndex, memberKeyStr, jointName, direction) {
  let i = fromIndex + direction;
  while (i >= 0 && i < frames.length) {
    const member = findMemberInFrame(frames[i], memberKeyStr);
    const joint = member?.joints?.[jointName];
    if (joint) {
      const score = resolveJointConfidence(joint.visibility, joint.presence);
      if (score > JOINT_CONFIDENCE_INTERPOLATE_MAX && !member?.isEstimated) {
        return {
          index: i,
          joint,
          world: member?.worldCoordinates?.[jointName]
        };
      }
    }
    i += direction;
  }
  return null;
}
function interpolateLowConfidenceJoints(frames) {
  if (!frames.length) return frames;
  const result = frames.map((frame) => ({
    ...frame,
    members: frame.members.map((m) => ({
      ...m,
      joints: { ...m.joints },
      worldCoordinates: m.worldCoordinates ? { ...m.worldCoordinates } : void 0
    }))
  }));
  const jointNames = /* @__PURE__ */ new Set();
  result.forEach((frame) => {
    frame.members.forEach((m) => {
      Object.keys(m.joints || {}).forEach((n) => jointNames.add(n));
    });
  });
  let filledCount = 0;
  result.forEach((frame, frameIndex) => {
    frame.members.forEach((member) => {
      const key = memberKey(member);
      jointNames.forEach((jointName) => {
        if (member.joints[jointName]) return;
        const prev = findNeighborJoint(result, frameIndex, key, jointName, -1);
        const next = findNeighborJoint(result, frameIndex, key, jointName, 1);
        if (prev && next) {
          const t0 = result[prev.index].timestamp;
          const t1 = result[next.index].timestamp;
          const t = frame.timestamp;
          const ratio = t1 > t0 ? (t - t0) / (t1 - t0) : 0.5;
          const joint = interpolateJointPoint(prev.joint, next.joint, Math.min(1, Math.max(0, ratio)));
          let world;
          if (prev.world && next.world) {
            world = interpolateJointPoint(prev.world, next.world, ratio);
          } else if (next.world) {
            world = { ...next.world };
          } else if (prev.world) {
            world = { ...prev.world };
          }
          member.joints[jointName] = joint;
          if (world) {
            member.worldCoordinates = member.worldCoordinates || {};
            member.worldCoordinates[jointName] = world;
          }
          filledCount += 1;
          return;
        }
        if (prev) {
          member.joints[jointName] = { ...prev.joint, confidence: (prev.joint.confidence ?? 1) * 0.75 };
          if (prev.world) {
            member.worldCoordinates = member.worldCoordinates || {};
            member.worldCoordinates[jointName] = { ...prev.world };
          }
          filledCount += 1;
        } else if (next) {
          member.joints[jointName] = { ...next.joint, confidence: (next.joint.confidence ?? 1) * 0.65 };
          if (next.world) {
            member.worldCoordinates = member.worldCoordinates || {};
            member.worldCoordinates[jointName] = { ...next.world };
          }
          filledCount += 1;
        }
      });
    });
  });
  if (import.meta.env?.DEV && filledCount > 0) {
    console.debug("[JointConfidenceFilter] temporal interpolated joints:", filledCount);
  }
  return result;
}

// src/services/skeleton/poseSimilarity.ts
var POSE_MATCH_JOINTS = [
  "nose",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle"
];
var MAX_POSE_DISTANCE = 2.5;
function jointMatchWeight(ja, jb) {
  return Math.min(resolveJointScore(ja), resolveJointScore(jb));
}
function jointsPoseDistance(a, b, options = {}) {
  if (!a || !b) return MAX_POSE_DISTANCE;
  const minWeight = options.minJointWeight ?? 0.2;
  let weightedSum = 0;
  let weightSum = 0;
  POSE_MATCH_JOINTS.forEach((key) => {
    const ja = a[key];
    const jb = b[key];
    if (!ja || !jb) return;
    if (!Number.isFinite(ja.x) || !Number.isFinite(jb.x)) return;
    const w = jointMatchWeight(ja, jb);
    if (w < minWeight) return;
    const dist = Math.hypot(ja.x - jb.x, ja.y - jb.y, (ja.z ?? 0) - (jb.z ?? 0));
    weightedSum += dist * w;
    weightSum += w;
  });
  if (!weightSum) return MAX_POSE_DISTANCE;
  return Math.min(MAX_POSE_DISTANCE, weightedSum / weightSum);
}
function hungarianAssign(costMatrix) {
  const nRows = costMatrix.length;
  if (!nRows) return [];
  const nCols = costMatrix[0]?.length ?? 0;
  if (!nCols) return Array(nRows).fill(-1);
  const n = Math.max(nRows, nCols);
  const LARGE = 1e9;
  const cost = Array.from(
    { length: n },
    (_, i) => Array.from({ length: n }, (_2, j) => {
      if (i < nRows && j < nCols) return costMatrix[i][j];
      return LARGE;
    })
  );
  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignment = Array(nRows).fill(-1);
  for (let j = 1; j <= n; j += 1) {
    const row = p[j] - 1;
    const col = j - 1;
    if (row >= 0 && row < nRows && col >= 0 && col < nCols) {
      assignment[row] = col;
    }
  }
  return assignment;
}

// src/services/motion/TrackMotionPredictor.ts
var JointCVPredictor = class {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  lastT = 0;
  initialized = false;
  update(j, t) {
    if (this.initialized && this.lastT > 0) {
      const dt = Math.max(1e-4, t - this.lastT);
      const ax = (j.x - this.x) / dt;
      const ay = (j.y - this.y) / dt;
      const az = ((j.z ?? 0) - this.z) / dt;
      this.vx = this.vx * 0.65 + ax * 0.35;
      this.vy = this.vy * 0.65 + ay * 0.35;
      this.vz = this.vz * 0.65 + az * 0.35;
    }
    this.x = j.x;
    this.y = j.y;
    this.z = j.z ?? 0;
    this.lastT = t;
    this.initialized = true;
  }
  predict(t) {
    if (!this.initialized) return { x: this.x, y: this.y, z: this.z };
    const dt = Math.max(0, t - this.lastT);
    return {
      x: this.x + this.vx * dt,
      y: this.y + this.vy * dt,
      z: this.z + this.vz * dt
    };
  }
  velocity() {
    return Math.hypot(this.vx, this.vy, this.vz);
  }
  reset() {
    this.initialized = false;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.lastT = 0;
  }
};
var TrackMotionPredictor = class {
  joints = /* @__PURE__ */ new Map();
  getJoint(name) {
    let j = this.joints.get(name);
    if (!j) {
      j = new JointCVPredictor();
      this.joints.set(name, j);
    }
    return j;
  }
  update(joints, timestamp) {
    if (!joints) return;
    POSE_MATCH_JOINTS.forEach((name) => {
      const j = joints[name];
      if (!j || !Number.isFinite(j.x) || !Number.isFinite(j.y)) return;
      this.getJoint(name).update({ x: j.x, y: j.y, z: j.z ?? 0 }, timestamp);
    });
  }
  predict(timestamp) {
    const out = {};
    POSE_MATCH_JOINTS.forEach((name) => {
      const pred = this.getJoint(name).predict(timestamp);
      out[name] = { x: pred.x, y: pred.y, z: pred.z, confidence: 0.55 };
    });
    return out;
  }
  /** 관절 평균 속도 (정규화/초) */
  averageVelocity() {
    const vels = POSE_MATCH_JOINTS.map((name) => this.getJoint(name).velocity()).filter((v) => v > 0);
    if (!vels.length) return 0;
    return vels.reduce((a, b) => a + b, 0) / vels.length;
  }
  reset() {
    this.joints.forEach((j) => j.reset());
    this.joints.clear();
  }
};

// src/services/motion/TrackPool.ts
var TrackPool = class {
  active = /* @__PURE__ */ new Set();
  released = [];
  nextId = 0;
  maxSlots;
  constructor(maxSlots = 9) {
    this.maxSlots = Math.max(1, maxSlots);
  }
  setMaxSlots(maxSlots) {
    this.maxSlots = Math.max(1, maxSlots);
  }
  /** 활성 슬롯 수 */
  get activeCount() {
    return this.active.size;
  }
  /** 풀에서 trackId 획득 — 해제된 ID 우선 재사용 */
  acquire(preferred) {
    if (preferred != null && Number.isFinite(preferred) && preferred >= 0 && !this.active.has(preferred)) {
      this.active.add(preferred);
      this.released = this.released.filter((id) => id !== preferred);
      return preferred;
    }
    if (this.released.length) {
      this.released.sort((a, b) => a - b);
      const id = this.released.shift();
      this.active.add(id);
      return id;
    }
    let candidate = this.nextId;
    while (candidate < this.maxSlots) {
      if (!this.active.has(candidate)) {
        this.active.add(candidate);
        this.nextId = Math.max(this.nextId, candidate + 1);
        return candidate;
      }
      candidate += 1;
    }
    return null;
  }
  /** 트랙 종료 시 ID 반환 — 이후 acquire에서 재사용 */
  release(trackId) {
    if (!Number.isFinite(trackId) || trackId < 0) return;
    if (!this.active.has(trackId)) return;
    this.active.delete(trackId);
    if (!this.released.includes(trackId)) {
      this.released.push(trackId);
    }
  }
  isActive(trackId) {
    return this.active.has(trackId);
  }
  reset() {
    this.active.clear();
    this.released = [];
    this.nextId = 0;
  }
};

// src/services/motion/adaptiveMatchThreshold.ts
var BASE_MATCH_COST_THRESHOLD = 0.72;
var MIN_MATCH_COST_THRESHOLD = 0.52;
var MAX_MATCH_COST_THRESHOLD = 1.18;
function computeAdaptiveMatchThreshold({
  motionVelocity = 0,
  poseConfidence = 0.8,
  bpm = 120,
  sampleFps = 30,
  occlusionFrames = 0
} = {}) {
  const vel = Math.max(0, Number(motionVelocity) || 0);
  const conf = Math.min(1, Math.max(0, Number(poseConfidence) || 0.5));
  const tempo = Math.max(60, Math.min(200, Number(bpm) || 120));
  const velocityFactor = Math.min(1, vel / 2.2);
  const tempoFactor = Math.min(1, Math.max(0, (tempo - 80) / 100));
  let threshold = BASE_MATCH_COST_THRESHOLD;
  threshold += velocityFactor * 0.28;
  threshold += tempoFactor * 0.12;
  if (vel < 0.35) threshold -= 0.14;
  if (tempo < 95) threshold -= 0.06;
  if (conf < 0.55) threshold += 0.08;
  if (conf > 0.85) threshold -= 0.04;
  if (occlusionFrames > 0) {
    threshold += Math.min(0.22, occlusionFrames * 0.04);
  }
  const fpsNorm = Math.max(24, Math.min(60, Number(sampleFps) || 30));
  if (fpsNorm >= 50) threshold += 0.03;
  return Math.min(MAX_MATCH_COST_THRESHOLD, Math.max(MIN_MATCH_COST_THRESHOLD, threshold));
}
function computeJointMotionVelocity(prev, curr, dtSec) {
  if (!prev || !curr || !Number.isFinite(dtSec) || dtSec <= 1e-4) return 0;
  let sum2 = 0;
  let count = 0;
  POSE_MATCH_JOINTS.forEach((key) => {
    const a = prev[key];
    const b = curr[key];
    if (!a || !b) return;
    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) return;
    const w = Math.min(resolveJointScore(a), resolveJointScore(b));
    if (w < 0.2) return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));
    sum2 += dist / dtSec * w;
    count += w;
  });
  return count ? sum2 / count : 0;
}

// src/services/motion/OrientationEngine.ts
var RAD = Math.PI / 180;
function classifyYaw(yawRad) {
  const deg = (yawRad * 180 / Math.PI + 360) % 360;
  if (deg < 30 || deg >= 330) return "front";
  if (deg >= 150 && deg < 210) return "back";
  if (deg >= 30 && deg < 60) return "right_45";
  if (deg >= 300 && deg < 330) return "left_45";
  if (deg >= 60 && deg < 120) return "right_90";
  if (deg >= 240 && deg < 300) return "left_90";
  return "unknown";
}
function computeMemberOrientation(member) {
  const joints = member.joints || {};
  const world = member.worldCoordinates || {};
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  const lh = joints.left_hip;
  const rh = joints.right_hip;
  const nose = joints.nose;
  if (!ls || !rs) {
    return { yaw: 0, pitch: 0, label: "unknown", confidence: 0 };
  }
  const shoulderMid = {
    x: (ls.x + rs.x) / 2,
    y: (ls.y + rs.y) / 2,
    z: ((ls.z ?? 0) + (rs.z ?? 0)) / 2
  };
  const wls = world.left_shoulder;
  const wrs = world.right_shoulder;
  const wnose = world.nose;
  let yaw = 0;
  let confidence = 0.5;
  if (wls && wrs && Number.isFinite(wls.z) && Number.isFinite(wrs.z)) {
    const shoulderWidth = wrs.x - wls.x;
    const depthAsym = (wls.z ?? 0) - (wrs.z ?? 0);
    yaw = Math.atan2(depthAsym, Math.abs(shoulderWidth) + 1e-4);
    confidence = 0.85;
  } else if (nose) {
    const noseOffsetX = nose.x - shoulderMid.x;
    const shoulderWidth = Math.abs(rs.x - ls.x);
    yaw = Math.atan2(noseOffsetX, Math.max(0.05, shoulderWidth));
    confidence = 0.6;
  } else {
    yaw = Math.atan2(rs.y - ls.y, rs.x - ls.x) - Math.PI / 2;
    confidence = 0.45;
  }
  if (wnose && wls && wrs) {
    const facingCamera = (wls.z ?? 0) + (wrs.z ?? 0) > (wnose.z ?? 0) * 2;
    if (facingCamera && Math.abs(yaw) > 120 * RAD) {
      yaw = Math.PI;
    }
  }
  let pitch = 0;
  if (lh && rh) {
    const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    pitch = Math.atan2(shoulderMid.y - hipMid.y, Math.hypot(shoulderMid.x - hipMid.x, 0.05));
  }
  return {
    yaw,
    pitch,
    label: classifyYaw(yaw),
    confidence
  };
}
function applyOrientationToMember(member) {
  const orientation = computeMemberOrientation(member);
  return { ...member, orientation };
}
function applyOrientationToFrames(frames) {
  return frames.map((frame) => ({
    ...frame,
    members: (frame.members || []).map(applyOrientationToMember)
  }));
}

// src/utils/quaternionInterpolation.ts
var SKELETON_BONE_SEGMENTS = [
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_shoulder", "right_shoulder"],
  ["left_hip", "right_hip"]
];
function normalizeVec3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-8) return null;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function boneDirection(joints, parent, child) {
  const a = joints[parent];
  const b = joints[child];
  if (!a || !b) return null;
  return normalizeVec3({
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z ?? 0) - (a.z ?? 0)
  });
}
function boneLength(joints, parent, child) {
  const a = joints[parent];
  const b = joints[child];
  if (!a || !b) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));
  return len > 1e-8 ? len : null;
}
function slerpDirection(a, b, t) {
  const va = normalizeVec3(a) || a;
  const vb = normalizeVec3(b) || b;
  let dot = va.x * vb.x + va.y * vb.y + va.z * vb.z;
  dot = Math.max(-1, Math.min(1, dot));
  if (dot > 0.9995) {
    return normalizeVec3({
      x: va.x + (vb.x - va.x) * t,
      y: va.y + (vb.y - va.y) * t,
      z: va.z + (vb.z - va.z) * t
    }) || va;
  }
  if (dot < -0.9995) {
    const ortho = Math.abs(va.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const axis = normalizeVec3({
      x: va.y * ortho.z - va.z * ortho.y,
      y: va.z * ortho.x - va.x * ortho.z,
      z: va.x * ortho.y - va.y * ortho.x
    }) || { x: 0, y: 0, z: 1 };
    const theta = Math.PI * t;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    return {
      x: va.x * cosTheta + axis.x * sinTheta,
      y: va.y * cosTheta + axis.y * sinTheta,
      z: va.z * cosTheta + axis.z * sinTheta
    };
  }
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const w0 = Math.sin((1 - t) * omega) / sinOmega;
  const w1 = Math.sin(t * omega) / sinOmega;
  return normalizeVec3({
    x: va.x * w0 + vb.x * w1,
    y: va.y * w0 + vb.y * w1,
    z: va.z * w0 + vb.z * w1
  }) || va;
}
var RETARGET_BONE_SEGMENTS = {
  leftArm: ["left_shoulder", "left_elbow"],
  leftForeArm: ["left_elbow", "left_wrist"],
  rightArm: ["right_shoulder", "right_elbow"],
  rightForeArm: ["right_elbow", "right_wrist"],
  leftUpLeg: ["left_hip", "left_knee"],
  leftLeg: ["left_knee", "left_ankle"],
  rightUpLeg: ["right_hip", "right_knee"],
  rightLeg: ["right_knee", "right_ankle"],
  spine: ["left_hip", "left_shoulder"],
  head: ["left_shoulder", "nose"]
};
function quaternionFromUnitVectors(from, to) {
  const fa = normalizeVec3(from) || { x: 0, y: 1, z: 0 };
  const tb = normalizeVec3(to) || { x: 0, y: 1, z: 0 };
  let dot = fa.x * tb.x + fa.y * tb.y + fa.z * tb.z;
  dot = Math.max(-1, Math.min(1, dot));
  if (dot > 0.999999) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  if (dot < -0.999999) {
    const axis = Math.abs(fa.x) < 0.9 ? normalizeVec3({ x: 1, y: 0, z: 0 }) : normalizeVec3({ x: 0, y: 1, z: 0 });
    return { x: axis?.x ?? 0, y: axis?.y ?? 0, z: axis?.z ?? 1, w: 0 };
  }
  const cross = {
    x: fa.y * tb.z - fa.z * tb.y,
    y: fa.z * tb.x - fa.x * tb.z,
    z: fa.x * tb.y - fa.y * tb.x
  };
  const s = Math.sqrt((1 + dot) * 2);
  const inv = 1 / s;
  return {
    x: cross.x * inv,
    y: cross.y * inv,
    z: cross.z * inv,
    w: s * 0.5
  };
}
function computeBoneRotationsFromJoints(joints, worldJoints) {
  const source = worldJoints && Object.keys(worldJoints).length >= 4 ? worldJoints : joints;
  const refUp = { x: 0, y: -1, z: 0 };
  const out = {};
  Object.entries(RETARGET_BONE_SEGMENTS).forEach(([boneName, [parent, child]]) => {
    const dir = boneDirection(source, parent, child);
    if (!dir) return;
    out[boneName] = quaternionFromUnitVectors(refUp, dir);
  });
  return out;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function interpolateJointsHybrid(prev, next, ratio) {
  const jointNames = /* @__PURE__ */ new Set([...Object.keys(prev), ...Object.keys(next)]);
  const joints = {};
  jointNames.forEach((name) => {
    const ja = prev[name];
    const jb = next[name];
    if (ja && jb) {
      joints[name] = {
        x: lerp(ja.x, jb.x, ratio),
        y: lerp(ja.y, jb.y, ratio),
        z: lerp(ja.z ?? 0, jb.z ?? 0, ratio),
        visibility: ja.visibility ?? jb.visibility,
        presence: ja.presence ?? jb.presence,
        confidence: lerp(ja.confidence ?? 1, jb.confidence ?? 1, ratio) * 0.9
      };
    } else if (jb) {
      joints[name] = { ...jb };
    } else if (ja) {
      joints[name] = { ...ja };
    }
  });
  SKELETON_BONE_SEGMENTS.forEach(([parent, child]) => {
    const dirPrev = boneDirection(prev, parent, child);
    const dirNext = boneDirection(next, parent, child);
    const lenPrev = boneLength(prev, parent, child);
    const lenNext = boneLength(next, parent, child);
    const parentJoint = joints[parent];
    if (!dirPrev || !dirNext || !parentJoint || lenPrev == null || lenNext == null) return;
    const dir = slerpDirection(dirPrev, dirNext, ratio);
    const len = lerp(lenPrev, lenNext, ratio);
    const existing = joints[child];
    joints[child] = {
      ...existing || {},
      x: parentJoint.x + dir.x * len,
      y: parentJoint.y + dir.y * len,
      z: (parentJoint.z ?? 0) + dir.z * len,
      visibility: existing?.visibility ?? parentJoint.visibility,
      presence: existing?.presence ?? parentJoint.presence,
      confidence: (existing?.confidence ?? 0.7) * 0.9
    };
  });
  return joints;
}

// src/services/motion/JointRotationEngine.ts
function computeMemberBoneRotations(member) {
  if (!member?.joints) return {};
  const world = member.worldCoordinates;
  return computeBoneRotationsFromJoints(member.joints, world);
}
function applyBoneRotationsToMember(member) {
  const boneRotations = computeMemberBoneRotations(member);
  if (!Object.keys(boneRotations).length) return member;
  return { ...member, boneRotations };
}
function applyJointRotationsToFrames(frames) {
  return frames.map((frame) => ({
    ...frame,
    members: (frame.members || []).map(applyBoneRotationsToMember)
  }));
}

// src/benchmark/reconstructFrameProfiler.ts
var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
function isProfileEnabled() {
  return typeof globalThis !== "undefined" && globalThis.__RECONSTRUCT_FRAME_PROFILE__ === true;
}
function jsonByteSize(value) {
  try {
    const json = JSON.stringify(value);
    if (textEncoder) return textEncoder.encode(json).byteLength;
    return json.length;
  } catch {
    return -1;
  }
}
function readHeapBytes() {
  const perf = typeof performance !== "undefined" ? performance : null;
  const mem = perf ? perf.memory : null;
  return mem && Number.isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize : null;
}
var ReconstructFrameProfiler = class {
  frameRows = [];
  functionTimings = /* @__PURE__ */ new Map();
  currentFrame = null;
  stepStack = [];
  hungarianMsThisFrame = 0;
  reset() {
    this.frameRows = [];
    this.functionTimings.clear();
    this.currentFrame = null;
    this.stepStack = [];
    this.hungarianMsThisFrame = 0;
  }
  beginFrame(frameIndex, timestamp) {
    this.currentFrame = {
      frameIndex,
      timestamp,
      totalMs: 0,
      memberMatchingMs: 0,
      hungarianMatchingMs: 0,
      formationMs: 0,
      missingMemberFillMs: 0,
      poseMergeMs: 0,
      timelineMs: 0,
      finalSkeletonMs: 0,
      trackingTotalMs: 0,
      membersOutBytes: 0,
      timelineOutBytes: 0,
      finalOutBytes: 0,
      heapBytes: readHeapBytes()
    };
    this.hungarianMsThisFrame = 0;
  }
  beginStep(step) {
    if (!this.currentFrame) return;
    this.stepStack.push({ step, t0: performance.now() });
  }
  endStep(step) {
    if (!this.currentFrame || !this.stepStack.length) return;
    const top = this.stepStack[this.stepStack.length - 1];
    if (top.step !== step) return;
    this.stepStack.pop();
    const ms = performance.now() - top.t0;
    const key = `${step}Ms`;
    if (key in this.currentFrame && typeof this.currentFrame[key] === "number") {
      this.currentFrame[key] += ms;
    }
    this.recordFunction(step, ms);
  }
  addHungarianMs(ms) {
    if (!this.currentFrame) return;
    this.currentFrame.hungarianMatchingMs = (this.currentFrame.hungarianMatchingMs || 0) + ms;
    this.hungarianMsThisFrame += ms;
    this.recordFunction("hungarianAssign", ms);
  }
  recordFunction(name, ms) {
    const prev = this.functionTimings.get(name) || { totalMs: 0, calls: 0 };
    prev.totalMs += ms;
    prev.calls += 1;
    this.functionTimings.set(name, prev);
  }
  setOutputBytes(kind, bytes) {
    if (!this.currentFrame) return;
    if (kind === "members") this.currentFrame.membersOutBytes = bytes;
    if (kind === "timeline") this.currentFrame.timelineOutBytes = bytes;
    if (kind === "final") this.currentFrame.finalOutBytes = bytes;
  }
  endFrame(totalMs) {
    if (!this.currentFrame) return;
    this.currentFrame.totalMs = totalMs;
    this.currentFrame.heapBytes = readHeapBytes();
    this.frameRows.push(this.currentFrame);
    this.currentFrame = null;
  }
  getTopFunctions(limit = 10) {
    return [...this.functionTimings.entries()].map(([name, v]) => ({
      name,
      totalMs: v.totalMs,
      calls: v.calls,
      avgMs: v.calls ? v.totalMs / v.calls : 0
    })).sort((a, b) => b.totalMs - a.totalMs).slice(0, limit);
  }
};
var reconstructFrameProfiler = new ReconstructFrameProfiler();
function profileBeginFrame(frameIndex, timestamp) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.beginFrame(frameIndex, timestamp);
}
function profileEndFrame(totalMs) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.endFrame(totalMs);
}
function profileStep(step, fn) {
  if (!isProfileEnabled()) return fn();
  reconstructFrameProfiler.beginStep(step);
  try {
    return fn();
  } finally {
    reconstructFrameProfiler.endStep(step);
  }
}
function profileRecordBytes(kind, value) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.setOutputBytes(kind, jsonByteSize(value));
}

// src/services/motion/MemberTrackingEngine.ts
var MemberTrackingEngine = class {
  trackPool;
  predictors = /* @__PURE__ */ new Map();
  occlusionByTrack = /* @__PURE__ */ new Map();
  identityConfidence = /* @__PURE__ */ new Map();
  memberVelocity = /* @__PURE__ */ new Map();
  lastTimestamp = 0;
  constructor(maxTracks = 9) {
    this.trackPool = new TrackPool(maxTracks);
  }
  reset() {
    this.trackPool.reset();
    this.predictors.forEach((p) => p.reset());
    this.predictors.clear();
    this.occlusionByTrack.clear();
    this.identityConfidence.clear();
    this.memberVelocity.clear();
    this.lastTimestamp = 0;
  }
  getTrackPool() {
    return this.trackPool;
  }
  getIdentityConfidence() {
    const out = {};
    this.identityConfidence.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  getPredictor(trackId) {
    let p = this.predictors.get(trackId);
    if (!p) {
      p = new TrackMotionPredictor();
      this.predictors.set(trackId, p);
    }
    return p;
  }
  releaseTrack(trackId) {
    this.predictors.get(trackId)?.reset();
    this.predictors.delete(trackId);
    this.occlusionByTrack.delete(trackId);
    this.trackPool.release(trackId);
  }
  /** Visibility · Presence 필터 적용 */
  filterMemberVisibility(member) {
    const filtered = applyJointConfidenceFilter(
      member.joints || {},
      member.worldCoordinates || {}
    );
    return {
      ...member,
      joints: filtered.joints,
      worldCoordinates: Object.keys(filtered.worldJoints).length ? filtered.worldJoints : member.worldCoordinates,
      confidence: computeMemberPoseConfidence({ joints: filtered.joints, confidence: member.confidence })
    };
  }
  /** 첫 프레임 시드 */
  seedMembers(members) {
    return members.map((m) => {
      const filtered = this.filterMemberVisibility(m);
      const trackId = this.trackPool.acquire(Number(filtered.trackId)) ?? this.trackPool.acquire() ?? 0;
      if (filtered.joints) this.getPredictor(trackId).update(filtered.joints, this.lastTimestamp);
      this.occlusionByTrack.set(trackId, 0);
      if (filtered.estimatedMemberId) {
        this.identityConfidence.set(filtered.estimatedMemberId, filtered.confidence ?? 0.8);
      }
      return applyBoneRotationsToMember(applyOrientationToMember({
        ...filtered,
        trackId,
        personIndex: trackId
      }));
    });
  }
  /**
   * Kalman Prediction → Adaptive Hungarian → Occlusion Recovery → Quaternion/Orientation.
   */
  trackMembers(currentMembers, previousMembers, options = {}) {
    if (!previousMembers.length) {
      const seeded = this.seedMembers(currentMembers);
      return {
        members: seeded,
        occlusionRecoveries: 0,
        avgVelocity: 0,
        identityConfidence: this.getIdentityConfidence()
      };
    }
    const now = options.timestamp ?? 0;
    const dtSec = options.timestamp != null && options.prevTimestamp != null ? Math.max(1e-3, now - options.prevTimestamp) : 1 / (options.sampleFps || 30);
    this.lastTimestamp = now;
    const maxOcclusion = options.maxOcclusionFrames ?? Math.ceil((options.sampleFps || 30) * 2);
    this.trackPool.setMaxSlots(options.maxTracks ?? 9);
    const filteredCurrent = currentMembers.map((m) => this.filterMemberVisibility(m));
    let frameMotionVelocity = 0;
    this.predictors.forEach((p) => {
      frameMotionVelocity = Math.max(frameMotionVelocity, p.averageVelocity());
    });
    const avgConfidence = filteredCurrent.reduce((s, m) => s + computeMemberPoseConfidence(m), 0) / Math.max(1, filteredCurrent.length);
    const nPrev = previousMembers.length;
    const nCurr = filteredCurrent.length;
    const costMatrix = profileStep("memberMatching", () => Array.from({ length: nPrev }, (_, i) => {
      const prev = previousMembers[i];
      const tid = Number(prev.trackId ?? i);
      const occlusionFrames = this.occlusionByTrack.get(tid) ?? (prev.isEstimated ? 1 : 0);
      const refJoints = occlusionFrames > 0 ? this.getPredictor(tid).predict(now) : prev.joints;
      const boost = occlusionFrames > 0 ? computeAdaptiveMatchThreshold({
        motionVelocity: frameMotionVelocity,
        poseConfidence: avgConfidence,
        bpm: options.bpm,
        sampleFps: options.sampleFps,
        occlusionFrames
      }) - computeAdaptiveMatchThreshold({
        motionVelocity: frameMotionVelocity,
        poseConfidence: avgConfidence,
        bpm: options.bpm,
        sampleFps: options.sampleFps
      }) : 0;
      return Array.from({ length: nCurr }, (_2, j) => {
        const raw = jointsPoseDistance(refJoints, filteredCurrent[j]?.joints);
        return Math.max(0, raw - boost * 0.15);
      });
    }));
    const assignment = profileStep("hungarianMatching", () => hungarianAssign(costMatrix));
    const matchedCurr = /* @__PURE__ */ new Set();
    const matchedPrev = /* @__PURE__ */ new Set();
    const result = [];
    let occlusionRecoveries = 0;
    let velocitySum = 0;
    let velocityCount = 0;
    const staleTracks = [];
    profileStep("poseMerge", () => {
      assignment.forEach((currIdx, prevIdx) => {
        if (currIdx < 0 || currIdx >= nCurr) return;
        const prev = previousMembers[prevIdx];
        const tid = Number(prev.trackId ?? prevIdx);
        const cost = costMatrix[prevIdx]?.[currIdx] ?? Infinity;
        const occlusionFrames = this.occlusionByTrack.get(tid) ?? (prev.isEstimated ? 1 : 0);
        const threshold = computeAdaptiveMatchThreshold({
          motionVelocity: frameMotionVelocity,
          poseConfidence: avgConfidence,
          bpm: options.bpm,
          sampleFps: options.sampleFps,
          occlusionFrames
        });
        if (cost > threshold) return;
        matchedCurr.add(currIdx);
        matchedPrev.add(prevIdx);
        const curr = filteredCurrent[currIdx];
        const memberId = prev.estimatedMemberId ?? curr.estimatedMemberId;
        if (prev.joints && curr.joints) {
          const vel = computeJointMotionVelocity(prev.joints, curr.joints, dtSec);
          frameMotionVelocity = Math.max(frameMotionVelocity, vel);
          if (memberId) {
            this.memberVelocity.set(memberId, vel);
            velocitySum += vel;
            velocityCount += 1;
          }
        }
        this.getPredictor(tid).update(curr.joints, now);
        this.occlusionByTrack.set(tid, 0);
        if (memberId) {
          const prevConf = this.identityConfidence.get(memberId) ?? 0.5;
          this.identityConfidence.set(
            memberId,
            prevConf * 0.15 + (curr.confidence ?? 0.8) * 0.85
          );
        }
        result.push(applyBoneRotationsToMember(applyOrientationToMember({
          ...curr,
          trackId: tid,
          personIndex: tid,
          estimatedMemberId: memberId,
          isEstimated: false
        })));
      });
    });
    profileStep("missingMemberFill", () => {
      previousMembers.forEach((prev, prevIdx) => {
        if (matchedPrev.has(prevIdx)) return;
        const tid = Number(prev.trackId ?? prevIdx);
        const missed = (this.occlusionByTrack.get(tid) ?? 0) + 1;
        this.occlusionByTrack.set(tid, missed);
        if (missed > maxOcclusion) {
          staleTracks.push(tid);
          return;
        }
        const predicted = this.getPredictor(tid).predict(now);
        const holdJoints = Object.keys(predicted).length ? predicted : prev.joints;
        result.push(applyBoneRotationsToMember(applyOrientationToMember({
          ...prev,
          joints: holdJoints,
          isEstimated: true,
          confidence: computeMemberPoseConfidence(prev) * 0.7
        })));
      });
      staleTracks.forEach((tid) => this.releaseTrack(tid));
      filteredCurrent.forEach((curr, currIdx) => {
        if (matchedCurr.has(currIdx)) return;
        let reIdPrev = null;
        let reIdCost = Infinity;
        let reIdTid = -1;
        previousMembers.forEach((prev, prevIdx) => {
          if (matchedPrev.has(prevIdx)) return;
          const tid = Number(prev.trackId ?? prevIdx);
          const occlusionFrames = this.occlusionByTrack.get(tid) ?? 1;
          if (occlusionFrames <= 0) return;
          const predicted = this.getPredictor(tid).predict(now);
          const cost = jointsPoseDistance(predicted, curr.joints);
          const threshold = computeAdaptiveMatchThreshold({
            motionVelocity: frameMotionVelocity,
            poseConfidence: avgConfidence,
            bpm: options.bpm,
            sampleFps: options.sampleFps,
            occlusionFrames
          });
          if (cost < reIdCost && cost <= threshold) {
            reIdCost = cost;
            reIdPrev = prev;
            reIdTid = tid;
          }
        });
        if (reIdPrev && reIdTid >= 0) {
          occlusionRecoveries += 1;
          const memberId = reIdPrev.estimatedMemberId ?? curr.estimatedMemberId;
          this.getPredictor(reIdTid).update(curr.joints, now);
          this.occlusionByTrack.set(reIdTid, 0);
          if (memberId) this.identityConfidence.set(memberId, (curr.confidence ?? 0.75) * 0.9);
          result.push(applyBoneRotationsToMember(applyOrientationToMember({
            ...curr,
            trackId: reIdTid,
            personIndex: reIdTid,
            estimatedMemberId: memberId
          })));
          return;
        }
        const trackId = this.trackPool.acquire(Number(curr.trackId));
        if (trackId == null) return;
        this.getPredictor(trackId).update(curr.joints, now);
        this.occlusionByTrack.set(trackId, 0);
        if (curr.estimatedMemberId) {
          this.identityConfidence.set(curr.estimatedMemberId, curr.confidence ?? 0.6);
        }
        result.push(applyBoneRotationsToMember(applyOrientationToMember({
          ...curr,
          trackId,
          personIndex: trackId
        })));
      });
    });
    return {
      members: result,
      occlusionRecoveries,
      avgVelocity: velocityCount ? velocitySum / velocityCount : 0,
      identityConfidence: this.getIdentityConfidence()
    };
  }
  /** 멤버 Motion Timeline 기반 Quaternion 보간 hold */
  interpolateMemberHold(memberId, prev, next, ratio, timestamp) {
    if (!prev?.joints || !next?.joints) return prev || next;
    const joints = interpolateJointsHybrid(prev.joints, next.joints, ratio);
    return applyBoneRotationsToMember(applyOrientationToMember({
      ...prev,
      joints,
      timestamp,
      isEstimated: true,
      confidence: ((prev.confidence ?? 1) * (1 - ratio) + (next.confidence ?? 1) * ratio) * 0.8,
      estimatedMemberId: memberId
    }));
  }
};

// src/utils/skeletonTimelineUtils.ts
function interpolateSkeletonFrame(prev, next, ratio) {
  const prevByMember = new Map(prev.members.map((m) => [m.estimatedMemberId, m]));
  const members = [];
  next.members.forEach((nextMember) => {
    const prevMember = prevByMember.get(nextMember.estimatedMemberId);
    if (!prevMember) {
      members.push(nextMember);
      return;
    }
    const joints = interpolateJointsHybrid(
      prevMember.joints || {},
      nextMember.joints || {},
      ratio
    );
    members.push({
      ...nextMember,
      trackId: nextMember.trackId ?? prevMember.trackId,
      personIndex: nextMember.trackId ?? prevMember.trackId,
      isEstimated: prevMember.isEstimated || nextMember.isEstimated,
      joints
    });
  });
  prev.members.forEach((prevMember) => {
    if (members.some((m) => m.estimatedMemberId === prevMember.estimatedMemberId)) return;
    members.push({
      ...prevMember,
      isEstimated: true
    });
  });
  return {
    timestamp: prev.timestamp + (next.timestamp - prev.timestamp) * ratio,
    timestampMs: Math.round(
      (prev.timestampMs ?? prev.timestamp * 1e3) + ((next.timestampMs ?? next.timestamp * 1e3) - (prev.timestampMs ?? prev.timestamp * 1e3)) * ratio
    ),
    videoWidth: next.videoWidth ?? prev.videoWidth,
    videoHeight: next.videoHeight ?? prev.videoHeight,
    members
  };
}
function findFrameIndexByTimestamp(frames, timeSec) {
  if (!frames?.length) return -1;
  const t = Number(timeSec);
  if (!Number.isFinite(t)) return -1;
  const first = frames[0];
  const lastIdx = frames.length - 1;
  const last = frames[lastIdx];
  if (t < first.timestamp) return 0;
  if (t > last.timestamp) return -1;
  if (t === last.timestamp) return lastIdx;
  let lo = 0;
  let hi = lastIdx;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (frames[mid].timestamp <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}
function resolvePracticeFrameAtTime(frames, timeSec) {
  if (!frames?.length) return null;
  const t = Math.max(0, Number(timeSec));
  if (!Number.isFinite(t)) return null;
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (t < first.timestamp) return null;
  if (t > last.timestamp) return null;
  if (t <= first.timestamp) {
    return { ...first, timestamp: t, timestampMs: Math.round(t * 1e3) };
  }
  const lo = findFrameIndexByTimestamp(frames, t);
  if (lo < 0) return null;
  const prev = frames[lo];
  const next = frames[lo + 1] ?? prev;
  if (prev === next || next.timestamp <= prev.timestamp) {
    return { ...prev, timestamp: t, timestampMs: Math.round(t * 1e3) };
  }
  const delta = next.timestamp - prev.timestamp;
  const ratio = Math.min(1, Math.max(0, (t - prev.timestamp) / delta));
  return interpolateSkeletonFrame(prev, next, ratio);
}

// src/services/motion/MemberMotionRetargeting.ts
var HIP_KEYS = ["left_hip", "right_hip"];
var AUDIENCE_Y = 0.12;
function hipCenter(joints) {
  const hips = HIP_KEYS.map((k) => joints[k]).filter(Boolean);
  if (!hips.length) {
    const nose = joints.nose;
    return nose ? { x: nose.x, y: nose.y, z: nose.z ?? 0 } : null;
  }
  const sum2 = hips.reduce(
    (acc, j) => ({ x: acc.x + j.x, y: acc.y + j.y, z: acc.z + (j.z ?? 0) }),
    { x: 0, y: 0, z: 0 }
  );
  return { x: sum2.x / hips.length, y: sum2.y / hips.length, z: sum2.z / hips.length };
}
function shoulderBearing(joints) {
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  if (!ls || !rs) return 0;
  return Math.atan2(rs.y - ls.y, rs.x - ls.x);
}
function groupCentroid(members) {
  if (!members.length) return { x: 0.5, y: 0.5 };
  const sum2 = members.reduce((acc, m) => ({ x: acc.x + m.defaultX, y: acc.y + m.defaultY }), { x: 0, y: 0 });
  return { x: sum2.x / members.length, y: sum2.y / members.length };
}
function resolveFormationSlotAnchor(member, groupMembers) {
  const centroid = groupCentroid(groupMembers);
  const outwardX = member.defaultX - centroid.x;
  const outwardY = member.defaultY - centroid.y;
  const toAudienceX = member.defaultX - 0.5;
  const toAudienceY = AUDIENCE_Y - member.defaultY;
  const facingAngle = Math.abs(toAudienceX) + Math.abs(toAudienceY) > 1e-4 ? Math.atan2(toAudienceY, toAudienceX) : Math.atan2(outwardY, outwardX) + Math.PI / 2;
  const depth = Math.hypot(outwardX, outwardY) * 0.08;
  return {
    x: member.defaultX,
    y: member.defaultY,
    z: depth,
    facingAngle
  };
}
function rotatePoint2D(p, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
    z: p.z ?? 0
  };
}
function transformLandmarkPoints(points, hip, rotation, targetHip) {
  if (!points?.length) return void 0;
  return points.map((p) => {
    const local = { x: p.x - hip.x, y: p.y - hip.y, z: (p.z ?? 0) - hip.z };
    const rotated = rotatePoint2D(local, rotation);
    return {
      ...p,
      x: targetHip.x + rotated.x,
      y: targetHip.y + rotated.y,
      z: targetHip.z + rotated.z
    };
  });
}
function transformHandFace(hand, hip, rotation, targetHip) {
  if (!hand?.landmarks?.length) return hand;
  return {
    ...hand,
    landmarks: transformLandmarkPoints(hand.landmarks, hip, rotation, targetHip) || hand.landmarks,
    worldLandmarks: hand.worldLandmarks ? transformLandmarkPoints(hand.worldLandmarks, hip, rotation, targetHip) : void 0
  };
}
function retargetMemberSkeletonToFormation(source, focusSlot, targetSlot, sourceBearing, formationScale = 1) {
  const joints = source.joints || {};
  const hip = hipCenter(joints);
  if (!hip) return { ...source, isEstimated: true };
  const rotation = targetSlot.facingAngle - sourceBearing;
  const spread = formationScale;
  const hipLocal = {};
  Object.entries(joints).forEach(([name, j]) => {
    if (!j) return;
    hipLocal[name] = {
      ...j,
      x: (j.x - hip.x) * spread,
      y: (j.y - hip.y) * spread,
      z: ((j.z ?? 0) - hip.z) * spread
    };
  });
  const rotatedLocal = {};
  Object.entries(hipLocal).forEach(([name, j]) => {
    const r = rotatePoint2D(j, rotation);
    rotatedLocal[name] = {
      ...j,
      x: r.x,
      y: r.y,
      z: r.z
    };
  });
  SKELETON_BONE_SEGMENTS.forEach(([parent, child]) => {
    const dirSrc = boneDirection(rotatedLocal, parent, child);
    const dirFocus = boneDirection(hipLocal, parent, child);
    const len = boneLength(rotatedLocal, parent, child) ?? boneLength(hipLocal, parent, child);
    const parentJoint = rotatedLocal[parent];
    if (!dirSrc || !dirFocus || !parentJoint || len == null) return;
    const dir = slerpDirection(dirFocus, dirSrc, 0.35);
    rotatedLocal[child] = {
      ...rotatedLocal[child] || {},
      x: parentJoint.x + dir.x * len,
      y: parentJoint.y + dir.y * len,
      z: (parentJoint.z ?? 0) + dir.z * len,
      visibility: rotatedLocal[child]?.visibility ?? parentJoint.visibility,
      confidence: (rotatedLocal[child]?.confidence ?? 0.7) * 0.85
    };
  });
  const world = source.worldCoordinates || {};
  const worldHip = hipCenter(world) || hip;
  const retargetedJoints = {};
  Object.entries(rotatedLocal).forEach(([name, j]) => {
    retargetedJoints[name] = {
      ...j,
      x: targetSlot.x + j.x,
      y: targetSlot.y + j.y,
      z: targetSlot.z + (j.z ?? 0)
    };
  });
  const retargetedWorld = {};
  Object.entries(world).forEach(([name, pt]) => {
    const local = {
      x: (pt.x - worldHip.x) * spread,
      y: (pt.y - worldHip.y) * spread,
      z: ((pt.z ?? 0) - worldHip.z) * spread
    };
    const r = rotatePoint2D(local, rotation);
    retargetedWorld[name] = {
      ...pt,
      x: targetSlot.x + r.x,
      y: targetSlot.y + r.y,
      z: targetSlot.z + r.z
    };
  });
  return {
    ...source,
    joints: retargetedJoints,
    worldCoordinates: Object.keys(retargetedWorld).length ? retargetedWorld : source.worldCoordinates,
    leftHand: transformHandFace(source.leftHand, hip, rotation, targetSlot),
    rightHand: transformHandFace(source.rightHand, hip, rotation, targetSlot),
    face: source.face?.landmarks ? {
      ...source.face,
      landmarks: transformLandmarkPoints(source.face.landmarks, hip, rotation, targetSlot) || source.face.landmarks
    } : source.face,
    isEstimated: true,
    confidence: (source.confidence ?? 0.8) * 0.72
  };
}
function expandSingleDancerViaFormationRetargeting(members, groupId, focusMemberId, ctx = {}) {
  const group = GROUP_DATA[groupId];
  if (!group || !members?.length) return members;
  const source = members.find((m) => !m.isEstimated) || members[0];
  if (!source?.joints || !Object.keys(source.joints).length) return members;
  const sourceBearing = shoulderBearing(source.joints);
  const focusMember = group.members.find((m) => m.id === focusMemberId) || group.members[0];
  const focusSlot = resolveFormationSlotAnchor(focusMember, group.members);
  const scale = ctx.formationScale ?? 1;
  return group.members.map((member, trackId) => {
    if (member.id === focusMemberId) {
      return {
        ...source,
        trackId,
        personIndex: trackId,
        estimatedMemberId: member.id,
        isEstimated: false,
        confidence: source.confidence ?? 1
      };
    }
    const targetSlot = resolveFormationSlotAnchor(member, group.members);
    const retargeted = retargetMemberSkeletonToFormation(
      source,
      focusSlot,
      targetSlot,
      sourceBearing,
      scale
    );
    return {
      ...retargeted,
      trackId,
      personIndex: trackId,
      estimatedMemberId: member.id
    };
  });
}
function synthesizeFormationMembersForFrame(frame, {
  groupId,
  focusMemberId,
  allMemberIds,
  formationTimeline,
  formationKeyframes
}) {
  const group = GROUP_DATA[groupId];
  if (!group) return frame;
  const present = new Set((frame.members || []).map((m) => m.estimatedMemberId).filter(Boolean));
  const missing = allMemberIds.filter((id) => id && id !== focusMemberId && !present.has(id));
  if (!missing.length) return frame;
  const source = frame.members?.find((m) => m.estimatedMemberId === focusMemberId && !m.isEstimated) || frame.members?.find((m) => !m.isEstimated) || frame.members?.[0];
  if (!source) return frame;
  const motionAnchorId = source.estimatedMemberId || focusMemberId;
  let expanded = expandSingleDancerViaFormationRetargeting(
    [source],
    groupId,
    motionAnchorId,
    { formationTimeline, formationKeyframes, timestamp: frame.timestamp }
  );
  const keyframes = formationTimeline?.keyframes || formationKeyframes || [];
  if (keyframes.length) {
    const slotKeyframe = keyframes.reduce(
      (nearest, k) => Math.abs(k.timestamp - frame.timestamp) < Math.abs(nearest.timestamp - frame.timestamp) ? k : nearest
    );
    if (slotKeyframe?.slots?.length) {
      expanded = expanded.map((m) => {
        const slot = slotKeyframe.slots.find((s) => s.memberId === m.estimatedMemberId);
        if (!slot || m.estimatedMemberId === focusMemberId) return m;
        const targetSlot = {
          x: slot.x,
          y: slot.y,
          z: slot.z ?? 0,
          facingAngle: resolveFormationSlotAnchor(
            { defaultX: slot.x, defaultY: slot.y },
            group.members
          ).facingAngle
        };
        const focusSlot = resolveFormationSlotAnchor(
          group.members.find((gm) => gm.id === focusMemberId) || group.members[0],
          group.members
        );
        return {
          ...retargetMemberSkeletonToFormation(
            source,
            focusSlot,
            targetSlot,
            shoulderBearing(source.joints || {})
          ),
          trackId: m.trackId,
          personIndex: m.personIndex,
          estimatedMemberId: m.estimatedMemberId
        };
      });
    }
  }
  const byId = new Map(expanded.map((m) => [m.estimatedMemberId, m]));
  const merged = allMemberIds.filter((id) => id).map((id) => {
    const existing = frame.members?.find((m) => m.estimatedMemberId === id);
    if (existing && !existing.isEstimated) return existing;
    return byId.get(id) || existing;
  }).filter(Boolean);
  return {
    ...frame,
    members: merged,
    memberTracks: merged.map((m) => ({
      trackId: Number(m.trackId ?? 0),
      memberId: m.estimatedMemberId,
      confidence: m.confidence ?? 0.7
    }))
  };
}
function synthesizeFormationMembersForFrames(frames, options) {
  if (!frames?.length) return frames;
  return frames.map((frame) => synthesizeFormationMembersForFrame(frame, options));
}

// src/services/motion/MotionDatabaseEngine.ts
function buildMemberMotionTracks(frames, memberIds) {
  const tracks = /* @__PURE__ */ new Map();
  memberIds.forEach((id) => tracks.set(id, { memberId: id, samples: [] }));
  frames.forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const memberId = member.estimatedMemberId;
      if (!memberId || !tracks.has(memberId)) return;
      if (!member.joints || !Object.keys(member.joints).length) return;
      tracks.get(memberId).samples.push({
        timestamp: frame.timestamp,
        member: { ...member, joints: { ...member.joints } }
      });
    });
  });
  return tracks;
}
function resolveMemberMotionAtTime(track, timestamp) {
  if (!track?.samples?.length) return null;
  const live = track.samples.find(
    (s) => Math.abs(s.timestamp - timestamp) < 1e-3 && !s.member.isEstimated
  );
  if (live) return live.member;
  const nearest = track.samples.reduce(
    (best, s) => Math.abs(s.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? s : best
  );
  const prev = [...track.samples].reverse().find((s) => s.timestamp <= timestamp);
  const next = track.samples.find((s) => s.timestamp >= timestamp);
  if (prev && next && prev.timestamp !== next.timestamp) {
    const ratio = (timestamp - prev.timestamp) / (next.timestamp - prev.timestamp);
    return interpolateMemberMotion(prev.member, next.member, ratio, timestamp);
  }
  return nearest?.member ?? null;
}
function interpolateMemberMotion(a, b, ratio, timestamp) {
  const t = Math.min(1, Math.max(0, ratio));
  const joints = {};
  const names = /* @__PURE__ */ new Set([...Object.keys(a.joints || {}), ...Object.keys(b.joints || {})]);
  names.forEach((name) => {
    const ja = a.joints?.[name];
    const jb = b.joints?.[name];
    if (!ja || !jb) return;
    joints[name] = {
      ...ja,
      x: ja.x + (jb.x - ja.x) * t,
      y: ja.y + (jb.y - ja.y) * t,
      z: (ja.z ?? 0) + ((jb.z ?? 0) - (ja.z ?? 0)) * t,
      confidence: ((ja.confidence ?? 1) * (1 - t) + (jb.confidence ?? 1) * t) * 0.8
    };
  });
  return {
    ...a,
    joints,
    timestamp,
    isEstimated: true,
    confidence: ((a.confidence ?? 1) * (1 - t) + (b.confidence ?? 1) * t) * 0.75
  };
}
function measureMemberMotionCoverage(tracks, memberIds, durationSec) {
  const coverage = /* @__PURE__ */ new Map();
  memberIds.forEach((id) => {
    const track = tracks.get(id);
    if (!track?.samples.length || durationSec <= 0) {
      coverage.set(id, 0);
      return;
    }
    const realSamples = track.samples.filter((s) => !s.member.isEstimated);
    const span = realSamples.length ? realSamples[realSamples.length - 1].timestamp - realSamples[0].timestamp : 0;
    coverage.set(id, Math.min(1, span / durationSec));
  });
  return coverage;
}
function resolveFrameMembersFromMotionDatabase(frame, tracks, options) {
  const { allMemberIds, userMemberId } = options;
  const aiIds = allMemberIds.filter((id) => id && id !== userMemberId);
  const liveById = new Map(
    (frame.members || []).filter((m) => m.estimatedMemberId).map((m) => [m.estimatedMemberId, m])
  );
  return aiIds.map((memberId, idx) => {
    const live = liveById.get(memberId);
    if (live?.joints && Object.keys(live.joints).length && !live.isEstimated) {
      return {
        ...live,
        trackId: live.trackId ?? idx,
        personIndex: live.personIndex ?? idx,
        estimatedMemberId: memberId
      };
    }
    const fromTrack = resolveMemberMotionAtTime(tracks.get(memberId), frame.timestamp);
    if (fromTrack?.joints && Object.keys(fromTrack.joints).length) {
      return {
        ...fromTrack,
        trackId: fromTrack.trackId ?? idx,
        personIndex: fromTrack.personIndex ?? idx,
        estimatedMemberId: memberId,
        isEstimated: fromTrack.isEstimated ?? !live
      };
    }
    return live || null;
  }).filter(Boolean);
}
function applyMemberMotionDatabase(frames, options) {
  if (!frames?.length) return frames;
  const aiIds = options.allMemberIds.filter((id) => id && id !== options.userMemberId);
  const tracks = buildMemberMotionTracks(frames, aiIds);
  const duration = frames[frames.length - 1]?.timestamp || 0;
  const coverage = measureMemberMotionCoverage(tracks, aiIds, duration);
  const multiMemberRealMotion = aiIds.filter((id) => (coverage.get(id) ?? 0) > 0.05).length >= 2;
  if (!multiMemberRealMotion && options.singleDancerMode && options.formationContext) {
    if (import.meta.env?.DEV) {
      console.debug("[MotionDatabase] 1\uC778 \uC601\uC0C1 \u2014 Formation Retarget \uD3F4\uBC31");
    }
    return synthesizeFormationMembersForFrames(frames, options.formationContext);
  }
  if (import.meta.env?.DEV) {
    const summary = aiIds.map((id) => `${id}:${((coverage.get(id) ?? 0) * 100).toFixed(0)}%`).join(", ");
    console.debug("[MotionDatabase] \uBA64\uBC84\uBCC4 \uC2E4\uCE21 Motion", summary);
  }
  return frames.map((frame) => {
    const members = resolveFrameMembersFromMotionDatabase(frame, tracks, options);
    return {
      ...frame,
      members,
      memberTracks: members.map((m) => ({
        trackId: Number(m.trackId ?? 0),
        memberId: m.estimatedMemberId,
        confidence: m.confidence ?? 0.7
      }))
    };
  });
}
function resolveMembersFromStoredMotionDatabase(frame, skeletonFrames, groupMemberIds, userMemberId) {
  const dbFrame = resolvePracticeFrameAtTime(skeletonFrames, frame.timestamp);
  if (!dbFrame?.members?.length) return frame.members || [];
  const byId = new Map(
    dbFrame.members.map((m) => [m.estimatedMemberId, m])
  );
  return groupMemberIds.filter((id) => id !== userMemberId).map((memberId, idx) => {
    const fromDb = byId.get(memberId);
    if (fromDb?.joints && Object.keys(fromDb.joints).length) {
      return {
        ...fromDb,
        trackId: fromDb.trackId ?? idx,
        personIndex: fromDb.personIndex ?? idx,
        estimatedMemberId: memberId
      };
    }
    const live = (frame.members || []).find((m) => m.estimatedMemberId === memberId);
    return live || null;
  }).filter(Boolean);
}

// src/services/motion/MotionTimelineEngine.ts
function buildMemberMotionTimelines(frames, memberIds) {
  const tracks = /* @__PURE__ */ new Map();
  memberIds.forEach((memberId) => {
    tracks.set(memberId, {
      memberId,
      sampleCount: 0,
      realSampleCount: 0,
      coverageSec: 0,
      samples: []
    });
  });
  frames.forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const memberId = member.estimatedMemberId;
      if (!memberId || !tracks.has(memberId)) return;
      if (!member.joints || !Object.keys(member.joints).length) return;
      const track = tracks.get(memberId);
      track.samples.push({
        timestamp: frame.timestamp,
        frameIndex: frame.frameIndex,
        joints: member.joints,
        worldCoordinates: member.worldCoordinates,
        orientation: member.orientation,
        boneRotations: member.boneRotations,
        confidence: member.confidence,
        isEstimated: member.isEstimated
      });
      track.sampleCount += 1;
      if (!member.isEstimated) track.realSampleCount += 1;
      track.trackId = member.trackId ?? track.trackId;
    });
  });
  tracks.forEach((track) => {
    const real = track.samples.filter((s) => !s.isEstimated);
    if (real.length >= 2) {
      track.coverageSec = real[real.length - 1].timestamp - real[0].timestamp;
    }
  });
  if (import.meta.env?.DEV) {
    const summary = [...tracks.values()].map((t) => `${t.memberId}:${t.realSampleCount}/${t.sampleCount}`).join(", ");
    console.debug("[MotionTimeline]", summary);
  }
  return tracks;
}

// src/utils/practiceValidationDebug.ts
function buildFieldError(missingField, expected, received, message) {
  return { missingField, expected, received, ...message ? { message } : {} };
}
function logValidationFieldErrors(label, errors) {
  if (!errors.length) return;
  console.group(`[Validation] ${label} \u2014 ${errors.length} blocking error(s)`);
  errors.forEach((entry, index) => {
    const payload = {
      missingField: entry.missingField,
      expected: entry.expected,
      received: entry.received,
      ...entry.message ? { message: entry.message } : {}
    };
    console.warn(`Blocking #${index + 1}: ${entry.missingField}`);
    console.log(JSON.stringify(payload, null, 2));
  });
  console.groupEnd();
}
function logUndefinedFields(label, obj, keys) {
  const missing = keys.filter((key) => {
    const value = obj?.[key];
    return value === void 0 || value === null;
  });
  if (missing.length > 0) {
    const errors = missing.map(
      (field) => buildFieldError(
        field,
        "defined value",
        obj?.[field] ?? void 0,
        `${label}: required field missing`
      )
    );
    logValidationFieldErrors(label, errors);
  }
  return missing;
}
function logPracticeValidationTable(row, extra = {}) {
  console.group("[PracticeValidation] summary");
  console.table([{ ...row, ...extra }]);
  console.groupEnd();
}

// src/utils/skeletonDataUtils.ts
function normalizeTrackMemberMap(input) {
  const out = /* @__PURE__ */ new Map();
  if (!input) return out;
  if (input instanceof Map) {
    input.forEach((memberId, trackId) => {
      if (memberId) out.set(Number(trackId), String(memberId));
    });
    return out;
  }
  Object.entries(input).forEach(([trackId, memberId]) => {
    if (memberId) out.set(Number(trackId), String(memberId));
  });
  return out;
}
function hasUsableJoints(joints) {
  if (!joints || typeof joints !== "object") return false;
  return Object.keys(joints).length > 0;
}
function normalizeJointPoint(joint) {
  return {
    x: Number(joint?.x) || 0,
    y: Number(joint?.y) || 0,
    z: Number(joint?.z) || 0,
    visibility: joint?.visibility ?? joint?.confidence ?? 1,
    presence: joint?.presence,
    confidence: joint?.confidence ?? joint?.visibility ?? 1
  };
}
function jointsToWorldCoordinates(joints) {
  const out = {};
  Object.entries(joints).forEach(([name, joint]) => {
    out[name] = {
      x: joint.x,
      y: joint.y,
      z: joint.z ?? 0,
      visibility: joint.visibility,
      confidence: joint.confidence ?? joint.visibility
    };
  });
  return out;
}
function computeBoundingBoxFromJoints(joints) {
  const points = Object.values(joints || {});
  if (!points.length) return void 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  if (!Number.isFinite(minX)) return void 0;
  return { minX, minY, maxX, maxY };
}
function averageJointConfidence(joints) {
  const values = Object.values(joints).map((j) => j.confidence ?? j.visibility).filter((v) => v != null && Number.isFinite(v));
  if (!values.length) return 1;
  return values.reduce((sum2, v) => sum2 + Number(v), 0) / values.length;
}
function buildFrameMemberTracks(members) {
  return members.map((m) => ({
    trackId: Number(m.trackId ?? m.personIndex ?? 0),
    memberId: m.estimatedMemberId,
    confidence: m.confidence ?? averageJointConfidence(m.joints),
    initialPosition: m.boundingBox ? { x: (m.boundingBox.minX + m.boundingBox.maxX) / 2, y: (m.boundingBox.minY + m.boundingBox.maxY) / 2 } : void 0
  }));
}
function mergeFrameBoundingBoxes(members) {
  const boxes = members.map((m) => m.boundingBox).filter(Boolean);
  if (!boxes.length) return computeBoundingBoxFromJoints(members[0]?.joints || {});
  return boxes.reduce(
    (acc, box) => ({
      minX: Math.min(acc.minX, box.minX),
      minY: Math.min(acc.minY, box.minY),
      maxX: Math.max(acc.maxX, box.maxX),
      maxY: Math.max(acc.maxY, box.maxY)
    }),
    boxes[0]
  );
}
function normalizeSkeletonMember(raw) {
  if (!raw) return null;
  const trackId = Number(raw.trackId ?? raw.personIndex ?? NaN);
  const estimatedMemberId = raw.estimatedMemberId || raw.memberId || raw.id || (Number.isFinite(trackId) ? `track_${trackId}` : null);
  if (!estimatedMemberId && !hasUsableJoints(raw.joints) && !raw.boundingBox && !raw.worldCoordinates) {
    return null;
  }
  const joints = raw.joints || {};
  const normalizedJoints = {};
  Object.entries(joints).forEach(([name, joint]) => {
    if (!joint) return;
    normalizedJoints[name] = normalizeJointPoint(joint);
  });
  const worldCoordinates = raw.worldCoordinates && typeof raw.worldCoordinates === "object" ? Object.fromEntries(
    Object.entries(raw.worldCoordinates).map(([name, pt]) => [
      name,
      {
        x: Number(pt?.x) || 0,
        y: Number(pt?.y) || 0,
        z: Number(pt?.z) || 0,
        visibility: pt?.visibility ?? pt?.confidence,
        confidence: pt?.confidence ?? pt?.visibility
      }
    ])
  ) : jointsToWorldCoordinates(normalizedJoints);
  const boundingBox = raw.boundingBox ? {
    minX: Number(raw.boundingBox.minX) || 0,
    minY: Number(raw.boundingBox.minY) || 0,
    maxX: Number(raw.boundingBox.maxX) || 0,
    maxY: Number(raw.boundingBox.maxY) || 0
  } : computeBoundingBoxFromJoints(normalizedJoints);
  const confidence = raw.confidence != null && Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : averageJointConfidence(normalizedJoints);
  return {
    ...raw,
    personIndex: Number(raw.personIndex ?? raw.trackId ?? 0),
    trackId: Number.isFinite(trackId) ? trackId : Number(raw.personIndex ?? 0),
    estimatedMemberId: estimatedMemberId ? String(estimatedMemberId) : null,
    isEstimated: Boolean(raw.isEstimated),
    joints: normalizedJoints,
    confidence,
    boundingBox,
    worldCoordinates
  };
}
function normalizeSkeletonFrames(frames) {
  if (!frames?.length) {
    logUndefinedFields("normalizeSkeletonFrames.input", { frames }, ["frames"]);
    return [];
  }
  return frames.map((frame, frameIndex) => {
    const members = (frame.members || []).map((m) => normalizeSkeletonMember(m)).filter(
      (m) => Boolean(
        m && (hasUsableJoints(m.joints) || m.estimatedMemberId || m.trackId != null || m.boundingBox || m.worldCoordinates)
      )
    );
    const memberTracks = frame.memberTracks?.length ? frame.memberTracks.map((t) => ({
      trackId: Number(t.trackId),
      memberId: t.memberId ?? null,
      confidence: Number(t.confidence) || 0,
      initialPosition: t.initialPosition
    })) : buildFrameMemberTracks(members);
    const frameConfidence = frame.confidence != null && Number.isFinite(Number(frame.confidence)) ? Number(frame.confidence) : members.length ? members.reduce((sum2, m) => sum2 + (m.confidence ?? 1), 0) / members.length : 0;
    return {
      ...frame,
      timestamp: Number(frame.timestamp) || 0,
      timestampMs: frame.timestampMs ?? Math.round((Number(frame.timestamp) || 0) * 1e3),
      frameIndex: frame.frameIndex ?? frameIndex,
      videoWidth: frame.videoWidth || 1920,
      videoHeight: frame.videoHeight || 1080,
      members,
      memberTracks,
      formation: frame.formation,
      confidence: frameConfidence,
      boundingBox: frame.boundingBox ?? mergeFrameBoundingBoxes(members),
      worldCoordinates: frame.worldCoordinates
    };
  }).filter((frame) => frame.members.length > 0);
}
function attachSessionMetadataToFrames(frames, {
  memberTracks = [],
  formationKeyframes = []
} = {}) {
  if (!frames.length) return frames;
  const trackMetaById = new Map(memberTracks.map((t) => [t.trackId, t]));
  const formationByTs = new Map(formationKeyframes.map((kf) => [kf.timestamp, kf]));
  return frames.map((frame, frameIndex) => {
    const formation = frame.formation ?? formationByTs.get(frame.timestamp) ?? findNearestFormationKeyframe(formationKeyframes, frame.timestamp);
    const memberTracksForFrame = frame.memberTracks?.length ? frame.memberTracks.map((t) => {
      const meta = trackMetaById.get(t.trackId);
      return {
        ...t,
        memberId: t.memberId ?? meta?.memberId ?? null,
        confidence: t.confidence ?? meta?.avgConfidence ?? t.confidence,
        initialPosition: t.initialPosition ?? meta?.initialPosition
      };
    }) : frame.members.map((m) => {
      const tid = Number(m.trackId ?? m.personIndex ?? 0);
      const meta = trackMetaById.get(tid);
      return {
        trackId: tid,
        memberId: m.estimatedMemberId ?? meta?.memberId ?? null,
        confidence: m.confidence ?? meta?.avgConfidence ?? 1,
        initialPosition: meta?.initialPosition
      };
    });
    return {
      ...frame,
      frameIndex: frame.frameIndex ?? frameIndex,
      formation,
      formationType: frame.formationType ?? formation?.formationType,
      memberTracks: memberTracksForFrame
    };
  });
}
function findNearestFormationKeyframe(keyframes, timestamp) {
  if (!keyframes.length) return void 0;
  return keyframes.reduce(
    (nearest, kf) => Math.abs(kf.timestamp - timestamp) < Math.abs(nearest.timestamp - timestamp) ? kf : nearest
  );
}
function resolveMemberForTrack(trackToMemberMap, trackId, excludeMemberId) {
  const id = Number(trackId);
  const memberId = trackToMemberMap.get(id) || trackToMemberMap.get(Number(String(trackId))) || null;
  if (!memberId || excludeMemberId && memberId === excludeMemberId) return null;
  return memberId;
}
var SKELETON_MIN_VALID_FRAME_RATIO = 0.8;
var SKELETON_MAX_ALLOWED_INVALID_FRAMES = 10;
var SKELETON_MIN_TIMELINE_COVERAGE = 0.85;
function countAiInPracticeFrame(frame, userMemberId) {
  return frame.members.filter(
    (m) => m.estimatedMemberId && m.estimatedMemberId !== userMemberId && hasUsableJoints(m.joints)
  ).length;
}
function isPracticeFrameValid(frame, userMemberId) {
  return countAiInPracticeFrame(frame, userMemberId) >= 1;
}
function frameTimelineTimestamp(frame) {
  const sourceVideoTime = Number(frame?.sourceVideoTime);
  if (Number.isFinite(sourceVideoTime) && sourceVideoTime >= 0) return sourceVideoTime;
  const timestamp = Number(frame?.timestamp);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : 0;
}
function calculateTimelineCoverage(frames, durationSec) {
  const list = frames ?? [];
  const firstTimestamp = list.length ? frameTimelineTimestamp(list[0]) : 0;
  const lastTimestamp = list.length ? frameTimelineTimestamp(list[list.length - 1]) : 0;
  const rawDuration = Number(durationSec);
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : Math.max(lastTimestamp, 0);
  const coverage = duration > 0 ? Math.min(1, Math.max(0, lastTimestamp) / duration) : 0;
  return {
    duration,
    frameCount: list.length,
    firstTimestamp,
    lastTimestamp,
    coverage
  };
}
function failSkeletonValidation(label, errors, partial) {
  logValidationFieldErrors(label, errors);
  return {
    valid: false,
    errors,
    ...partial
  };
}
function passSkeletonValidation(partial) {
  return {
    valid: true,
    errors: [],
    ...partial
  };
}
function validateSkeletonForPractice(frames, userMemberId, options = {}) {
  const minValidRatio = options.minValidRatio ?? SKELETON_MIN_VALID_FRAME_RATIO;
  const inputErrors = [];
  if (!userMemberId || typeof userMemberId !== "string") {
    inputErrors.push(
      buildFieldError("skeleton.userMemberId", "non-empty string", userMemberId, "\uC0AC\uC6A9\uC790 \uBA64\uBC84 ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")
    );
  }
  if (!frames?.length) {
    inputErrors.push(
      buildFieldError(
        "skeleton.frames",
        "Array(\u22651)",
        frames == null ? void 0 : frames.length,
        "\uC2A4\uCF08\uB808\uD1A4 \uD504\uB808\uC784 \uBC30\uC5F4\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4."
      )
    );
  }
  if (inputErrors.length) {
    return failSkeletonValidation("validateSkeletonForPractice", inputErrors, {
      frameCount: frames?.length ?? 0,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: 0,
      reason: inputErrors.map((e) => e.message || e.missingField).join("; "),
      report: {
        totalFrames: 0,
        validFrames: 0,
        invalidFrames: 0,
        memberAverage: 0,
        timelineCoverage: 0,
        validFrameRatio: 0
      }
    });
  }
  const normalized = options.skipNormalize ? frames ?? [] : normalizeSkeletonFrames(frames);
  const emptyReport = {
    totalFrames: 0,
    validFrames: 0,
    invalidFrames: 0,
    memberAverage: 0,
    timelineCoverage: 0,
    validFrameRatio: 0
  };
  if (!normalized.length) {
    const errors = [
      buildFieldError(
        "skeleton.frames",
        "Array(\u22651) after normalize",
        normalized.length,
        "\uC815\uADDC\uD654 \uD6C4 \uC720\uD6A8 \uD504\uB808\uC784\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
      )
    ];
    return failSkeletonValidation("validateSkeletonForPractice", errors, {
      frameCount: 0,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: 0,
      reason: "\uC2A4\uCF08\uB808\uD1A4 \uD504\uB808\uC784\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.",
      report: emptyReport
    });
  }
  const aiIds = /* @__PURE__ */ new Set();
  let validFrames = 0;
  let invalidFrames = 0;
  let aiMemberSum = 0;
  normalized.forEach((frame) => {
    const aiInFrame = countAiInPracticeFrame(frame, userMemberId);
    aiMemberSum += aiInFrame;
    frame.members.forEach((m) => {
      if (m.estimatedMemberId && m.estimatedMemberId !== userMemberId && hasUsableJoints(m.joints)) {
        aiIds.add(m.estimatedMemberId);
      }
    });
    if (isPracticeFrameValid(frame, userMemberId)) {
      validFrames += 1;
    } else {
      invalidFrames += 1;
    }
  });
  const totalFrames = normalized.length;
  const validFrameRatio = totalFrames > 0 ? validFrames / totalFrames : 0;
  const memberAverage = totalFrames > 0 ? aiMemberSum / totalFrames : 0;
  const timelineCoverageReport = calculateTimelineCoverage(normalized, options.expectedDurationSec);
  const timelineCoverage = timelineCoverageReport.coverage;
  const minTimelineCoverage = options.minTimelineCoverage ?? SKELETON_MIN_TIMELINE_COVERAGE;
  const report = {
    totalFrames,
    validFrames,
    invalidFrames,
    memberAverage,
    timelineCoverage,
    validFrameRatio
  };
  const ratioOk = validFrameRatio >= minValidRatio;
  if (import.meta.env?.DEV || options.logTable) {
    console.debug("[validateSkeletonForPractice] report", report, {
      aiMemberIds: [...aiIds],
      maxAllowedInvalid: SKELETON_MAX_ALLOWED_INVALID_FRAMES
    });
  }
  if (options.logTable) {
    logPracticeValidationTable(
      {
        frameCount: totalFrames,
        timelineLength: options.expectedDurationSec ?? normalized[normalized.length - 1]?.timestamp ?? 0,
        memberCount: Math.round(memberAverage * 10) / 10,
        snapshot: "n/a (skeleton pass)",
        video: options.expectedDurationSec ?? "unknown",
        motion: `aiIds=${aiIds.size}`,
        formation: "n/a",
        metadata: `valid=${validFrames}/${totalFrames}`,
        confidence: String(Math.round(validFrameRatio * 1e3) / 1e3)
      },
      {
        stage: "validateSkeletonForPractice",
        valid: ratioOk && aiIds.size > 0
      }
    );
  }
  if (aiIds.size === 0) {
    const errors = [
      buildFieldError(
        "skeleton.aiMemberIds",
        "Set(\u22651)",
        0,
        "\uC804\uCCB4 \uC601\uC0C1\uC5D0\uC11C AI \uBA64\uBC84 \uC2A4\uCF08\uB808\uD1A4\uC774 \uD55C \uBC88\uB3C4 \uAC10\uC9C0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."
      )
    ];
    return failSkeletonValidation("validateSkeletonForPractice", errors, {
      frameCount: totalFrames,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: Math.round(memberAverage * 10) / 10,
      reason: errors[0].message,
      report
    });
  }
  const expectedAiMemberCount = Number(options.expectedAiMemberCount);
  if (Number.isFinite(expectedAiMemberCount) && expectedAiMemberCount > 0 && aiIds.size < expectedAiMemberCount) {
    const errors = [
      buildFieldError(
        "skeleton.aiMemberIds",
        `Set(\u2265${expectedAiMemberCount})`,
        aiIds.size,
        `AI \uBA64\uBC84 \uC2A4\uCF08\uB808\uD1A4 \uC218 \uBD80\uC871 (${aiIds.size}/${expectedAiMemberCount}). \uC804\uCCB4 \uBA64\uBC84\uAC00 \uBCF4\uC774\uB294 \uC601\uC0C1\uC73C\uB85C \uB2E4\uC2DC \uCD94\uCD9C\uD574 \uC8FC\uC138\uC694.`
      )
    ];
    return failSkeletonValidation("validateSkeletonForPractice", errors, {
      frameCount: totalFrames,
      aiMemberIds: [...aiIds],
      aiMemberCount: aiIds.size,
      sampleMemberCount: Math.round(memberAverage * 10) / 10,
      reason: errors[0].message,
      report
    });
  }
  if (timelineCoverage < minTimelineCoverage) {
    const pct = Math.round(timelineCoverage * 100);
    const needPct = Math.round(minTimelineCoverage * 100);
    const lastTs = timelineCoverageReport.lastTimestamp;
    const errors = [
      buildFieldError(
        "skeleton.timelineCoverage",
        `\u2265 ${minTimelineCoverage} (${needPct}%)`,
        timelineCoverage,
        `\uC2A4\uCF08\uB808\uD1A4 \uD0C0\uC784\uB77C\uC778 \uCEE4\uBC84\uB9AC\uC9C0 \uBD80\uC871 (${pct}% < ${needPct}%). \uB9C8\uC9C0\uB9C9 timestamp ${lastTs.toFixed(1)}s \u2014 \uC548\uBB34 \uC7AC\uCD94\uCD9C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.`
      )
    ];
    return failSkeletonValidation("validateSkeletonForPractice", errors, {
      frameCount: totalFrames,
      aiMemberIds: [...aiIds],
      aiMemberCount: aiIds.size,
      sampleMemberCount: Math.round(memberAverage * 10) / 10,
      reason: errors[0].message,
      report
    });
  }
  if (!ratioOk) {
    const pct = Math.round(validFrameRatio * 100);
    const needPct = Math.round(minValidRatio * 100);
    const errors = [
      buildFieldError(
        "skeleton.validFrameRatio",
        `\u2265 ${minValidRatio} (${needPct}%)`,
        validFrameRatio,
        `\uC720\uD6A8 \uD504\uB808\uC784 \uBE44\uC728 \uBD80\uC871 (${pct}% < ${needPct}%). ${validFrames}/${totalFrames}\uD504\uB808\uC784.`
      ),
      buildFieldError(
        "skeleton.validFrames",
        `\u2265 ${Math.ceil(totalFrames * minValidRatio)}`,
        validFrames,
        `\uC778\uC2DD \uC2E4\uD328 ${invalidFrames}\uD504\uB808\uC784`
      )
    ];
    return failSkeletonValidation("validateSkeletonForPractice", errors, {
      frameCount: totalFrames,
      aiMemberIds: [...aiIds],
      aiMemberCount: aiIds.size,
      sampleMemberCount: Math.round(memberAverage * 10) / 10,
      reason: errors[0].message,
      report
    });
  }
  return passSkeletonValidation({
    frameCount: totalFrames,
    aiMemberIds: [...aiIds],
    aiMemberCount: aiIds.size,
    sampleMemberCount: Math.round(memberAverage * 10) / 10,
    report
  });
}

// src/services/dance/FormationTimelineEngine.ts
var HIP_KEYS2 = ["left_hip", "right_hip"];
function memberHipCenter(member) {
  const joints = member.joints || {};
  const hips = HIP_KEYS2.map((k) => joints[k]).filter(Boolean);
  if (hips.length) {
    const sum2 = hips.reduce(
      (acc, j) => ({ x: acc.x + j.x, y: acc.y + j.y, z: acc.z + (j.z ?? 0) }),
      { x: 0, y: 0, z: 0 }
    );
    return { x: sum2.x / hips.length, y: sum2.y / hips.length, z: sum2.z / hips.length };
  }
  const nose = joints.nose;
  return nose ? { x: nose.x, y: nose.y, z: nose.z ?? 0 } : null;
}
function shoulderRotation(member) {
  const ls = member.joints?.left_shoulder;
  const rs = member.joints?.right_shoulder;
  if (!ls || !rs) return 0;
  return Math.atan2(rs.y - ls.y, rs.x - ls.x);
}
function variance(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}
function classifyFormationType(positions) {
  const n = positions.length;
  if (n < 2) return "scatter";
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const cx = xs.reduce((a, b) => a + b, 0) / n;
  const cy = ys.reduce((a, b) => a + b, 0) / n;
  const distances = positions.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const distVar = variance(distances);
  const avgDist = distances.reduce((a, b) => a + b, 0) / n;
  if (xSpread > 0.22 && ySpread < 0.1) return "line";
  if (ySpread > 0.22 && xSpread < 0.1) return "line";
  if (n >= 4 && avgDist > 0.08 && distVar < 4e-3) return "circle";
  if (n === 3 && avgDist > 0.06) return "triangle";
  if (n === 4) {
    const front = ys.filter((y) => y < cy - 0.04).length;
    const back = ys.filter((y) => y > cy + 0.04).length;
    const sides = xs.filter((x) => Math.abs(x - cx) > 0.08).length;
    if (front >= 1 && back >= 1 && sides >= 2) return "diamond";
  }
  if (n >= 4) {
    const top = ys.filter((y) => y < cy - 0.08).length;
    const bottom = ys.filter((y) => y > cy + 0.04).length;
    if (top >= 1 && bottom >= 2) return "v_shape";
  }
  return "unknown";
}
function buildSlotsFromFrame(frame, map, userMemberId, groupId) {
  const group = GROUP_DATA[groupId];
  const slots = [];
  const assigned = /* @__PURE__ */ new Set();
  (frame.members || []).forEach((member) => {
    const memberId = member.estimatedMemberId || resolveMemberForTrack(map, Number(member.trackId), userMemberId);
    if (!memberId || memberId === userMemberId) return;
    const center = memberHipCenter(member);
    if (!center) return;
    assigned.add(memberId);
    slots.push({
      memberId,
      trackId: Number(member.trackId ?? 0),
      x: center.x,
      y: center.y,
      z: center.z,
      isUserSlot: false,
      isEmpty: false
    });
  });
  const userMember = group?.members.find((m) => m.id === userMemberId);
  if (userMember) {
    slots.push({
      memberId: userMemberId,
      trackId: null,
      x: userMember.defaultX,
      y: userMember.defaultY,
      z: 0,
      isUserSlot: true,
      isEmpty: true
    });
  }
  return slots;
}
function computeGroupRotation(members) {
  const rots = members.map(shoulderRotation).filter((r) => Number.isFinite(r));
  if (!rots.length) return 0;
  return rots.reduce((a, b) => a + b, 0) / rots.length;
}
function computeSpacing(positions) {
  if (positions.length < 2) return 0.5;
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.min(1, Math.max(0.15, spread * 1.4));
}
function sampleFrames(frames, intervalSec) {
  if (!frames.length) return [];
  const out = [];
  let nextT = frames[0].timestamp;
  frames.forEach((frame) => {
    if (frame.timestamp >= nextT - 1e-4) {
      out.push(frame);
      nextT = frame.timestamp + intervalSec;
    }
  });
  if (out[out.length - 1] !== frames[frames.length - 1]) {
    out.push(frames[frames.length - 1]);
  }
  return out;
}
function analyzeFormationTimeline({
  groupId,
  songId,
  userMemberId,
  frames,
  trackToMember = /* @__PURE__ */ new Map(),
  minSegmentSec = 4
}) {
  const group = GROUP_DATA[groupId];
  const map = normalizeTrackMemberMap(trackToMember);
  const defaultFormation = group?.defaultFormation || "diamond";
  if (!frames?.length) {
    return {
      groupId,
      songId,
      userMemberId,
      defaultFormation,
      segments: [],
      keyframes: []
    };
  }
  const sampled = sampleFrames(frames, Math.max(0.5, minSegmentSec / 3));
  const snapshots = [];
  sampled.forEach((frame) => {
    const aiMembers = (frame.members || []).filter(
      (m) => m.estimatedMemberId && m.estimatedMemberId !== userMemberId
    );
    const positions = aiMembers.map(memberHipCenter).filter(Boolean);
    if (!positions.length) return;
    const slots = buildSlotsFromFrame(frame, map, userMemberId, groupId);
    snapshots.push({
      timestamp: frame.timestamp,
      formationType: classifyFormationType(positions),
      rotation: computeGroupRotation(aiMembers),
      spacing: computeSpacing(positions),
      slots,
      positions
    });
  });
  if (!snapshots.length) {
    return {
      groupId,
      songId,
      userMemberId,
      defaultFormation,
      segments: [],
      keyframes: []
    };
  }
  const segments = [];
  let segStart = snapshots[0];
  let prev = snapshots[0];
  for (let i = 1; i < snapshots.length; i += 1) {
    const cur = snapshots[i];
    const typeChanged = cur.formationType !== prev.formationType;
    const spacingChanged = Math.abs(cur.spacing - prev.spacing) > 0.12;
    const timeGap = cur.timestamp - segStart.timestamp;
    if ((typeChanged || spacingChanged) && timeGap >= minSegmentSec * 0.5) {
      segments.push({
        startTime: segStart.timestamp,
        endTime: prev.timestamp,
        formationType: segStart.formationType,
        rotation: segStart.rotation,
        spacing: segStart.spacing,
        transition: typeChanged ? "morph" : "step",
        slots: segStart.slots
      });
      segStart = cur;
    }
    prev = cur;
  }
  segments.push({
    startTime: segStart.timestamp,
    endTime: snapshots[snapshots.length - 1].timestamp,
    formationType: segStart.formationType,
    rotation: segStart.rotation,
    spacing: segStart.spacing,
    transition: "cut",
    slots: segStart.slots
  });
  const keyframes = snapshots.map((snap, i) => {
    const prevSnap = snapshots[i - 1];
    let transition = "cut";
    if (prevSnap) {
      transition = snap.formationType !== prevSnap.formationType ? "morph" : "step";
    }
    return {
      timestamp: snap.timestamp,
      formationType: snap.formationType,
      rotation: snap.rotation,
      spacing: snap.spacing,
      transition,
      slots: snap.slots
    };
  });
  if (import.meta.env?.DEV) {
    console.debug(
      "[FormationTimelineEngine]",
      segments.map((s) => `${s.startTime.toFixed(1)}s ${s.formationType}`).join(" \u2192 ")
    );
  }
  return {
    groupId,
    songId,
    userMemberId,
    defaultFormation,
    segments,
    keyframes
  };
}
function resolveFormationAtTime(timeline, timestamp) {
  const kfs = timeline.keyframes || [];
  if (!kfs.length) return null;
  let active = kfs[0];
  for (let i = 0; i < kfs.length; i += 1) {
    if (kfs[i].timestamp <= timestamp) active = kfs[i];
    else break;
  }
  return active;
}

// src/services/motion/MemberIdentificationEngine.ts
function identifyMembersFromTracks(frames, trackToMember, allMemberIds, userMemberId) {
  const map = normalizeTrackMemberMap(trackToMember);
  const aiIds = allMemberIds.filter((id) => id && id !== userMemberId);
  const appearanceCount = /* @__PURE__ */ new Map();
  const trackConfidence = /* @__PURE__ */ new Map();
  const trackPositions = /* @__PURE__ */ new Map();
  frames.forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const tid = Number(member.trackId ?? member.personIndex ?? -1);
      const mid = member.estimatedMemberId || map.get(tid);
      if (!mid || mid === userMemberId) return;
      appearanceCount.set(mid, (appearanceCount.get(mid) ?? 0) + 1);
      const conf = member.confidence ?? 0.5;
      const cur = trackConfidence.get(tid) || { sum: 0, count: 0 };
      trackConfidence.set(tid, { sum: cur.sum + conf, count: cur.count + 1 });
      const nose = member.joints?.nose;
      if (nose && tid >= 0) {
        const pos = trackPositions.get(tid) || { x: 0, y: 0, count: 0 };
        trackPositions.set(tid, {
          x: pos.x + nose.x,
          y: pos.y + nose.y,
          count: pos.count + 1
        });
      }
    });
  });
  const trackToMemberOut = {};
  const memberToTrackOut = {};
  const ambiguousTracks = [];
  map.forEach((memberId, trackId) => {
    if (memberId === userMemberId) return;
    trackToMemberOut[trackId] = memberId;
    if (memberToTrackOut[memberId] != null && memberToTrackOut[memberId] !== trackId) {
      ambiguousTracks.push(trackId);
    }
    memberToTrackOut[memberId] = trackId;
  });
  const memberTracks = [...trackPositions.entries()].map(([trackId, pos]) => {
    const stats = trackConfidence.get(trackId);
    return {
      trackId,
      memberId: trackToMemberOut[trackId] ?? map.get(trackId) ?? null,
      initialPosition: { x: pos.x / pos.count, y: pos.y / pos.count },
      avgConfidence: stats ? stats.sum / stats.count : 0
    };
  });
  const totalFrames = Math.max(1, frames.length);
  const coverageByMember = {};
  aiIds.forEach((id) => {
    coverageByMember[id] = (appearanceCount.get(id) ?? 0) / totalFrames;
  });
  return {
    trackToMember: trackToMemberOut,
    memberToTrack: memberToTrackOut,
    memberTracks,
    identifiedCount: Object.keys(memberToTrackOut).length,
    coverageByMember,
    ambiguousTracks
  };
}

// src/utils/practiceTimelineUtils.ts
function computePracticeTimeline(videoDurationSec, fps) {
  const duration = Number(videoDurationSec);
  const sampleFps = Number(fps);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!Number.isFinite(sampleFps) || sampleFps <= 0) return null;
  const totalFrames = Math.max(1, Math.round(duration * sampleFps));
  return { duration, fps: sampleFps, totalFrames };
}
function normalizeFrameTimestampsToFpsGrid(frames, fps) {
  const rate = Number(fps);
  if (!frames?.length || !Number.isFinite(rate) || rate <= 0) return frames ?? [];
  return frames.map((frame, frameIndex) => ({
    ...frame,
    frameIndex,
    timestamp: frameIndex / rate,
    timestampMs: Math.round(frameIndex / rate * 1e3)
  }));
}

// src/data/groupStudioSongs.ts
function tags(groupId, title, extra = []) {
  const group = GROUP_DATA[groupId];
  const memberTags = (group?.members || []).flatMap((m) => [m.name, m.nameKr, m.id]);
  return [
    title,
    title.toLowerCase(),
    group?.name,
    group?.nameKr,
    groupId,
    ...memberTags,
    ...extra
  ].filter(Boolean);
}
function song(id, title, groupId, bpm, difficulty, duration, albumColor, albumColor2, albumCover, baseTrending, extraTags = [], youtubeUrl = "") {
  const group = GROUP_DATA[groupId];
  return {
    id,
    title,
    groupId,
    bpm,
    difficulty,
    duration,
    albumColor,
    albumColor2,
    albumCover: `/album-covers/${id}.jpg`,
    coverFallbacks: [albumCover].filter(Boolean),
    baseTrending,
    searchTags: tags(groupId, title, extraTags),
    youtubeQuery: `${group?.name || groupId} ${group?.nameKr || ""} ${title} \uC548\uBB34 \uC5F0\uC2B5 dance practice`,
    youtubeUrl
  };
}
var STUDIO_SONGS = [
  song("love-dive", "LOVE DIVE", "ive", 118, 3, 174, "#6C5CE7", "#FF6B9D", "https://upload.wikimedia.org/wikipedia/en/4/4f/Ive_-_Love_Dive.png", 98, ["love dive", "\uB7EC\uBE0C\uB2E4\uC774\uBE0C"]),
  song("after-like", "After LIKE", "ive", 125, 3, 178, "#FF6348", "#FFD700", "https://upload.wikimedia.org/wikipedia/en/9/9e/Ive_-_After_Like.png", 85, ["after like", "\uC560\uD504\uD130\uB77C\uC774\uD06C"]),
  song("i-am", "I AM", "ive", 122, 4, 184, "#E91E63", "#9C27B0", "https://upload.wikimedia.org/wikipedia/en/1/1f/Ive_-_I%27ve_Ive.png", 80, ["i am", "\uC544\uC774\uC5E0"]),
  song("supernova", "Supernova", "aespa", 120, 4, 196, "#00BCD4", "#E91E63", "https://upload.wikimedia.org/wikipedia/en/8/8a/Aespa_-_Supernova.png", 95, ["\uC288\uD37C\uB178\uBC14"]),
  song("how-you-like-that", "How You Like That", "blackpink", 130, 4, 181, "#FF1F8E", "#FFD700", "https://upload.wikimedia.org/wikipedia/en/0/0c/Blackpink_How_You_Like_That.png", 92, ["how you like that", "\uD558\uC6B0\uC720\uB77C\uC774\uD06C\uB313"]),
  song("pink-venom", "Pink Venom", "blackpink", 128, 4, 187, "#FF6B9D", "#6C5CE7", "https://upload.wikimedia.org/wikipedia/en/f/f5/Blackpink_-_Pink_Venom.png", 88, ["pink venom", "\uD551\uD06C\uBCA0\uB188"]),
  song("shut-down", "Shut Down", "blackpink", 132, 5, 176, "#1a1a2e", "#FF1F8E", "https://upload.wikimedia.org/wikipedia/en/8/8e/Blackpink_-_Born_Pink.png", 82, ["shut down", "\uC167\uB2E4\uC6B4"]),
  song("magnetic", "Magnetic", "newjeans", 110, 2, 168, "#FF1F8E", "#A78BFA", "https://upload.wikimedia.org/wikipedia/en/5/5f/NewJeans_-_Get_Up.png", 90, ["magnetic", "\uB9C8\uADF8\uB124\uD2F1"]),
  song("whiplash", "Whiplash", "aespa", 126, 4, 183, "#9C27B0", "#00BCD4", "https://upload.wikimedia.org/wikipedia/en/2/2d/Aespa_-_Armageddon.png", 87, ["whip lash", "\uC704\uD50C\uB798\uC2DC"]),
  song("fancy", "FANCY", "twice", 120, 3, 214, "#FF6348", "#FF1F8E", "https://upload.wikimedia.org/wikipedia/en/4/4f/Twice_-_Fancy_You.png", 75, []),
  song("dynamite", "Dynamite", "bts", 114, 2, 199, "#FFD700", "#FF6348", "https://upload.wikimedia.org/wikipedia/en/4/4b/BTS_-_Dynamite.png", 78, ["\uB2E4\uC774\uB098\uB9C8\uC774\uD2B8"]),
  song("wannabe", "WANNABE", "itzy", 128, 4, 194, "#FF1F8E", "#FF6348", "https://upload.wikimedia.org/wikipedia/en/8/8e/Itzy_-_It%27z_Me.png", 72, ["wannabe", "\uC6CC\uB108\uBE44"]),
  song("what-you-want", "What You Want", "cortis", 118, 3, 192, "#1DB971", "#60A5FA", "", 94, ["what you want", "\uC653 \uC720 \uC6D0"]),
  song("go-cortis", "GO!", "cortis", 125, 4, 186, "#F87171", "#34D399", "", 96, ["go", "\uACE0"]),
  song("redred", "REDRED", "cortis", 122, 3, 178, "#F87171", "#FFD700", "", 93, ["red red", "\uB808\uB4DC\uB808\uB4DC", "redred"]),
  song("fashion-cortis", "FaSHioN", "cortis", 120, 3, 181, "#A78BFA", "#FCD34D", "", 88, ["fashion", "\uD328\uC158"])
];
var SONG_MAP = Object.fromEntries(STUDIO_SONGS.map((s) => [s.id, s]));

// src/utils/frameMetadataUtils.ts
function timeSecToBeat(timeSec, bpm) {
  const rate = Number(bpm);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Number(timeSec) * rate / 60;
}
function timeSecToBeatIndex(timeSec, bpm) {
  return Math.floor(timeSecToBeat(timeSec, bpm));
}
function averageMemberConfidence(members) {
  if (!members?.length) return 0;
  const scores = members.map((m) => m.confidence ?? 0).filter((v) => v > 0);
  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
function evaluateFramePoseQuality(frame) {
  const members = frame.members || [];
  if (!members.length) return 0;
  let jointScore = 0;
  let jointCount = 0;
  members.forEach((m) => {
    if (m.isEstimated) return;
    Object.values(m.joints || {}).forEach((j) => {
      const c = j.confidence ?? j.visibility ?? 0;
      if (c > 0) {
        jointScore += c;
        jointCount += 1;
      }
    });
  });
  const jointAvg = jointCount ? jointScore / jointCount : 0;
  const memberAvg = averageMemberConfidence(members);
  const estimatedPenalty = members.filter((m) => m.isEstimated).length / members.length;
  return Math.max(0, Math.min(1, jointAvg * 0.55 + memberAvg * 0.35 + (1 - estimatedPenalty) * 0.1));
}
function enrichSkeletonFrameMetadata(frames, {
  bpm,
  fps,
  sourceVideoDurationSec,
  memberTracks = [],
  formationKeyframes = []
}) {
  if (!frames?.length) return frames;
  const rate = Number(bpm) > 0 ? Number(bpm) : 120;
  const sortedFormation = [...formationKeyframes || []].sort((a, b) => a.timestamp - b.timestamp);
  const resolveFormation = (t) => {
    if (!sortedFormation.length) return void 0;
    let active = sortedFormation[0];
    for (let i = 0; i < sortedFormation.length; i += 1) {
      if (sortedFormation[i].timestamp <= t) active = sortedFormation[i];
      else break;
    }
    return active;
  };
  return frames.map((frame, frameIndex) => {
    const sourceVideoTime = frame.sourceVideoTime ?? frame.timestamp;
    const beat = timeSecToBeat(sourceVideoTime, rate);
    const beatIndex = timeSecToBeatIndex(sourceVideoTime, rate);
    const poseQuality = frame.poseQuality ?? evaluateFramePoseQuality(frame);
    const confidence = frame.confidence ?? averageMemberConfidence(frame.members || []);
    const frameMemberTracks = frame.memberTracks?.length ? frame.memberTracks : (frame.members || []).map((m) => ({
      trackId: Number(m.trackId ?? m.personIndex ?? 0),
      memberId: m.estimatedMemberId,
      confidence: m.confidence ?? poseQuality
    }));
    return {
      ...frame,
      timestamp: frame.timestamp,
      timestampMs: frame.timestampMs ?? Math.round(frame.timestamp * 1e3),
      frameIndex: frame.frameIndex ?? frameIndex,
      sourceVideoTime,
      bpm: rate,
      beat,
      beatIndex,
      formation: frame.formation ?? resolveFormation(sourceVideoTime),
      formationType: frame.formationType ?? resolveFormation(sourceVideoTime)?.formationType ?? void 0,
      memberTracks: frameMemberTracks,
      confidence,
      poseQuality,
      videoWidth: frame.videoWidth,
      videoHeight: frame.videoHeight,
      members: frame.members,
      boundingBox: frame.boundingBox,
      worldCoordinates: frame.worldCoordinates
    };
  });
}

// src/services/practice/PracticePlayer.ts
function resolveSkeletonLastTimestamp(frames) {
  if (!frames?.length) return 0;
  const last = frames[frames.length - 1]?.timestamp;
  return Number.isFinite(last) && last > 0 ? last : 0;
}
function resolvePracticeVideoDuration(frames, sourceVideoDurationSec) {
  const videoDur = Number(sourceVideoDurationSec);
  const lastTs = resolveSkeletonLastTimestamp(frames);
  if (Number.isFinite(videoDur) && videoDur > 0) {
    return videoDur;
  }
  return lastTs;
}

// src/utils/buildPracticeSessionData.ts
function resolvePracticeDurationSec(sourceVideoDurationSec, frames) {
  const duration = resolvePracticeVideoDuration(frames ?? [], sourceVideoDurationSec);
  return duration > 0 ? duration : null;
}

// src/services/skeleton/FrameInterpolationEngine.ts
function interpolateMember(prev, next, ratio) {
  const joints = interpolateJointsHybrid(prev.joints || {}, next.joints || {}, ratio);
  const worldCoordinates = {};
  const worldNames = /* @__PURE__ */ new Set([
    ...Object.keys(prev.worldCoordinates || {}),
    ...Object.keys(next.worldCoordinates || {})
  ]);
  worldNames.forEach((name) => {
    const wa = prev.worldCoordinates?.[name];
    const wb = next.worldCoordinates?.[name];
    if (wa && wb) {
      worldCoordinates[name] = interpolateJointsHybrid(
        { [name]: wa },
        { [name]: wb },
        ratio
      )[name];
    } else if (wb) {
      worldCoordinates[name] = { ...wb };
    } else if (wa) {
      worldCoordinates[name] = { ...wa };
    }
  });
  const confidence = ((prev.confidence ?? 1) * (1 - ratio) + (next.confidence ?? 1) * ratio) * 0.85;
  const trackId = prev.trackId ?? next.trackId;
  return {
    ...prev,
    estimatedMemberId: prev.estimatedMemberId ?? next.estimatedMemberId,
    trackId,
    personIndex: trackId,
    joints,
    worldCoordinates: Object.keys(worldCoordinates).length ? worldCoordinates : prev.worldCoordinates,
    boundingBox: computeBoundingBoxFromJoints(joints) ?? prev.boundingBox,
    confidence,
    isEstimated: true
  };
}
function memberLookupKey(member) {
  return String(member.estimatedMemberId ?? member.trackId ?? "");
}
function findMember(frames, index, key) {
  const frame = frames[index];
  if (!frame || !key) return null;
  return frame.members.find((m) => memberLookupKey(m) === key) ?? frame.members.find((m) => String(m.trackId) === key) ?? null;
}
function findNeighborWithMember(frames, fromIndex, key, direction) {
  let i = fromIndex + direction;
  while (i >= 0 && i < frames.length) {
    const member = findMember(frames, i, key);
    if (member && !member.isEstimated) return { index: i, member };
    if (member?.isEstimated) {
      const score = member.confidence ?? 0;
      if (score > 0.4) return { index: i, member };
    }
    i += direction;
  }
  return null;
}
function interpolateSkeletonFrameGaps(frames, memberIds) {
  if (!frames.length || !memberIds.length) return frames;
  const result = frames.map((frame) => ({
    ...frame,
    members: frame.members.map((m) => ({
      ...m,
      joints: { ...m.joints },
      worldCoordinates: m.worldCoordinates ? { ...m.worldCoordinates } : void 0
    }))
  }));
  const trackKeys = /* @__PURE__ */ new Set();
  result.forEach((frame) => {
    frame.members.forEach((m) => {
      const key = memberLookupKey(m);
      if (key) trackKeys.add(key);
    });
  });
  memberIds.forEach((id) => trackKeys.add(id));
  result.forEach((frame, frameIndex) => {
    const byKey = new Map(frame.members.map((m) => [memberLookupKey(m), m]));
    const additions = [];
    trackKeys.forEach((key) => {
      if (!key || byKey.has(key)) return;
      const prev = findNeighborWithMember(result, frameIndex, key, -1);
      const next = findNeighborWithMember(result, frameIndex, key, 1);
      if (prev && next) {
        const t0 = result[prev.index].timestamp;
        const t1 = result[next.index].timestamp;
        const t = frame.timestamp;
        const ratio = t1 > t0 ? (t - t0) / (t1 - t0) : 0.5;
        additions.push(
          interpolateMember(prev.member, next.member, Math.min(1, Math.max(0, ratio)))
        );
        return;
      }
      if (prev) {
        additions.push(cloneEstimatedMember(prev.member, "forward"));
        return;
      }
      if (next) {
        additions.push(cloneEstimatedMember(next.member, "backward"));
      }
    });
    if (additions.length) {
      frame.members = [...frame.members, ...additions];
      frame.memberTracks = frame.members.map((m) => ({
        trackId: Number(m.trackId ?? 0),
        memberId: m.estimatedMemberId,
        confidence: (m.confidence ?? 1) * (m.isEstimated ? 0.7 : 1)
      }));
    }
  });
  if (import.meta.env?.DEV) {
    const filled = result.reduce((sum2, f, i) => {
      const before = frames[i]?.members?.length ?? 0;
      return sum2 + Math.max(0, f.members.length - before);
    }, 0);
    if (filled > 0) {
      console.debug("[FrameInterpolationEngine] interpolated members:", filled);
    }
  }
  return result;
}
function cloneEstimatedMember(source, mode) {
  const trackId = source.trackId;
  return {
    ...source,
    trackId,
    personIndex: trackId,
    joints: { ...source.joints },
    worldCoordinates: source.worldCoordinates ? { ...source.worldCoordinates } : void 0,
    boundingBox: source.boundingBox ? { ...source.boundingBox } : void 0,
    isEstimated: true,
    confidence: (source.confidence ?? 1) * (mode === "forward" ? 0.75 : 0.65)
  };
}

// src/utils/mainThreadYield.ts
function yieldToMainThread() {
  return new Promise((resolve) => {
    const ric = globalThis.requestIdleCallback;
    if (typeof ric === "function") {
      ric(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
async function yieldEvery(index, chunkSize = 200) {
  if (index > 0 && index % chunkSize === 0) {
    await yieldToMainThread();
  }
}

// src/services/skeleton/SkeletonMemberTracker.ts
function cloneMember(member, overrides = {}) {
  return {
    ...member,
    ...overrides,
    joints: { ...member.joints },
    worldCoordinates: member.worldCoordinates ? { ...member.worldCoordinates } : void 0,
    boundingBox: member.boundingBox ? { ...member.boundingBox } : void 0
  };
}
function resolveMemberIdFromTrack(trackId, trackToMember) {
  if (!trackToMember) return null;
  if (trackToMember instanceof Map) return trackToMember.get(trackId) || null;
  return trackToMember[trackId] ?? trackToMember[String(trackId)] ?? null;
}
function buildMemberTracksForFrame(members) {
  return members.map((m) => ({
    trackId: Number(m.trackId ?? 0),
    memberId: m.estimatedMemberId,
    confidence: computeMemberPoseConfidence(m),
    initialPosition: m.boundingBox ? {
      x: (m.boundingBox.minX + m.boundingBox.maxX) / 2,
      y: (m.boundingBox.minY + m.boundingBox.maxY) / 2
    } : void 0
  }));
}
async function stabilizeSkeletonMemberTracks(frames, options = {}) {
  if (!frames.length) return frames;
  const bpm = options.bpm ?? 120;
  const sampleFps = options.sampleFps ?? 30;
  const maxOcclusionFrames = options.maxOcclusionFrames ?? Math.ceil(sampleFps * 2);
  const trackPool = new TrackPool(options.maxTracks ?? 9);
  const predictorByTrackId = /* @__PURE__ */ new Map();
  const occlusionByTrackId = /* @__PURE__ */ new Map();
  const getPredictor = (trackId) => {
    let p = predictorByTrackId.get(trackId);
    if (!p) {
      p = new TrackMotionPredictor();
      predictorByTrackId.set(trackId, p);
    }
    return p;
  };
  const releaseTrack = (trackId) => {
    predictorByTrackId.get(trackId)?.reset();
    predictorByTrackId.delete(trackId);
    occlusionByTrackId.delete(trackId);
    trackPool.release(trackId);
  };
  const stabilized = [];
  let prevMembers = [];
  let prevTimestamp = 0;
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    await yieldEvery(frameIndex, 150);
    const frame = frames[frameIndex];
    const currMembers = frame.members || [];
    const timestamp = frame.timestamp ?? frameIndex / sampleFps;
    const dtSec = prevTimestamp > 0 ? Math.max(1e-3, timestamp - prevTimestamp) : 1 / sampleFps;
    if (!prevMembers.length) {
      const seeded = currMembers.map((m) => {
        const trackId = trackPool.acquire(Number(m.trackId)) ?? trackPool.acquire() ?? 0;
        const estimatedMemberId = resolveMemberIdFromTrack(trackId, options.trackToMember) ?? m.estimatedMemberId;
        const member = cloneMember(m, {
          trackId,
          personIndex: trackId,
          estimatedMemberId,
          confidence: computeMemberPoseConfidence(m)
        });
        if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
        occlusionByTrackId.set(trackId, 0);
        return member;
      });
      prevMembers = seeded;
      prevTimestamp = timestamp;
      stabilized.push({
        ...frame,
        frameIndex: frame.frameIndex ?? frameIndex,
        members: seeded,
        memberTracks: buildMemberTracksForFrame(seeded)
      });
      continue;
    }
    let motionVelocity = 0;
    prevMembers.forEach((prev) => {
      const tid = Number(prev.trackId ?? 0);
      motionVelocity = Math.max(motionVelocity, getPredictor(tid).averageVelocity());
    });
    currMembers.forEach((curr, i) => {
      const prev = prevMembers[i];
      if (prev?.joints && curr?.joints) {
        motionVelocity = Math.max(motionVelocity, computeJointMotionVelocity(prev.joints, curr.joints, dtSec));
      }
    });
    const avgConfidence = currMembers.reduce((s, m) => s + computeMemberPoseConfidence(m), 0) / Math.max(1, currMembers.length);
    const baseThreshold = options.maxMatchCost ?? computeAdaptiveMatchThreshold({
      motionVelocity,
      poseConfidence: avgConfidence,
      bpm,
      sampleFps
    });
    const nPrev = prevMembers.length;
    const nCurr = currMembers.length;
    const costMatrix = Array.from({ length: nPrev }, (_, i) => {
      const prev = prevMembers[i];
      const trackId = Number(prev.trackId);
      const occlusionFrames = occlusionByTrackId.get(trackId) ?? (prev.isEstimated ? 1 : 0);
      const refJoints = occlusionFrames > 0 ? getPredictor(trackId).predict(timestamp) : prev.joints;
      const boost = occlusionFrames > 0 ? computeAdaptiveMatchThreshold({
        motionVelocity,
        poseConfidence: avgConfidence,
        bpm,
        sampleFps,
        occlusionFrames
      }) - baseThreshold : 0;
      return Array.from({ length: nCurr }, (_2, j) => {
        const raw = jointsPoseDistance(refJoints, currMembers[j]?.joints);
        return Math.max(0, raw - boost * 0.15);
      });
    });
    const assignment = hungarianAssign(costMatrix);
    const matchedCurr = /* @__PURE__ */ new Set();
    const matchedPrev = /* @__PURE__ */ new Set();
    const nextMembers = [];
    assignment.forEach((currIdx, prevIdx) => {
      if (currIdx < 0 || currIdx >= nCurr) return;
      const prev = prevMembers[prevIdx];
      const trackId = Number(prev.trackId);
      const cost = costMatrix[prevIdx]?.[currIdx] ?? Infinity;
      const occlusionFrames = occlusionByTrackId.get(trackId) ?? (prev.isEstimated ? 1 : 0);
      const threshold = computeAdaptiveMatchThreshold({
        motionVelocity,
        poseConfidence: avgConfidence,
        bpm,
        sampleFps,
        occlusionFrames
      });
      if (cost > threshold) return;
      matchedCurr.add(currIdx);
      matchedPrev.add(prevIdx);
      const curr = currMembers[currIdx];
      const estimatedMemberId = resolveMemberIdFromTrack(trackId, options.trackToMember) ?? prev.estimatedMemberId ?? curr.estimatedMemberId;
      const member = cloneMember(curr, {
        trackId,
        personIndex: trackId,
        estimatedMemberId,
        isEstimated: Boolean(curr.isEstimated),
        confidence: computeMemberPoseConfidence(curr)
      });
      if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
      occlusionByTrackId.set(trackId, 0);
      nextMembers.push(member);
    });
    const staleTrackIds = [];
    prevMembers.forEach((prev, prevIdx) => {
      if (matchedPrev.has(prevIdx)) return;
      const trackId = Number(prev.trackId);
      const missed = (occlusionByTrackId.get(trackId) ?? 0) + 1;
      occlusionByTrackId.set(trackId, missed);
      if (missed > maxOcclusionFrames) {
        staleTrackIds.push(trackId);
        return;
      }
      const predicted = getPredictor(trackId).predict(timestamp);
      const holdJoints = Object.keys(predicted).length ? predicted : prev.joints;
      nextMembers.push(
        cloneMember(prev, {
          trackId,
          personIndex: trackId,
          joints: holdJoints,
          isEstimated: true,
          confidence: computeMemberPoseConfidence(prev) * 0.7
        })
      );
    });
    staleTrackIds.forEach((trackId) => releaseTrack(trackId));
    currMembers.forEach((curr, currIdx) => {
      if (matchedCurr.has(currIdx)) return;
      let reIdPrev = null;
      let reIdCost = Infinity;
      prevMembers.forEach((prev, prevIdx) => {
        if (matchedPrev.has(prevIdx)) return;
        const trackId2 = Number(prev.trackId);
        const occlusionFrames = occlusionByTrackId.get(trackId2) ?? 1;
        if (occlusionFrames <= 0) return;
        const predicted = getPredictor(trackId2).predict(timestamp);
        const cost = jointsPoseDistance(predicted, curr.joints);
        const threshold = computeAdaptiveMatchThreshold({
          motionVelocity,
          poseConfidence: avgConfidence,
          bpm,
          sampleFps,
          occlusionFrames
        });
        if (cost < reIdCost && cost <= threshold) {
          reIdCost = cost;
          reIdPrev = prev;
        }
      });
      if (reIdPrev) {
        const trackId2 = Number(reIdPrev.trackId);
        const estimatedMemberId2 = resolveMemberIdFromTrack(trackId2, options.trackToMember) ?? reIdPrev.estimatedMemberId ?? curr.estimatedMemberId;
        const member2 = cloneMember(curr, {
          trackId: trackId2,
          personIndex: trackId2,
          estimatedMemberId: estimatedMemberId2,
          confidence: computeMemberPoseConfidence(curr)
        });
        if (member2.joints) getPredictor(trackId2).update(member2.joints, timestamp);
        occlusionByTrackId.set(trackId2, 0);
        nextMembers.push(member2);
        return;
      }
      const trackId = trackPool.acquire(Number(curr.trackId));
      if (trackId == null) return;
      const estimatedMemberId = resolveMemberIdFromTrack(trackId, options.trackToMember) ?? curr.estimatedMemberId;
      const member = cloneMember(curr, {
        trackId,
        personIndex: trackId,
        estimatedMemberId,
        confidence: computeMemberPoseConfidence(curr)
      });
      if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
      occlusionByTrackId.set(trackId, 0);
      nextMembers.push(member);
    });
    prevMembers = nextMembers;
    prevTimestamp = timestamp;
    stabilized.push({
      ...frame,
      frameIndex: frame.frameIndex ?? frameIndex,
      members: nextMembers,
      memberTracks: buildMemberTracksForFrame(nextMembers)
    });
  }
  if (import.meta.env?.DEV) {
    console.debug("[SkeletonMemberTracker] stabilized", stabilized.length, "frames (TrackPool+confidence)");
  }
  return stabilized;
}

// src/utils/skeletonPoseNormalize.ts
var HEIGHT_TOP = "nose";
var HEIGHT_BOTTOM = ["left_ankle", "right_ankle"];
var DEPTH_KEYS = ["left_shoulder", "right_shoulder", "left_hip", "right_hip", "nose"];
var MIN_SCALE = 1e-4;
function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: a.visibility ?? b.visibility,
    presence: a.presence ?? b.presence,
    confidence: a.confidence ?? b.confidence
  };
}
function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function transformJoints(joints, fn) {
  const out = {};
  Object.entries(joints).forEach(([name, j]) => {
    if (j) out[name] = fn(j, name);
  });
  return out;
}
function resolveHipCenter(joints) {
  const left = joints.left_hip;
  const right = joints.right_hip;
  if (left && right) return midpoint(left, right);
  if (left) return left;
  if (right) return right;
  const nose = joints.nose;
  return nose ? { ...nose, z: nose.z ?? 0 } : null;
}
function resolveShoulderWidth(joints) {
  const left = joints.left_shoulder;
  const right = joints.right_shoulder;
  if (left && right) return dist2d(left, right);
  return 0;
}
function resolveBodyHeight(joints, hipCenter2) {
  const top = joints[HEIGHT_TOP];
  const ankles = HEIGHT_BOTTOM.map((k) => joints[k]).filter(Boolean);
  if (top && ankles.length) {
    const ankleY = ankles.reduce((sum2, a) => sum2 + a.y, 0) / ankles.length;
    return Math.abs(top.y - ankleY);
  }
  if (top) return Math.abs(top.y - hipCenter2.y) * 2.2;
  return 0;
}
function resolveCameraDepthSpan(joints) {
  const zs = DEPTH_KEYS.map((k) => joints[k]?.z).filter((z) => Number.isFinite(z));
  if (zs.length < 2) return 0;
  return Math.max(...zs) - Math.min(...zs);
}
function normalizePoseJoints(joints, worldJoints = {}) {
  if (!joints || !Object.keys(joints).length) {
    return { joints: {}, worldJoints: {} };
  }
  const hipCenter2 = resolveHipCenter(joints);
  if (!hipCenter2) return { joints: { ...joints }, worldJoints: { ...worldJoints } };
  let norm2d = transformJoints(joints, (j) => ({
    ...j,
    x: j.x - hipCenter2.x,
    y: j.y - hipCenter2.y,
    z: (j.z ?? 0) - (hipCenter2.z ?? 0)
  }));
  const worldHip = resolveHipCenter(worldJoints) ?? hipCenter2;
  let normWorld = Object.keys(worldJoints).length ? transformJoints(worldJoints, (j) => ({
    ...j,
    x: j.x - worldHip.x,
    y: j.y - worldHip.y,
    z: (j.z ?? 0) - (worldHip.z ?? 0)
  })) : {};
  const shoulderW = resolveShoulderWidth(norm2d);
  if (shoulderW > MIN_SCALE) {
    norm2d = transformJoints(norm2d, (j) => ({
      ...j,
      x: j.x / shoulderW,
      y: j.y / shoulderW,
      z: (j.z ?? 0) / shoulderW
    }));
    if (Object.keys(normWorld).length) {
      const worldShoulderW = resolveShoulderWidth(normWorld) || shoulderW;
      if (worldShoulderW > MIN_SCALE) {
        normWorld = transformJoints(normWorld, (j) => ({
          ...j,
          x: j.x / worldShoulderW,
          y: j.y / worldShoulderW,
          z: (j.z ?? 0) / worldShoulderW
        }));
      }
    }
  }
  const height = resolveBodyHeight(norm2d, { x: 0, y: 0, z: 0 });
  if (height > MIN_SCALE) {
    norm2d = transformJoints(norm2d, (j) => ({
      ...j,
      x: j.x / height,
      y: j.y / height,
      z: (j.z ?? 0) / height
    }));
    if (Object.keys(normWorld).length) {
      const worldHipCenter = resolveHipCenter(normWorld) ?? { x: 0, y: 0, z: 0 };
      const worldHeight = resolveBodyHeight(normWorld, worldHipCenter) || height;
      if (worldHeight > MIN_SCALE) {
        normWorld = transformJoints(normWorld, (j) => ({
          ...j,
          x: j.x / worldHeight,
          y: j.y / worldHeight,
          z: (j.z ?? 0) / worldHeight
        }));
      }
    }
  }
  const depthSpan = resolveCameraDepthSpan(norm2d);
  const depthScale = depthSpan > MIN_SCALE ? depthSpan : Math.abs(hipCenter2.z ?? 0) || 1;
  if (depthScale > MIN_SCALE) {
    norm2d = transformJoints(norm2d, (j) => ({
      ...j,
      z: (j.z ?? 0) / depthScale
    }));
    if (Object.keys(normWorld).length) {
      const worldDepth = resolveCameraDepthSpan(normWorld) || depthScale;
      if (worldDepth > MIN_SCALE) {
        normWorld = transformJoints(normWorld, (j) => ({
          ...j,
          z: (j.z ?? 0) / worldDepth
        }));
      }
    }
  }
  return { joints: norm2d, worldJoints: normWorld };
}
function normalizeMemberPoseScale(member) {
  const { joints, worldJoints } = normalizePoseJoints(
    member.joints || {},
    member.worldCoordinates || {}
  );
  return {
    ...member,
    joints,
    worldCoordinates: Object.keys(worldJoints).length ? worldJoints : member.worldCoordinates
  };
}

// src/services/motion/JointKalmanFilter.ts
var Kalman1D = class {
  constructor(q = 8e-3, r = 0.12) {
    this.q = q;
    this.r = r;
  }
  x = 0;
  p = 1;
  initialized = false;
  filter(measurement) {
    if (!this.initialized) {
      this.x = measurement;
      this.initialized = true;
      return measurement;
    }
    this.p += this.q;
    const k = this.p / (this.p + this.r);
    this.x += k * (measurement - this.x);
    this.p *= 1 - k;
    return this.x;
  }
  reset() {
    this.initialized = false;
    this.p = 1;
  }
};
var JointKalmanFilter = class {
  jointFilters = /* @__PURE__ */ new Map();
  getFilters(jointName) {
    let f = this.jointFilters.get(jointName);
    if (!f) {
      f = { x: new Kalman1D(), y: new Kalman1D(), z: new Kalman1D(8e-3, 0.15) };
      this.jointFilters.set(jointName, f);
    }
    return f;
  }
  smoothJoints(joints) {
    if (!joints) return {};
    const out = {};
    Object.entries(joints).forEach(([name, j]) => {
      if (!j) return;
      const f = this.getFilters(name);
      out[name] = {
        x: f.x.filter(j.x),
        y: f.y.filter(j.y),
        z: f.z.filter(j.z ?? 0),
        visibility: j.visibility,
        confidence: j.confidence ?? j.visibility
      };
    });
    return out;
  }
  reset() {
    this.jointFilters.forEach((f) => {
      f.x.reset();
      f.y.reset();
      f.z.reset();
    });
    this.jointFilters.clear();
  }
};
function smoothSkeletonFrames(frames) {
  if (!frames?.length) return frames;
  const filtersByMember = /* @__PURE__ */ new Map();
  return frames.map((frame) => ({
    ...frame,
    members: frame.members.map((member) => {
      const key = member.estimatedMemberId ?? `track_${member.trackId}`;
      let filter = filtersByMember.get(key);
      if (!filter) {
        filter = new JointKalmanFilter();
        filtersByMember.set(key, filter);
      }
      return {
        ...member,
        joints: filter.smoothJoints(member.joints),
        worldCoordinates: member.worldCoordinates ? filter.smoothJoints(member.worldCoordinates) : member.worldCoordinates
      };
    })
  }));
}

// src/services/motion/GroupMotionPipeline.ts
var MOTION_PIPELINE_VERSION = "5.0";
var MOTION_PIPELINE_STAGES = [
  "normalize",
  "confidence",
  "smooth",
  "tracking",
  "interpolation",
  "formation_detection",
  "member_identification",
  "motion_timeline",
  "motion_database",
  "orientation",
  "joint_rotation",
  "formation",
  "timeline",
  "metadata",
  "validate"
];
function countInterpolatedMembers(frames) {
  let count = 0;
  frames.forEach((frame) => {
    frame.members?.forEach((m) => {
      if (m.isEstimated) count += 1;
    });
  });
  return count;
}
function stage(audit, id, applied, extra = {}) {
  audit.stages[id] = { applied, ...extra };
}
async function runGroupMotionPipeline({
  rawFrames,
  groupId,
  songId = "unknown",
  userMemberId,
  allMemberIds,
  videoDurationSec,
  fps,
  bpm = 120,
  trackToMember,
  memberTracks: inputMemberTracks = [],
  formationKeyframes: inputFormationKeyframes = [],
  applySmoothing = false,
  skipPostProcess = false,
  preserveExtractionFrames = false
}) {
  let formationKeyframes = [...inputFormationKeyframes];
  let memberTracks = [...inputMemberTracks];
  let motionTimelines;
  let memberIdentification;
  let formationTimeline;
  const audit = {
    version: MOTION_PIPELINE_VERSION,
    ranAt: (/* @__PURE__ */ new Date()).toISOString(),
    stages: {},
    inputFrameCount: rawFrames?.length ?? 0,
    outputFrameCount: 0,
    interpolatedMemberCount: 0,
    timeline: null
  };
  if (!rawFrames?.length) {
    throw new Error("[GroupMotionPipeline] \uC785\uB825 \uD504\uB808\uC784\uC774 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
  }
  const duration = resolvePracticeDurationSec(videoDurationSec, rawFrames);
  if (!duration) {
    throw new Error("[GroupMotionPipeline] video.duration\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  const timeline = computePracticeTimeline(duration, fps);
  if (!timeline) {
    throw new Error("[GroupMotionPipeline] timeline(duration \xD7 fps) \uACC4\uC0B0 \uC2E4\uD328");
  }
  audit.timeline = timeline;
  let frames = rawFrames;
  if (skipPostProcess) {
    MOTION_PIPELINE_STAGES.forEach((id) => stage(audit, id, false, { error: "skipPostProcess" }));
    frames = enrichSkeletonFrameMetadata(frames, {
      bpm,
      fps: timeline.fps,
      sourceVideoDurationSec: duration,
      memberTracks,
      formationKeyframes
    });
    stage(audit, "metadata", true);
    stage(audit, "validate", true);
    await yieldToMainThread();
    const validation2 = validateSkeletonForPractice(frames, userMemberId, {
      skipNormalize: true,
      expectedDurationSec: duration,
      expectedAiMemberCount: allMemberIds.filter((id) => id && id !== userMemberId).length
    });
    const coverageReport = calculateTimelineCoverage(frames, duration);
    audit.outputFrameCount = frames.length;
    audit.interpolatedMemberCount = countInterpolatedMembers(frames);
    if (!validation2.valid || coverageReport.coverage < SKELETON_MIN_TIMELINE_COVERAGE) {
      throw new Error(
        validation2.reason || `[GroupMotionPipeline] skipPostProcess coverage \uBD80\uC871 (duration=${duration.toFixed(2)}s, lastTimestamp=${coverageReport.lastTimestamp.toFixed(2)}s, coverage=${Math.round(coverageReport.coverage * 100)}%)`
      );
    }
    return { frames, timeline, extractedFrameCount: frames.length, validation: validation2, audit };
  }
  frames = normalizeSkeletonFrames(frames);
  frames = frames.map((frame) => ({
    ...frame,
    members: frame.members.map((m) => normalizeMemberPoseScale(m))
  }));
  stage(audit, "normalize", true, { inputFrames: rawFrames.length, outputFrames: frames.length });
  if (!frames.length) throw new Error("[GroupMotionPipeline] normalize \uD6C4 \uD504\uB808\uC784 \uC5C6\uC74C");
  await yieldToMainThread();
  if (preserveExtractionFrames) {
    stage(audit, "confidence", false, { error: "preserveExtractionFrames" });
  } else {
    frames = interpolateLowConfidenceJoints(frames);
    stage(audit, "confidence", true, { outputFrames: frames.length });
  }
  await yieldToMainThread();
  if (applySmoothing) {
    frames = smoothSkeletonFrames(frames);
    stage(audit, "smooth", true);
    await yieldToMainThread();
  } else {
    stage(audit, "smooth", false);
  }
  frames = await stabilizeSkeletonMemberTracks(frames, {
    trackToMember,
    bpm,
    sampleFps: timeline.fps,
    maxTracks: allMemberIds?.length || 9
  });
  stage(audit, "tracking", true, { outputFrames: frames.length });
  await yieldToMainThread();
  if (preserveExtractionFrames) {
    stage(audit, "interpolation", false, { error: "preserveExtractionFrames" });
  } else {
    const beforeInterp = countInterpolatedMembers(frames);
    frames = interpolateSkeletonFrameGaps(frames, allMemberIds);
    stage(audit, "interpolation", true, {
      interpolatedMembers: Math.max(0, countInterpolatedMembers(frames) - beforeInterp),
      outputFrames: frames.length
    });
  }
  await yieldToMainThread();
  if (groupId && allMemberIds.length > 1) {
    const trackMap = trackToMember instanceof Map ? trackToMember : trackToMember ? new Map(Object.entries(trackToMember).map(([k, v]) => [Number(k), v])) : /* @__PURE__ */ new Map();
    formationTimeline = analyzeFormationTimeline({
      groupId,
      songId,
      userMemberId,
      frames,
      trackToMember: trackMap
    });
    if (!formationKeyframes.length && formationTimeline.keyframes?.length) {
      formationKeyframes = formationTimeline.keyframes;
    }
    stage(audit, "formation_detection", true, {
      outputFrames: formationTimeline.segments?.length ?? 0
    });
    memberIdentification = identifyMembersFromTracks(frames, trackMap, allMemberIds, userMemberId);
    if (memberIdentification.memberTracks.length) {
      memberTracks = memberIdentification.memberTracks;
    }
    stage(audit, "member_identification", true, {
      identifiedMembers: memberIdentification.identifiedCount
    });
    const maxLiveDetected = Math.max(
      0,
      ...frames.map((f) => (f.members || []).filter((m) => !m.isEstimated).length)
    );
    const singleDancerMode = maxLiveDetected <= 1;
    frames = applyMemberMotionDatabase(frames, {
      allMemberIds,
      userMemberId,
      singleDancerMode,
      formationContext: {
        groupId,
        focusMemberId: userMemberId,
        allMemberIds,
        formationTimeline,
        formationKeyframes
      }
    });
    stage(audit, "motion_database", true, { outputFrames: frames.length });
    motionTimelines = buildMemberMotionTimelines(
      frames,
      allMemberIds.filter((id) => id !== userMemberId)
    );
    audit.motionTimelineMemberCount = motionTimelines.size;
    stage(audit, "motion_timeline", true, {
      identifiedMembers: motionTimelines.size
    });
  } else {
    stage(audit, "formation_detection", false);
    stage(audit, "member_identification", false);
    stage(audit, "motion_timeline", false);
    stage(audit, "motion_database", false);
  }
  await yieldToMainThread();
  frames = applyOrientationToFrames(frames);
  stage(audit, "orientation", true, { outputFrames: frames.length });
  await yieldToMainThread();
  frames = applyJointRotationsToFrames(frames);
  stage(audit, "joint_rotation", true, { outputFrames: frames.length });
  await yieldToMainThread();
  frames = attachSessionMetadataToFrames(frames, { memberTracks, formationKeyframes });
  stage(audit, "formation", true, { outputFrames: frames.length });
  await yieldToMainThread();
  if (preserveExtractionFrames) {
    stage(audit, "timeline", false, { error: "preserveExtractionFrames" });
  } else {
    frames = normalizeFrameTimestampsToFpsGrid(frames, timeline.fps);
    stage(audit, "timeline", true, { outputFrames: frames.length });
  }
  await yieldToMainThread();
  frames = enrichSkeletonFrameMetadata(frames, {
    bpm,
    fps: timeline.fps,
    sourceVideoDurationSec: duration,
    memberTracks,
    formationKeyframes
  });
  stage(audit, "metadata", true);
  await yieldToMainThread();
  const validation = validateSkeletonForPractice(frames, userMemberId, {
    skipNormalize: true,
    expectedDurationSec: duration,
    expectedAiMemberCount: allMemberIds.filter((id) => id && id !== userMemberId).length
  });
  stage(audit, "validate", true, { error: validation.valid ? void 0 : validation.reason });
  if (!validation.valid) {
    throw new Error(validation.reason || "[GroupMotionPipeline] \uC2A4\uCF08\uB808\uD1A4 \uAC80\uC99D \uC2E4\uD328");
  }
  audit.outputFrameCount = frames.length;
  audit.interpolatedMemberCount = countInterpolatedMembers(frames);
  if (import.meta.env?.DEV) {
    console.debug("[GroupMotionPipeline] v5.0 \uC644\uB8CC", {
      stages: Object.keys(audit.stages),
      motionMembers: audit.motionTimelineMemberCount,
      formationSegments: formationTimeline?.segments?.length
    });
  }
  return {
    frames,
    timeline,
    extractedFrameCount: frames.length,
    validation,
    audit,
    motionTimelines,
    memberIdentification,
    formationTimeline
  };
}

// src/services/groupChoreoCache.ts
var DB_NAME = "onnode_group_choreo_v2";
var DB_VERSION = 1;
var STORE = "choreo";
var CHOREO_CACHE_PIPELINE_VERSION = MOTION_PIPELINE_VERSION;
function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getCachedChoreo(cacheKey) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(cacheKey);
    req.onsuccess = () => {
      const entry = req.result || null;
      if (entry && !isChoreoCacheValid(entry)) {
        console.warn("[ChoreoCache] \uBD88\uB7C9 \uCE90\uC2DC \uC790\uB3D9 \uC0AD\uC81C", { cacheKey });
        deleteCachedChoreo(cacheKey);
        resolve(null);
        return;
      }
      resolve(entry);
    };
    req.onerror = () => resolve(null);
  });
}
async function saveCachedChoreo(entry) {
  const db = await openDb();
  if (!db || !entry?.cacheKey) return false;
  if (entry?.frames?.length) {
    const report = calculateTimelineCoverage(entry.frames, entry.durationSec);
    if (report.duration <= 0 || report.coverage < SKELETON_MIN_TIMELINE_COVERAGE) {
      throw new Error(
        `ChoreoCache \uC800\uC7A5 \uCC28\uB2E8: coverage \uBD80\uC871 (duration=${Number(report.duration || 0).toFixed(2)}s, lastTimestamp=${report.lastTimestamp.toFixed(2)}s, coverage=${Math.round(report.coverage * 100)}%)`
      );
    }
    const memberReport = calculateCacheMemberCoverage(entry);
    if (!memberReport.valid) {
      throw new Error(
        `ChoreoCache \uC800\uC7A5 \uCC28\uB2E8: AI \uBA64\uBC84 \uC218 \uBD80\uC871 (${memberReport.actualAiCount}/${memberReport.expectedAiCount})`
      );
    }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      ...entry,
      pipelineVersion: entry.pipelineVersion || CHOREO_CACHE_PIPELINE_VERSION,
      savedAt: entry.savedAt || (/* @__PURE__ */ new Date()).toISOString()
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
async function deleteCachedChoreo(cacheKey) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(cacheKey);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
function logCacheCoverage(label, entry, cacheValid) {
  const report = calculateTimelineCoverage(entry?.frames, entry?.durationSec);
  console.table({
    [label]: {
      videoDuration: entry?.durationSec ?? 0,
      analysisDuration: entry?.durationSec ?? 0,
      frameCount: report.frameCount,
      firstTimestamp: report.firstTimestamp,
      lastTimestamp: report.lastTimestamp,
      coverage: report.coverage,
      cacheUsed: true,
      cacheValid
    }
  });
  return report;
}
function calculateCacheMemberCoverage(entry) {
  const group = GROUP_DATA[entry?.groupId];
  const userMemberId = entry?.positionMap?.userMemberId ?? entry?.formationHole?.memberId ?? "";
  if (!group) {
    return { valid: true, expectedAiCount: 0, actualAiCount: 0 };
  }
  const aiIds = /* @__PURE__ */ new Set();
  (entry.frames || []).forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const id = member.estimatedMemberId;
      if (id && (!userMemberId || id !== userMemberId) && member.joints && Object.keys(member.joints).length) {
        aiIds.add(id);
      }
    });
  });
  const expectedAiCount = Math.max(0, group.members.length - 1);
  return {
    valid: aiIds.size >= expectedAiCount,
    expectedAiCount,
    actualAiCount: aiIds.size
  };
}
function isChoreoCacheValid(entry) {
  if (!entry?.frames?.length) return false;
  if (entry.pipelineVersion && entry.pipelineVersion !== CHOREO_CACHE_PIPELINE_VERSION) return false;
  const coverageProbe = calculateTimelineCoverage(entry.frames, entry.durationSec);
  const coverageValid = coverageProbe.duration > 0 && coverageProbe.coverage >= SKELETON_MIN_TIMELINE_COVERAGE;
  const coverageReport = logCacheCoverage("Choreo Cache Coverage", entry, coverageValid);
  if (!coverageValid) {
    console.warn("[ChoreoCache] coverage \uBD80\uC871 \uCE90\uC2DC \uBB34\uD6A8\uD654", {
      cacheKey: entry.cacheKey,
      durationSec: coverageReport.duration,
      firstTimestamp: coverageReport.firstTimestamp,
      lastTimestamp: coverageReport.lastTimestamp,
      coverage: coverageReport.coverage
    });
    return false;
  }
  const memberReport = calculateCacheMemberCoverage(entry);
  if (!memberReport.valid) {
    console.warn("[ChoreoCache] AI \uBA64\uBC84 \uBD80\uC871 \uCE90\uC2DC \uBB34\uD6A8\uD654", {
      cacheKey: entry.cacheKey,
      expectedAiCount: memberReport.expectedAiCount,
      actualAiCount: memberReport.actualAiCount
    });
    return false;
  }
  const sample = entry.frames[Math.floor(entry.frames.length / 2)];
  const member = sample?.members?.[0];
  return sample?.frameIndex != null && sample?.beat != null && sample?.poseQuality != null && sample?.memberTracks != null && (member?.leftHand != null || member?.rightHand != null || member?.face != null);
}

// src/services/motion/GroupMotionReconstructionEngine.ts
var GROUP_MOTION_ENGINE_VERSION = "1.0";
var GroupMotionReconstructionEngine = class {
  tracker = new MemberTrackingEngine();
  debug = { ...EMPTY_GROUP_MOTION_DEBUG };
  metadata = {};
  formationTimeline = null;
  motionTimelines = /* @__PURE__ */ new Map();
  occlusionRecoveryTotal = 0;
  previousFrame = null;
  reset() {
    this.tracker.reset();
    this.debug = { ...EMPTY_GROUP_MOTION_DEBUG };
    this.metadata = {};
    this.formationTimeline = null;
    this.motionTimelines.clear();
    this.occlusionRecoveryTotal = 0;
    this.previousFrame = null;
  }
  getDebugState() {
    return { ...this.debug };
  }
  getMetadata() {
    if (!this.metadata.groupId) return null;
    return this.metadata;
  }
  /**
   * Motion Database 기반 AI 멤버 생성 — Skeleton 복사 금지.
   * 1) 저장된 DB skeletonFrames
   * 2) 세션 누적 live Motion Timeline
   * 3) 프레임 실측 live detection
   */
  generateAIMembers(frame, options) {
    const { userMemberId, allMemberIds, motionDatabase, groupId } = options;
    const aiIds = allMemberIds.filter((id) => id && id !== userMemberId);
    const group = GROUP_DATA[groupId];
    if (!group) return frame.members || [];
    if (motionDatabase?.skeletonFrames?.length) {
      return resolveMembersFromStoredMotionDatabase(
        frame,
        motionDatabase.skeletonFrames,
        group.members.map((m) => m.id),
        userMemberId
      );
    }
    const liveById = new Map(
      (frame.members || []).filter((m) => m.estimatedMemberId && m.estimatedMemberId !== userMemberId).map((m) => [m.estimatedMemberId, m])
    );
    return aiIds.map((memberId, idx) => {
      const live = liveById.get(memberId);
      if (live?.joints && Object.keys(live.joints).length && !live.isEstimated) {
        return { ...live, trackId: live.trackId ?? idx, personIndex: live.personIndex ?? idx };
      }
      const timeline = this.motionTimelines.get(memberId);
      if (timeline?.samples?.length) {
        const sorted = timeline.samples;
        const prevSample = [...sorted].reverse().find((s) => s.timestamp <= frame.timestamp);
        const nextSample = sorted.find((s) => s.timestamp >= frame.timestamp);
        if (prevSample && nextSample && prevSample.timestamp !== nextSample.timestamp) {
          const ratio = (frame.timestamp - prevSample.timestamp) / (nextSample.timestamp - prevSample.timestamp);
          const prevMember = {
            personIndex: idx,
            trackId: idx,
            estimatedMemberId: memberId,
            joints: prevSample.joints,
            worldCoordinates: prevSample.worldCoordinates,
            confidence: prevSample.confidence
          };
          const nextMember = {
            personIndex: idx,
            trackId: idx,
            estimatedMemberId: memberId,
            joints: nextSample.joints,
            worldCoordinates: nextSample.worldCoordinates,
            confidence: nextSample.confidence
          };
          const held = this.tracker.interpolateMemberHold(
            memberId,
            prevMember,
            nextMember,
            Math.min(1, Math.max(0, ratio)),
            frame.timestamp
          );
          if (held) return { ...held, trackId: idx, personIndex: idx, estimatedMemberId: memberId };
        }
        const nearest = sorted.reduce(
          (best, s) => Math.abs(s.timestamp - frame.timestamp) < Math.abs(best.timestamp - frame.timestamp) ? s : best
        );
        if (nearest?.joints && Object.keys(nearest.joints).length) {
          return {
            personIndex: idx,
            trackId: idx,
            estimatedMemberId: memberId,
            joints: nearest.joints,
            worldCoordinates: nearest.worldCoordinates,
            orientation: nearest.orientation,
            boneRotations: nearest.boneRotations,
            confidence: nearest.confidence,
            isEstimated: true
          };
        }
      }
      return live || null;
    }).filter(Boolean);
  }
  /** 단일 프레임 재구성 — 스트리밍/실시간용 */
  reconstructFrame(frame, options, detectedCount) {
    const t0 = isProfileEnabled() ? performance.now() : 0;
    if (isProfileEnabled()) {
      profileBeginFrame(frame.frameIndex ?? 0, frame.timestamp);
    }
    const {
      groupId,
      userMemberId,
      allMemberIds,
      bpm = 120,
      sampleFps = 30,
      motionDatabase,
      formationTimeline
    } = options;
    const count = detectedCount ?? (frame.members || []).filter((m) => !m.isEstimated).length;
    let members = frame.members || [];
    if (motionDatabase?.skeletonFrames?.length) {
      members = profileStep("generateAI", () => this.generateAIMembers(frame, options));
      this.debug.pipelineStage = "motion_database";
    } else if (count > 1) {
      const trackResult = profileStep("trackingTotal", () => this.previousFrame?.members?.length ? this.tracker.trackMembers(members, this.previousFrame.members, {
        bpm,
        sampleFps,
        timestamp: frame.timestamp,
        prevTimestamp: this.previousFrame.timestamp,
        maxTracks: allMemberIds.length || 9
      }) : { members: this.tracker.seedMembers(members), occlusionRecoveries: 0, avgVelocity: 0, identityConfidence: {} });
      members = trackResult.members;
      profileRecordBytes("members", members);
      this.occlusionRecoveryTotal += trackResult.occlusionRecoveries;
      this.debug.pipelineStage = "adaptive_tracking";
      this.debug.avgMemberVelocity = trackResult.avgVelocity;
      Object.assign(this.debug, {
        occlusionRecoveries: this.occlusionRecoveryTotal,
        avgIdentityConfidence: Object.values(trackResult.identityConfidence).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(trackResult.identityConfidence).length)
      });
    } else {
      members = profileStep("generateAI", () => this.generateAIMembers(frame, options));
      this.debug.singleDancerMode = true;
      this.debug.pipelineStage = "motion_timeline";
    }
    const formation = formationTimeline ?? this.formationTimeline;
    const formationKf = profileStep("formation", () => formation ? resolveFormationAtTime(formation, frame.timestamp) : null);
    const out = profileStep("finalSkeleton", () => ({
      ...frame,
      members,
      formationType: formationKf?.formationType ?? frame.formationType,
      formation: formationKf ?? frame.formation
    }));
    this.previousFrame = out;
    profileStep("timeline", () => {
      this.updateLiveTimelines(out, allMemberIds.filter((id) => id !== userMemberId));
    });
    this.updateDebugFromFrame(out, options);
    profileRecordBytes("final", out);
    if (isProfileEnabled()) {
      profileEndFrame(performance.now() - t0);
    }
    return out;
  }
  updateLiveTimelines(frame, aiMemberIds) {
    const tracks = buildMemberMotionTracks([frame], aiMemberIds);
    tracks.forEach((track, memberId) => {
      const existing = this.motionTimelines.get(memberId);
      if (!existing) {
        this.motionTimelines.set(memberId, {
          memberId,
          sampleCount: track.samples.length,
          realSampleCount: track.samples.filter((s) => !s.member.isEstimated).length,
          coverageSec: 0,
          samples: track.samples.map((s) => ({
            timestamp: s.timestamp,
            joints: s.member.joints,
            worldCoordinates: s.member.worldCoordinates,
            orientation: s.member.orientation,
            boneRotations: s.member.boneRotations,
            confidence: s.member.confidence,
            isEstimated: s.member.isEstimated
          }))
        });
      } else {
        track.samples.forEach((s) => existing.samples.push({
          timestamp: s.timestamp,
          joints: s.member.joints,
          worldCoordinates: s.member.worldCoordinates,
          orientation: s.member.orientation,
          boneRotations: s.member.boneRotations,
          confidence: s.member.confidence,
          isEstimated: s.member.isEstimated
        }));
        existing.sampleCount = existing.samples.length;
        existing.realSampleCount = existing.samples.filter((s) => !s.isEstimated).length;
      }
    });
  }
  updateDebugFromFrame(frame, options) {
    const members = frame.members || [];
    const visible = members.filter((m) => !m.isEstimated);
    const estimated = members.filter((m) => m.isEstimated);
    this.debug = {
      ...this.debug,
      frameIndex: frame.frameIndex ?? this.debug.frameIndex + 1,
      timestamp: frame.timestamp,
      trackedCount: members.length,
      visibleCount: visible.length,
      estimatedCount: estimated.length,
      activeTrackIds: [...this.tracker.getTrackPool().activeCount ? members.map((m) => Number(m.trackId ?? 0)) : []],
      avgPoseConfidence: members.reduce((s, m) => s + computeMemberPoseConfidence(m), 0) / Math.max(1, members.length),
      formationType: frame.formationType ?? null,
      formationTransition: frame.formation?.transition ?? null,
      orientationLabels: members.map((m) => m.orientation?.label ?? "unknown"),
      motionTimelineCoverage: Object.fromEntries(
        [...this.motionTimelines.entries()].map(([id, t]) => [
          id,
          t.realSampleCount / Math.max(1, t.sampleCount)
        ])
      ),
      interpolationActive: estimated.length > 0
    };
  }
  /**
   * 전체 프레임 시퀀스 재구성 — GroupMotionPipeline v5.0 통합.
   */
  async reconstructSequence(rawFrames, options) {
    this.reset();
    const {
      groupId,
      songId = "unknown",
      userMemberId,
      allMemberIds,
      bpm = 120,
      motionDatabase,
      formationTimeline,
      trackToMember,
      cacheKey,
      skipCache = false,
      videoDurationSec,
      fps
    } = options;
    if (cacheKey && !skipCache) {
      const cached = await getCachedChoreo(cacheKey);
      if (cached?.frames?.length && isChoreoCacheValid(cached)) {
        this.debug = { ...EMPTY_GROUP_MOTION_DEBUG, cacheHit: true, pipelineStage: "cache_hit" };
        const meta2 = {
          engineVersion: GROUP_MOTION_ENGINE_VERSION,
          pipelineVersion: cached.pipelineVersion || CHOREO_CACHE_PIPELINE_VERSION,
          reconstructedAt: cached.savedAt || (/* @__PURE__ */ new Date()).toISOString(),
          groupId,
          songId,
          userMemberId,
          frameCount: cached.frames.length,
          aiMemberIds: allMemberIds.filter((id) => id !== userMemberId),
          memberTracks: [],
          formationTimeline: formationTimeline ?? null,
          motionTimelines: [],
          identityConfidence: {},
          singleDancerMode: false,
          occlusionRecoveryCount: 0,
          cacheKey,
          fromCache: true
        };
        return { frames: cached.frames, metadata: meta2, debug: this.debug, motionDatabase };
      }
    }
    const pipeline = await runGroupMotionPipeline({
      rawFrames,
      groupId,
      songId,
      userMemberId,
      allMemberIds,
      videoDurationSec,
      fps,
      bpm,
      trackToMember,
      formationKeyframes: formationTimeline?.keyframes
    });
    let frames = pipeline.frames;
    this.formationTimeline = pipeline.formationTimeline ?? formationTimeline ?? null;
    if (this.formationTimeline) {
      frames = frames.map((frame) => {
        const kf = resolveFormationAtTime(this.formationTimeline, frame.timestamp);
        return {
          ...frame,
          formation: kf ?? frame.formation,
          formationType: kf?.formationType ?? frame.formationType
        };
      });
    }
    const aiIds = allMemberIds.filter((id) => id !== userMemberId);
    this.motionTimelines = buildMemberMotionTimelines(frames, aiIds);
    const memberIdResult = identifyMembersFromTracks(
      frames,
      trackToMember ?? /* @__PURE__ */ new Map(),
      allMemberIds,
      userMemberId
    );
    const meta = {
      engineVersion: GROUP_MOTION_ENGINE_VERSION,
      pipelineVersion: MOTION_PIPELINE_VERSION,
      reconstructedAt: (/* @__PURE__ */ new Date()).toISOString(),
      groupId,
      songId,
      userMemberId,
      frameCount: frames.length,
      aiMemberIds: aiIds,
      memberTracks: memberIdResult.memberTracks,
      formationTimeline: this.formationTimeline,
      motionTimelines: [...this.motionTimelines.values()],
      identityConfidence: memberIdResult.coverageByMember,
      singleDancerMode: Math.max(...frames.map(
        (f) => (f.members || []).filter((m) => !m.isEstimated).length
      )) <= 1,
      occlusionRecoveryCount: this.occlusionRecoveryTotal,
      cacheKey,
      fromCache: false,
      pipelineAudit: pipeline.audit
    };
    this.metadata = meta;
    this.debug.pipelineStage = "complete";
    if (cacheKey) {
      await saveCachedChoreo({
        cacheKey,
        songId,
        groupId,
        frames,
        frameCount: frames.length,
        durationSec: videoDurationSec,
        pipelineVersion: MOTION_PIPELINE_VERSION,
        sampleFps: fps,
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return {
      frames,
      metadata: meta,
      debug: this.getDebugState(),
      motionDatabase
    };
  }
  /** 프레임 시퀀스 스트리밍 재구성 (파이프라인 없이 엔진만) */
  reconstructFrameSequence(frames, options) {
    this.reset();
    if (options.formationTimeline) this.formationTimeline = options.formationTimeline;
    return frames.map((frame, i) => {
      const count = (frame.members || []).filter((m) => !m.isEstimated).length;
      return this.reconstructFrame(
        { ...frame, frameIndex: frame.frameIndex ?? i },
        options,
        count
      );
    });
  }
};

// src/benchmark/runReconstructFrameBenchmark.ts
var MEMBER_IDS = ["jennie", "lisa", "rose", "jisoo"];
var VIDEO_DURATION_SEC = 163;
var SAMPLE_FPS = CHOREO_DEFAULT_SAMPLE_FPS;
function makeJoints(frameIndex, memberIdx) {
  const phase = frameIndex * 0.08 + memberIdx * 0.5;
  const joints = {};
  POSE_MATCH_JOINTS.forEach((key, ji) => {
    joints[key] = {
      x: 0.3 + memberIdx * 0.12 + Math.sin(phase + ji * 0.2) * 0.02,
      y: 0.4 + Math.cos(phase + ji * 0.15) * 0.03,
      z: 0.1 * Math.sin(phase),
      visibility: 0.9
    };
  });
  return joints;
}
function makeSyntheticFrame(frameIndex, timestamp) {
  const members = MEMBER_IDS.map((id, idx) => ({
    personIndex: idx,
    trackId: idx,
    estimatedMemberId: id,
    joints: makeJoints(frameIndex, idx),
    confidence: 0.85,
    isEstimated: false
  }));
  return {
    timestamp,
    frameIndex,
    timestampMs: timestamp * 1e3,
    members,
    videoWidth: 1920,
    videoHeight: 1080
  };
}
function avg(rows, key) {
  if (!rows.length) return 0;
  return rows.reduce((s, r) => s + (r[key] || 0), 0) / rows.length;
}
function sum(rows, key) {
  return rows.reduce((s, r) => s + (r[key] || 0), 0);
}
function linearRegressionSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p) => {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  });
  return den ? num / den : 0;
}
function runReconstructFrameBenchmark() {
  globalThis.__RECONSTRUCT_FRAME_PROFILE__ = true;
  reconstructFrameProfiler.reset();
  const totalFrames = Math.round(VIDEO_DURATION_SEC * SAMPLE_FPS);
  const engine = new GroupMotionReconstructionEngine();
  engine.reset();
  const options = {
    groupId: "blackpink",
    songId: "bench",
    userMemberId: "jennie",
    allMemberIds: MEMBER_IDS,
    bpm: 128,
    sampleFps: SAMPLE_FPS
  };
  const cacheSnapshots = [];
  let previousFrameRefTest = null;
  const benchStart = performance.now();
  for (let i = 0; i < totalFrames; i += 1) {
    const timestamp = i / SAMPLE_FPS;
    const frame = makeSyntheticFrame(i, timestamp);
    const out = engine.reconstructFrame(frame, options, MEMBER_IDS.length);
    if (i === 50) {
      const prev = engine.previousFrame;
      const prevMembers = prev?.members;
      const outMembers = out.members;
      const sharesMembersArray = prevMembers === outMembers;
      const marker = prev?.members?.[0]?.joints?.nose?.x;
      if (marker != null && prev?.members?.[0]?.joints?.nose) {
        prev.members[0].joints.nose.x = marker + 999;
      }
      const mutatedVisibleOnOut = out.members?.[0]?.joints?.nose?.x === (marker != null ? marker + 999 : null);
      previousFrameRefTest = {
        isDeepClone: false,
        isReference: prev === out,
        sharesMembersArray
      };
      previousFrameRefTest.isDeepClone = !previousFrameRefTest.isReference && !mutatedVisibleOnOut;
      if (marker != null && prev?.members?.[0]?.joints?.nose) {
        prev.members[0].joints.nose.x = marker;
      }
    }
    if (i % 100 === 0 || i === totalFrames - 1) {
      const tracker = engine.tracker;
      const motionTimelines = engine.motionTimelines;
      let timelineSamples = 0;
      motionTimelines.forEach((t) => {
        timelineSamples += t.samples.length;
      });
      const prevFrame = engine.previousFrame;
      cacheSnapshots.push({
        frameIndex: i,
        motionTimelineSamples: timelineSamples,
        predictors: tracker.predictors.size,
        occlusionByTrack: tracker.occlusionByTrack.size,
        identityConfidence: tracker.identityConfidence.size,
        memberVelocity: tracker.memberVelocity.size,
        previousFrameBytes: jsonByteSize(prevFrame),
        heapBytes: readHeapBytes()
      });
    }
  }
  const benchTotalMs = performance.now() - benchStart;
  const rows = reconstructFrameProfiler.frameRows;
  const first30 = rows.filter((r) => r.timestamp <= 30);
  const after30 = rows.filter((r) => r.timestamp > 30);
  const slope = linearRegressionSlope(rows.map((r) => ({ x: r.frameIndex, y: r.totalMs })));
  const stepSummary = [
    { step: "Total (all frames)", totalMs: sum(rows, "totalMs"), avgMs: avg(rows, "totalMs"), pct: 100 },
    { step: "Member Matching", totalMs: sum(rows, "memberMatchingMs"), avgMs: avg(rows, "memberMatchingMs"), pct: sum(rows, "memberMatchingMs") / sum(rows, "totalMs") * 100 },
    { step: "Hungarian Matching", totalMs: sum(rows, "hungarianMatchingMs"), avgMs: avg(rows, "hungarianMatchingMs"), pct: sum(rows, "hungarianMatchingMs") / sum(rows, "totalMs") * 100 },
    { step: "Formation", totalMs: sum(rows, "formationMs"), avgMs: avg(rows, "formationMs"), pct: sum(rows, "formationMs") / sum(rows, "totalMs") * 100 },
    { step: "Missing Member Fill", totalMs: sum(rows, "missingMemberFillMs"), avgMs: avg(rows, "missingMemberFillMs"), pct: sum(rows, "missingMemberFillMs") / sum(rows, "totalMs") * 100 },
    { step: "Pose Merge", totalMs: sum(rows, "poseMergeMs"), avgMs: avg(rows, "poseMergeMs"), pct: sum(rows, "poseMergeMs") / sum(rows, "totalMs") * 100 },
    { step: "Timeline", totalMs: sum(rows, "timelineMs"), avgMs: avg(rows, "timelineMs"), pct: sum(rows, "timelineMs") / sum(rows, "totalMs") * 100 },
    { step: "Final Skeleton", totalMs: sum(rows, "finalSkeletonMs"), avgMs: avg(rows, "finalSkeletonMs"), pct: sum(rows, "finalSkeletonMs") / sum(rows, "totalMs") * 100 },
    { step: "Tracking Total", totalMs: sum(rows, "trackingTotalMs"), avgMs: avg(rows, "trackingTotalMs"), pct: sum(rows, "trackingTotalMs") / sum(rows, "totalMs") * 100 }
  ].map((r) => ({
    ...r,
    totalMs: Number(r.totalMs.toFixed(3)),
    avgMs: Number(r.avgMs.toFixed(4)),
    pct: Number(r.pct.toFixed(2))
  }));
  const objectSizeSummary = [
    { object: "members (avg/frame)", bytes: Math.round(rows.reduce((s, r) => s + r.membersOutBytes, 0) / Math.max(1, rows.length)) },
    { object: "timeline delta (avg/frame)", bytes: Math.round(rows.reduce((s, r) => s + r.timelineOutBytes, 0) / Math.max(1, rows.length)) },
    { object: "final out (avg/frame)", bytes: Math.round(rows.reduce((s, r) => s + r.finalOutBytes, 0) / Math.max(1, rows.length)) },
    { object: "previousFrame @ end", bytes: cacheSnapshots[cacheSnapshots.length - 1]?.previousFrameBytes ?? 0 }
  ];
  const cacheGrowth = [
    { cache: "track cache (predictors Map)", start: cacheSnapshots[0]?.predictors, end: cacheSnapshots[cacheSnapshots.length - 1]?.predictors, grows: cacheSnapshots[cacheSnapshots.length - 1]?.predictors > cacheSnapshots[0]?.predictors },
    { cache: "occlusionByTrack Map", start: cacheSnapshots[0]?.occlusionByTrack, end: cacheSnapshots[cacheSnapshots.length - 1]?.occlusionByTrack, grows: cacheSnapshots[cacheSnapshots.length - 1]?.occlusionByTrack !== cacheSnapshots[0]?.occlusionByTrack },
    { cache: "identityConfidence Map", start: cacheSnapshots[0]?.identityConfidence, end: cacheSnapshots[cacheSnapshots.length - 1]?.identityConfidence, grows: cacheSnapshots[cacheSnapshots.length - 1]?.identityConfidence > cacheSnapshots[0]?.identityConfidence },
    { cache: "memberVelocity Map", start: cacheSnapshots[0]?.memberVelocity, end: cacheSnapshots[cacheSnapshots.length - 1]?.memberVelocity, grows: cacheSnapshots[cacheSnapshots.length - 1]?.memberVelocity > cacheSnapshots[0]?.memberVelocity },
    { cache: "timeline cache (motionTimelines samples)", start: cacheSnapshots[0]?.motionTimelineSamples, end: cacheSnapshots[cacheSnapshots.length - 1]?.motionTimelineSamples, grows: true },
    { cache: "formation cache", start: "N/A (per-frame resolve, no accumulation)", end: "N/A", grows: false },
    { cache: "member cache (liveById in generateAI)", start: "N/A (multi-member path)", end: "N/A", grows: false },
    { cache: "frame cache (previousFrame)", start: 1, end: 1, grows: false }
  ];
  const structuralAnalysis = [
    { item: "previousFrame deep clone?", value: previousFrameRefTest?.isDeepClone ? "YES" : "NO" },
    { item: "previousFrame same reference as out?", value: previousFrameRefTest?.isReference ? "YES" : "NO" },
    { item: "previousFrame shares members[] with out?", value: previousFrameRefTest?.sharesMembersArray ? "YES" : "NO" },
    { item: "WeakMap usage in reconstructFrame path", value: "NONE (all Map/Set/Array)" },
    { item: "Recursion in reconstructFrame path", value: "NONE (hungarian iterative)" },
    { item: "O(N\xB2) loops", value: "YES \u2014 costMatrix O(nPrev\xD7nCurr), reId loop O(nCurr\xD7nPrev), timeline sample scan O(samples) per AI frame" },
    { item: "GC-uncollectable growth risk", value: cacheSnapshots[cacheSnapshots.length - 1]?.motionTimelineSamples > totalFrames ? "YES \u2014 motionTimelines.samples unbounded" : "LOW for Maps (bounded by member count)" }
  ];
  const timingTrend = [
    { metric: "163s video frames", value: totalFrames },
    { metric: "sampleFps", value: SAMPLE_FPS },
    { metric: "bench total ms", value: Number(benchTotalMs.toFixed(2)) },
    { metric: "avg ms/frame (measured)", value: Number(avg(rows, "totalMs").toFixed(4)) },
    { metric: "avg ms/frame first 30s", value: Number(avg(first30, "totalMs").toFixed(4)) },
    { metric: "avg ms/frame after 30s", value: Number(avg(after30, "totalMs").toFixed(4)) },
    { metric: "30s \uD6C4 \uC99D\uAC00\uC728 (after/before)", value: Number((avg(after30, "totalMs") / Math.max(1e-9, avg(first30, "totalMs"))).toFixed(4)) },
    { metric: "frameIndex vs totalMs slope (ms/frameIndex)", value: Number(slope.toFixed(6)) },
    { metric: "heap start bytes", value: cacheSnapshots[0]?.heapBytes ?? "n/a (Chrome only)" },
    { metric: "heap end bytes", value: cacheSnapshots[cacheSnapshots.length - 1]?.heapBytes ?? "n/a (Chrome only)" },
    { metric: "heap monotonic increase", value: cacheSnapshots[0]?.heapBytes != null && cacheSnapshots[cacheSnapshots.length - 1]?.heapBytes != null ? cacheSnapshots[cacheSnapshots.length - 1].heapBytes > cacheSnapshots[0].heapBytes ? "YES" : "NO" : "n/a (Chrome only)" }
  ];
  const perFrameSample = rows.filter((_, idx) => idx % 163 === 0 || idx === rows.length - 1).map((r) => ({
    frameIndex: r.frameIndex,
    timestamp: Number(r.timestamp.toFixed(2)),
    totalMs: Number(r.totalMs.toFixed(3)),
    timelineMs: Number(r.timelineMs.toFixed(3)),
    heapBytes: r.heapBytes
  }));
  const top10 = reconstructFrameProfiler.getTopFunctions(10).map((f) => ({
    function: f.name,
    totalMs: Number(f.totalMs.toFixed(3)),
    calls: f.calls,
    avgMs: Number(f.avgMs.toFixed(4))
  }));
  console.log("\n========== reconstructFrame() 163s BENCHMARK ==========");
  console.table(stepSummary);
  console.table(objectSizeSummary);
  console.table(cacheGrowth);
  console.table(structuralAnalysis);
  console.table(timingTrend);
  console.table(perFrameSample);
  console.log("\n--- Top 10 Functions (by totalMs) ---");
  console.table(top10);
  globalThis.__RECONSTRUCT_FRAME_PROFILE__ = false;
  return {
    stepSummary,
    objectSizeSummary,
    cacheGrowth,
    structuralAnalysis,
    timingTrend,
    perFrameSample,
    top10,
    totalFrames,
    benchTotalMs
  };
}
if (typeof globalThis !== "undefined") {
  globalThis.runReconstructFrameBenchmark = runReconstructFrameBenchmark;
}
export {
  runReconstructFrameBenchmark
};
