window.JUDGE_DOCUMENTS = [
  {
    id: "advanced-manual",
    title: "上級プレイヤー用ルールガイド",
    shortTitle: "上級プレイヤーガイド",
    version: "未設定",
    updatedAt: "未設定",
    fileName: "",
    path: "",
    required: false,
    expectedTerms: ["上級プレイヤー", "ルール", "ポケモンカードゲーム"]
  },
  {
    id: "floor-rule",
    title: "ポケモンカードゲーム 競技向けフロアルール",
    shortTitle: "フロアルール",
    version: "2026-01-30",
    updatedAt: "2026-01-30",
    fileName: "",
    path: "",
    required: false,
    expectedTerms: ["フロアルール", "競技", "ポケモンカードゲーム"]
  },
  {
    id: "penalty-guideline",
    title: "ポケモンカードゲーム ジャッジ向けペナルティガイドライン",
    shortTitle: "ペナルティガイドライン",
    version: "未設定",
    updatedAt: "未設定",
    fileName: "",
    path: "",
    required: true,
    expectedTerms: ["ペナルティガイドライン", "裁定対応指針", "ポケモンカードゲーム"]
  },
  {
    id: "ruling-case",
    title: "ポケモンカードゲーム 裁定事例集",
    shortTitle: "裁定事例集",
    version: "1_2",
    updatedAt: "未設定",
    fileName: "",
    path: "",
    required: true,
    expectedTerms: ["裁定事例集", "裁定", "ポケモンカードゲーム"]
  }
];

window.JUDGE_FILTERS = [
  { id: "all", label: "全資料", documentIds: [] },
  { id: "advanced-manual", label: "上級プレイヤー用ルールガイド", documentIds: ["advanced-manual"] },
  { id: "floor-rule", label: "競技向けフロアルール", documentIds: ["floor-rule"] },
  { id: "penalty-guideline", label: "ペナルティガイドライン", documentIds: ["penalty-guideline"] },
  { id: "ruling-case", label: "裁定事例集", documentIds: ["ruling-case"] },
  { id: "penalty-and-ruling", label: "ペナルティ＋裁定事例集", documentIds: ["penalty-guideline", "ruling-case"] }
];

window.JUDGE_SHORTCUTS = [
  "余分なカードを見た",
  "余分なカードを手札に加えた",
  "非公開のカードを混ぜた",
  "本来できない行動",
  "処理忘れ",
  "ダメージの誤り",
  "対戦準備の誤り",
  "不十分なシャッフル",
  "カードを落とした",
  "遅いプレイ",
  "対戦相手のプレイエラーの見逃し",
  "デッキ・デッキリストの問題",
  "遅刻",
  "アドバイス行為",
  "公開情報",
  "非公開情報",
  "意思疎通",
  "巻き戻し",
  "シャッフル",
  "対戦終了",
  "ドロップ"
].map((label) => ({
  label,
  query: label,
  targetDocuments: ["penalty-guideline", "ruling-case"]
}));
