/* だまされ体験ラボ：画面と進行のエンジン。シナリオ本体は data/*.js が window.DL.scenarios に積む */
(() => {
"use strict";

const SCENARIOS = (window.DL && window.DL.scenarios) || [];
const DEBRIEF = (window.DL && window.DL.debrief) || {};
/* GitHub Pages で開かれたときはそのURLを、それ以外では公開ページのURLをシェアに使う */
const PAGES_URL = "https://azakeiten.github.io/damasare-lab/";
const SHARE_URL = /github\.io$/.test(location.hostname) ? location.origin + location.pathname : PAGES_URL;
/* 企画・制作の表記。フッター・ホーム・授業ページに表示される */
const ORG = { name: "AZAKEI（麻経）", note: "麻布中学校・高等学校 経済系同好会", url: "https://azakeiten.github.io/" };

/* サインを8つの系統にまとめる。図鑑とグラフの軸になる */
const CATS = {
  umai:    { n: "うますぎる話",     ic: "甘", d: "楽・確実・高収入・特別。条件が良すぎる話は、まず疑う。" },
  isogi:   { n: "急かす",           ic: "急", d: "今だけ・残りわずか・今日中に。考える時間を奪う言葉。" },
  himitsu: { n: "秘密・場所を移す", ic: "隠", d: "別のアプリへ、アプリの外へ、誰にも言わないで。" },
  kane:    { n: "先にお金",         ic: "￥", d: "登録料・先払い・借金・電子マネーなど、払い方の指定。" },
  kojin:   { n: "個人情報",         ic: "鍵", d: "身分証・顔写真・認証コード・パスワード・カード番号。" },
  kankei:  { n: "気持ちや関係を使う", ic: "心", d: "好意・先輩後輩・罪悪感・不安・脅し。断りにくくする。" },
  jouken:  { n: "小さな条件",       ic: "細", d: "継続購入・分割・手数料・解約条件。総額で考える。" },
  tsuuchi: { n: "いきなりの通知",   ic: "通", d: "SMS・警告画面・友だちを名のるメッセージ。リンクを押す前に。" },
  soudan:  { n: "相談・被害のあと", ic: "話", d: "ひとりで抱えない。取り戻せますという二次被害にも注意。" }
};
const GENRES = {
  kasegu: { n: "かせぐ話", h: 28 },
  kau:    { n: "買う・推す", h: 335 },
  net:    { n: "スマホ・ネット", h: 205 },
  deai:   { n: "出会い・誘い", h: 265 },
  kurashi: { n: "くらし・契約", h: 165 }
};
const QUIZ = [
  { q: "もっとお金をかせぎたい、と思うことがよくある", s: ["side", "yami", "koza", "course"], type: "がんばり屋タイプ" },
  { q: "投資や「お金を増やす方法」に興味がある", s: ["celeb", "invest", "romance"], type: "資産づくりタイプ" },
  { q: "推し活やほしいもののために、SNSやフリマをよく見る", s: ["ticket", "tousen", "flea", "nisetsuhan"], type: "推し活タイプ" },
  { q: "SNSの投稿を、よくシェアや拡散をする", s: ["bokin", "tousen", "takeover"], type: "シェア好きタイプ" },
  { q: "家族や祖父母のことが、ときどき心配になる", s: ["oreore", "kyufu", "phishing"], type: "家族思いタイプ" },
  { q: "マッチングアプリやSNSで、知らない人とやり取りすることがある", s: ["romance", "side", "scout"], type: "つながりタイプ" },
  { q: "クレジットカードや後払いを使っている（使ってみたい）", s: ["pay", "genkinka", "esthe"], type: "キャッシュレスタイプ" },
  { q: "先輩や友だちの誘いを断るのが、ちょっと苦手", s: ["multi", "invest", "casino"], type: "やさしいタイプ" },
  { q: "就活や将来のことを考えると、不安になる", s: ["shukatsu", "course", "side"], type: "将来まじめタイプ" },
  { q: "一人暮らしをしている、またはもうすぐ始める", s: ["chintai", "kyufu", "genkinka"], type: "ひとり立ちタイプ" },
  { q: "スマホの通知やリンクは、とりあえずタップしがち", s: ["phishing", "support", "takeover"], type: "タップ早押しタイプ" }
];
const ENDLAB = { safe: "被害なし", partial: "被害を最小限に", bad: "被害にあった" };
const STAMP = { safe: "SAFE", partial: "ギリギリ", bad: "OUT" };
const TEMPO = { normal: 1, fast: 0.4, instant: 0 };

/* ===== 保存（この端末のブラウザだけ） ===== */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let progress = store.get("dl3-progress", {}) || {};
let prefs = Object.assign({ tempo: "normal", fs: "m" }, store.get("dl3-prefs", {}));
if (!(prefs.tempo in TEMPO)) prefs.tempo = "normal";
const saveProgress = () => store.set("dl3-progress", progress);
const savePrefs = () => store.set("dl3-prefs", prefs);
const prog = (id) => {
  const p = (progress[id] ||= { ends: [], signs: {}, plays: 0 });
  p.ends ||= []; p.signs ||= {}; p.plays ||= 0;
  return p;
};

/* ===== 小道具 ===== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const byId = (id) => SCENARIOS.find((s) => s.id === id) || (/^mix-\d+$/.test(id || "") ? genScenario(+id.slice(4)) : null);
const endIds = (sc) => Object.keys(sc.nodes).filter((k) => sc.nodes[k].end);
/* ミヌケの着せかえ：見抜きレベルで手に入るアクセサリー（64×64の座標で、顔に重ねて描く） */
const WEAR = {
  none:   { n: "なし", lv: 0, g: "" },
  glass:  { n: "まるメガネ", lv: 3, g: `<g fill="none" stroke="#1B2534" stroke-width="2.6"><circle cx="23" cy="38" r="7"/><circle cx="41" cy="38" r="7"/><path d="M30 38h4M16 36l-6-3M48 36l6-3"/></g><g fill="#fff" opacity=".35"><circle cx="20.5" cy="35.5" r="2.4"/><circle cx="38.5" cy="35.5" r="2.4"/></g>` },
  hat:    { n: "探偵の帽子", lv: 6, g: `<path d="M6 21c8-3 44-3 52 0l-3 4H9z" fill="#6B4A2B" stroke="#1B2534" stroke-width="2"/><path d="M15 21c1-11 8-16 17-16s16 5 17 16" fill="#8A5E36" stroke="#1B2534" stroke-width="2"/><path d="M15 17h34" stroke="#C9A227" stroke-width="3"/>` },
  phones: { n: "ヘッドホン", lv: 10, g: `<path d="M8 36c0-17 11-29 24-29s24 12 24 29" fill="none" stroke="#1E3A5F" stroke-width="4" stroke-linecap="round"/><rect x="2" y="31" width="10" height="15" rx="4" fill="#1E3A5F" stroke="#1B2534" stroke-width="2"/><rect x="52" y="31" width="10" height="15" rx="4" fill="#1E3A5F" stroke="#1B2534" stroke-width="2"/><circle cx="7" cy="38.5" r="2" fill="#C9A227"/><circle cx="57" cy="38.5" r="2" fill="#C9A227"/>` },
  scarf:  { n: "マフラー", lv: 15, g: `<path d="M12 52c6 6 14 9 20 9s14-3 20-9l2 5c-6 6-14 9-22 9s-16-3-22-9z" fill="#C8463A" stroke="#1B2534" stroke-width="2"/><path d="M40 58l4 6h6l-4-7" fill="#C8463A" stroke="#1B2534" stroke-width="2"/><path d="M16 56l2 2M24 59l1 3M33 60v3" stroke="#F2C9A5" stroke-width="2"/>` },
  crown:  { n: "王冠", lv: 20, g: `<path d="M18 14l3-11 6 7 5-9 5 9 6-7 3 11z" fill="#E3C25A" stroke="#1B2534" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="10" r="2" fill="#C8463A"/><circle cx="24" cy="12" r="1.5" fill="#2F9E62"/><circle cx="40" cy="12" r="1.5" fill="#2F7BD6"/>` }
};
let wearMemo = { t: 0, k: "", w: "none" };
const wearNow = () => {
  const w = WEAR[prefs.wear] ? prefs.wear : "none", now = Date.now();
  if (wearMemo.k === w && now - wearMemo.t < 1000) return wearMemo.w;
  wearMemo = { t: now, k: w, w: lvInfo().lv >= WEAR[w].lv ? w : "none" };
  return wearMemo.w;
};
const mascot = (cls, wearId) => `<svg class="mascot ${cls || ""}" viewBox="-2 -2 68 68" aria-hidden="true"><use href="#minuke" x="0" y="0" width="64" height="64"></use>${WEAR[wearId || wearNow()].g}</svg>`;
const lvl = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const levelName = (n) => ["", "かんたん", "ふつう", "むずかしい"][n] || "";
function orgBadge() {
  if (!ORG.name) return "";
  return `<a class="org" href="${esc(ORG.url || "#")}" target="_blank" rel="noopener"><span class="org-word">AZA<i>KEI</i></span><span class="org-seal" aria-hidden="true">麻経</span><span class="org-txt"><small>企画・制作</small>${esc(ORG.note)}</span></a>`;
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function totals() {
  let signs = 0, ends = 0, gotEnds = 0, caught = 0, met = 0, cleared = 0;
  SCENARIOS.forEach((sc) => {
    const p = progress[sc.id];
    signs += Object.keys(sc.signs).length; ends += endIds(sc).length;
    if (p) {
      gotEnds += (p.ends || []).length;
      Object.values(p.signs || {}).forEach((v) => { met++; if (v === "caught") caught++; });
      if ((p.ends || []).length) cleared++;
    }
  });
  return { signs, ends, gotEnds, caught, met, cleared };
}

/* 学びのコース：テーマごとに話をまとめて、順番に体験できるようにする */
const COURSES = [
  { id: "first", n: "はじめての5本", d: "まずはここから。よくあるトラブルを一通り体験します。", s: ["phishing", "side", "ticket", "oreore", "takeover"] },
  { id: "sns", n: "スマホ・SNS編", d: "通知、リンク、DM、アプリ。毎日さわるスマホの中のサイン。", s: ["phishing", "takeover", "teishi", "apk", "qrpay", "aivoice", "shashin", "shindan", "teiki", "kyohaku", "sim", "sakura", "nft", "akarom", "crowd", "diet", "etc", "jewel", "aiapp", "shoken", "kaizoku", "reply", "points", "shareacct", "aikoi", "shomei", "otoshimono", "haishin", "sakujo", "cheat", "machigai", "utsuteru", "isan", "gametomo", "kaiyaku", "zeikin", "wangiri", "uwasa", "nayami", "badge", "vpn", "yt", "kashiacct", "shukudai", "coupon", "narisumashi", "chain", "kakeibo", "group", "code", "speedup", "kenshin", "portal", "chosaku", "ichi", "qrlogin", "goukaku", "follower", "giftwari", "airdrop", "shiryoku", "sensei", "iede", "jidori", "shotaijo", "sumahokashi", "jusho", "kyoju", "jidouonsei", "gameshop", "azuke", "satooya", "shoukin", "gakkouhi", "chubaito", "mynacard", "omamori", "taimaa"] },
  { id: "hitori", n: "ひとり暮らし準備編", d: "部屋探し、引っ越し、回線、カード。新生活の前に。", s: ["chintai", "kaishu", "denki", "rental", "koukuuken", "kariru", "hikkoshi", "hoshou", "touhin", "water", "gas", "cashback", "kokusei", "gaichu", "takuhai", "koushin", "share", "gakunen", "cardtel", "suido", "kaisen", "wifi", "okuritsuke", "gakuhi", "sotsuaru", "catch", "taikyo", "hakobi", "battery", "tire", "carshare", "petsagashi", "sitter", "host", "escrow", "passport", "kanojo", "roomshare", "minpaku", "ikkatsu", "daikou"] },
  { id: "oshi", n: "推し活編", d: "チケット、応援広告、課金。好きな気持ちにつけこむ話。", s: ["ticket", "nariori", "ouen", "collab", "esports", "chusen", "livecom", "oripa", "replica", "kyoudou", "sotsuryo", "tousan", "misanga", "shirotaku", "photo", "toreka", "kuruma", "karakon", "shikijo", "seifuku", "hoshouden", "lease", "shincho", "fanclub", "doukou", "seiyuu", "uketori", "tatekae", "taikai", "shuuri", "kakin", "gameacct", "liver", "sports", "archive", "henpin", "cutmodel", "itaba", "cosplay", "noruma", "nyukin"] },
  { id: "shinro", n: "進学・就職編", d: "入学、サークル、バイト、就活。新しい環境のはじまりに。", s: ["kyokasho", "buhi", "pcmonitor", "shuppan", "ceo", "taishoku", "konkatsu", "ocampus", "shanai", "sankousho", "option", "kakomon", "volunteer", "shoumei", "daihitsu", "circle", "baito", "offapp", "kenshuhi", "report", "gakuwari", "suisen", "shogakukin", "intern", "eikaiwa", "visa", "coaching", "menkyo", "haitatsu", "shukatsu", "course", "kyozai", "ryugaku", "meikan", "hoikuen", "hojokin", "kaedama", "kogitte", "obhoumon", "gakusai", "programming", "shashinkan", "resort", "gd", "ongaku", "shutsugan", "tekisei", "kyuryo", "kaki", "owahara"] },
  { id: "okane", n: "お金の話編", d: "投資、借金、出資。「もうかる」「借りられる」の裏側。", s: ["invest", "multi", "yami", "kojinyushi", "genkinka", "pay", "saimu", "kigyo", "meigi", "acctbuy", "kyuyo", "shuuekika", "shutten", "sakurabaito", "shikaku", "wagyu", "gaika", "shinkoku", "hp", "gym", "mansion", "torimodoshi", "yosou", "seikei", "task", "salon", "doga", "dousoukai", "kaigai", "shoukaiya", "kaiga", "naishoku", "otoshidama", "kouryuukai", "dropship", "chiken", "seinen", "mujin", "kujibiki", "souzoku", "classt", "reform", "omatome", "bouhan", "meigiloan", "fukkyu", "yubiwa"] },
  { id: "kazoku", n: "家族を守る編", d: "祖父母や親にかかってくる電話や訪問。あなたが気づいて、伝える番。", s: ["oreore", "kazokuline", "oshikai", "hoken", "saimin", "bousai", "sumaho", "solar", "shoukaki", "kotsumitsudo", "hagaki", "daibiki", "surikae", "apoden", "mikoukai", "loto", "reji", "mizu", "sougi", "shouhinken", "nenkin", "seizen", "haka", "rusuban", "kuyou", "kani", "shinbun", "kaigo", "akiya", "gojokai", "aircon", "tablet", "kidsmodel", "nisepolice", "mynahoken", "tenken", "kyufu", "cardtel", "henkin", "kanpukin", "leaseback", "ninchi", "hochouki", "shinsatsu", "yukioroshi", "atm", "eiei", "genya", "hakajimai", "fusa", "keitaimibarai", "depart", "popup", "rokuon", "kagi", "futon", "idenshi", "terebi", "tenjikai"] }
];
const cleared = (id) => !!(progress[id] && (progress[id].ends || []).length);
const courseOf = (c) => c.s.map(byId).filter(Boolean);
function coursesHTML() {
  return `<section class="sec" aria-label="学びのコース"><div class="sec-h"><h2>学びのコース</h2><p>テーマごとに、話を順番にまとめました。気になるところから、ひとつずつ。</p></div>
    <div class="courses">${COURSES.map((c) => {
      const list = courseOf(c), done = list.filter((s) => cleared(s.id)).length, nx = list.find((s) => !cleared(s.id));
      const pct = Math.round((done / list.length) * 100);
      return `<a class="course${done === list.length ? " done" : ""}${prefs.course === c.id ? " on" : ""}" href="#${(nx || list[0]).id}" data-course="${c.id}">
        <div class="co-top"><b>${esc(c.n)}</b><span class="co-n">${done === list.length ? "修了・証あり" : `${done} / ${list.length}`}</span></div>
        <span class="co-d">${esc(c.d)}</span>
        <span class="co-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="co-dots" aria-hidden="true">${list.map((s) => `<i class="${cleared(s.id) ? "ok" : ""}" title="${esc(s.tag)}"></i>`).join("")}</span>
        <i class="co-go">${done === list.length ? "もう一度ふりかえる →" : nx ? `次：${esc(nx.tag)} →` : ""}</i></a>`;
    }).join("")}</div></section>`;
}
function bindCourses(root) {
  root.querySelectorAll("[data-course]").forEach((a) => a.addEventListener("click", () => { prefs.course = a.dataset.course; savePrefs(); }));
}
/* いま進めているコースの、次の話（なければ null） */
function courseNext(sc) {
  const c = COURSES.find((x) => x.id === prefs.course);
  if (!c || !c.s.includes(sc.id)) return null;
  const list = courseOf(c);
  const nx = list.find((s) => s !== sc && !cleared(s.id));
  return nx ? { c, s: nx, done: list.filter((s) => cleared(s.id)).length, all: list.length } : { c, s: null, done: list.length, all: list.length };
}

/* ===== つづけた日カレンダー：体験した日を、16週間のマス目に色でならべる ===== */
function heatHTML() {
  const log = store.get("dl3-log", []) || [];
  const by = {};
  log.forEach((x) => { const k = dayKey(new Date(x.t)); by[k] = (by[k] || 0) + 1; });
  (store.get("dl3-days", []) || []).forEach((k) => { if (!by[k]) by[k] = 1; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const W = 16, start = new Date(today); start.setDate(start.getDate() - today.getDay() - (W - 1) * 7);
  /* 連続日数：今日（まだなら昨日）からさかのぼる */
  let stk = 0; const c = new Date(today); if (!by[dayKey(c)]) c.setDate(c.getDate() - 1);
  while (by[dayKey(c)]) { stk++; c.setDate(c.getDate() - 1); }
  /* いちばん長い連続 */
  const keys = Object.keys(by).map((k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getTime(); }).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  keys.forEach((t) => { run = prev != null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
  const lv = (n) => (n >= 5 ? 4 : n >= 3 ? 3 : n >= 2 ? 2 : n ? 1 : 0);
  const cols = [], months = [];
  for (let w = 0; w < W; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (d === 0 && (w === 0 || day.getDate() <= 7)) months.push([w, `${day.getMonth() + 1}月`]);
      const fut = day > today, n = by[dayKey(day)] || 0;
      cells.push(fut ? `<i class="hm-c fut" aria-hidden="true"></i>` : `<i class="hm-c l${lv(n)}${+day === +today ? " now" : ""}" title="${day.getMonth() + 1}月${day.getDate()}日：${n ? `${n}話` : "なし"}"></i>`);
    }
    cols.push(`<div class="hm-col">${cells.join("")}</div>`);
  }
  const msg = !keys.length ? "1本体験すると、今日のマスに色がつきます。" : stk >= 7 ? `${stk}日つづいています。見抜く力が、くらしの一部になってきました。` : stk >= 2 ? `${stk}日つづいています。明日も1話、どうですか？` : by[dayKey(today)] ? "今日も体験しました。明日もつづけて、連続記録をのばそう。" : "今日はまだです。1話3分から。";
  const active = Object.keys(by).length;
  return `<section class="sec hm-sec" id="heat" aria-label="つづけた日カレンダー"><div class="sec-h"><h2>つづけた日カレンダー</h2><p>体験した日に色がつきます。毎日少しずつが、いちばんの守りです。</p></div>
    <div class="hm-box">
      <div class="hm-stats"><div><b>${stk}</b><span>日連続</span></div><div><b>${best}</b><span>最長の連続</span></div><div><b>${active}</b><span>体験した日</span></div></div>
      <div class="hm-scroll"><div class="hm-grid" role="img" aria-label="過去${W}週間の体験した日：${active}日、連続${stk}日">
        <div class="hm-months" aria-hidden="true">${months.map(([w, m]) => `<span style="grid-column:${w + 1}">${m}</span>`).join("")}</div>
        <div class="hm-days" aria-hidden="true"><span></span><span>月</span><span></span><span>水</span><span></span><span>金</span><span></span></div>
        <div class="hm-cols">${cols.join("")}</div></div></div>
      <div class="hm-foot"><p class="hm-msg">${mascot("sm")}<span>${esc(msg)}</span></p>
        <span class="hm-leg" aria-hidden="true">少<i class="hm-c l0"></i><i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><i class="hm-c l4"></i>多</span></div>
    </div></section>`;
}
/* ふりかえり帳：体験の記録を、新しい順に */
function logPlay(sc, id, n, caught, missed) {
  const log = store.get("dl3-log", []) || [];
  log.push({ id: sc.id, e: id, end: n.end, c: caught, m: missed, t: Date.now() });
  store.set("dl3-log", log.slice(-300));
}
function journalHTML() {
  const log = (store.get("dl3-log", []) || []).filter((x) => byId(x.id)).slice().reverse();
  const head = `<div class="sec-h"><h2>ふりかえり帳</h2><p>あなたが体験した話と、たどりついた結末の記録です。この端末の中だけに保存されます。</p></div>`;
  if (!log.length) return `<section class="sec" aria-label="ふりかえり帳">${head}<div class="jr-empty">${mascot("md")}<span>まだ記録がありません。シナリオを1本体験すると、ここに残ります。</span><a class="btn small primary" href="#${(nextUnplayed() || SCENARIOS[0]).id}">体験してみる</a></div></section>`;
  const fmt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  const days = [];
  log.slice(0, 40).forEach((x) => { const k = fmt(x.t); let g = days.find((d) => d.k === k); if (!g) days.push((g = { k, items: [] })); g.items.push(x); });
  const cnt = { safe: 0, partial: 0, bad: 0 }; log.forEach((x) => cnt[x.end]++);
  const notes = notesGet(), shownNote = new Set();
  return `<section class="sec" aria-label="ふりかえり帳">${head}
    <div class="jr-sum"><span><b>${log.length}</b>回の体験</span><span class="safe"><b>${cnt.safe}</b>被害なし</span><span class="partial"><b>${cnt.partial}</b>最小限</span><span class="bad"><b>${cnt.bad}</b>被害にあった</span></div>
    <div class="journal">${days.map((d) => `<div class="jr-day"><span class="jr-date">${d.k}</span><ul>${d.items.map((x) => {
      const sc = byId(x.id), node = sc.nodes[x.e] || {};
      const tm = new Date(x.t), hm = `${tm.getHours()}:${String(tm.getMinutes()).padStart(2, "0")}`;
      return `<li class="jr-${x.end}"><span class="jr-dot" aria-hidden="true"></span><div><small>${hm}　${esc(sc.tag)}　<span class="label ${x.end}">${ENDLAB[x.end]}</span></small>
        <b>${esc(node.h || sc.title)}</b><span>気づけたサイン ${x.c}・見逃したサイン ${x.m}</span>${notes[x.id] && !shownNote.has(x.id) && shownNote.add(x.id) ? `<em class="jr-note"><i>メモ</i>${esc(notes[x.id].t)}</em>` : ""}</div><a class="linkbtn" href="#${sc.id}">もう一度</a></li>`;
    }).join("")}</ul></div>`).join("")}</div>
    ${log.length > 40 ? `<p class="hint">新しい40件を表示しています。</p>` : ""}</section>`;
}

/* ===== 気づきメモ：話を終えたら「次はこうする」をひとこと残す（この端末の中だけ） ===== */
const notesGet = () => store.get("dl3-notes", {}) || {};
function noteHTML(sc) {
  const d = DEBRIEF[sc.id] || {}, cur = (notesGet()[sc.id] || {}).t || "";
  const ideas = [...new Set([(d.after || [])[0], (d.say || []).find((x) => !/^（/.test(x)), "その場で決めずに、家族に話す"].filter(Boolean))].slice(0, 3);
  return `<div class="note-box"><div class="side-h"><h2>気づきメモ</h2><span>次はこうする、をひとこと</span></div>
    <textarea id="noteIn" rows="2" maxlength="120" placeholder="例：知らない人からのお金の話は、まず親に見せる">${esc(cur)}</textarea>
    <div class="note-row">${ideas.map((t, i) => `<button class="chipbtn sm" type="button" data-nidea="${i}">${esc(t)}</button>`).join("")}<button class="btn small primary" type="button" id="noteSave">メモを保存</button></div>
    <p class="note-hint">メモは、図鑑のページの「ふりかえり帳」に残ります。この端末の中だけに保存され、どこにも送られません。</p></div>`;
}
function bindNote(sc) {
  if (!$("noteIn")) return;
  const d = DEBRIEF[sc.id] || {};
  const ideas = [...new Set([(d.after || [])[0], (d.say || []).find((x) => !/^（/.test(x)), "その場で決めずに、家族に話す"].filter(Boolean))].slice(0, 3);
  document.querySelectorAll("[data-nidea]").forEach((b) => (b.onclick = () => { const t = ideas[+b.dataset.nidea]; const v = $("noteIn").value.trim(); $("noteIn").value = v ? `${v}　${t}` : t; $("noteIn").focus(); }));
  $("noteSave").onclick = () => {
    const v = maskTx($("noteIn").value.trim()), all = notesGet();
    if (!v) { delete all[sc.id]; store.set("dl3-notes", all); toast("メモを消しました"); return; }
    const first = !all[sc.id]; all[sc.id] = { t: v, at: Date.now() }; store.set("dl3-notes", all);
    if (first) addXP(3);
    toast("気づきメモを保存しました"); setTimeout(checkAch, 800);
  };
}
/* 家族や友だちに話すための、ひとこと */
function talkText(sc, n) {
  const d = DEBRIEF[sc.id] || {};
  const sign = Object.values(sc.signs)[0];
  return `「${sc.tag}」のトラブルを体験できる教材をやってみたよ。` +
    (d.point ? `ポイントは「${d.point}」。` : "") +
    (sign ? `たとえば「${sign.t}」はあやしいサインなんだって。` : "") +
    (d.say && d.say[0] ? `こう言われたら「${d.say[0]}」って返せばいいらしい。` : "") +
    `困ったら188（消費者ホットライン）に相談できるよ。`;
}

/* ===== ルーティング（#home / #zukan / #help / #シナリオID） ===== */
function route() {
  const h = (location.hash || "").replace(/^#/, "") || "home";
  closeResult(true);
  if (EXAM && EXAM.res[EXAM.i] && h === EXAM.ids[EXAM.i + 1]) EXAM.i++;
  if (h === "mix") { location.replace("#mix-" + Math.floor(Math.random() * 1e9)); return; }
  if (byId(h)) return showView("play", h);
  if (h === "zukan" || h === "help" || h === "teach" || h === "challenge") return showView(h);
  showView("home");
}
function showView(name, scId) {
  ["home", "play", "zukan", "help", "teach", "challenge"].forEach((v) => { $("v-" + v).hidden = v !== name; });
  document.body.dataset.view = name;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const on = a.dataset.nav === name || (name === "play" && a.dataset.nav === "home");
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (name !== "play") { RUN++; }
  if (name !== "challenge" && EXAM && EXAM.saved) EXAM = null;
  if (name === "home") renderHome();
  if (name === "zukan") renderZukan();
  if (name === "help") renderHelp();
  if (name === "teach") renderTeach();
  if (name === "challenge") renderChallenge();
  if (name === "play") openScenario(scId);
  window.scrollTo(0, 0);
  if (window.__goto) { const g = window.__goto; window.__goto = null; setTimeout(() => { const e = $(g); if (e) e.scrollIntoView({ block: "start" }); }, 60); }
  if (name === "challenge" && window.__mode) { const m = window.__mode; window.__mode = null; ({ daily: () => startChallenge("daily"), endless: () => startChallenge("endless"), pair: () => startChallenge("pair"), reply: startReply, spot: startSpot, wana: startWana, exam: startExam }[m] || (() => {}))(); }
}

/* ===== ホーム ===== */
let filter = "all";
let quiz = { i: 0, ans: [], done: false };

function scenarioCard(sc) {
  const p = progress[sc.id] || { ends: [], signs: {} };
  const ne = endIds(sc).length, ns = Object.keys(sc.signs).length;
  const caught = Object.values(p.signs || {}).filter((v) => v === "caught").length;
  const g = GENRES[sc.genre];
  const played = (p.ends || []).length;
  const badge = played === ne ? `<span class="badge clear">コンプリート</span>` : played ? `<span class="badge clear">クリア</span>` : sc.isNew ? `<span class="badge">NEW</span>` : "";
  const f = firstMsg(sc);
  /* 一覧は「スマホの通知」に見立てる：アプリ名・時刻・送り主・最初のひとこと */
  return `<a class="scard${played ? "" : " unread"}" href="#${sc.id}" id="card-${sc.id}" style="--gh:${g.h}">
    <div class="nt-head"><span class="nt-app"><span class="nt-ic" aria-hidden="true">${SCENE_ICON[f.type] || SCENE_ICON.dm}</span>${esc(f.app)}</span><span class="nt-time">${esc(sc.clock || "")}</span>${badge}${bmStar(sc.id)}</div>
    <div class="nt-body">${av(sc, f.who)}<div><b>${esc(f.name)}</b><p class="nt-prev">${esc(f.text)}</p></div></div>
    <div class="body"><span class="gtag">${esc(sc.tag)}</span><h3>${esc(sc.title)}</h3>
      <div class="meta">${roleOf(sc) !== "all" ? `<span class="rolechip role-${roleOf(sc)}">${esc(ROLES[roleOf(sc)])}</span>` : ""}<span>約${sc.mins}分</span><span>むずかしさ <span class="lvl">${lvl(sc.level)}</span></span><span>結末 ${played}/${ne}</span><span>サイン ${caught}/${ns}</span></div>
      <div class="pbar" aria-hidden="true"><i style="width:${Math.round((played / ne) * 100)}%"></i></div>
    </div></a>`;
}
/* 場面の種類ごとのアイコン（一覧の通知カード用） */
const svgI = (d) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SCENE_ICON = {
  dm: svgI('<path d="M4 5h16v11H9l-5 4z"/>'),
  talk: svgI('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>'),
  call: svgI('<path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>'),
  live: svgI('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5.5"/>'),
  web: svgI('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>'),
  home: svgI('<path d="M4 11l8-7 8 7v9H4z"/>')
};
/* 苦手克服：いちばん見逃しが多い系統の、まだ気づけていないサインがある話をすすめる */
function weakHTML() {
  const stat = {};
  SCENARIOS.forEach((sc) => Object.entries(sc.signs).forEach(([k, sg]) => {
    const st = ((progress[sc.id] || {}).signs || {})[k];
    const s = (stat[sg.cat] ||= { met: 0, caught: 0 });
    if (st) { s.met++; if (st === "caught") s.caught++; }
  }));
  const cands = Object.entries(stat).filter(([, s]) => s.met >= 2).map(([c, s]) => ({ c, rate: s.caught / s.met, ...s })).sort((a, b) => a.rate - b.rate);
  if (!cands.length || cands[0].rate >= 0.9) return "";
  const w = cands[0], cat = CATS[w.c];
  const recs = SCENARIOS.filter((sc) => Object.entries(sc.signs).some(([k, sg]) => sg.cat === w.c && ((progress[sc.id] || {}).signs || {})[k] !== "caught")).slice(0, 3);
  if (!recs.length) return "";
  return `<section class="weak" aria-label="苦手克服トレーニング"><div class="weak-h"><span class="ic" aria-hidden="true">${cat.ic}</span><div><span class="eyebrow">苦手克服トレーニング</span>
    <b>あなたが見逃しやすいのは「${esc(cat.n)}」のサイン</b><span>これまで ${w.met}回出会って、気づけたのは ${w.caught}回。${esc(cat.d)}</span></div></div>
    <div class="weak-recs">${recs.map((s) => `<a class="rec" href="#${s.id}"><small>${esc(s.tag)}・約${s.mins}分</small><b>${esc(s.title)}</b></a>`).join("")}</div></section>`;
}
/* 何日続けて体験しているか */
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
function markToday() {
  const days = new Set(store.get("dl3-days", []) || []);
  days.add(dayKey(new Date()));
  store.set("dl3-days", [...days].slice(-120));
}
function streak() {
  const days = new Set(store.get("dl3-days", []) || []);
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
/* 効果音（オンにしたときだけ。ファイルは使わず、その場で音を作る） */
let actx = null;
function sfx(kind) {
  if (!prefs.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const seq = { stop: [[520, 0, 0.09, "square"], [330, 0.11, 0.16, "square"]], ok: [[660, 0, 0.08, "sine"], [880, 0.09, 0.14, "sine"]], end: [[523, 0, 0.12, "triangle"], [659, 0.12, 0.12, "triangle"], [784, 0.24, 0.22, "triangle"]], nudge: [[880, 0, 0.06, "sine"], [880, 0.12, 0.06, "sine"]] }[kind] || [];
    const t0 = actx.currentTime + 0.01;
    seq.forEach(([f, at, dur, type]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(actx.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
    });
  } catch (e) {}
}
/* 最初に届くメッセージ（通知のプレビュー用） */
function firstMsg(sc) {
  let node = sc.nodes[sc.start], app = "", who = "", text = "", type = "";
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    if (node.scene) { app = app || node.scene.app; who = who || node.scene.who; type = type || node.scene.type; }
    const m = (node.log || []).find((l) => l[0] === "them" || l[0] === "card");
    if (m) {
      if (m[0] === "them") { text = m[1]; if (m[2]) who = m[2]; } else { text = `${m[1]}：${m[2][0]}`; }
      break;
    }
    node = node.choices && sc.nodes[node.choices[0].next];
  }
  const c = sc.cast[who] || {};
  return { app: app || "メッセージ", who, name: c.n || "", text, type };
}
/* ヒーローのデモ：届いたメッセージに STOP のハンコが押される、を繰り返す */
const DEMOS = [
  { app: "SNS メッセージ", n: "みき", i: "み", h: 340, msgs: ["はじめまして〜！ 突然ごめんなさい🙏", "スマホで1日5分の作業で、月20万くらいになってて", "よかったら、やり方シェアしましょうか？☺️"], cat: "umai", sign: "「簡単・短時間・高収入」がそろっている" },
  { app: "SMS", n: "+81 80-XXXX-XXXX", i: "?", h: 0, msgs: ["お客様宛にお荷物のお届けにあがりましたが、不在の為持ち帰りました。", "下記よりご確認ください。http://xxxx-delivery.top/"], cat: "tsuuchi", sign: "SMSのリンクから開かせようとする" },
  { app: "LINE", n: "たくみ先輩", i: "た", h: 210, msgs: ["おー久しぶり！ 元気してる？", "実はさ、いい話があって", "今度の土曜、カフェでちょっと話聞いてみない？ おごるから"], cat: "kankei", sign: "久しぶりの人から、急にお金の「いい話」" },
  { app: "SNS", n: "高収入バイト募集", i: "募", h: 0, msgs: ["【急募】ホワイト案件 即日5万〜", "荷物を受け取って、指定の場所に置くだけ", "未経験OK・身バレなし"], cat: "umai", sign: "仕事内容があいまいなのに高額" }
];
let demoTimer = null;
/* ヒーローの下を横切る警告テープ（文字が流れる） */
function tapeRun() {
  const words = ["その誘い、どこで見抜ける？", "STOP", "うますぎる話", "急かす", "先にお金", "秘密にさせる", "ひとりで抱えない", "188", "#9110"];
  const run = words.map((w) => `<span>${esc(w)}</span><i aria-hidden="true">●</i>`).join("");
  return `<div class="tape-run" aria-hidden="true"><div class="tr-in">${run}${run}</div></div>`;
}
function demoHTML() {
  return `<div class="hero-stage">
    <div class="mini-phone" aria-label="メッセージの例と、気づくサイン">
      <div class="mp-status"><span>23:12</span><span class="island"></span><span>●●●</span></div>
      <div class="mp-head" id="mpHead"></div>
      <div class="mp-log" id="mpLog"></div>
      <div class="mp-stamp" id="mpStamp" aria-hidden="true"><span>STOP</span></div>
      <div class="mp-sign" id="mpSign"></div>
    </div>
    <div class="hero-mascot">${mascot()}<div class="say-bubble">ぼくはミヌケ。<br>「あれ？」って気づく練習、いっしょにしよう！</div></div>
  </div>`;
}
function runDemo() {
  clearTimeout(demoTimer);
  let k = 0;
  const show = (d, animate) => {
    if (!$("mpLog")) return false;
    $("mpHead").innerHTML = `<span class="av sm" style="--h:${d.h}">${esc(d.i)}</span><b>${esc(d.n)}</b><span class="app">${esc(d.app)}</span>`;
    $("mpLog").innerHTML = "";
    $("mpStamp").classList.remove("on");
    $("mpSign").classList.remove("on");
    $("mpSign").innerHTML = `<span class="cat-tag">${esc(CATS[d.cat].n)}のサイン</span><b>${esc(d.sign)}</b>`;
    if (!animate) {
      d.msgs.forEach((m) => $("mpLog").insertAdjacentHTML("beforeend", `<p>${esc(m)}</p>`));
      $("mpStamp").classList.add("on"); $("mpSign").classList.add("on");
      return true;
    }
    d.msgs.forEach((m, i) => setTimeout(() => { if ($("mpLog")) $("mpLog").insertAdjacentHTML("beforeend", `<p class="pop">${esc(m)}</p>`); }, 500 + i * 900));
    const t = 500 + d.msgs.length * 900 + 300;
    setTimeout(() => { if ($("mpStamp")) { $("mpStamp").classList.add("on"); $("mpSign").classList.add("on"); } }, t);
    return true;
  };
  show(DEMOS[0], false);
  if (reduced) return;
  const loop = () => {
    if ($("v-home").hidden || !$("mpLog")) return;
    k = (k + 1) % DEMOS.length;
    show(DEMOS[k], true);
    demoTimer = setTimeout(loop, 1400 + DEMOS[k].msgs.length * 900 + 2600);
  };
  demoTimer = setTimeout(loop, 4200);
}
function av(sc, key, sm) {
  const c = sc.cast[key];
  if (!c) return `<span class="av ghost${sm ? " sm" : ""}">？</span>`;
  return `<span class="av${sm ? " sm" : ""}" style="--h:${c.h}" aria-hidden="true">${esc(c.i)}</span>`;
}
function nextUnplayed() {
  return SCENARIOS.find((s) => !(progress[s.id] && (progress[s.id].ends || []).length)) || null;
}

/* ===== あそびかたマップ：ふえた遊び方と道具を、ひと目で選べるようにする ===== */
function modesHTML() {
  const met = SCENARIOS.filter((s) => cleared(s.id)).length;
  const ach = achievements(), got = ach.filter((a) => a.got).length;
  const G = [
    ["体験する", [
      ["話", "シナリオ", `${SCENARIOS.length}本の話を、スマホの画面で体験`, "#home", null, null, `${met}/${SCENARIOS.length}`, "libSec"],
      ["新", "毎回ちがう話", "場面と手口を組み合わせて、開くたびに新しい話", "#mix", null, null, "", null],
      ["裏", "本音モード", "話を終えたら、だます側の心の声を見ながらもう一度", "#home", null, null, "", "libSec"]
    ]],
    ["見抜く", [
      ["今", "今日のチャレンジ", "日替わりの10問。あやしい？ だいじょうぶ？", "#challenge", "daily", null, "", null],
      ["探", "サインさがし", "メッセージのあやしいところをタップ", "#challenge", "spot", null, "", null],
      ["罠", "画面のワナさがし", "通販やアプリの画面にかくれた仕掛け", "#challenge", "wana", null, "", null],
      ["言", "ことばで返す", "自分の言葉で断る練習", "#challenge", "reply", null, "", null],
      ["検", "見抜き検定", "3話つづけて、級が決まる", "#challenge", "exam", null, "", null]
    ]],
    ["ふりかえる", [
      ["顔", "相手の人物帳", "これまでに出会った「相手」", "#zukan", null, "castbook", `${met}/${SCENARIOS.length}`, null],
      ["形", "守りのかたち", "見抜きのレーダーと、あなたの守りのタイプ", "#zukan", null, "shape", "", null],
      ["章", "称号", "体験を重ねて集める", "#zukan", null, null, `${got}/${ach.length}`, null],
      ["日", "つづけた日カレンダー", "体験した日に色がつく、16週間のマス目", "#zukan", null, "heat", "", null],
      ["着", "ミヌケの着せかえ", "レベルで手に入るアクセサリー", "#zukan", null, "wear", "", null],
      ["証", "コースの修了証", "コースを修了したら、名前入りの修了証", "#zukan", null, "cert", `${COURSES.filter((c) => courseOf(c).every((s) => cleared(s.id))).length}/${COURSES.length}`, null]
    ]],
    ["くらしで使う", [
      ["時", "だましが届く時間", "24時間の時計で、手口が届く時間を見る", "#help", null, "clock24", "", null],
      ["止", "立ち止まりフローチャート", "6つの質問で、いま止まるべきかを点検", "#help", null, "flow", "", null],
      ["点", "メッセージをチェック", "届いたメッセージを貼って、サインに色をつける", "#help", null, "checker", "", null],
      ["相", "188に相談する練習", "相談員の質問に答えて、相談メモを作る", "#home", null, null, "", "call"],
      ["待", "守りの待ち受け", "ロック画面に置く、守りのひとことの壁紙", "#help", null, "wallpaper", "", null],
      ["約", "守りの約束カード", "家族で決めた約束を、カードにして残す", "#help", null, "pledge", "", null],
      ["授", "授業で使う", "ワークシートや、発表用の画面", "#teach", null, null, "", null]
    ]]
  ];
  return `<section class="sec modes" aria-label="あそびかたマップ"><div class="sec-h"><h2>あそびかたマップ</h2><p>体験する・見抜く・ふりかえる・くらしで使う。気になるところから、どうぞ。</p></div>
    <div class="md-groups">${G.map(([gn, items], gi) => `<div class="md-group" style="--mi:${gi}"><span class="md-gh">${esc(gn)}</span><div class="md-tiles">${items.map(([ic, n, d, href, mode, go, badge, local]) =>
      `<a class="md-tile" href="${href}"${mode ? ` data-mode="${mode}"` : ""}${go ? ` data-goto="${go}"` : ""}${local ? ` data-local="${local}"` : ""}><span class="md-ic" aria-hidden="true">${ic}</span><span class="md-tx"><b>${esc(n)}</b><small>${esc(d)}</small></span>${badge ? `<i class="md-badge">${badge}</i>` : ""}</a>`).join("")}</div></div>`).join("")}</div></section>`;
}
function bindModes() {
  document.querySelectorAll(".md-tile").forEach((a) => (a.onclick = (e) => {
    if (a.dataset.local === "call") { e.preventDefault(); openCall(callPick(), "partial"); return; }
    if (a.dataset.local) { e.preventDefault(); const t = $(a.dataset.local) || $("lib"); if (t) t.scrollIntoView({ block: "start" }); return; }
    if (a.dataset.mode) window.__mode = a.dataset.mode;
    if (a.dataset.goto) window.__goto = a.dataset.goto;
  }));
}
/* ===== コースの修了証：コースを全部体験したら、名前を入れて保存・印刷できる ===== */
function courseStat(c) {
  const list = courseOf(c);
  let met = 0, caught = 0;
  list.forEach((s) => Object.values((progress[s.id] || {}).signs || {}).forEach((v) => { met++; if (v === "caught") caught++; }));
  return { list, done: list.filter((s) => cleared(s.id)).length, met, caught };
}
function certHTML() {
  const rows = COURSES.map((c) => Object.assign({ c }, courseStat(c)));
  const got = rows.filter((r) => r.done === r.list.length).length;
  return `<section class="sec cert-sec" id="cert" aria-label="コースの修了証"><div class="sec-h"><h2>コースの修了証　${got} / ${rows.length}</h2><p>学びのコースの話を全部体験すると、修了証をつくれます。名前を入れて、保存や印刷ができます。</p></div>
    <div class="ce-list">${rows.map((r) => { const ok = r.done === r.list.length, left = r.list.length - r.done;
      return `<div class="ce-item${ok ? " ok" : ""}"><span class="ce-seal" aria-hidden="true">${ok ? "修" : `${Math.round(r.done / r.list.length * 100)}<small>%</small>`}</span>
        <div class="ce-t"><b>${esc(r.c.n)}</b><span>${ok ? `修了｜気づけたサイン ${r.caught} / ${r.met}` : `あと ${left} 本で修了`}</span></div>
        ${ok ? `<button class="btn small primary" type="button" data-cert="${r.c.id}">修了証をつくる</button>` : `<a class="btn small" href="#${(r.list.find((s) => !cleared(s.id)) || r.list[0]).id}" data-course="${r.c.id}">つづける</a>`}</div>`; }).join("")}</div></section>`;
}
function drawCourseCert(cv, c, name) {
  const x = cv.getContext("2d"), W = cv.width, H = cv.height, st = courseStat(c);
  const NAVY = "#14243A", GOLD = "#B08A2E", GOLD2 = "#C9A227", PAPER = "#FBF8F1", INK = "#1B2534", F = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif', M = '"Shippori Mincho", "Yu Mincho", serif';
  x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
  /* ふちどり：紺の太枠＋金の細線＋四すみの飾り */
  x.fillStyle = NAVY; x.fillRect(0, 0, W, 34); x.fillRect(0, H - 34, W, 34); x.fillRect(0, 0, 34, H); x.fillRect(W - 34, 0, 34, H);
  x.strokeStyle = GOLD2; x.lineWidth = 3; x.strokeRect(54, 54, W - 108, H - 108);
  x.lineWidth = 1; x.strokeRect(66, 66, W - 132, H - 132);
  [[66, 66], [W - 66, 66], [66, H - 66], [W - 66, H - 66]].forEach(([cx, cy]) => { x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillStyle = GOLD2; x.fillRect(-11, -11, 22, 22); x.fillStyle = PAPER; x.fillRect(-5, -5, 10, 10); x.restore(); });
  x.textAlign = "center"; x.textBaseline = "alphabetic";
  x.fillStyle = GOLD; x.font = `700 24px ${F}`; x.fillText("C E R T I F I C A T E   O F   C O M P L E T I O N", W / 2, 150);
  x.fillStyle = INK; x.font = `800 96px ${M}`; x.fillText("修　了　証", W / 2, 260);
  const nm = (name || "").trim();
  let fz = 60; x.font = `700 ${fz}px ${M}`;
  const nt = nm ? `${nm}　さん` : "　　　　　　　　　さん";
  while (x.measureText(nt).width > W - 520 && fz > 34) { fz -= 4; x.font = `700 ${fz}px ${M}`; }
  x.fillText(nt, W / 2, 372);
  x.strokeStyle = INK; x.lineWidth = 1.5; x.beginPath(); x.moveTo(W / 2 - 330, 394); x.lineTo(W / 2 + 330, 394); x.stroke();
  x.font = `500 31px ${M}`; x.fillStyle = INK;
  const body = `あなたは「だまされ体験ラボ」の学びのコース「${c.n}」の${st.list.length}本の話をすべて体験し、だましのサインに気づき、断り、相談する力を身につけました。その努力をたたえ、ここに証します。`;
  let line = "", y = 470; const lw = W - 440;
  for (const ch of body) { if (x.measureText(line + ch).width > lw) { x.fillText(line, W / 2, y); line = ch; y += 52; } else line += ch; }
  if (line) x.fillText(line, W / 2, y);
  /* 体験した話の名前を、小さく並べる（多いときは12本まで） */
  const tags = st.list.slice(0, 12).map((s) => s.tag), more = st.list.length - tags.length;
  const tt = tags.join("・") + (more > 0 ? `　ほか${more}本` : "");
  y += 74; x.fillStyle = GOLD; x.font = `700 22px ${F}`; x.fillText("— 体験した話 —", W / 2, y);
  x.fillStyle = "#5B6777"; x.font = `500 23px ${F}`; line = ""; y += 42;
  for (const ch of tt) { if (x.measureText(line + ch).width > W - 480) { x.fillText(line, W / 2, y); line = ch; y += 36; if (y > H - 250) break; } else line += ch; }
  if (line && y <= H - 250) x.fillText(line, W / 2, y);
  /* 下の段：日付と記録・印 */
  const d = new Date();
  x.textAlign = "left"; x.fillStyle = GOLD; x.font = `700 22px ${F}`; x.fillText("修了日", 150, H - 190); x.fillText("気づけたサイン", 150, H - 128);
  x.fillStyle = INK; x.font = `700 32px ${F}`; x.fillText(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`, 300, H - 188); x.fillText(`${st.caught} / ${st.met}`, 330, H - 126);
  const sx = W - 230, sy = H - 190;
  x.fillStyle = "rgba(206,58,46,.9)"; x.beginPath(); x.arc(sx, sy, 78, 0, Math.PI * 2); x.fill();
  x.strokeStyle = PAPER; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, 66, 0, Math.PI * 2); x.stroke();
  x.fillStyle = PAPER; x.textAlign = "center"; x.font = `800 40px ${M}`; x.fillText("見抜", sx, sy - 4); x.fillText("修了", sx, sy + 42);
  x.fillStyle = "#5B6777"; x.font = `500 20px ${F}`; x.fillText("だまされ体験ラボ　｜　困ったときは 消費者ホットライン 188・警察相談 #9110", W / 2, H - 82);
}
function openCert(id) {
  const c = COURSES.find((k) => k.id === id); if (!c) return;
  let m = $("ceModal");
  if (!m) { m = document.createElement("div"); m.className = "modal ce-modal"; m.id = "ceModal"; m.innerHTML = `<div class="sheet ce-sheet" role="dialog" aria-modal="true" aria-labelledby="ceTitle" id="ceSheet"></div>`; document.body.appendChild(m); m.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCert(); }); m.addEventListener("click", (e) => { if (e.target === m) closeCert(); }); }
  const back = document.activeElement;
  $("ceSheet").innerHTML = `<div class="tape"></div><div class="in"><div class="ce-head"><h2 id="ceTitle">修了証｜${esc(c.n)}</h2><button class="c8-x ce-x" type="button" id="ceClose" aria-label="閉じる">×</button></div>
    <canvas id="ceCv" width="1600" height="1130" aria-label="修了証のプレビュー：${esc(c.n)}"></canvas>
    <label class="pl-field"><span>名前（入れなくてもOK。この端末の中だけに保存されます）</span><input id="ceName" type="text" maxlength="14" value="${esc(store.get("dl3-certname", "") || "")}" placeholder="例：みぬけ たろう"></label>
    <div class="sharebtns"><button class="btn small primary" type="button" id="ceSave">画像を保存</button><button class="btn small" type="button" id="cePrint">印刷する</button></div></div>`;
  m.hidden = false;
  const draw = () => drawCourseCert($("ceCv"), c, $("ceName").value);
  $("ceName").oninput = () => { store.set("dl3-certname", $("ceName").value.trim()); draw(); };
  const done = () => { store.set("dl3-cert", true); setTimeout(checkAch, 800); };
  $("ceSave").onclick = () => { done(); const a = document.createElement("a"); a.href = $("ceCv").toDataURL("image/png"); a.download = `shuryosho-${c.id}.png`; a.click(); };
  $("cePrint").onclick = () => { done();
    const url = $("ceCv").toDataURL("image/png"), ps = $("printSheet") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "printSheet" }));
    ps.innerHTML = `<img src="${url}" alt="修了証" style="width:100%;max-width:270mm;display:block;margin:0 auto">`;
    window.print();
  };
  $("ceClose").onclick = closeCert;
  m._back = back;
  draw(); (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { if (!m.hidden) draw(); });
  $("ceClose").focus({ preventScroll: true });
}
function closeCert() { const m = $("ceModal"); if (!m) return; m.hidden = true; if (m._back && document.body.contains(m._back)) m._back.focus({ preventScroll: true }); }
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-cert]"); if (!b) return; e.preventDefault(); openCert(b.dataset.cert); });
/* ===== 188に相談する練習：相談員の質問に答えて、伝わる話し方と「相談メモ」を身につける ===== */
let CL = null;
function callSteps(sc, end) {
  const d = DEBRIEF[sc.id] || {}, f = firstMsg(sc);
  const who = f.name ? `「${f.name.replace(/（？）$/, "")}」と名のる相手` : "知らない相手";
  const flow = (d.flow || []).slice(0, 3).map((x) => x.replace(/^「|」$/g, ""));
  const paid = end !== "safe";
  return [
    { q: "はい、消費生活センターです。どうされましたか？", o: [
      [`「${sc.tag}」のことで相談です。${who}から連絡がありました`, 1, "最初に、何の話かをひとことで。それだけで、相談員は話の地図を思いえがけます。"],
      ["あの……だまされたかもしれなくて……", 0, "だいじょうぶ。最初に「何の話か」をひとこと言えると、もっと早く伝わります。"],
      ["やっぱりいいです。たいしたことじゃないので", 0, "小さなことでも、相談していいんです。被害の前に相談する人も、たくさんいます。"]
    ], r: ["わかりました。順番にうかがいますね", "ゆっくりでだいじょうぶですよ。どんなことがあったか、順番に聞かせてください", "切らないでくださいね。小さなことでも、早めの相談が大事なんです"] },
    { q: "いつごろ、どこで、どんな相手から連絡がありましたか？", o: [
      [`${sc.clock}ごろ、${f.app}で、${who}からです`, 1, "日時・場所（アプリ）・相手の名前。この3つがあると、同じ手口の情報と照らし合わせられます。"],
      ["最近だったと思うんですけど……よく覚えていません", 0, "日時は、スクリーンショットや着信の記録で確かめられます。メモしておくと安心です。"],
      ["相手のことは、言わないほうがいいですよね？", 0, "相手の名前やアカウント、電話番号は、大事な手がかり。かくさずに伝えましょう。"]
    ], r: ["ありがとうございます。とてもわかりやすいです", "記録が残っていたら、あとで確かめてみてくださいね", "相手の情報は、だいじな手がかりになるんです。わかる範囲で教えてください"] },
    { q: "どんなことを言われて、どうなりましたか？", o: [
      [flow.length ? `最初は「${flow[0]}」。そのあと「${flow[1] || flow[0]}」と言われました` : "言われたことを、順番にメモしてあります", 1, "言われた言葉を、そのまま順番に。相談員は、その言葉から手口を見分けます。"],
      ["とにかく、ひどいことを言われて……", 0, "気持ちも大事ですが、言われた言葉をそのまま伝えると、手口がはっきりします。"],
      ["わたしがバカだったんです……", 0, "悪いのは、だます側です。自分を責めなくてだいじょうぶ。"]
    ], r: ["よくある手口と、とても似ていますね", "どんな言葉だったか、思い出せるものだけでも教えてください", "あなたは悪くありませんよ。話してくれて、ありがとうございます"] },
    { q: paid ? "お金を払ったり、個人情報を伝えたりしましたか？" : "お金を払ったり、個人情報を伝えたりはしていませんか？", o: paid ? [
      ["払いました。金額と日付、払い方（振込・電子マネー・カード）をメモしてあります", 1, "払い方がわかると、止められるお金や、取れる手が決まります。"],
      ["いくら払ったか、覚えていません", 0, "通帳やカードの明細、アプリの履歴で確かめられます。金額と日付をメモしておこう。"],
      ["お金のことは、家族に知られたくなくて……", 0, "早く家族に話すほど、取れる手が増えます。相談員がいっしょに考えてくれます。"]
    ] : [
      ["払っていません。名前や住所も伝えていません", 1, "何をしていないかを言えるのも、大事な情報です。"],
      ["たぶん、だいじょうぶだと思います……", 0, "あいまいなときは、送ったメッセージや入力した画面を見返してから伝えよう。"],
      ["それより、相手を捕まえてほしいんです", 0, "気持ちはわかります。まずは、あなたの被害を確かめることから始めます。"]
    ], r: paid ? ["わかりました。払い方によっては、まだ止められることがあります", "明細で確かめてみましょう。金額と日付がわかると、進めやすくなります", "家族に話すかどうかも、いっしょに考えましょう"] : ["よかったです。被害の前に相談できたのは、とても大事なことです", "送ったものがないか、いっしょに確かめましょう", "まずは、あなたが安全かどうかを確かめますね"] },
    { q: "やりとりの記録は残っていますか？", o: [
      ["スクリーンショットと、相手のアカウントや電話番号を保存しています", 1, "記録は、相談や警察への届け出で、いちばんの助けになります。"],
      ["はずかしいので、全部消してしまいました", 0, "消す前に、スクリーンショットを。ブロックや削除は、保存してからにしよう。"],
      ["相手をブロックして、トークごと消しました", 0, "ブロックはいい判断。でも、その前に画面を保存しておくと、あとで役に立ちます。"]
    ], r: ["完ぺきです。その記録を手元に置いておいてください", "消してしまったものは、思い出せる範囲でメモにしておきましょう", "ブロックはいい判断です。残っている通知や履歴があれば、保存しておいてください"] }
  ];
}
function callHTML() {
  const sc = CL.sc, st = CL.steps;
  const bubbles = CL.log.map((m) => `<div class="c8-row ${m.me ? "me" : ""}${m.tip ? " tip" : ""}">${m.tip ? `<span class="c8-tip"><b>${m.good ? "伝わる！" : "ヒント"}</b>${esc(m.t)}</span>` : `<span class="c8-b">${esc(m.t)}</span>`}</div>`).join("");
  const step = st[CL.i];
  const body = CL.i < st.length
    ? `<div class="c8-opts" role="group" aria-label="答えをえらぶ">${CL.order.map((k) => `<button class="choice c8-o" type="button" id="c8o-${k}" data-k="${k}"${CL.wait ? " disabled" : ""}><span>${esc(step.o[k][0])}</span></button>`).join("")}</div>`
    : memoHTML();
  return `<div class="c8-top"><span class="c8-num">188</span><div><b>消費者ホットライン</b><small>相談の練習｜${esc(sc.tag)}</small></div>
      <span class="c8-time" aria-hidden="true">${CL.i < st.length ? `${CL.i + 1} / ${st.length}` : "終了"}</span>
      <button class="c8-x" type="button" id="c8Close" aria-label="相談の練習を閉じる">×</button></div>
    <div class="c8-steps" aria-hidden="true">${st.map((_, k) => `<i class="${k < CL.i ? "done" : k === CL.i ? "now" : ""}"></i>`).join("")}</div>
    <div class="c8-log" id="c8Log" aria-live="polite">${bubbles}${CL.wait ? `<div class="c8-row"><span class="c8-b c8-dots" aria-label="相談員が話しています"><i></i><i></i><i></i></span></div>` : ""}</div>
    <div class="c8-foot">${body}</div>`;
}
function memoText() {
  const sc = CL.sc, d = DEBRIEF[sc.id] || {}, f = firstMsg(sc), paid = CL.end !== "safe";
  const day = new Date(), ds = `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日`;
  return [
    ["相談した日", ds],
    ["何の話", `${sc.tag}（${sc.title.replace(/^「|」$/g, "")}）`],
    ["いつ・どこで", `${sc.clock}ごろ／${f.app}`],
    ["相手", f.name ? `${f.name.replace(/（？）$/, "")}と名のる相手` : "わからない"],
    ["言われたこと", (d.flow || []).join(" → ")],
    ["お金・個人情報", paid ? "払った金額・日付・払い方：＿＿＿＿＿＿" : "払っていない・伝えていない"],
    ["残した記録", "スクリーンショット・相手のアカウント・電話番号"],
    ["次にすること", (d.after || ["家族に話す"]).join("／")]
  ];
}
function memoHTML() {
  const stars = CL.score, n = CL.steps.length;
  return `<div class="c8-memo"><div class="c8-mh"><span class="eyebrow">相談メモ</span><b>伝わりやすさ <span class="c8-stars" aria-label="${n}点中${stars}点">${"★".repeat(stars)}<i>${"★".repeat(n - stars)}</i></span></b></div>
    <dl>${memoText().map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <p class="c8-note">本当に困ったときは、<b>188</b>（いやや）に電話すると、近くの消費生活センターにつながります。このメモを見ながら話すと、落ち着いて伝えられます。</p>
    <div class="sharebtns"><button class="btn small primary" type="button" id="c8Copy">メモをコピー</button><button class="btn small" type="button" id="c8Again">もう一度練習する</button><button class="btn small" type="button" id="c8Done">閉じる</button></div></div>`;
}
function renderCall() {
  const el = $("c8Sheet"); if (!el) return;
  el.innerHTML = callHTML();
  const lg = $("c8Log"); lg.scrollTop = lg.scrollHeight;
  $("c8Close").onclick = closeCall;
  el.querySelectorAll(".c8-o").forEach((b) => (b.onclick = () => answerCall(+b.dataset.k)));
  if ($("c8Copy")) {
    $("c8Copy").onclick = async () => { const t = memoText().map(([k, v]) => `${k}：${v}`).join("\n"); try { await navigator.clipboard.writeText(t); toast("相談メモをコピーしました"); } catch (e) { toast("コピーできませんでした"); } };
    $("c8Again").onclick = () => openCall(CL.sc, CL.end);
    $("c8Done").onclick = closeCall;
  }
}
function sayCall(t, after) { CL.wait = true; renderCall(); setTimeout(() => { if (!CL) return; CL.wait = false; CL.log.push({ t }); speak(t, 210); if (after) after(); renderCall(); }, reduced ? 120 : 700); }
function answerCall(k) {
  if (!CL || CL.wait) return;
  const step = CL.steps[CL.i], [t, good, tip] = step.o[k];
  CL.log.push({ t, me: true }, { t: tip, tip: true, good: !!good });
  if (good) CL.score++;
  CL.i++;
  CL.order = shuffle([0, 1, 2]);
  const next = CL.steps[CL.i];
  sayCall(step.r[k], () => {
    if (next) CL.log.push({ t: next.q });
    else {
      const d = DEBRIEF[CL.sc.id] || {};
      CL.log.push({ t: `お話、よくわかりました。まずは「${(d.after || ["家族に話す"])[0]}」から始めましょう。今日の内容を、メモにまとめておきますね` });
      store.set("dl3-call", (store.get("dl3-call", 0) || 0) + 1);
      checkAch();
    }
  });
}
function openCall(sc, end) {
  if (!sc) return;
  const steps = callSteps(sc, end || "partial");
  CL = { sc, end: end || "partial", steps, i: 0, score: 0, log: [], wait: false, order: shuffle([0, 1, 2]), back: document.activeElement };
  let m = $("c8");
  if (!m) { m = document.createElement("div"); m.className = "modal c8-modal"; m.id = "c8"; m.innerHTML = `<div class="sheet c8" role="dialog" aria-modal="true" aria-label="188に相談する練習" id="c8Sheet"></div>`; document.body.appendChild(m); m.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCall(); }); }
  m.hidden = false;
  CL.log.push({ t: "（プルルル……）" });
  renderCall();
  sayCall(steps[0].q, () => {});
  setTimeout(() => { const x = $("c8Close"); if (x) x.focus({ preventScroll: true }); }, 0);
}
function closeCall() {
  const m = $("c8"); if (m) m.hidden = true;
  const b = CL && CL.back; CL = null;
  if (b && b.focus && document.body.contains(b)) b.focus({ preventScroll: true });
}
function callPick() {
  const last = byId(store.get("dl3-last", null));
  if (last && DEBRIEF[last.id]) return last;
  const all = SCENARIOS.filter((s) => DEBRIEF[s.id] && !s.gen), done = all.filter((s) => cleared(s.id));
  const pool = done.length ? done : all;
  return pool[Math.floor(Math.random() * pool.length)];
}
/* ===== あとで体験リスト：気になる話に★をつけて、とっておく（この端末の中だけ） ===== */
const bmGet = () => (store.get("dl3-bm", []) || []).filter((id) => byId(id));
const bmStar = (id) => { const on = bmGet().includes(id); return `<span class="bm${on ? " on" : ""}" role="button" tabindex="0" data-bm="${id}" aria-pressed="${on}" aria-label="${on ? "あとで体験リストから外す" : "あとで体験リストに入れる"}" title="${on ? "あとで体験リストから外す" : "あとで体験"}">★</span>`; };
function bmToggle(id) {
  let b = bmGet(); const on = b.includes(id);
  b = on ? b.filter((x) => x !== id) : [id, ...b].slice(0, 60);
  store.set("dl3-bm", b);
  document.querySelectorAll(`[data-bm="${id}"]`).forEach((el) => { el.classList.toggle("on", !on); el.setAttribute("aria-pressed", String(!on)); el.setAttribute("aria-label", !on ? "あとで体験リストから外す" : "あとで体験リストに入れる"); });
  toast(on ? "あとで体験リストから外しました" : "あとで体験リストに入れました");
  const sec = $("bmSec"); if (sec) { const t = document.createElement("div"); t.innerHTML = bmHTML() || `<section id="bmSec" hidden></section>`; sec.replaceWith(t.firstElementChild); }
  const fb = $("fBm"); if (fb) fb.querySelector("small").textContent = bmGet().length;
}
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-bm]"); if (!b) return; e.preventDefault(); e.stopPropagation(); bmToggle(b.dataset.bm); }, true);
document.addEventListener("keydown", (e) => { const b = e.target.closest && e.target.closest("[data-bm]"); if (!b || (e.key !== "Enter" && e.key !== " ")) return; e.preventDefault(); e.stopPropagation(); bmToggle(b.dataset.bm); }, true);
function bmHTML() {
  const list = bmGet().map(byId).filter(Boolean);
  if (!list.length) return "";
  return `<section class="sec bm-shelf" id="bmSec" aria-label="あとで体験する"><div class="sec-h"><h2><span class="bm-ic" aria-hidden="true">★</span>あとで体験する　${list.length}本</h2><p>★をつけた話です。もう一度★を押すと外せます。</p></div>
    <div class="shelf-scroll">${list.map(scenarioCard).join("")}</div></section>`;
}
function renderHome() {
  const t = totals();
  const rate = t.met ? Math.round((t.caught / t.met) * 100) : null;
  const next = nextUnplayed();
  const lastId = store.get("dl3-last", null);
  const last = lastId && byId(lastId);
  const contHTML = t.gotEnds
    ? `<div class="cont">${mascot("md")}<div class="t"><b>${t.cleared === SCENARIOS.length ? "全シナリオ クリア！ 残りの結末も探してみよう" : `${t.cleared} / ${SCENARIOS.length} シナリオ クリア`}</b>
       <span>${streak() >= 2 ? `<b class="streak">${streak()}日つづけて体験中</b>　` : ""}${next ? `次のおすすめ：${esc(next.title)}` : "サイン図鑑で、見逃したサインを見直そう"}</span></div>
       ${last ? `<a class="btn small" href="#${last.id}">もう一度：${esc(last.tag)}</a>` : ""}
       ${next ? `<a class="btn small primary" href="#${next.id}">つづきから</a>` : `<a class="btn small primary" href="#zukan">図鑑を見る</a>`}</div>`
    : "";

  $("v-home").innerHTML = `
  ${dashHTML(t)}
  <div class="hero bleed b-hero${t.gotEnds ? " hero-back" : ""}">
    <div>
      <div class="eyebrow">中高生・大学生のための消費者教育教材</div>
      <h1>だまされる前に、<br><em>気づく練習を。</em></h1>
      <p class="lead">SNSや電話で実際に起きている詐欺・消費者トラブルを、選択式のストーリーで体験できる学習サイトです。手口ではなく「おかしいと気づくサイン」を、${SCENARIOS.length}の場面で身につけます。</p>
      <div class="ctas">
        <a class="btn primary" href="#${(next || SCENARIOS[0]).id}" id="ctaStart">まずは体験してみる <small>約5分</small></a>
        <a class="btn" href="#quizSec" id="ctaQuiz">自分に近い話を診断</a>
      </div>
      <ul class="trust" aria-label="このサイトについて"><li>登録不要・無料</li><li>個人情報を集めません</li><li>広告なし</li><li>記録はこの端末の中だけ</li></ul>
      ${todayChHTML()}
      <a class="newpill" href="#help" id="newCheck"><b>NEW</b>届いたメッセージを貼りつけて、サインをチェックできるようになりました</a>
      <div class="hero-org">${orgBadge()}</div>
    </div>
    ${demoHTML()}
  </div>
  ${tapeRun()}
  ${seasonHTML()}
  <div class="stats">
    <div class="stat"><b>${SCENARIOS.length}</b><span>シナリオ</span></div>
    <div class="stat"><b>${t.signs}</b><span>気づくサイン</span></div>
    <div class="stat"><b>${t.gotEnds}<small style="font-size:.6em"> / ${t.ends}</small></b><span>回収した結末</span></div>
    <div class="stat"><b>${rate === null ? "—" : rate + "%"}</b><span>あなたの見抜き率</span></div>
  </div>
  <section class="ways" aria-label="3つの学び方">
    <a class="way" href="#${(next || SCENARIOS[0]).id}"><span class="way-n">1</span><b>体験する</b><span>スマホに届くメッセージに返信して、${SCENARIOS.length}のストーリーを進めます。選ぶたびに、かくれていたサインを解説。</span><i>シナリオをはじめる →</i></a>
    <a class="way" href="#challenge"><span class="way-n">2</span><b>見抜く</b><span>「あやしい？ だいじょうぶ？」を判定するチャレンジ。日替わり・エンドレス・見くらべ・ことばで返すの4つの遊び方で、何度でも。</span><i>チャレンジする →</i></a>
    <a class="way" href="#zukan"><span class="way-n">3</span><b>集める</b><span>出会ったサインは図鑑に。見抜きレベルと称号が上がり、苦手な系統もわかります。</span><i>図鑑を見る →</i></a>
  </section>
  ${modesHTML()}
  ${contHTML}
  ${mixHTML()}
  ${coursesHTML()}
  ${todaySignHTML()}
  ${weakHTML()}

  <section class="sec bleed b-sun" id="quizSec" aria-label="タイプ診断">
    <div class="quiz">
      <div class="quiz-side">
        <div class="eyebrow" style="color:inherit">YES / NO 診断</div>
        <h3>あなたがねらわれやすいのは、どんな話？</h3>
        <p>${QUIZ.length}の質問に答えると、まず体験してほしいシナリオを3つえらびます。答えはこの端末の中だけで使います。</p>
      </div>
      <div class="quiz-main" id="quizMain"></div>
    </div>
  </section>

  <section class="sec" id="sqSec" aria-label="サインあてクイズ">
    <div class="sec-h"><h2>1分でできる、サインあてクイズ</h2><p>物語に出てくるメッセージを見て、かくれているサインの系統を当てよう。全5問。</p></div>
    <div class="sq" id="sq"></div>
  </section>

  ${bmHTML() || `<section id="bmSec" hidden></section>`}
  <section class="sec" id="libSec" aria-label="シナリオ一覧">
    <div class="sec-h"><h2>シナリオをえらぶ</h2><p>どれからでもOK。結末はシナリオごとに3〜8種類。選択を変えると、ちがう結末とサインに出会えます。</p></div>
    <div class="libtools">
      <label class="search"><span class="sr">シナリオを探す</span><input type="search" id="libQ" placeholder="キーワードで探す（例：投資、チケット、電話）" value="${esc(libQ)}"></label>
      <label class="sortsel"><span>並べかえ</span><select id="libSort">${Object.entries(SORTS).map(([k, s]) => `<option value="${k}"${libSort === k ? " selected" : ""}>${s.n}</option>`).join("")}</select></label>
    </div>
    <div class="filters" role="group" aria-label="ジャンルでしぼりこむ" id="filters"></div>
    <div id="lib"></div>
  </section>

  <section class="sec bleed b-ink" aria-label="9つのサイン">
    <div class="sec-h"><h2>だましに共通する、9つのサイン</h2><p>どのシナリオのサインも、この9つのどれかに分けられます。ひとつでも当てはまったら、いったん止まろう。</p></div>
    <div class="cats">${Object.entries(CATS).map(([k, c]) => `<div class="cat"><span class="ic" aria-hidden="true">${c.ic}</span><b>${esc(c.n)}</b><span>${esc(c.d)}</span></div>`).join("")}</div>
    <div style="margin-top:18px"><a class="btn small" href="#zukan">サイン図鑑で集めたサインを見る</a></div>
  </section>`;

  renderFilters(); renderLib(); bindLibTools(); renderQuiz(); renderSQ(); runDemo(); bindCourses($("v-home")); bindModes();
  $("ctaQuiz").onclick = (e) => { e.preventDefault(); $("quizSec").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); };
  $("newCheck").onclick = () => { window.__gotoChecker = true; };
}
/* サインあてクイズ：各シナリオの「サインつきの選択」の直前に出るメッセージを問題にする */
let SQ = null;
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function sqPool() {
  const pool = [];
  SCENARIOS.forEach((sc) => Object.entries(sc.nodes).forEach(([k, n]) => {
    if (n.end || !n.choices) return;
    const c = n.choices.find((x) => x.sign && sc.signs[x.sign]);
    if (!c) return;
    const lines = n.log.filter((l) => l[0] === "them" || l[0] === "card");
    if (!lines.length) return;
    const last = lines[lines.length - 1];
    const text = last[0] === "card" ? `${last[1]}：${last[2].join("／")}` : last[1];
    const who = last[0] === "card" ? last[1] : (sc.cast[last[2] || (n.scene && n.scene.who) || ""] || {}).n || "";
    pool.push({ sc, text, who, sign: sc.signs[c.sign] });
  }));
  return pool;
}
function newSQ() {
  const pool = shuffle(sqPool());
  const picked = [], usedCat = new Set();
  for (const p of pool) { if (picked.length >= 5) break; if (!usedCat.has(p.sign.cat)) { picked.push(p); usedCat.add(p.sign.cat); } }
  for (const p of pool) { if (picked.length >= 5) break; if (!picked.includes(p)) picked.push(p); }
  const cats = Object.keys(CATS);
  SQ = { items: picked.map((p) => ({ ...p, opts: shuffle([p.sign.cat, ...shuffle(cats.filter((c) => c !== p.sign.cat)).slice(0, 2)]) })), i: 0, score: 0, picked: null };
}
function renderSQ() {
  const el = $("sq"); if (!el) return;
  if (!SQ) newSQ();
  if (SQ.i >= SQ.items.length) {
    const best = Math.max(prefs.sqBest || 0, SQ.score);
    if (best !== prefs.sqBest) { prefs.sqBest = best; savePrefs(); setTimeout(checkAch, 400); }
    const msg = SQ.score === 5 ? "全問正解！ サインの系統が身についています。" : SQ.score >= 3 ? "いい感じ。まちがえた系統は、図鑑で見直そう。" : "サインの系統は、ホームの「9つのサイン」で確認できます。";
    el.innerHTML = `<div class="sq-end">${mascot("md")}<div><span class="eyebrow">結果</span><b>${SQ.score} / ${SQ.items.length} 問正解</b><p>${msg}（これまでのベスト：${best}問）</p></div>
      <button class="btn small primary" type="button" id="sqAgain">もう一度（問題が変わります）</button></div>`;
    $("sqAgain").onclick = () => { newSQ(); renderSQ(); };
    return;
  }
  const it = SQ.items[SQ.i];
  const g = GENRES[it.sc.genre];
  const answered = SQ.picked !== null;
  el.innerHTML = `<div class="sq-top"><span class="qnum">Q${SQ.i + 1} / ${SQ.items.length}</span><span class="gtag" style="--gh:${g.h}">${esc(it.sc.tag)}</span></div>
    <div class="sq-msg"><span class="sq-who">${esc(it.who)}</span><p>${esc(it.text)}</p></div>
    <p class="sq-q">このメッセージに、いちばん強く出ているサインは？</p>
    <div class="sq-opts">${it.opts.map((c) => {
      const cls = answered ? (c === it.sign.cat ? "right" : c === SQ.picked ? "wrong" : "dim") : "";
      return `<button class="sq-opt ${cls}" type="button" data-c="${c}" id="sq-${c}" ${answered ? "disabled" : ""}><span class="ic" aria-hidden="true">${CATS[c].ic}</span><span>${esc(CATS[c].n)}</span></button>`;
    }).join("")}</div>
    ${answered ? `<div class="sq-ans ${SQ.picked === it.sign.cat ? "ok" : "ng"}"><b>${SQ.picked === it.sign.cat ? "正解！" : "おしい！ 正解は「" + esc(CATS[it.sign.cat].n) + "」"}</b>
      <span>${esc(it.sign.t)}</span><p>${esc(it.sign.d)}</p>
      <div class="row-btns"><button class="btn small primary" type="button" id="sqNext">${SQ.i + 1 < SQ.items.length ? "次の問題" : "結果を見る"}</button><a class="btn small" href="#${it.sc.id}">この話を体験する</a></div></div>` : ""}`;
  el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { SQ.picked = b.dataset.c; if (SQ.picked === it.sign.cat) { SQ.score++; addXP(5); } renderSQ(); const n = $("sqNext"); if (n) n.focus({ preventScroll: true }); }));
  if ($("sqNext")) $("sqNext").onclick = () => { SQ.i++; SQ.picked = null; renderSQ(); };
}

/* 今日のサイン：日付で1つ選ぶ。だれが開いても同じ日は同じサイン */
function todaySignHTML() {
  const all = [];
  SCENARIOS.forEach((sc) => Object.entries(sc.signs).forEach(([k, sg]) => all.push({ sc, k, sg })));
  if (!all.length) return "";
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const x = all[(day * 7919) % all.length];
  const cat = CATS[x.sg.cat];
  return `<div class="today"><div class="today-tag"><span class="eyebrow">今日のサイン</span><span class="today-date">${d.getMonth() + 1}月${d.getDate()}日</span></div>
    <div class="today-body"><span class="ic" aria-hidden="true">${cat ? cat.ic : "!"}</span><div><b>${esc(x.sg.t)}</b><p>${esc(x.sg.d)}</p>
    <a class="btn small" href="#${x.sc.id}">このサインが出てくる話：${esc(x.sc.title)}</a></div></div></div>`;
}
/* 場面の種類で探す：メッセージ・電話・対面・ウェブ */
const SCENE_GROUP = { dm: "msg", talk: "msg", call: "call", live: "live", web: "web", home: "web" };
const SCENE_GN = { all: "すべての場面", msg: "メッセージ", call: "電話", live: "対面", web: "ウェブ・アプリ" };
/* あなたの立場で探す：あらすじの「あなたは〇〇」から、立場を読み取る */
const ROLES = { all: "すべての立場", chu: "中学生", kou: "高校生", dai: "大学・専門学校", sha: "社会人", kazoku: "家族を守る" };
const roleOf = (sc) => {
  const t = sc.intro || "";
  if (/おばあ|おじい|祖父|祖母|お年寄り/.test(t)) return "kazoku";
  if (/中学/.test(t)) return "chu";
  if (/高校/.test(t)) return "kou";
  if (/大学|専門学校|大学院/.test(t)) return "dai";
  if (/社会人|会社|\d{2}歳|主婦|子育て|新入社員|働いて/.test(t)) return "sha";
  return "all";
};
let libRole = "all", libBm = false;
let libScene = "all", libNew = false;
const libList = () => {
  const q = libQ.trim().toLowerCase();
  let list = SCENARIOS.filter((s) => filter === "all" || s.genre === filter);
  if (libScene !== "all") list = list.filter((s) => SCENE_GROUP[firstMsg(s).type] === libScene);
  if (libNew) list = list.filter((s) => !played(s));
  if (libBm) { const b = bmGet(); list = list.filter((s) => b.includes(s.id)); }
  if (libRole !== "all") list = list.filter((s) => roleOf(s) === libRole);
  if (q) list = list.filter((s) => [s.title, s.sub, s.tag, s.intro, GENRES[s.genre].n, ...Object.values(s.signs).map((x) => x.t)].join(" ").toLowerCase().includes(q));
  return list;
};
function renderFilters() {
  const opts = [["all", "すべて"], ...Object.entries(GENRES).map(([k, g]) => [k, g.n])];
  $("filters").innerHTML = `<div class="frow">${opts.map(([k, n]) => `<button class="chipbtn" type="button" id="f-${k}" data-f="${k}" aria-pressed="${filter === k}">${esc(n)}</button>`).join("")}</div>
    <div class="frow frow2"><button class="chipbtn sm dice" type="button" id="fRand"><span aria-hidden="true">🎲</span> ランダムに1本</button>
      <button class="chipbtn sm" type="button" id="fNew" aria-pressed="${libNew}">未体験だけ</button>
      <button class="chipbtn sm bm-chip" type="button" id="fBm" aria-pressed="${libBm}"><span aria-hidden="true">★</span> あとで体験<small>${bmGet().length}</small></button>
      <span class="frow-sep" aria-hidden="true"></span>
      <span class="frow-h">場面</span>${Object.entries(SCENE_GN).map(([k, n]) => `<button class="chipbtn sm" type="button" id="fs-${k}" data-s="${k}" aria-pressed="${libScene === k}">${k !== "all" ? `<span class="nt-ic" aria-hidden="true">${SCENE_ICON[{ msg: "dm", call: "call", live: "live", web: "web" }[k]]}</span>` : ""}${esc(n)}</button>`).join("")}</div>
    <div class="frow frow-role"><span class="frow-h">立場</span>${Object.entries(ROLES).map(([k, n]) => `<button class="chipbtn sm role-${k}" type="button" data-r="${k}" aria-pressed="${libRole === k}">${esc(n)}<small>${k === "all" ? SCENARIOS.length : SCENARIOS.filter((s) => roleOf(s) === k).length}</small></button>`).join("")}</div>`;
  $("filters").querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; renderFilters(); renderLib(); }));
  $("filters").querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { libScene = b.dataset.s; renderFilters(); renderLib(); }));
  $("filters").querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { libRole = b.dataset.r; renderFilters(); renderLib(); }));
  $("fNew").onclick = () => { libNew = !libNew; renderFilters(); renderLib(); };
  $("fBm").onclick = () => { libBm = !libBm; renderFilters(); renderLib(); };
  $("fRand").onclick = () => {
    const pool = libList().length ? libList() : SCENARIOS;
    const fresh = pool.filter((s) => !played(s));
    const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    location.hash = "#" + pick.id;
  };
}
/* 一覧：検索・並べかえ。「すべて・おすすめ順・検索なし」のときはジャンルごとの棚にする */
let libQ = "", libSort = "rec";
const played = (s) => ((progress[s.id] || {}).ends || []).length > 0;
const SORTS = {
  rec: { n: "おすすめ順", f: null },
  new: { n: "まだ遊んでいない話から", f: (a, b) => played(a) - played(b) },
  short: { n: "短い順", f: (a, b) => a.mins - b.mins },
  easy: { n: "かんたんな順", f: (a, b) => a.level - b.level },
  hard: { n: "むずかしい順", f: (a, b) => b.level - a.level }
};
function renderLib() {
  const q = libQ.trim().toLowerCase();
  let list = libList();
  if (SORTS[libSort].f) list = list.slice().sort(SORTS[libSort].f);
  if (!list.length) {
    $("lib").innerHTML = `<div class="lib-empty">${mascot("md")}<p>${q ? `「${esc(libQ)}」に合う話が見つかりませんでした。別のことばで探してみてね。` : libNew ? "この条件の話は、ぜんぶ体験ずみです。すごい！" : "この条件に合う話はありませんでした。"}</p></div>`;
    return;
  }
  if (filter === "all" && !q && libSort === "rec" && libScene === "all" && !libNew && libRole === "all" && !libBm) {
    $("lib").innerHTML = Object.entries(GENRES).map(([gk, g]) => {
      const items = list.filter((s) => s.genre === gk);
      const done = items.filter(played).length;
      return `<section class="shelf-row" style="--gh:${g.h}" aria-label="${esc(g.n)}">
        <div class="shelf-h"><span class="gtag">${esc(g.n)}</span><b>${items.length}本</b><span class="shelf-p"><i style="width:${Math.round((done / items.length) * 100)}%"></i></span><span>${done}/${items.length} クリア</span>
          <button class="linkbtn" type="button" data-g="${gk}">ぜんぶ見る</button></div>
        <div class="shelf-scroll">${items.map(scenarioCard).join("")}</div></section>`;
    }).join("");
    $("lib").querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { filter = b.dataset.g; renderFilters(); renderLib(); $("filters").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }));
    return;
  }
  $("lib").innerHTML = `<p class="lib-count">${list.length}本</p><div class="lib">${list.map(scenarioCard).join("")}</div>`;
}
function bindLibTools() {
  $("libQ").oninput = (e) => { libQ = e.target.value; renderLib(); };
  $("libSort").onchange = (e) => { libSort = e.target.value; renderLib(); };
}
function renderQuiz() {
  const el = $("quizMain");
  if (quiz.done) {
    const score = {};
    SCENARIOS.forEach((s, i) => (score[s.id] = -i * 0.001));
    let type = null;
    QUIZ.forEach((q, i) => { if (quiz.ans[i]) { q.s.forEach((id, j) => { score[id] = (score[id] || 0) + 1 + (q.s.length - j) * 0.1; }); type ||= q.type; } });
    let recs = Object.keys(score).filter((id) => byId(id)).sort((a, b) => score[b] - score[a]).slice(0, 3);
    if (!quiz.ans.some(Boolean)) { recs = ["phishing", "takeover", "side"].filter(byId); type = "しっかり者タイプ"; }
    el.innerHTML = `<div class="qres">
      <div class="type">${mascot("md")}<div><div class="qnum">あなたは</div><b>${esc(type)}</b></div></div>
      <p>${quiz.ans.some(Boolean) ? "YESと答えた場面は、相手にとっても声をかけやすい場面です。まずはこの3つから体験してみよう。" : "今はねらわれにくそう。でも、通知や友だちのメッセージはだれにでも届きます。この3つはチェックしておこう。"}</p>
      <div class="recs">${recs.map((id) => { const s = byId(id); return `<a class="rec" href="#${s.id}"><small>${esc(s.tag)}・約${s.mins}分</small><b>${esc(s.title)}</b></a>`; }).join("")}</div>
      <button class="qback" type="button" id="qRetry">もう一度診断する</button></div>`;
    $("qRetry").onclick = () => { quiz = { i: 0, ans: [], done: false }; renderQuiz(); };
    return;
  }
  const q = QUIZ[quiz.i];
  el.innerHTML = `<div class="qprog" aria-hidden="true">${QUIZ.map((_, i) => `<i class="${i <= quiz.i ? "on" : ""}"></i>`).join("")}</div>
    <div class="qnum">Q${quiz.i + 1} / ${QUIZ.length}</div>
    <p class="qtext">${esc(q.q)}</p>
    <div class="yn"><button class="btn primary" type="button" id="qYes">YES</button><button class="btn" type="button" id="qNo">NO</button></div>
    ${quiz.i > 0 ? `<button class="qback" type="button" id="qBack">ひとつ前にもどる</button>` : ""}`;
  const ans = (v) => { quiz.ans[quiz.i] = v; if (quiz.i < QUIZ.length - 1) quiz.i++; else quiz.done = true; renderQuiz(); };
  $("qYes").onclick = () => ans(true);
  $("qNo").onclick = () => ans(false);
  if ($("qBack")) $("qBack").onclick = () => { quiz.i--; renderQuiz(); };
}

/* ===== 称号 ===== */
function achievements() {
  const P = (id) => progress[id] || { ends: [], signs: {} };
  const cleared = SCENARIOS.filter((s) => (P(s.id).ends || []).length);
  const allSigns = [];
  SCENARIOS.forEach((sc) => Object.entries(sc.signs).forEach(([k, sg]) => allSigns.push({ cat: sg.cat, st: (P(sc.id).signs || {})[k] })));
  const met = allSigns.filter((x) => x.st).length;
  const caughtCats = new Set(allSigns.filter((x) => x.st === "caught").map((x) => x.cat));
  const perfect = SCENARIOS.filter((s) => P(s.id).perfect).length;
  const badEnds = SCENARIOS.reduce((a, sc) => a + (P(sc.id).ends || []).filter((e) => sc.nodes[e] && sc.nodes[e].end === "bad").length, 0);
  const safeEnd = (id) => (P(id).ends || []).some((e) => byId(id) && byId(id).nodes[e].end === "safe");
  return [
    { id: "first", ic: "一", n: "はじめの一歩", d: "結末を1つ回収する", got: cleared.length >= 1 },
    { id: "five", ic: "五", n: "5つの話を体験", d: "5本のシナリオをクリア", got: cleared.length >= 5 },
    { id: "all", ic: "全", n: "全シナリオ制覇", d: `${SCENARIOS.length}本すべてをクリア`, got: cleared.length === SCENARIOS.length },
    { id: "genre", ic: "門", n: "全ジャンル制覇", d: "すべてのジャンルで1本ずつクリア", got: Object.keys(GENRES).every((g) => cleared.some((s) => s.genre === g)) },
    { id: "perfect", ic: "無", n: "ノーミス見抜き", d: "見逃しゼロで「被害なし」の結末へ", got: perfect >= 1 },
    { id: "perfect5", ic: "達", n: "見抜きの達人", d: "5本のシナリオでノーミス見抜き", got: perfect >= 5 },
    { id: "comp", ic: "完", n: "結末コンプリート", d: "1本のシナリオの結末をすべて回収", got: SCENARIOS.some((s) => (P(s.id).ends || []).length === endIds(s).length) },
    { id: "learn", ic: "学", n: "失敗から学ぶ", d: "「被害にあった」結末を5つ見る", got: badEnds >= 5 },
    { id: "signs", ic: "集", n: "サイン収集家", d: "50個のサインに出会う", got: met >= 50 },
    { id: "cats", ic: "九", n: "9系統マスター", d: "9つの系統すべてで、サインに気づく", got: Object.keys(CATS).every((c) => caughtCats.has(c)) },
    { id: "talk", ic: "話", n: "相談の達人", d: "「相談・被害のあと」のサインに5つ気づく", got: allSigns.filter((x) => x.cat === "soudan" && x.st === "caught").length >= 5 },
    { id: "second", ic: "盾", n: "二次被害ブロッカー", d: "「取り戻せます」の連絡を見抜く", got: (P("ticket").signs || {}).second === "caught" },
    { id: "family", ic: "家", n: "家族の守り手", d: "おばあちゃんを守りきる", got: safeEnd("oreore") },
    { id: "quiz", ic: "満", n: "クイズ満点", d: "サインあてクイズで5問正解", got: (prefs.sqBest || 0) >= 5 },
    { id: "teach1", ic: "教", n: "先生デビュー", d: "エピローグで、友だちを1回守る", got: SCENARIOS.some((s) => P(s.id).taught) },
    { id: "teach10", ic: "友", n: "みんなの守り手", d: "エピローグで、10の話の友だちを守る", got: SCENARIOS.filter((s) => P(s.id).taught).length >= 10 },
    { id: "honne", ic: "裏", n: "本音を見た", d: "本音モードで、話を最後まで体験する", got: SCENARIOS.some((s) => P(s.id).honne) },
    { id: "spot", ic: "探", n: "サインさがし名人", d: "サインさがしで40点以上", got: (store.get("dl3-spot", 0) || 0) >= 40 },
    { id: "check", ic: "点", n: "メッセージ点検係", d: "「届いたメッセージをチェック」を使う", got: !!store.get("dl3-checked", false) },
    { id: "note", ic: "記", n: "ふりかえり名人", d: "気づきメモを5つの話で残す", got: Object.keys(store.get("dl3-notes", {}) || {}).length >= 5 },
    { id: "wana", ic: "罠", n: "ワナ見やぶり", d: "画面のワナさがしで30点以上", got: (store.get("dl3-wana", 0) || 0) >= 30 },
    { id: "pledge", ic: "約", n: "わが家の約束", d: "守りの約束カードを保存か印刷する", got: !!store.get("dl3-pledged", false) },
    { id: "cert", ic: "証", n: "修了証", d: "コースの修了証を保存か印刷する", got: !!store.get("dl3-cert", false) },
    { id: "days7", ic: "暦", n: "7日の積み重ね", d: "7つの日に、シナリオを体験する", got: new Set([...(store.get("dl3-days", []) || []), ...(store.get("dl3-log", []) || []).map((x) => dayKey(new Date(x.t)))]).size >= 7 },
    { id: "wp", ic: "待", n: "いつも目に入る守り", d: "守りの待ち受けを保存する", got: !!store.get("dl3-wped", false) },
    { id: "flow", ic: "止", n: "立ち止まる力", d: "立ち止まりフローチャートを最後まで答える", got: !!store.get("dl3-flowed", false) },
    { id: "call", ic: "相", n: "相談の練習生", d: "「188に相談する練習」を最後まで終える", got: (store.get("dl3-call", 0) || 0) >= 1 }
  ];
}
function checkAch() {
  const had = new Set(store.get("dl3-ach", []) || []);
  const now = achievements().filter((a) => a.got);
  const fresh = now.filter((a) => !had.has(a.id));
  store.set("dl3-ach", now.map((a) => a.id));
  fresh.forEach((a, i) => setTimeout(() => toast(`称号を手に入れた！「${a.n}」`), i * 2400));
}
/* ===== 体験マップ：全シナリオを、ジャンルごとのマス目で見わたす ===== */
function mapGridHTML() {
  const stOf = (sc) => {
    const got = ((progress[sc.id] || {}).ends || []).length;
    return got === 0 ? "none" : got >= endIds(sc).length ? "full" : "clear";
  };
  const all = SCENARIOS.map((sc) => ({ sc, st: stOf(sc) }));
  const cnt = (s) => all.filter((x) => x.st === s).length;
  return `<section class="sec mapgrid" aria-label="体験マップ">
    <div class="sec-h"><h2>体験マップ　${cnt("clear") + cnt("full")} / ${all.length}</h2><p>すべての話を、ジャンルごとにマス目で並べました。マスを押すと、その話がはじまります。</p></div>
    <div class="mg-leg"><span><i class="mg-t none"></i>まだ（${cnt("none")}）</span><span><i class="mg-t clear"></i>クリア（${cnt("clear")}）</span><span><i class="mg-t full"></i>結末コンプリート（${cnt("full")}）</span></div>
    <div class="mg-rows">${Object.entries(GENRES).map(([gk, g]) => {
      const items = all.filter((x) => x.sc.genre === gk);
      const done = items.filter((x) => x.st !== "none").length;
      return `<div class="mg-row" style="--gh:${g.h}"><div class="mg-h"><b>${esc(g.n)}</b><span>${done}/${items.length}</span></div>
        <div class="mg-tiles">${items.map((x) => `<a class="mg-t ${x.st}" href="#${x.sc.id}" title="${esc(x.sc.tag)}：${esc(x.sc.title)}" aria-label="${esc(x.sc.tag)}（${x.st === "none" ? "まだ" : x.st === "full" ? "コンプリート" : "クリア"}）"></a>`).join("")}</div></div>`;
    }).join("")}</div></section>`;
}
/* ===== あなたの守りのかたち：系統ごとの見抜き率のレーダーと、よく使う行動からわかる守りのタイプ ===== */
function bumpAct(k) { const a = store.get("dl3-acts", {}) || {}; a[k] = (a[k] || 0) + 1; store.set("dl3-acts", a); }
const ACT_TYPE = {
  check:  ["確かめ探偵タイプ", "相手のプロフィールや番号を、まず確かめる。正体を見る目が、いちばんの守りです。"],
  ask:    ["質問名人タイプ", "「どうして？」と聞き返せる。答えにつまる相手の様子から、うそが見えてきます。"],
  talk:   ["相談上手タイプ", "ひとりで決めずに、まわりに話せる。だます側がいちばんいやがる力です。"],
  search: ["しらべ研究者タイプ", "名前や文面で検索して、同じ手口を見つけられる。情報で身を守るタイプです。"],
  wait:   ["ひと呼吸タイプ", "すぐに返事をしない。急かす相手のペースに、のみこまれません。"],
  memo:   ["証拠係タイプ", "画面やメモを残せる。何かあったとき、相談の大きな助けになります。"],
  free:   ["自分の言葉タイプ", "自分の言葉で、はっきり返せる。短い断りのひとことが、身についてきています。"],
  hes:    ["ためらい冷静タイプ", "「ちょっと考えさせて」と言える。立ち止まる力は、すべての守りの土台です。"]
};
const ACT_N = { check: "相手を確かめる", ask: "聞き返す", talk: "相談する", search: "調べる", wait: "時間をおく", memo: "記録を残す", free: "自分の言葉で返す", hes: "ためらう" };
function shapeHTML(catRows) {
  const acts = store.get("dl3-acts", {}) || {}, total = Object.values(acts).reduce((a, b) => a + b, 0);
  const top = Object.entries(acts).sort((a, b) => b[1] - a[1])[0];
  const rows = catRows.filter((r) => r.ck !== "soudan");
  const met = rows.filter((r) => r.met >= 2);
  const best = met.slice().sort((a, b) => b.rate - a.rate)[0], worst = met.slice().sort((a, b) => a.rate - b.rate)[0];
  const type = top && top[1] >= 2 ? ACT_TYPE[top[0]] : null;
  return `<section class="sec shape" id="shape" aria-label="あなたの守りのかたち">
    <div class="sec-h"><h2>あなたの守りのかたち</h2><p>8つの系統で、どれだけ自分で気づけたか。外に広がるほど、その系統に強いということです。</p></div>
    <div class="sh-wrap">
      <canvas id="shapeCv" width="520" height="520" aria-label="系統ごとの見抜き率のレーダーチャート"></canvas>
      <div class="sh-side">
        <div class="sh-type"><span class="eyebrow">あなたの守りのタイプ</span>
          <b>${type ? esc(type[0]) : "これから見つかるタイプ"}</b>
          <p>${type ? esc(type[1]) : "体験の中で「相手を確かめる」「聞き返す」「相談する」などの行動を使うと、あなたの守りのタイプが見えてきます。"}</p></div>
        ${best && worst && best !== worst ? `<div class="sh-bw"><div><span>いちばん強い</span><b>${CATS[best.ck].ic} ${esc(CATS[best.ck].n)}</b><small>${Math.round(best.rate * 100)}%</small></div>
          <div><span>のびしろ</span><b>${CATS[worst.ck].ic} ${esc(CATS[worst.ck].n)}</b><small>${Math.round(worst.rate * 100)}%</small></div></div>` : ""}
        ${(() => { const tn = SCENARIOS.filter((s) => (progress[s.id] || {}).taught).length; return tn ? `<div class="sh-taught"><span>エピローグで友だちを守った</span><b>${tn}<small>話</small></b></div>` : ""; })()}
        ${total ? `<div class="sh-acts"><span class="eyebrow">よく使う行動</span>${Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) =>
          `<div class="sh-act"><span>${esc(ACT_N[k] || k)}</span><i style="width:${Math.round(v / Math.max(...Object.values(acts)) * 100)}%"></i><small>${v}回</small></div>`).join("")}</div>` : ""}
      </div>
    </div></section>`;
}
function drawShape(catRows) {
  const cv = $("shapeCv"); if (!cv) return;
  const x = cv.getContext("2d"), W = 520, cx = W / 2, cy = W / 2, R = 135;
  const SHORT = { umai: "うますぎる話", isogi: "急かす", himitsu: "秘密・移動", kane: "先にお金", kojin: "個人情報", kankei: "気持ち・関係", jouken: "小さな条件", tsuuchi: "いきなり通知" };
  const rows = catRows.filter((r) => r.ck !== "soudan"), n = rows.length;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light" || document.documentElement.dataset.theme === "dark";
  const ink = dark ? "#E6ECF2" : "#1B2534", line = dark ? "rgba(230,236,242,.16)" : "rgba(27,37,52,.14)";
  x.clearRect(0, 0, W, W);
  const pt = (i, r) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  x.lineWidth = 1.5; x.strokeStyle = line;
  [0.25, 0.5, 0.75, 1].forEach((f) => { x.beginPath(); rows.forEach((_, i) => { const [px, py] = pt(i, R * f); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); x.stroke(); });
  rows.forEach((_, i) => { const [px, py] = pt(i, R); x.beginPath(); x.moveTo(cx, cy); x.lineTo(px, py); x.stroke(); });
  x.beginPath();
  rows.forEach((r, i) => { const [px, py] = pt(i, R * Math.max(0.04, r.met ? r.rate : 0)); i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.closePath(); x.fillStyle = "rgba(201,162,39,.30)"; x.fill(); x.strokeStyle = "#C9A227"; x.lineWidth = 3; x.stroke();
  rows.forEach((r, i) => { if (!r.met) return; const [px, py] = pt(i, R * Math.max(0.04, r.rate)); x.beginPath(); x.arc(px, py, 6, 0, Math.PI * 2); x.fillStyle = "#C9A227"; x.fill(); });
  x.textBaseline = "middle";
  rows.forEach((r, i) => {
    const [px, py] = pt(i, R + 54); x.textAlign = "center";
    x.font = '700 17px "Zen Kaku Gothic New", sans-serif';
    x.fillStyle = r.met ? ink : (dark ? "rgba(230,236,242,.4)" : "rgba(27,37,52,.35)");
    x.fillText(SHORT[r.ck] || CATS[r.ck].n, px, py - 10);
    x.font = '900 15px "Zen Kaku Gothic New", sans-serif'; if (r.met) x.fillStyle = "#C9A227";
    x.fillText(r.met ? `${Math.round(r.rate * 100)}%` : "—", px, py + 12);
  });
}
/* ===== 相手の人物帳：出会った「相手」を顔の一覧で集める ===== */
let cbSel = null;
function castOf(sc) {
  const fm = firstMsg(sc), keys = Object.keys(sc.cast || {});
  const isAlly = (k) => ALLY_RE.test(sc.cast[k].n + (sc.cast[k].r || ""));
  const k = (fm.who && sc.cast[fm.who] && !isAlly(fm.who)) ? fm.who : keys.find((x) => !isAlly(x)) || keys[0];
  if (!k) return null;
  let line = "";
  for (const n of Object.values(sc.nodes)) {
    const m = (n.log || []).find((l) => l[0] === "them" && (l[2] || (n.scene && n.scene.who) || fm.who) === k);
    if (m) { line = m[1]; break; }
  }
  if (!line) line = fm.text.replace(/^[^：]{1,16}：/, "");
  const cats = [...new Set(Object.values(sc.signs).map((s) => s.cat).filter((c) => c !== "soudan"))];
  return { sc, k, c: sc.cast[k], line, cats, met: cleared(sc.id) };
}
function castBookHTML() {
  const all = SCENARIOS.map(castOf).filter(Boolean);
  const met = all.filter((x) => x.met);
  const sel = all.find((x) => x.sc.id === cbSel && x.met) || met[met.length - 1] || null;
  const detail = sel ? `<div class="cb-detail" id="cbDetail" style="--h:${sel.c.h}">
      <div class="cb-who"><span class="av" style="--h:${sel.c.h}" aria-hidden="true">${esc(sel.c.i)}</span><div><b>${esc(sel.c.n)}</b><span>${esc(sel.c.r || "")}${sel.c.r ? "｜" : ""}${esc(sel.sc.tag)}</span></div></div>
      ${sel.line ? `<p class="cb-line">「${esc(sel.line)}」</p>` : ""}
      <div class="cb-cats"><span class="cb-h">使ってきた手</span>${sel.cats.map((c) => `<span class="cb-cat"><i aria-hidden="true">${CATS[c].ic}</i>${esc(CATS[c].n)}</span>`).join("")}</div>
      ${DEBRIEF[sel.sc.id] ? `<p class="cb-point"><span class="cb-h">見抜くポイント</span>${esc(DEBRIEF[sel.sc.id].point)}</p>` : ""}
      <a class="btn small" href="#${sel.sc.id}">この話をもう一度 →</a>
    </div>` : `<div class="cb-detail empty">${mascot("md")}<span>まだ、だれにも会っていません。話をひとつ遊ぶと、相手がここに並びます。</span></div>`;
  return `<section class="sec castbook" id="castbook" aria-label="相手の人物帳">
    <div class="sec-h"><h2>相手の人物帳　${met.length} / ${all.length}</h2><p>これまでに出会った「相手」です。顔を押すと、最初のひとことと、使ってきた手が見られます。</p></div>
    <div class="cb-wrap">
      <div class="cb-grid" role="list">${all.map((x) => x.met
        ? `<button type="button" role="listitem" class="cb-t${sel && sel.sc.id === x.sc.id ? " on" : ""}" data-cb="${x.sc.id}" style="--h:${x.c.h}" title="${esc(x.c.n)}（${esc(x.sc.tag)}）" aria-label="${esc(x.c.n)}（${esc(x.sc.tag)}）">${esc(x.c.i)}</button>`
        : `<span role="listitem" class="cb-t lock" title="まだ会っていない（${esc(x.sc.tag)}）" aria-label="まだ会っていない相手">？</span>`).join("")}</div>
      ${detail}
    </div></section>`;
}
function bindCastBook() {
  document.querySelectorAll("[data-cb]").forEach((b) => (b.onclick = () => {
    cbSel = b.dataset.cb;
    const sec = b.closest(".castbook"), tmp = document.createElement("div");
    tmp.innerHTML = castBookHTML();
    sec.replaceWith(tmp.firstElementChild);
    bindCastBook();
    const d = $("cbDetail");
    if (d && innerWidth < 760) d.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }));
}
function wearHTML() {
  const lv = lvInfo().lv, cur = wearNow();
  return `<section class="sec wear" id="wear" aria-label="ミヌケの着せかえ"><div class="sec-h"><h2>ミヌケの着せかえ</h2><p>見抜きレベルが上がると、ミヌケのアクセサリーが手に入ります。えらんだものは、ホームや結果画面のミヌケが身につけます。</p></div>
    <div class="wr-grid">${Object.entries(WEAR).map(([k, w]) => { const open = lv >= w.lv;
      return `<button type="button" class="wr-item${cur === k ? " on" : ""}${open ? "" : " locked"}" data-wear="${k}" ${open ? "" : "disabled"} aria-pressed="${cur === k}">
        ${mascot("wr-m", open ? k : "none")}<b>${esc(w.n)}</b><small>${open ? (cur === k ? "身につけている" : "えらぶ") : `Lv.${w.lv} で手に入る`}</small></button>`; }).join("")}</div></section>`;
}
function bindWear() {
  document.querySelectorAll("[data-wear]").forEach((b) => (b.onclick = () => { prefs.wear = b.dataset.wear; savePrefs(); const s = $("wear"); const t = document.createElement("div"); t.innerHTML = wearHTML(); s.replaceWith(t.firstElementChild); bindWear(); toast(`ミヌケが「${WEAR[prefs.wear].n}」を身につけた`); }));
}
function achHTML() {
  const list = achievements();
  return `<section class="sec" aria-label="称号"><div class="sec-h"><h2>称号　${list.filter((a) => a.got).length} / ${list.length}</h2><p>体験を重ねると手に入ります。まだの称号は、条件を見てチャレンジしてみよう。</p></div>
    <div class="medals">${list.map((a) => `<div class="medal${a.got ? " got" : ""}"><span class="md-ic" aria-hidden="true">${a.ic}</span><div><b>${esc(a.n)}</b><span>${esc(a.d)}</span></div>${a.got ? `<span class="md-st">獲得</span>` : ""}</div>`).join("")}</div></section>`;
}

/* ===== 図鑑 ===== */
let resetArmed = false;
let zkCat = "all", zkSt = "all";
function renderZukan() {
  const all = [];
  SCENARIOS.forEach((sc) => Object.entries(sc.signs).forEach(([k, sg]) => all.push({ sc, k, sg, st: (progress[sc.id] && progress[sc.id].signs || {})[k] })));
  const t = totals();
  const catRows = Object.entries(CATS).map(([ck, c]) => {
    const items = all.filter((x) => x.sg.cat === ck);
    const met = items.filter((x) => x.st).length, caught = items.filter((x) => x.st === "caught").length;
    return { ck, c, items, met, caught, rate: met ? caught / met : 0 };
  });
  $("v-zukan").innerHTML = `
  <div class="zhead bleed b-hero">
    <div>
      <div class="eyebrow">COLLECTION</div>
      <h1>サイン図鑑</h1>
      <p style="color:var(--muted)">体験の中で出会ったサインがここに集まります。見つけたサイン <b style="color:var(--ink)">${all.filter((x) => x.st).length} / ${all.length}</b>、そのうち自分で気づけたのは <b style="color:var(--ink)">${t.caught}</b>。見逃したサインは、もう一度プレイして「気づけた」に塗りかえよう。</p>
    </div>
    <div class="chart" aria-label="系統ごとの見抜き率">
      <h2>系統ごとの見抜き率</h2>
      <p class="cap">出会ったサインのうち、自分で気づけた割合。まだ出会っていない系統は空欄です。</p>
      <div class="bars">${catRows.map((r) => `<div class="barrow" title="${esc(r.c.n)}：出会った ${r.met}・気づけた ${r.caught}">
        <span class="lab">${esc(r.c.n)}</span><span class="track"><i style="width:${Math.round(r.rate * 100)}%"></i></span>
        <span class="val">${r.met ? `${r.caught}/${r.met}` : "—"}</span></div>`).join("")}</div>
    </div>
  </div>
  ${shapeHTML(catRows)}
  ${mapGridHTML()}
  ${castBookHTML()}
  ${achHTML()}
  ${wearHTML()}
  ${certHTML()}
  ${heatHTML()}
  ${journalHTML()}
  <div class="zk-tools" id="zkTools" role="group" aria-label="図鑑をしぼりこむ">
    <div class="frow"><span class="frow-h">系統</span>${[["all", "すべて", all.length], ...catRows.map((r) => [r.ck, r.c.n, r.items.length])].map(([k, n, c]) => `<button class="chipbtn sm" type="button" data-zc="${k}" aria-pressed="${zkCat === k}">${k !== "all" ? `<span aria-hidden="true">${CATS[k].ic}</span>` : ""}${esc(n)}<small>${c}</small></button>`).join("")}</div>
    <div class="frow"><span class="frow-h">状態</span>${[["all", "すべて"], ["caught", "気づけた"], ["missed", "見逃した"], ["none", "未発見"]].map(([k, n]) => `<button class="chipbtn sm zs-${k}" type="button" data-zs="${k}" aria-pressed="${zkSt === k}">${n}<small>${k === "all" ? all.length : all.filter((x) => (x.st || "none") === k).length}</small></button>`).join("")}</div>
  </div>
  ${(() => { const rows = catRows.filter((r) => zkCat === "all" || r.ck === zkCat).map((r) => Object.assign({}, r, { items: r.items.filter((x) => zkSt === "all" || (x.st || "none") === zkSt) })).filter((r) => r.items.length);
    return rows.length ? "" : `<div class="jr-empty">${mascot("md")}<span>この条件のサインは、まだありません。${zkSt === "missed" ? "見逃したサインがないのは、すごいこと！" : ""}</span></div>`; })()}
  ${catRows.filter((r) => zkCat === "all" || r.ck === zkCat).map((r) => Object.assign({}, r, { items: r.items.filter((x) => zkSt === "all" || (x.st || "none") === zkSt) })).filter((r) => r.items.length).map((r) => `<section class="zgroup" aria-label="${esc(r.c.n)}">
    <div class="zgroup-h"><span class="ic" aria-hidden="true">${r.c.ic}</span><div><b>${esc(r.c.n)}</b><span>${esc(r.c.d)}</span></div></div>
    <div class="zcards">${r.items.map((x) => {
      const g = GENRES[x.sc.genre];
      if (!x.st) return `<div class="zc locked"><div class="top"><span class="from">${esc(x.sc.tag)}</span><span class="st locked">未発見</span></div><b>？？？？？</b><span class="d">「${esc(x.sc.title)}」のどこかで出会えます</span></div>`;
      return `<div class="zc"><div class="top"><span class="from" style="color:hsl(${g.h} 60% var(--g-ls))">${esc(x.sc.tag)}</span><span class="st ${x.st}">${x.st === "caught" ? "気づけた" : "見逃した"}</span></div><b>${esc(x.sg.t)}</b><span class="d">${esc(x.sg.d)}</span></div>`;
    }).join("")}</div></section>`).join("")}
  <div class="reset"><span>記録はこの端末のブラウザにだけ保存されています。</span>
    <button class="btn small" type="button" id="resetBtn">${resetArmed ? "本当に消す（元に戻せません）" : "記録をリセット"}</button>
    ${resetArmed ? `<button class="btn small" type="button" id="resetCancel">やめる</button>` : ""}</div>`;
  $("resetBtn").onclick = () => {
    if (!resetArmed) { resetArmed = true; return renderZukan(); }
    progress = {}; saveProgress(); store.set("dl3-log", []); resetArmed = false; renderZukan(); toast("記録をリセットしました");
  };
  if ($("resetCancel")) $("resetCancel").onclick = () => { resetArmed = false; renderZukan(); };
  const zkGo = () => { renderZukan(); const t = $("zkTools"); if (t) t.scrollIntoView({ block: "start" }); };
  document.querySelectorAll("[data-zc]").forEach((b) => (b.onclick = () => { zkCat = b.dataset.zc; zkGo(); }));
  document.querySelectorAll("[data-zs]").forEach((b) => (b.onclick = () => { zkSt = b.dataset.zs; zkGo(); }));
  bindCastBook(); bindWear(); if ($("cert")) bindCourses($("cert"));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => drawShape(catRows));
}

/* ===== 相談先 ===== */
function renderHelp() {
  $("v-help").innerHTML = `
  <div class="help-hero bleed b-hero"><div class="eyebrow">IF SOMETHING HAPPENS</div><h1>困ったら、ひとりで抱えない</h1>
    <p style="color:var(--muted)">だまされたのは恥ずかしいことではありません。早く相談するほど、取れる手段が増えます。迷ったら、まず188へ。</p></div>
  ${checkerHTML()}
  ${flowHTML()}
  <div class="calls">
    <div class="call"><span class="eyebrow">消費者ホットライン</span><div class="num">188</div><p>局番なし。近くの消費生活センターにつながります。契約・解約・お金のトラブル全般。「いやや！」で覚えよう。</p></div>
    <div class="call"><span class="eyebrow">警察相談専用電話</span><div class="num">#9110</div><p>詐欺かもしれない、脅されている、個人情報を悪用されたかも、というとき。緊急のときは110番。</p></div>
    <div class="call"><span class="eyebrow">カードの不正利用</span><div class="num" style="font-size:var(--step-2)">カード裏面の番号</div><p>カード情報を入力してしまった、知らない請求がある。すぐにカード会社に連絡して止めてもらおう。</p></div>
  </div>
  <section class="sec" aria-label="相談の前に">
    <div class="sec-h"><h2>相談の前にやっておくこと</h2></div>
    <ol class="steps">
      <li><b>やり取りを消さずに保存する</b><span>DM・トーク・広告・購入画面をスクリーンショット。相手のアカウント名やURLも。</span></li>
      <li><b>お金の記録をそろえる</b><span>振込の控え、カードの明細、電子マネーのレシートやカード。</span></li>
      <li><b>いつ・何があったかをメモする</b><span>日付と順番がわかるだけで、相談がぐっとスムーズに。</span></li>
      <li><b>これ以上払わない・送らない</b><span>「取り戻せます」と向こうから来る連絡は二次被害のサイン。相談先は自分で調べた公的な窓口へ。</span></li>
    </ol>
  </section>
  ${kimariHTML()}
  ${clockHTML()}
  ${familyHTML()}
  ${pledgeHTML()}
  ${wpHTML()}
  ${phraseBookHTML()}
  ${wordsHTML()}
  <section class="sec" aria-label="断り方">
    <div class="sec-h"><h2>そのまま使える、断りのひとこと</h2><p>理由をくわしく説明しなくて大丈夫。短く、はっきり。</p></div>
    <div class="phrases">
      <div class="phrase">「親に相談してから決めます」<small>契約や支払いをその場でせまられたとき</small></div>
      <div class="phrase">「今日は決めません。帰ります」<small>長い説明や個室での勧誘のとき</small></div>
      <div class="phrase">「アプリの外ではやり取りしません」<small>フリマやチケットの個人間取引で</small></div>
      <div class="phrase">「仕事の内容がわからないのでやめます」<small>副業や高額バイトの誘いに</small></div>
      <div class="phrase">「一回電話で確認するね」<small>友だちを名のる不自然なお願いに</small></div>
      <div class="phrase">「その話には興味がありません」<small>久しぶりの人からの「いい話」に</small></div>
    </div>
  </section>`;
  bindPhraseBook();
  bindPledge();
  bindWp();
  bindChecker();
  bindFlow();
  bindClock();
  document.querySelectorAll("[data-easybtn]").forEach((b) => (b.onclick = toggleEasy));
  document.querySelectorAll("[data-voicebtn]").forEach((b) => (b.onclick = toggleVoice));
  applyVoice();
  applyEasy();
  bindCourses($("v-help"));
}

/* ===== 授業で使う（先生・保護者向け） ===== */
const SHEET_TEXT = `だまされ体験ラボ　ふりかえりシート

年　　組　　番　名前（　　　　　　　　）

1. 体験したシナリオ：
2. たどりついた結末：
3. いちばん「あれ？」と思った場面と、その理由：
4. 見逃してしまったサインと、次はどう気づくか：
5. 9つのサインのうち、自分がいちばん引っかかりそうなもの：
6. 困ったときの相談先（番号も書こう）：
7. 家族や友だちに伝えたいこと：`;

/* QRコード：cdnjs の qrcode-generator を必要なときだけ読み込む */
function drawQR() {
  const box = $("qrBox"); if (!box) return;
  const paint = () => {
    try {
      const qr = window.qrcode(0, "M"); qr.addData(SHARE_URL); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch (e) { box.innerHTML = `<span class="qr-wait">QRコードを表示できませんでした。下のURLを使ってください。</span>`; }
  };
  if (window.qrcode) return paint();
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  s.onload = paint;
  s.onerror = () => { box.innerHTML = `<span class="qr-wait">QRコードを表示できませんでした。下のURLを使ってください。</span>`; };
  document.head.appendChild(s);
}
/* ===== 話し合いカード：コースの話ごとに「見抜くポイント」と「問い」をカードにして印刷する ===== */
function cardsHTML() {
  return `<section class="sec talkcards" aria-label="話し合いカード">
    <div class="sec-h"><h2>話し合いカードを印刷する</h2><p>コースをえらぶと、その話ごとに「見抜くポイント」と「話し合いの問い」が入ったカードを、A4にまとめて印刷できます。グループで1枚ずつ配って、話し合いに使えます。</p></div>
    <div class="tc-row"><label class="tc-sel"><span>コース</span><select id="tcCourse">${COURSES.map((c) => `<option value="${c.id}">${esc(c.n)}（${courseOf(c).length}枚）</option>`).join("")}</select></label>
      <button class="btn primary" type="button" id="tcPrint">話し合いカードを印刷</button></div>
    <div class="tc-prev" id="tcPrev" aria-label="カードの見本"></div></section>`;
}
function talkCard(sc) {
  const d = DEBRIEF[sc.id] || {};
  return `<div class="pc"><span class="pc-tag">${esc(sc.tag)}</span><b class="pc-title">${esc(sc.title)}</b>
    ${d.point ? `<p class="pc-point"><i>見抜くポイント</i>${esc(d.point)}</p>` : ""}
    <ol class="pc-q">${(d.ask || []).slice(0, 2).map((q) => `<li>${esc(q)}</li>`).join("")}</ol>
    <span class="pc-foot">だまされ体験ラボ｜#${esc(sc.id)}</span></div>`;
}
function bindCards() {
  if (!$("tcCourse")) return;
  const list = () => courseOf(COURSES.find((c) => c.id === $("tcCourse").value) || COURSES[0]);
  const prev = () => { $("tcPrev").innerHTML = list().slice(0, 2).map(talkCard).join("") + `<span class="tc-more">ほか ${Math.max(0, list().length - 2)} 枚</span>`; };
  $("tcCourse").onchange = prev; prev();
  $("tcPrint").onclick = () => {
    let el = $("printSheet"); if (!el) { el = document.createElement("div"); el.id = "printSheet"; document.body.appendChild(el); }
    const c = COURSES.find((x) => x.id === $("tcCourse").value) || COURSES[0];
    el.innerHTML = `<div class="pc-sheet"><header class="pc-head"><b>話し合いカード｜${esc(c.n)}</b><span>${esc(c.d)}</span></header><div class="pc-grid">${list().map(talkCard).join("")}</div></div>`;
    window.print();
  };
}
function renderTeach() {
  const genreOf = (sc) => GENRES[sc.genre].n;
  const catsOf = (sc) => [...new Set(Object.values(sc.signs).map((s) => s.cat))].map((c) => CATS[c] ? CATS[c].n : c).join("、");
  $("v-teach").innerHTML = `
  <div class="help-hero bleed b-hero"><div class="eyebrow">FOR TEACHERS &amp; FAMILIES</div><h1>授業や家庭で使う</h1>
    <p style="color:var(--muted)">2022年4月から成年年齢は18歳になり、18歳になると親の同意なく契約できるかわりに、未成年者取消権が使えなくなりました。このページは、高校生から大学1年生くらいの人といっしょに体験し、話し合うためのガイドです。1シナリオは約3〜7分。登録やログインは不要です。</p>
    ${ORG.name ? `<div class="hero-org">${orgBadge()}</div>` : ""}</div>

  <section class="sec present-cta" aria-label="スクリーンで出題する">
    <div><span class="eyebrow">クラスみんなで</span><h2>スクリーンに映して、いっしょに見抜く</h2>
      <p>大きな文字でメッセージを1通ずつ映します。「あやしいと思う人？」と手をあげてもらってから、答えと理由を表示できます。10問・約10分。</p></div>
    <button class="btn primary" type="button" id="presentBtn">スクリーンモードをはじめる</button>
  </section>
  ${cardsHTML()}

  <section class="sec qrsec" aria-label="教室で配る">
    <div class="qrbox" id="qrBox" aria-label="このページのQRコード"><span class="qr-wait">QRコードを準備中…</span></div>
    <div class="qrtext"><span class="eyebrow">教室で配る</span><h2>スクリーンに映して、スマホで読み取り</h2>
      <p>生徒は登録もログインもなしで、そのまま体験を始められます。進み具合はそれぞれのスマホの中だけに保存されます。</p>
      <code class="qrurl" id="qrUrl">${esc(SHARE_URL)}</code>
      <div class="row-btns"><button class="btn small" type="button" id="qrCopy">URLをコピー</button></div></div>
  </section>

  <section class="sec" aria-label="ねらい">
    <div class="sec-h"><h2>この教材のねらい</h2></div>
    <div class="cats">
      <div class="cat"><span class="ic" aria-hidden="true">1</span><b>手口ではなく、サインを覚える</b><span>手口は次々に変わります。「急かす」「先にお金」など、変わりにくい共通のサインに気づく力を育てます。</span></div>
      <div class="cat"><span class="ic" aria-hidden="true">2</span><b>自分ごととして体験する</b><span>選択肢を自分で選び、結末まで見ることで、「自分もだまされるかもしれない」と実感できます。</span></div>
      <div class="cat"><span class="ic" aria-hidden="true">3</span><b>だまされた後の行動を知る</b><span>被害にあっても、ひとりで抱えず相談すること。188と#9110を覚えることをゴールにしています。</span></div>
    </div>
  </section>

  <section class="sec" aria-label="授業の流れ">
    <div class="sec-h"><h2>50分の授業の流れ（例）</h2><p>1人1台の端末を想定しています。ペアで1台でも進められます。</p></div>
    <ol class="steps">
      <li><b>導入（5分）</b><span>「知らない人から『簡単に稼げる』とDMが来たら、どうする？」と問いかける。ホームのYES/NO診断を各自でやってみてもよい。</span></li>
      <li><b>体験（15分）</b><span>各自でシナリオを1〜2本体験する。おすすめは「1日5分で月20万の副業」「お荷物をお届けにあがりました」（どちらも短め）。</span></li>
      <li><b>共有（15分）</b><span>班で「どこで『あれ？』と思ったか」「どの結末になったか」を話す。結果画面の「あなたが通ったルート」と「考えてみよう」の問いを使う。</span></li>
      <li><b>まとめ（10分）</b><span>ホームの「だましに共通する9つのサイン」を全体で確認する。相談先ページで188と#9110を紹介する。</span></li>
      <li><b>ふりかえり（5分）</b><span>下のふりかえりシートを書く。家に帰って家族と1本体験する、を宿題にしてもよい。</span></li>
    </ol>
  </section>

  <section class="sec" aria-label="シナリオ一覧表">
    <div class="sec-h"><h2>シナリオの選び方</h2><p>むずかしさは、話の長さと、サインの気づきにくさの目安です。</p></div>
    <div class="tablewrap"><table class="ttable">
      <thead><tr><th>シナリオ</th><th>ジャンル</th><th>時間</th><th>むずかしさ</th><th>扱うサインの系統</th></tr></thead>
      <tbody>${SCENARIOS.map((sc) => `<tr><td><a href="#${sc.id}">${esc(sc.title)}</a></td><td>${esc(genreOf(sc))}</td><td>約${sc.mins}分</td><td><span class="lvl">${lvl(sc.level)}</span> ${levelName(sc.level)}</td><td>${esc(catsOf(sc))}</td></tr>`).join("")}</tbody>
    </table></div>
  </section>

  <section class="sec" aria-label="話し合いの問い">
    <div class="sec-h"><h2>シナリオごとのまとめと、話し合いの問い</h2><p>結果画面にも同じまとめが出ます。</p></div>
    <div class="dlist">${SCENARIOS.filter((sc) => DEBRIEF[sc.id]).map((sc) => `<details class="dd"><summary><span class="gtag" style="--gh:${GENRES[sc.genre].h}">${esc(sc.tag)}</span><b>${esc(sc.title)}</b></summary>${debriefHTML(sc)}</details>`).join("")}</div>
  </section>

  <section class="sec" aria-label="ふりかえりシート">
    <div class="sec-h"><h2>ふりかえりシート</h2><p>コピーして、プリントや学習用アプリに貼りつけて使えます。</p></div>
    <div class="sharebox"><textarea class="sharetext" id="sheetText" aria-label="ふりかえりシートの文章" style="min-height:260px">${esc(SHEET_TEXT)}</textarea>
      <div><button class="btn small" type="button" id="sheetCopy">シートをコピー</button></div></div>
  </section>

  <section class="sec" aria-label="使うときの配慮">
    <div class="sec-h"><h2>使うときに気をつけたいこと</h2></div>
    <ol class="steps">
      <li><b>被害にあった人を責めない</b><span>クラスの中に、本人や家族が実際に被害にあった人がいるかもしれません。「だまされる人が悪い」ではなく、「だれでもねらわれる」ことを前提に話してください。</span></li>
      <li><b>手口のくわしさより、サインに注目する</b><span>話し合いが「どうやってだますか」に寄りすぎたら、「どこで気づけた？」にもどしましょう。</span></li>
      <li><b>闇バイト・スカウトのシナリオは扱いに注意</b><span>脅しや望まない撮影が出てきます。年齢や状況に合わせて選び、「途中でも相談すれば引き返せる」ことを必ず伝えてください。</span></li>
      <li><b>記録は端末の中だけ</b><span>進み具合や図鑑はブラウザに保存されるだけで、だれかに送られることはありません。共有端末では、図鑑ページの「記録をリセット」で消せます。</span></li>
    </ol>
  </section>`;
  $("qrCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(SHARE_URL); toast("コピーしました"); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("qrUrl")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("選択しました。コピーしてください"); }
  };
  drawQR();
  bindCards();
  $("presentBtn").onclick = openPresent;
  $("sheetCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(SHEET_TEXT); toast("コピーしました"); }
    catch (e) { const ta = $("sheetText"); ta.focus(); ta.select(); toast("選択しました。コピーしてください"); }
  };
}

/* ===== プレイ ===== */
let RUN = 0;
let S = null;

function factor() { return S && S.skip ? 0 : TEMPO[prefs.tempo]; }
async function pause(ms) { const f = factor(); if (f > 0) await wait(ms * f); }

function openScenario(id) {
  RUN++;
  const sc = byId(id);
  store.set("dl3-last", id);
  S = { sc, run: RUN, signs: {}, order: {}, scene: null, clock: sc.clock || "12:00", lastFrom: null, skip: false, path: [], hist: [] };
  S.honne = HONNE_NEXT; HONNE_NEXT = false;
  hush();
  { const ec = $("endcard"); if (ec) ec.remove(); const ts = $("tskip"); if (ts) ts.remove(); const eb = $("evBadge"); if (eb) eb.remove(); delete $("composer").dataset.deciding; $("composer").classList.remove("deciding"); const cs = $("csSheet"); if (cs) cs.remove(); const sf = $("sfSheet"); if (sf) sf.remove(); const br = $("brSheet"); if (br) br.remove(); }
  $("screen").classList.toggle("honne-on", !!S.honne);
  $("overlay").hidden = true;
  $("log").innerHTML = "";
  $("playTitle").textContent = sc.title;
  $("playTag").textContent = sc.tag;
  $("playTag").style.setProperty("--gh", GENRES[sc.genre].h);
  $("v-play").style.setProperty("--gh", GENRES[sc.genre].h);
  $("clock").textContent = S.clock;
  const first = sc.nodes[sc.start];
  S.scene = null;
  if (first.scene) { S.scene = first.scene; setHead(); }
  renderSide(); renderDots(); renderMap();
  const castKeys = Object.keys(sc.cast);
  append(`<div class="intro" style="--gh:${GENRES[sc.genre].h}"><div class="band"><span class="gtag">${esc(sc.tag)}</span><h3>${esc(sc.title)}</h3></div>
    <div class="in"><p>${esc(sc.intro)}</p>
    <div class="castlist">${castKeys.map((k) => `<div>${av(sc, k, true)}<span><b>${esc(sc.cast[k].n)}</b>${sc.cast[k].r ? `　<span style="color:var(--muted)">${esc(sc.cast[k].r)}</span>` : ""}</span></div>`).join("")}</div>
    <div class="goal">${mascot("sm")}<span>この話にかくれた <b>${Object.keys(sc.signs).length}つのサイン</b> を見つけよう。結末は${endIds(sc).length}種類。</span></div></div></div>`);
  if (S.honne) append(`<div class="honne-note"><b>本音モード</b><span>だます側の「心の声」が、灰色の吹き出しで見えます。どの言葉に、どんなねらいがあるのか見てみよう。</span></div>`);
  $("composer").innerHTML = `<button class="choice go" type="button" id="goBtn"><span class="ch-ic" aria-hidden="true">${ICON_PLAY}</span><span>ストーリーをはじめる</span></button>`;
  const begin = () => {
    prog(sc.id).plays++; saveProgress();
    /* 始まったら、あらすじは見出しだけに折りたたんで、会話の場所を広くする */
    const intro = $("log").querySelector(".intro");
    if (intro) intro.classList.add("mini");
    S.scene = null; S.lastFrom = null;
    playNode(sc.start);
  };
  showLock(sc);
  showOpening(sc);
  $("goBtn").onclick = () => {
    hideLock(); closeOpening(true);
    if (store.get("dl3-coach2", false)) return begin();
    showCoach(begin);
  };
  /* スマホでは、開いたらスマホ画面が画面いっぱいに見える位置まで送る */
  if (matchMedia("(max-width: 860px)").matches) setTimeout(() => { if (!$("v-play").hidden) document.querySelector(".phone-col").scrollIntoView({ block: "start" }); }, 30);
}
const ICON_SAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>`;
const ICON_ACT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>`;
/* ===== はじまりの画面：ロック画面に届く通知・電話の着信・インターホン ===== */
const WEEK = "日月火水木金土";
function lockHTML(sc) {
  const f = firstMsg(sc), c = sc.cast[f.who] || null;
  const d = new Date(), date = `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}曜日`;
  const story = `<details class="lk-story" open><summary>この話の場面</summary><p>${esc(sc.intro)}</p></details>`;
  if (f.type === "home" || f.type === "live" && !/玄関|インターホン/.test(f.app)) return "";
  if (f.type === "call" || f.type === "live") {
    const door = f.type === "live";
    return `<div class="lock ring${door ? " door" : ""}" id="lock" role="dialog" aria-label="${door ? "インターホン" : "着信"}">
      <div class="lk-top"><span class="lk-kind">${door ? "インターホン" : "着信"}</span><b class="lk-name">${esc(door ? "玄関に、だれか来ました" : (c ? c.n : f.name || "知らない番号"))}</b><span class="lk-sub">${esc(door ? (c ? c.n : "") : (((sc.nodes[sc.start].scene || {}).status || "").replace(/^着信$|^通話中$/, "") || "携帯電話"))}</span></div>
      <div class="lk-av" aria-hidden="true"><i></i><i></i>${c ? `<span class="av" style="--h:${c.h}">${esc(c.i)}</span>` : `<span class="av ghost">？</span>`}</div>
      ${story}
      <p class="lk-note" id="lkNote" aria-live="polite"></p>
      <div class="lk-btns"><button type="button" class="lk-no" id="lkNo"><span class="lk-ic" aria-hidden="true">${door ? "✕" : SCENE_ICON.call}</span>${door ? "出ない" : "拒否"}</button><button type="button" class="lk-yes" id="lkYes"><span class="lk-ic" aria-hidden="true">${door ? "●" : SCENE_ICON.call}</span>${door ? "出る" : "応答"}</button></div>
    </div>`;
  }
  const preview = f.text.length > 46 ? f.text.slice(0, 46) + "…" : f.text;
  return `<div class="lock" id="lock" role="dialog" aria-label="ロック画面">
    <div class="lk-clock"><span>${esc(date)}</span><b>${esc(S.clock)}</b></div>
    <button type="button" class="lk-note-card" id="lkYes"><span class="lk-app"><span class="nt-ic" aria-hidden="true">${SCENE_ICON[f.type] || SCENE_ICON.dm}</span>${esc(f.app)}<i>いま</i></span>
      ${f.name ? `<b>${esc(f.name)}</b>` : ""}<span class="lk-prev">${esc(preview)}</span></button>
    ${story}
    <span class="lk-hint">通知をタップして、ひらく</span>
  </div>`;
}
/* ===== オープニング：話のはじまりに、事件ファイルのようなタイトルカードを出す（押すとすぐ閉じる） ===== */
let OPEN_T = null;
function showOpening(sc) {
  closeOpening(true);
  if (prefs.easy || sc.gen) return;
  const no = String(SCENARIOS.indexOf(sc) + 1).padStart(3, "0"), g = GENRES[sc.genre], seen = (prog(sc.id).plays || 0) > 0;
  const chars = [...sc.title].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join("");
  $("screen").insertAdjacentHTML("beforeend", `<div class="opening${S.honne ? " honne" : ""}${seen ? " quick" : ""}" id="opening" role="button" tabindex="0" aria-label="${esc(sc.title)}。押すと始まります" style="--gh:${g.h}">
    <div class="op-grain" aria-hidden="true"></div>
    <div class="op-top"><span class="op-file">CASE FILE</span><span class="op-no">No.${no}</span></div>
    <div class="op-mid">
      <span class="op-tag">${esc(g.n)}｜${esc(sc.tag)}</span>
      <h2 class="op-title">${chars}</h2>
      <span class="op-line" aria-hidden="true"></span>
      <div class="op-meta"><span><small>あなたは</small>${esc(ROLES[roleOf(sc)] || "")}</span><span><small>時刻</small>${esc(sc.clock || "")}</span><span><small>サイン</small>${Object.keys(sc.signs).length}つ</span></div>
    </div>
    <div class="op-foot">${S.honne ? `<b class="op-honne">本音モード</b>` : `<span>だまされる前に、気づけるか。</span>`}<i>タップで始める</i></div>
  </div>`);
  const el = $("opening");
  el.onclick = () => closeOpening();
  el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); closeOpening(); } };
  const ms = reduced ? 900 : seen ? 1300 : 2600;
  OPEN_T = setTimeout(() => closeOpening(), ms * Math.max(0.35, TEMPO[prefs.tempo] || 1));
}
function closeOpening(now) {
  clearTimeout(OPEN_T); OPEN_T = null;
  const el = $("opening"); if (!el) return;
  if (now || reduced) return el.remove();
  el.classList.add("out"); el.onclick = null;
  setTimeout(() => el.remove(), 420);
}
function showLock(sc) {
  hideLock(true);
  if (prefs.easy) return;
  const h = lockHTML(sc); if (!h) return;
  $("screen").insertAdjacentHTML("beforeend", h);
  $("screen").classList.add("locked");
  $("lkYes").onclick = () => $("goBtn") && $("goBtn").click();
  const no = $("lkNo");
  if (no) no.onclick = () => {
    $("lkNote").textContent = /出ない/.test(no.textContent) ? "出ないのも、立派な守り方。今回は練習なので、相手の話を聞いてみよう。" : "知らない番号に出ないのも、立派な守り方。今回は練習なので、出てみよう。";
    no.disabled = true; $("lkYes").classList.add("pulse"); $("lkYes").focus({ preventScroll: true });
  };
}
function hideLock(now) {
  const l = $("lock"); $("screen").classList.remove("locked");
  if (!l) return;
  if (now || reduced) return l.remove();
  l.classList.add("out"); setTimeout(() => l.remove(), 360);
}
/* はじめての人向けの3ステップ案内（1回だけ） */
function showCoach(done) {
  const stop = $("stop");
  stop.className = "stop coach";
  stop.innerHTML = `<div class="tape"></div><div class="in">
    <div class="v">${mascot("md")}<div><b id="stopTitle">遊び方</b><span>3つだけ覚えればOK</span></div></div>
    <ol class="coach-steps">
      <li><b>返し方は、いろいろ</b><span>選択肢をえらぶほかに、<em>聞き返す</em>・<em>相談する</em>もできるよ。いちばん下の入力欄に<em>自分の言葉</em>で書けば、ミヌケが読み取って物語が進むよ。</span></li>
      <li><b>選ぶたびに「STOP」</b><span>そこにかくれていたサインを、ミヌケが解説するよ。</span></li>
      <li><b>迷ったら「ミヌケのヒント」</b><span>結末やサインは、図鑑と称号に集まっていくよ。本物の個人情報は書かないでね。</span></li>
    </ol>
    <button type="button" id="coachGo">わかった、はじめる</button></div>`;
  $("overlay").hidden = false;
  $("coachGo").focus({ preventScroll: true });
  const close = () => { $("overlay").hidden = true; S.closeStop = null; store.set("dl3-coach2", true); done(); };
  $("coachGo").onclick = close;
  S.closeStop = close;
}

/* ===== ストーリーマップ：分かれ道を上から下へ描く ===== */
function storyMap(sc, path, current) {
  const p = progress[sc.id] || {};
  const seen = new Set(p.nodes || []);
  const got = new Set(p.ends || []);
  const depth = { [sc.start]: 0 }, order = [sc.start];
  for (let i = 0; i < order.length; i++) {
    const n = sc.nodes[order[i]];
    (n.choices || []).forEach((c) => { if (!(c.next in depth) && sc.nodes[c.next]) { depth[c.next] = depth[order[i]] + 1; order.push(c.next); } });
  }
  const levels = [];
  order.forEach((id) => { (levels[depth[id]] ||= []).push(id); });
  const W = 320, rowH = 38, top = 18;
  const pos = {};
  levels.forEach((ids, d) => ids.forEach((id, j) => { pos[id] = { x: Math.round(((j + 1) * W) / (ids.length + 1)), y: top + d * rowH }; }));
  const H = top * 2 + (levels.length - 1) * rowH;
  const onPath = new Set();
  for (let i = 1; i < path.length; i++) onPath.add(path[i - 1] + ">" + path[i]);
  const edges = [];
  order.forEach((id) => {
    const n = sc.nodes[id];
    [...new Set((n.choices || []).map((c) => c.next))].forEach((to) => {
      if (!pos[to]) return;
      const a = pos[id], b = pos[to];
      const cls = onPath.has(id + ">" + to) ? "now" : seen.has(id) && seen.has(to) ? "seen" : "";
      edges.push(`<path class="me ${cls}" d="M${a.x} ${a.y} C${a.x} ${a.y + rowH / 2}, ${b.x} ${b.y - rowH / 2}, ${b.x} ${b.y}"></path>`);
    });
  });
  const tip = (n) => {
    if (n.end) return n.h;
    const l = (n.log || []).find((x) => x[0] === "them" || x[0] === "narr" || x[0] === "card");
    return l ? (l[0] === "card" ? l[1] : l[1]).slice(0, 40) : "";
  };
  const dots = order.map((id) => {
    const n = sc.nodes[id], q = pos[id];
    const cur = id === current ? " cur" : "";
    if (n.end) {
      const g = got.has(id);
      return `<g class="mn end ${g ? "got " + n.end : ""}${cur}"><title>${esc(g ? n.h : "まだ見ていない結末")}</title><rect x="${q.x - 8}" y="${q.y - 8}" width="16" height="16" rx="4"></rect></g>`;
    }
    return `<g class="mn ${seen.has(id) ? "seen" : ""}${cur}"><title>${esc(seen.has(id) ? tip(n) : "まだ通っていない場面")}</title><circle cx="${q.x}" cy="${q.y}" r="${id === sc.start ? 7 : 5.5}"></circle></g>`;
  }).join("");
  return `<svg class="smap" viewBox="0 0 ${W} ${H}" role="img" aria-label="ストーリーの分かれ道の図。通った場面 ${order.filter((id) => seen.has(id) && !sc.nodes[id].end).length}、回収した結末 ${got.size} / ${endIds(sc).length}">${edges.join("")}${dots}</svg>`;
}
const MAP_LEGEND = `<div class="map-legend"><span><i class="lg-seen"></i>通った場面</span><span><i class="lg-now"></i>今回のルート</span><span><i class="lg-safe"></i>被害なし</span><span><i class="lg-partial"></i>最小限</span><span><i class="lg-bad"></i>被害あり</span><span><i class="lg-none"></i>未回収</span></div>`;
function renderMap() {
  if (!$("mapBox") || !S) return;
  $("mapBox").innerHTML = storyMap(S.sc, S.path, S.node) + MAP_LEGEND;
}

let CALL_T = 0;
/* ===== アドレスバーの点検：URLを1文字ずつ打ち出し、あやしい部分に赤い波線をひく ===== */
const URL_SUS_TLD = /\.(xyz|top|shop|click|xx|xxx|info|online|site|buzz|live|icu|cc|ru|cn|work)(?=\/|$)/i;
function urlMarkup(raw) {
  const u = raw.replace(/^https?:\/\//, "");
  const ranges = [];
  const t = URL_SUS_TLD.exec(u); if (t) ranges.push([t.index, t.index + t[0].length]);
  const re = /(-?x{3,}|-[0-9]{3,}|[0-9]{4,})/gi; let m;
  while ((m = re.exec(u))) { const a = m.index, b = a + m[0].length; if (!ranges.some(([p, q]) => a < q && b > p)) ranges.push([a, b]); }
  ranges.sort((p, q) => p[0] - q[0]);
  const reason = t ? `公式とちがうかも（${t[0]}）` : ranges.length ? "公式とちがうかも（見なれない文字）" : "";
  let html = "", open = false;
  [...u].forEach((ch, k) => {
    const inR = ranges.some(([a, b]) => k >= a && k < b);
    if (inR && !open) { html += `<mark class="url-sus">`; open = true; }
    if (!inR && open) { html += "</mark>"; open = false; }
    html += `<span style="--i:${k}">${esc(ch)}</span>`;
  });
  if (open) html += "</mark>";
  return { html, reason, n: u.length };
}
function setHead() {
  const sc = S.sc, scn = S.scene || {};
  const keys = [scn.who, ...(scn.also || [])].filter((k) => k && sc.cast[k]);
  let name, status = scn.status || "";
  if (scn.type === "live") { name = keys.map((k) => sc.cast[k].n).join("・"); status = status || "目の前で話している"; }
  else if (scn.type === "home") { name = scn.name || "ひとりの時間"; status = status || "スマホを見ながら考えている"; }
  else { name = scn.name || (scn.who && sc.cast[scn.who] ? sc.cast[scn.who].n : ""); }
  const avs = scn.type === "home" ? `<span class="av ghost" aria-hidden="true">家</span>` : `<span class="avs">${keys.map((k) => av(sc, k)).join("")}</span>`;
  clearInterval(CALL_T);
  const head = $("head");
  const isUrl = scn.type === "web" && /[a-z0-9-]+\.[a-z]{2,}/i.test(status);
  head.className = "head" + (scn.type === "call" ? " h-call" : isUrl ? " h-web" : "");
  if (scn.type === "call") {
    /* 通話中の画面：大きなアイコンと、進んでいく通話時間 */
    head.innerHTML = `<div class="call-top">${avs}<span class="who"><b>${esc(name)}</b><span>${esc(status || scn.app || "")}</span></span>
      <span class="call-t" aria-hidden="true"><i></i><span id="callT">0:00</span></span><span class="call-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div>
      <div class="call-keys" aria-hidden="true"><span>消音</span><span>キーパッド</span><span>スピーカー</span><span class="end">終了</span></div>`;
    const t0 = Date.now();
    CALL_T = setInterval(() => { const el = $("callT"); if (!el) return clearInterval(CALL_T); const s = Math.floor((Date.now() - t0) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 1000);
  } else if (isUrl) {
    /* ブラウザ：アドレスバーにURLを大きく。正しいかどうかは自分で確かめる */
    const um = urlMarkup(status);
    head.innerHTML = `<div class="urlbar"><span class="url-ic" aria-hidden="true">${svgI('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')}</span>
      <span class="url" style="--n:${um.n}"><span class="sr">アドレス：</span>${um.html}</span><span class="app">${esc(scn.app || "")}</span></div>
      <div class="url-tip${um.reason ? " sus" : ""}" style="--n:${um.n}">${mascot("sm")}<span>${um.reason ? `<b>！</b>${esc(um.reason)}` : "URL（アドレス）も、確かめるポイント"}</span></div>`;
  } else {
    head.innerHTML = `<span class="chev" aria-hidden="true">‹</span>${avs}
    <span class="who"><b>${esc(name)}</b>${status ? `<span${/登録されていません|知らない/.test(status) ? ` class="warnst"` : ""}>${esc(status)}</span>` : ""}</span><span class="app">${esc(scn.app || "")}</span>`;
  }
  $("screen").dataset.scene = scn.type || "dm";
}
function setScene(scn) {
  if (S.scene && JSON.stringify(S.scene) === JSON.stringify(scn)) return;
  const label = scn.app + (scn.who && S.sc.cast[scn.who] && scn.type !== "web" && scn.type !== "home" ? "｜" + (scn.name || S.sc.cast[scn.who].n) : "");
  append(`<div class="scene-div">${esc(label)}</div>`);
  S.scene = scn; S.lastFrom = null;
  setHead();
}
function append(html) {
  const log = $("log");
  const t = document.createElement("div");
  t.innerHTML = html.trim();
  const el = t.firstElementChild;
  if (!reduced) el.classList.add("new");
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

/* ===== 通話中の声の波：電話の相手が話しているあいだ、通話画面に音の波が動く ===== */
let WAVE_T = null;
function voiceWave(text) {
  const head = $("head"); if (!head || !head.classList.contains("h-call")) return;
  clearTimeout(WAVE_T);
  head.classList.add("speaking");
  const f = factor();
  WAVE_T = setTimeout(() => head.classList.remove("speaking"), f > 0 ? Math.min(3600, 700 + text.length * 70) * f : 300);
}
async function showItem(it) {
  if (S.run !== RUN) return;
  const [k, a, b] = it;
  const scn = S.scene || {};
  if (k === "them") {
    const who = b || scn.who;
    const c = S.sc.cast[who] || { n: "", i: "？", h: 0 };
    const showName = scn.type === "live" || (b && b !== scn.who);
    const cont = S.lastFrom === who;
    const slot = cont ? `<span class="av-slot"></span>` : `<span class="av-slot">${av(S.sc, who, true)}</span>`;
    const nm = showName && !cont ? `<span class="nm">${esc(c.n)}</span>` : "";
    if (scn.type === "call" && (!b || b === scn.who)) voiceWave(a);
    if (factor() > 0) {
      const tEl = append(`<div class="row them typing${cont ? " cont" : ""}">${slot}<span class="bub">${nm}<p><i></i><i></i><i></i></p></span></div>`);
      await pause(Math.min(1500, 350 + a.length * 22));
      tEl.remove();
      if (S.run !== RUN) return;
    }
    append(`<div class="row them${cont ? " cont" : ""}">${slot}<span class="bub">${nm}<p>${esc(a)}</p></span><span class="meta">${esc(S.clock)}</span></div>`);
    speak(a, c.h, "them");
    S.lastFrom = who;
    await pause(260);
  } else if (k === "me") {
    await pause(500); sendMe(a); await pause(500);
  } else if (k === "think") {
    await pause(700); append(`<div class="think">${esc(a)}</div>`); S.lastFrom = null; await pause(500);
  } else if (k === "narr") {
    await pause(300); append(`<div class="narr">${esc(a)}</div>`); S.lastFrom = null; speak(a, 0, "narr"); await pause(900);
  } else if (k === "sys") {
    await pause(300); append(`<div class="sys">${esc(a)}</div>`); S.lastFrom = null; await pause(500);
  } else if (k === "card") {
    await pause(400);
    const wide = ["web", "home", "live", "call"].includes(scn.type);
    append(`<div class="shot${wide ? " wide" : ""}"><div class="t">${esc(a)}</div><ul>${b.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`);
    speak(`${a}。${b.join("。")}`, 0, "narr");
    S.lastFrom = null; await pause(1100);
  }
}
function sendMe(text) {
  const el = append(`<div class="row me"><span class="bub"><p>${esc(text)}</p></span><span class="meta"><span class="rd"></span>${esc(S.clock)}</span></div>`);
  S.lastFrom = "__me";
  const rd = el.querySelector(".rd");
  if (S.scene && (S.scene.type === "talk" || S.scene.type === "dm")) setTimeout(() => { rd.textContent = "既読 "; }, 600 * (TEMPO[prefs.tempo] || 0.3));
}

/* ===== 時間がとぶ演出：「1か月後」などで、画面が暗くなり、時間の文字が流れる ===== */
async function timeSkip(label) {
  if (prefs.easy || reduced || factor() === 0 || S.skip) return;
  const old = $("tskip"); if (old) old.remove();
  $("screen").insertAdjacentHTML("beforeend", `<div class="tskip" id="tskip" aria-hidden="true"><span class="ts-dial"><i></i></span><span class="ts-line"></span><b>${esc(label)}</b><span class="ts-line"></span></div>`);
  await pause(1200);
  const el = $("tskip"); if (el) { el.classList.add("out"); setTimeout(() => el.remove(), 380); }
}
async function playNode(id) {
  const my = S.run;
  const n = S.sc.nodes[id];
  if (!n) { console.error("missing node", id); return; }
  S.node = id; S.skip = false; S.path.push(id);
  const pn = prog(S.sc.id);
  pn.nodes ||= [];
  if (!pn.nodes.includes(id)) { pn.nodes.push(id); saveProgress(); }
  renderMap();
  if (n.scene) setScene(n.scene);
  if (n.time) {
    if (/^\d{1,2}:\d{2}$/.test(n.time)) S.clock = n.time;
    else { const m = n.time.match(/(\d{1,2}:\d{2})/); if (m) S.clock = m[1]; }
    $("clock").textContent = S.clock;
    append(`<div class="timechip">${esc(n.time)}</div>`);
    if (!/^\d{1,2}:\d{2}$/.test(n.time) && id !== S.sc.start) { await timeSkip(n.time); if (my !== RUN) return; }
  }
  if (n.end) return endFlow(id, n);
  waitingUI();
  for (const it of n.log) { await showItem(it); if (my !== RUN) return; }
  if (S.honne) { await showHonne(n); if (my !== RUN) return; }
  choicesUI(n);
}
function waitingUI() {
  $("composer").innerHTML = `<div class="waiting"><span>会話が進んでいます…</span><button class="linkbtn" type="button" id="skipBtn">すぐ表示</button></div>`;
  $("skipBtn").onclick = () => { S.skip = true; };
}
/* ===== 返信の幅：えらぶ・聞き返す・相談する・自分の言葉で返す ===== */
const ICON_ASK = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M10 8.6a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M12 13.6v.1"/></svg>`;
const ICON_TALK = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M14.5 14.6c2.8 0 6 1.8 6 5.4"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>`;
/* 聞き返したときの、こちらの質問と、相手の返し（サインの系統ごと） */
const ASKQ = {
  umai: "そんなにうまい話、本当にあるんですか？", isogi: "どうして、そんなに急ぐんですか？", himitsu: "どうして、だれにも言っちゃだめなんですか？",
  kane: "お金のことなので、家族に確認してからでもいいですか？", kojin: "どうして、それを教える必要があるんですか？", kankei: "ちょっと考えさせてもらってもいい？",
  jouken: "条件を、書面で見せてもらえますか？", tsuuchi: "本当に、公式からの連絡ですか？"
};
const PRESS = {
  umai: ["本当ですよ。もうたくさんの人がやってます", "こんなチャンス、めったにないですよ。もったいない"],
  isogi: ["今日中じゃないと間に合わないんです。急いでください", "考えている時間はないですよ。枠が埋まっちゃいます"],
  himitsu: ["これは、ほかの人には言わないでくださいね", "家族に話すと話がややこしくなるので、ここだけで"],
  kane: ["いえ、急ぎなので今お願いします", "確認しなくてもだいじょうぶです。こちらでちゃんとやりますから"],
  kojin: ["確認のためなので、だいじょうぶですよ", "決まりなので、みなさんにお願いしているんです"],
  kankei: ["え、信じてくれないの？ ちょっと悲しいな", "あなただから話してるんだよ。ほかの人には頼めない"],
  jouken: ["細かいことは、あとでちゃんと説明しますね", "だいじょうぶ、ほかの人もみんなそうしてますから"],
  tsuuchi: ["正式なお知らせです。ご安心ください", "公式の案内です。早めに手続きをお願いします"]
};
const ASK_THINK = ["（…質問の答えに、なってない気がする）", "（さっきと同じことを、言い方を変えて言ってるだけ…？）"];
/* 自由入力の読み取りに使うことば */
const W_SAFE = ["断","やめ","無理","むり","結構","けっこう","遠慮","いらない","要らない","しない","しません","ない","ません","確認","確かめ","たしかめ","調べ","しらべ","検索","公式","かけ直","かけなお","折り返","相談","親","家族","母","父","おかあ","おとう","ママ","パパ","兄","姉","友","先生","学校","学生課","188","110","9110","警察","消費","ブロック","通報","無視","スルー","切る","切り","閉じ","削除","消す","保留","考え","待って","まって","後で","あとで","怪し","あやし","詐欺","さぎ","おかしい","書面","契約書","持ち帰","比べ","くらべ","会って","手渡し","止め","とめ","解約","返品","クーリング"];
const W_RISK = ["はい","お願いします","おねがい","わかりました","分かりました","了解","りょうかい","ok","オッケー","いいよ","いいですよ","いいですね","やります","やりたい","参加します","参加したい","買います","買う","買いたい","払います","払う","はらう","振り込みます","振り込む","振込します","送金","送ります","送る","教えます","渡します","渡す","契約します","登録します","登録する","インストール","ダウンロード","開く","開きます","ひらく","タップ","押す","押します","行きます","行く","信じ","ぜひ","申し込","入ります","応募","任せ","まかせ","よろしく","乗ります","のります"];
const W_ASK = /[?？]$|なんで|なぜ|どうして|本当|ほんと|ホント|どこ|だれ|誰|何の|なにの|くわしく|詳しく|証拠|根拠|会社名|名前は/;
const grams = (s) => { s = s.normalize("NFKC").replace(/[\s、。！？!?「」『』…・]/g, ""); const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
const simOf = (a, b) => { const A = grams(a), B = grams(b); let k = 0; A.forEach((x) => { if (B.has(x)) k++; }); return k / Math.max(1, Math.min(A.size, B.size)); };
const maskTx = (t) => t.replace(/[0-9０-９]{4,}/g, (m) => "●".repeat(m.length)).replace(/\S+@\S+/g, "●●●@●●●");
const talkScene = () => ["dm", "talk", "call", "live"].includes((S.scene || {}).type);

function nodeInfo(n) {
  const risky = n.choices.find((c) => c.ok === false && c.sign && S.sc.signs[c.sign]);
  const safe = n.choices.find((c) => c.ok === true);
  const rcat = risky ? S.sc.signs[risky.sign].cat : null;
  const lastThem = [...n.log].reverse().find((l) => l[0] === "them");
  const who = lastThem ? (lastThem[2] || (S.scene || {}).who) : null;
  const own = risky && S.sc.signs[risky.sign].ask;
  /* 相手が家族や友だちなど「だます側」でないときは、共通の聞き返しは出さない */
  const wc = who && S.sc.cast[who];
  const ally = !!(wc && /祖|おばあ|おじい|母|父|姉|兄|弟|妹|友|同級生|先生|本物|公式|親|家族|カード裏/.test(wc.n + (wc.r || "")));
  return { risky, safe, rcat, who, ally, askQ: own ? own[0] : ASKQ[rcat], press: own ? own.slice(1) : PRESS[rcat],
    canAsk: !!(risky && who && talkScene() && (own || (ASKQ[rcat] && !ally)) && (S.asked[S.node] || 0) < 2),
    canTalk: !!(risky && safe && rcat !== "soudan" && !/相談/.test(safe.say || safe.act)) };
}
const inPerson = () => ["call", "live"].includes((S.scene || {}).type);
function choicesUI(n, note) {
  { const comp = $("composer"); delete comp.dataset.deciding; comp.classList.remove("deciding"); }
  S.asked ||= {};
  const order = (S.order[S.node] ||= n.choices.map((_, i) => i).sort(() => Math.random() - 0.5));
  const hintSign = n.choices.map((c) => c.sign && S.sc.signs[c.sign]).find(Boolean);
  const info = nodeInfo(n);
  const keys = "ABCDEFGHIJ"; let k = 0;
  /* 大きな選択肢は3つ：もとの2つに「ためらう」を足す。ためらうと、相手は手口を変えてくる */
  S.hes ||= {}; S.hpos ||= {};
  const canHes = !!(info.risky && info.safe && n.choices.length === 2 && !S.hes[S.node] && !S.pending);
  const hesT = talkScene() ? (inPerson() ? "うーん…少し考えさせてください" : "うーん…ちょっと考えさせて") : "すぐには決めず、もう一度よく読む";
  const slots = order.map((i) => ({ i }));
  if (canHes) { if (S.hpos[S.node] === undefined) S.hpos[S.node] = Math.floor(Math.random() * 3); slots.splice(S.hpos[S.node], 0, { h: true }); }
  const main = slots.map((s) => {
    if (s.h) return `<button class="choice ${talkScene() ? "say" : "do"} hes" type="button" id="ch-${S.node}-hes"><span class="ch-key" aria-hidden="true">${keys[k++]}</span><span class="ch-tx"><small>${talkScene() ? "返信する" : "行動する"}</small><span>${esc(hesT)}</span></span><span class="ch-ic" aria-hidden="true">${talkScene() ? ICON_SAY : ICON_ACT}</span></button>`;
    const c = n.choices[s.i];
    return `<button class="choice ${c.say ? "say" : "do"}" type="button" id="ch-${S.node}-${s.i}" data-i="${s.i}"><span class="ch-key" aria-hidden="true">${keys[k++]}</span><span class="ch-tx"><small>${c.say ? "返信する" : "行動する"}</small><span>${esc(c.say || c.act)}</span></span><span class="ch-ic" aria-hidden="true">${c.say ? ICON_SAY : ICON_ACT}</span></button>`;
  }).join("");
  const askT = info.canAsk ? ((S.asked[S.node] || 0) ? "まだ納得できない。もう一度たずねる" : info.askQ) : "";
  /* 選択肢のほかに取れる行動：聞き返す・相談する・調べる・時間をおく・記録を残す */
  S.searched ||= {}; S.waited ||= {}; S.memo ||= {};
  const sgn = info.risky ? S.sc.signs[info.risky.sign] : hintSign;
  const acts = [];
  if (info.who && !info.ally && talkScene() && !S.checkedSc) acts.push(["check", "相手を確かめる", inPerson() ? ((S.scene || {}).type === "call" ? "電話番号を検索する" : "名刺を見せてもらう") : "プロフィールを見る", ICON_CHECK]);
  if (info.canAsk) acts.push(["ask", "聞き返す", askT, ICON_ASK]);
  if (info.canTalk) acts.push(["talk", "相談する", inPerson() ? "待ってもらって、家族や友だちに相談" : "返事の前に、家族や友だちに相談", ICON_TALK]);
  if (sgn && !S.searched[S.node]) acts.push(["search", "調べる", "ネットで、似た話がないか検索", ICON_SEARCH]);
  if (info.risky && !S.waited[S.node]) acts.push(["wait", "時間をおく", "すぐには返事をしない", ICON_WAIT]);
  if (!S.memo[S.node] && S.scene && S.scene.type !== "home") acts.push(["memo", "記録を残す", inPerson() ? "相手の名前や話をメモする" : "画面をスクリーンショット", ICON_MEMO]);
  const extra = acts.map(([x, t, sub, ic]) => `<button class="act-chip" type="button" id="ch-${S.node}-${x}" data-x="${x}"><span class="ch-key" aria-hidden="true">${keys[k++]}</span><span class="ac-ic" aria-hidden="true">${ic}</span><span class="ac-tx"><b>${t}</b><small>${esc(sub)}</small></span></button>`).join("");
  const ph = talkScene() ? "自分の言葉で返信（例：親に相談します）" : "自分ならどうする？（例：公式サイトで確かめる）";
  $("composer").innerHTML = `<div class="q"><span>あなたならどうする？</span>${hintSign ? `<button class="linkbtn hintbtn" type="button" id="hintBtn">${mascot("sm")}ミヌケのヒント</button>` : ""}</div>
    ${note ? `<div class="readnote" role="status">${mascot("sm")}<span>${note}</span></div>` : ""}
    <div class="choices">${main}</div>${extra ? `<div class="acts" role="group" aria-label="ほかの行動"><span class="acts-h">ほかの行動</span>${extra}</div>` : ""}
    <form class="freebar" id="freeForm" autocomplete="off"><label class="sr" for="freeIn">${talkScene() ? "自分の言葉で返信する" : "自分ならどうするか書く"}</label>
      <input id="freeIn" type="text" maxlength="80" enterkeyhint="send" placeholder="${ph}" value="${esc(S.pending || "")}">
      <button type="submit" id="freeSend" aria-label="送信">${ICON_SEND}</button></form>
    <p class="kbdhint">キーボードの <kbd>A</kbd>〜<kbd>${keys[k - 1]}</kbd> でもえらべます</p>`;
  $("composer").querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => {
    const comp = $("composer");
    if (comp.dataset.deciding) return;
    const c = n.choices[+b.dataset.i], t = S.pending, my = S.run; S.pending = null;
    const go = () => { delete comp.dataset.deciding; choose(c, t ? { myText: t, read: "あなたがえらんだ選択" } : null); };
    /* 決断の演出：えらんだボタンが光って浮かび、ほかの選択肢が沈んで消える */
    const f = factor();
    if (prefs.easy || reduced || f === 0) return go();
    comp.dataset.deciding = "1";
    comp.querySelectorAll("[data-i]").forEach((x) => x.classList.add(x === b ? "picked" : "dropped"));
    comp.classList.add("deciding");
    setTimeout(() => { comp.classList.remove("deciding"); if (my === RUN) go(); else delete comp.dataset.deciding; }, 380 * Math.max(0.5, f));
  }));
  const ab = $(`ch-${S.node}-ask`); if (ab) ab.onclick = () => { bumpAct("ask"); askBack(n, askT); };
  const tb = $(`ch-${S.node}-talk`); if (tb) tb.onclick = () => { bumpAct("talk"); consult(n); };
  const hb = $(`ch-${S.node}-hes`); if (hb) hb.onclick = () => { bumpAct("hes"); hesitate(n, hesT); };
  [["check", checkUp], ["search", searchUp], ["wait", waitUp], ["memo", memoUp]].forEach(([x, f]) => { const b = $(`ch-${S.node}-${x}`); if (b) b.onclick = () => { bumpAct(x); f(n); }; });
  $("freeForm").onsubmit = (e) => { e.preventDefault(); const v = $("freeIn").value.trim(); if (v) { bumpAct("free"); freeReply(n, v); } };
  if ($("hintBtn")) $("hintBtn").onclick = () => {
    const cat = CATS[hintSign.cat];
    S.hints = (S.hints || 0) + 1;
    $("hintBtn").outerHTML = `<span class="hint" role="status">${mascot("sm")}<span>この場面には「<b>${esc(cat.n)}</b>」のサインがかくれているかも。${esc(cat.d)}</span></span>`;
  };
  armNudge(n, info);
  const firstBtn = $("composer").querySelector("button.choice");
  if (firstBtn && document.activeElement && document.activeElement.closest && document.activeElement.closest("#composer")) firstBtn.focus({ preventScroll: true });
}
/* ===== 本音モード：相手の「心の声」を見ながら、もう一度体験する ===== */
let HONNE_NEXT = false;
const HONNE = {
  umai:    ["おいしい話に見えれば、細かいことは聞いてこない", "数字を大きく見せておけば、夢を見てくれる"],
  isogi:   ["考えさせたら負け。今すぐ決めさせよう", "「今だけ」と言えば、比べるひまはない"],
  himitsu: ["家族や友だちに話されたら、ここで終わりだ", "ほかの人の目が届かない場所へ連れていこう"],
  kane:    ["この払い方なら、あとから取り返されない", "一度払わせれば、次も払わせやすい"],
  kojin:   ["この情報さえ手に入れば、あとは好きにできる", "「確認のため」と言えば、たいてい教えてくれる"],
  kankei:  ["やさしくしておけば、断りづらくなる", "信じてもらえたら、こっちのものだ"],
  jouken:  ["大事な条件は、読まれる前に決めさせる", "小さな文字までは、だれも読まない"],
  tsuuchi: ["本物っぽく見せれば、疑わない", "不安にさせれば、リンクを押してくれる"]
};
const HONNE_OK = ["……気づかれた。こいつは手ごわい", "ちっ、ここで止まるか", "……次は別の手でいこう"];
const HONNE_NG = ["よし、かかった", "思ったとおり。このまま進めよう", "あと一押しだ"];
function honneWho(n) {
  S.asked ||= {};
  const info = nodeInfo(n), who = info.who || (S.scene || {}).who, c = who && S.sc.cast[who];
  if (!info.risky || !c || info.ally || ALLY_RE.test(c.n + (c.r || ""))) return null;
  return { info, who, c };
}
function honneHTML(who, text) {
  return `<div class="honne"><span class="hn-h">${av(S.sc, who, true)}<b>${esc(S.sc.cast[who].n)}</b>の本音</span><p>（${esc(text)}）</p></div>`;
}
async function showHonne(n) {
  const h = honneWho(n); if (!h) return;
  S.honneWho = h.who; prog(S.sc.id).honne = true;
  const lines = HONNE[h.info.rcat]; if (!lines) return;
  await pause(400);
  append(honneHTML(h.who, lines[S.path.length % lines.length])); S.lastFrom = null;
  await pause(900);
}
function honneReact(ok) {
  const who = S.honneWho; if (!who || !S.sc.cast[who]) return false;
  const arr = ok ? HONNE_OK : HONNE_NG;
  append(honneHTML(who, arr[S.path.length % arr.length]).replace('class="honne"', `class="honne ${ok ? "hn-ok" : "hn-ng"}"`)); S.lastFrom = null;
  S.honneWho = null;
  return true;
}
/* ===== 相手の催促：選択肢の前で迷っていると、相手が追いのメッセージを送ってくる ===== */
const NUDGE = {
  umai:    ["まだ迷ってます？ ほかにも希望の人がいるので", "こんなチャンス、二度とないですよ。返事ください！"],
  isogi:   ["まだですか？ 時間がないんです", "あと10分で締め切ります。急いでください！"],
  himitsu: ["既読ついてますよね？ だれかに話したりしてないですよね", "ここだけの話なので、早めに返事くださいね"],
  kane:    ["手続き、まだですか？ 今日中にお願いします", "このままだと、あなたの分がなくなってしまいます"],
  kojin:   ["確認がとれないと、先に進めないんです", "入力、まだですか？ 期限が近いです"],
  kankei:  ["……返事ないけど、だいじょうぶ？", "既読ついてるのに……。何か気にさわった？"],
  jouken:  ["細かいことは気にしなくて平気ですよ", "みなさん、すぐ決めてますよ。あとはあなただけです"],
  tsuuchi: ["【再送】お手続きがまだ完了していません", "【最終通知】本日中にお手続きください"]
};
const NUDGE_LIVE = ["（相手が、時計をちらっと見た）", "（相手が、少し身を乗り出してきた）"];
let nudgeTimer = null;
function armNudge(n, info) {
  clearTimeout(nudgeTimer);
  const who = info.who || (S.scene || {}).who, wc = who && S.sc.cast[who];
  if (prefs.easy || !info.risky || !wc || info.ally || ALLY_RE.test(wc.n + (wc.r || "")) || !talkScene() && (S.scene || {}).type !== "web") return;
  S.nudged ||= {};
  const node = S.node, my = S.run, cnt = S.nudged[node] || 0;
  if (cnt >= 2) return;
  const lines = NUDGE[info.rcat] || NUDGE.isogi;
  nudgeTimer = setTimeout(() => {
    if (my !== RUN || S.node !== node || !$("composer").querySelector("button.choice:not(:disabled)") || document.hidden || $("v-play").hidden) return;
    S.nudged[node] = cnt + 1;
    S.nudges = (S.nudges || 0) + 1;
    const live = inPerson() && (S.scene || {}).type === "live";
    const c = S.sc.cast[who] || { n: "" };
    if ((S.scene || {}).type === "web") pushNudge(c.n, lines[cnt]);
    else if (live) append(`<div class="narr nudge-narr">${esc(NUDGE_LIVE[cnt])}</div>`);
    else {
      const cont = S.lastFrom === who;
      append(`<div class="row them nag${cont ? " cont" : ""}"><span class="av-slot">${cont ? "" : av(S.sc, who, true)}</span><span class="bub"><p>${esc(lines[cnt])}</p></span><span class="meta">${esc(S.clock)}</span></div>`);
      S.lastFrom = who;
      speak(lines[cnt], (S.sc.cast[who] || {}).h, "them");
    }
    const sc = $("screen");
    if (!reduced) { sc.classList.remove("nudging"); void sc.offsetWidth; sc.classList.add("nudging"); }
    sfx("nudge");
    const q = $("composer").querySelector(".q > span");
    if (q && !q.querySelector(".nudge-tag")) q.insertAdjacentHTML("beforeend", `<em class="nudge-tag">${(S.scene || {}).type === "web" ? "通知がくり返し届いている" : "相手が返事をせかしている"}</em>`);
    armNudge(n, info);
  }, cnt ? 14000 : 11000);
}
/* 画面の上から落ちてくる通知（催促用の小さなバナー） */
function pushNudge(name, text) {
  const sc = $("screen"); if (!sc) return;
  sc.querySelectorAll(".nudge-push").forEach((x) => x.remove());
  sc.insertAdjacentHTML("beforeend", `<div class="pushn nudge-push" role="status"><span class="pn-app">新着メッセージ<i>いま</i></span><b>${esc(name || "（送り主）")}</b><span class="pn-tx">${esc(text)}</span></div>`);
  setTimeout(() => sc.querySelectorAll(".nudge-push").forEach((x) => x.remove()), 3200);
}
/* ===== 選択肢のほかの行動：調べる・時間をおく・記録を残す（物語は分かれず、その場面にもどってくる） ===== */
const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>`;
const ICON_WAIT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`;
const ICON_MEMO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>`;
function searchWord(info) {
  const scn = S.scene || {};
  if (scn.type === "web" && /[a-z0-9-]+\.[a-z]{2,}/i.test(scn.status || "")) return scn.status;
  const c = info.who && S.sc.cast[info.who];
  const nm = c ? c.n.replace(/（？）|\(\?\)/g, "").trim() : "";
  return (nm && nm.length <= 14 ? nm + " " : "") + S.sc.tag;
}
/* ===== 検索の演出：スマホにブラウザが開き、検索語が打ちこまれ、注意喚起の結果が上から並ぶ ===== */
async function searchFx(q, sg) {
  if (prefs.easy || reduced || factor() === 0 || S.skip) return;
  const old = $("sfSheet"); if (old) old.remove();
  const chars = [...q].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join("");
  $("screen").insertAdjacentHTML("beforeend", `<div class="sf-sheet" id="sfSheet" aria-hidden="true" style="--n:${[...q].length}">
    <div class="sf-bar"><span class="sf-lens"></span><span class="sf-q">${chars}</span><span class="sf-caret"></span></div>
    <div class="sf-list">
      <div class="sf-item warn" style="--k:0"><span class="sf-tag">注意喚起</span><b>${/「/.test(sg.t) ? esc(sg.t) : `『${esc(sg.t)}』`}に注意</b><small>消費生活センター・警察などのお知らせ</small></div>
      <div class="sf-item" style="--k:1"><span class="sf-tag sns">SNS</span><b>「同じ連絡が来た。無視して正解だった」</b><small>みんなの書きこみ</small></div>
      <div class="sf-item" style="--k:2"><span class="sf-tag ok">相談</span><b>消費者ホットライン 188・#9110</b><small>公式の相談窓口</small></div>
    </div></div>`);
  const sh = $("sfSheet");
  await pause(2300); if (!sh.isConnected) return;
  sh.classList.add("out"); setTimeout(() => sh.remove(), 340);
}
async function searchUp(n) {
  const my = S.run, info = nodeInfo(n);
  const sg = info.risky ? S.sc.signs[info.risky.sign] : n.choices.map((c) => c.sign && S.sc.signs[c.sign]).find(Boolean);
  lockComposer();
  S.searched[S.node] = true;
  const q = searchWord(info);
  append(`<div class="act">「${esc(q)}」で検索してみた</div>`); S.lastFrom = null;
  if (!S.didSearch) { S.didSearch = true; S.xp = (S.xp || 0) + addXP(2); }
  if (sg) { await searchFx(q, sg); if (my !== RUN) return; }
  await pause(600); if (my !== RUN) return;
  const cat = CATS[sg.cat];
  append(`<div class="shot wide search-res"><div class="t">検索結果</div><ul>
    <li><b>注意喚起のページ</b>『${esc(sg.t)}』に注意。${esc(sg.d)}</li>
    <li><b>SNSの書きこみ</b>「同じような連絡が来た。あやしいと思って無視した」</li>
    <li><b>相談窓口</b>困ったときは、消費者ホットライン188・警察相談専用電話#9110へ</li></ul></div>`);
  S.lastFrom = null;
  await pause(1100); if (my !== RUN) return;
  await showItem(["think", "（調べてみると、同じような話がいくつも出てくる…）"]); if (my !== RUN) return;
  choicesUI(n, "調べるのは、とても強い方法。名前や番号、文面で検索すると、同じ手口の注意喚起が見つかることがあります。");
}
/* ===== ひと呼吸の演出：画面がしずまり、丸が広がって縮む「すって・はいて」で、気持ちを落ちつける ===== */
async function breathFx() {
  if (prefs.easy || reduced || factor() === 0 || S.skip) return;
  const old = $("brSheet"); if (old) old.remove();
  $("screen").insertAdjacentHTML("beforeend", `<div class="br-sheet" id="brSheet" aria-hidden="true">
    <div class="br-ring"><span class="br-core"></span></div>
    <b class="br-word"><span class="in">すって…</span><span class="out">はいて…</span></b>
    <small>返事は、あとでいい。</small></div>`);
  const sh = $("brSheet");
  await pause(2600); if (!sh.isConnected) return;
  sh.classList.add("out"); setTimeout(() => sh.remove(), 400);
}
async function waitUp(n) {
  const my = S.run, info = nodeInfo(n);
  lockComposer();
  S.waited[S.node] = true;
  append(`<div class="act">すぐには返事をせず、少し時間をおくことにした</div>`); S.lastFrom = null;
  await pause(500); if (my !== RUN) return;
  await breathFx(); if (my !== RUN) return;
  append(`<div class="timechip">しばらくして</div>`);
  if (info.who && !info.ally && talkScene()) {
    await showItem(["them", PRESS.isogi[0], info.who]); if (my !== RUN) return;
    await showItem(["think", "（時間をおいたら、急かしてきた…）"]); if (my !== RUN) return;
    choicesUI(n, "時間をおくと、相手が急かしてくることがあります。急かすこと自体が、あやしいサインです。");
  } else {
    await showItem(["think", "（時間をおいて見直すと、さっきは気づかなかったところが目に入る…）"]); if (my !== RUN) return;
    choicesUI(n, "時間をおくと、冷静になれます。「今すぐ」と言われても、いったん止まってだいじょうぶ。");
  }
}
/* ===== 記録の演出：シャッターが光り、写真が画面の角の「記録」に飛んでいく ===== */
function shutterFx(memo) {
  const scr = $("screen"); if (!scr) return;
  let badge = $("evBadge");
  if (!badge) { scr.insertAdjacentHTML("beforeend", `<div class="ev-badge" id="evBadge" aria-hidden="true"><span class="ev-ic">${memo ? "✎" : "◉"}</span><b>0</b><small>記録</small></div>`); badge = $("evBadge"); }
  const lg = $("log"); if (lg) badge.style.top = Math.round(lg.getBoundingClientRect().top - scr.getBoundingClientRect().top + 10) + "px";
  const bump = () => { badge.querySelector("b").textContent = S.evidence || 0; badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); };
  if (prefs.easy || reduced || factor() === 0) return bump();
  const last = [...$("log").querySelectorAll(".row.them p, .shot .t")].pop();
  const txt = last ? last.textContent.slice(0, 40) : "";
  scr.insertAdjacentHTML("beforeend", `<div class="ev-flash${memo ? " memo" : ""}" aria-hidden="true"></div><div class="ev-shot${memo ? " memo" : ""}" aria-hidden="true"><i></i><i></i><span>${esc(txt)}</span><i></i></div>`);
  const fl = scr.querySelector(".ev-flash:last-of-type"), shot = scr.querySelector(".ev-shot:last-of-type");
  setTimeout(() => { fl && fl.remove(); }, 500);
  setTimeout(() => { shot && shot.remove(); bump(); }, 900);
}
async function memoUp(n) {
  const my = S.run;
  lockComposer();
  S.memo[S.node] = true;
  S.evidence = (S.evidence || 0) + 1;
  append(`<div class="act">${inPerson() ? "相手の名前や話したことを、スマホにメモした" : "画面をスクリーンショットして保存した"}</div>`); S.lastFrom = null;
  if (S.evidence === 1) S.xp = (S.xp || 0) + addXP(2);
  shutterFx(inPerson());
  await pause(400); if (my !== RUN) return;
  append(`<div class="chip ok"><i></i><span>記録を残した（${S.evidence}件）　相談するときの大事な証拠になります</span></div>`);
  await pause(300); if (my !== RUN) return;
  choicesUI(n);
}
/* ===== 相手の演出：ためらう・通知・取り消し・被害 ===== */
/* ためらったときに、相手が出してくる「ゆずった条件」や「気持ちへのうったえ」 */
const COMPROMISE = {
  umai: "わかりました。あなたにだけ、特別に条件をもっとよくしますね",
  isogi: "じゃあ、今日の夜までは待ちます。でも、それを過ぎたらもう無理ですよ",
  himitsu: "じゃあ、だれにも言わずに、ふたりだけで決めよう？",
  kane: "じゃあ、最初は半分だけでもいいですよ。それなら負担も少ないでしょう？",
  kojin: "じゃあ、名前と生年月日だけでもいいので、教えてもらえますか",
  kankei: "信じてくれないんだ…。ちょっとさみしいな",
  jouken: "細かい条件は、あとでちゃんと説明しますから。まずは形だけ",
  tsuuchi: "これは正式なお手続きです。ご不安なら、まずは確認だけでも"
};
async function hesitate(n, text) {
  const my = S.run, info = nodeInfo(n);
  lockComposer();
  S.hes[S.node] = true;
  if (talkScene()) sendMe(text); else { append(`<div class="act">${esc(text)}</div>`); S.lastFrom = null; }
  await pause(500); if (my !== RUN) return;
  if (talkScene() && info.who && !info.ally) {
    /* 一度打ちかけて取り消す → 言い方を変えて、ゆずった条件を出してくる */
    if (!inPerson()) {
      append(`<div class="row them unsent"><span class="av-slot"></span><span class="bub"><p>メッセージの送信を取り消しました</p></span></div>`);
      S.lastFrom = null;
      await pause(700); if (my !== RUN) return;
    }
    await showItem(["them", COMPROMISE[info.rcat] || COMPROMISE.kane, info.who]); if (my !== RUN) return;
    choicesUI(n, "ためらうと、相手は条件をゆるめたり、気持ちにうったえたりしてきます。「少しだけなら」と思わせるのも、よくある手口です。");
  } else {
    await showItem(["think", "（読み返すと、さっきは流していた言葉が、なんだか気になる…）"]); if (my !== RUN) return;
    choicesUI(n, "すぐに決めないのは、いい判断。もう一度見て、どれにするか選ぼう。");
  }
}
/* スマホ画面の上から出てくる通知 */
function pushNote(app, title, text, tone) {
  const scr = $("screen");
  if (!scr) return;
  const el = document.createElement("div");
  el.className = "pushn" + (tone ? " " + tone : "");
  el.setAttribute("role", "status");
  el.innerHTML = `<span class="pn-app">${esc(app)}<i>いま</i></span><b>${esc(title)}</b><span class="pn-tx">${esc(text)}</span>`;
  scr.appendChild(el);
  setTimeout(() => el.classList.add("out"), reduced ? 2600 : 3200);
  setTimeout(() => el.remove(), reduced ? 2700 : 3600);
}
function hitScreen() {
  const scr = $("screen");
  if (!scr || reduced) return;
  scr.classList.remove("hit"); void scr.offsetWidth; scr.classList.add("hit");
  setTimeout(() => scr.classList.remove("hit"), 900);
}
/* 被害の知らせ：どんなサインを見逃したかで、通知の中身を変える */
const HARM = {
  kojin: ["カード会社", "ご利用のお知らせ", "海外のサイトで ¥48,000 のご利用がありました"],
  tsuuchi: ["カード会社", "ご利用のお知らせ", "見覚えのないサイトで ¥36,500 のご利用がありました"],
  jouken: ["メール", "ご契約ありがとうございます", "お支払い総額 ¥330,000（分割24回）"],
  default: ["銀行アプリ", "お振込みのお知らせ", "¥50,000 のお振込みが完了しました。残高が減っています"]
};
const HARM_TEXT = {
  kane: "言われるままにお金を払ってしまった。もう戻ってこない",
  kojin: "伝えてしまった情報から、カードの情報を抜き取られた",
  tsuuchi: "リンク先で入力した情報を抜き取られた",
  umai: "「もうかる」という言葉にのって、お金を払ってしまった",
  isogi: "急かされるまま手続きして、お金を失った",
  himitsu: "だれにも相談しないまま話が進み、お金を失った",
  kankei: "相手を信じて、お金を渡してしまった",
  jouken: "よく読まないままサインして、高額な契約をしてしまった"
};
function harmFx(cat) {
  const h = HARM[cat] || HARM.default;
  pushNote(h[0], h[1], h[2], "bad");
  hitScreen();
  sfx("stop");
}
/* ===== 相手を確かめる：プロフィール・電話番号・名刺を見て、あやしさに気づく ===== */
const ICON_CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6 1.6 0 3 .5 4 1.4"/><path d="M15 18l2 2 4-4"/></svg>`;
const CHECK_TXT = {
  sns: [["アカウントの作成：3日前", "アカウントの作成：2週間前", "アカウントの作成：先月"],
    ["投稿は3件だけ", "同じ宣伝の投稿ばかり", "ほかの人の写真を使っているみたい"],
    ["フォロワーは多いのに、いいねがほとんどない", "フォローしている人の数が、フォロワーよりずっと多い", "コメント欄に「詐欺では？」という書きこみ"]],
  call: [["この番号の口コミ：「詐欺の電話」の報告が12件", "この番号の口コミ：「しつこい勧誘」の報告が8件", "この番号の口コミ：海外からの発信の可能性"],
    ["公式サイトに書かれた番号とはちがう", "会社の名前で検索しても、番号が出てこない", "名のった会社の公式サイトには「この番号から電話はしません」"]],
  live: [["会社名：〇〇サービス（住所が書いていない）", "会社名だけで、担当者の名前がない", "担当者の名前が、手書きで書き足してある"],
    ["連絡先が携帯電話の番号だけ", "検索しても、会社のホームページが出てこない", "名のった会社に電話すると「そのような者はいません」"]]
};
async function checkUp(n) {
  const my = S.run, info = nodeInfo(n), type = (S.scene || {}).type;
  lockComposer();
  S.checkedSc = true;
  const seed = [...S.sc.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const pick = (arr, i) => arr[(seed + i * 7) % arr.length];
  const c = S.sc.cast[info.who] || {};
  const kind = type === "call" ? "call" : type === "live" ? "live" : "sns";
  const act = kind === "call" ? "電話番号を、ネットで検索してみた" : kind === "live" ? "名刺を見せてもらった" : `${c.n || "相手"}のプロフィールを確かめた`;
  append(`<div class="act">${esc(act)}</div>`); S.lastFrom = null;
  if (!S.didCheck) { S.didCheck = true; S.xp = (S.xp || 0) + addXP(2); }
  await pause(600); if (my !== RUN) return;
  const lines = CHECK_TXT[kind].map((arr, i) => pick(arr, i));
  append(`<div class="shot wide check-res"><div class="t">${kind === "call" ? "番号の検索結果" : kind === "live" ? "名刺" : "プロフィール"}${c.n ? "：" + esc(c.n) : ""}</div><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`);
  S.lastFrom = null;
  await pause(1100); if (my !== RUN) return;
  await showItem(["think", "（…あやしいところが、いくつもある）"]); if (my !== RUN) return;
  choicesUI(n, "相手を確かめるのは、とても強い方法。アカウントの新しさ、投稿の中身、電話番号の口コミ、会社の住所。どれか1つでもおかしければ、立ち止まろう。");
}
function lockComposer() { $("composer").querySelectorAll("button, input").forEach((b) => (b.disabled = true)); }
/* 聞き返す：相手は答えずに、別の言い方でせかしてくる。そこにもサインが出る */
async function askBack(n, text, typed) {
  const my = S.run, info = nodeInfo(n);
  lockComposer();
  const nth = (S.asked[S.node] = (S.asked[S.node] || 0) + 1);
  sendMe(typed ? maskTx(typed) : text);
  if (nth === 1) S.xp = (S.xp || 0) + addXP(2);
  await pause(500); if (my !== RUN) return;
  const lines = info.press;
  await showItem(["them", lines[(nth - 1) % lines.length], info.who]); if (my !== RUN) return;
  await showItem(["think", ASK_THINK[(nth - 1) % ASK_THINK.length]]); if (my !== RUN) return;
  choicesUI(n, nth === 1 ? "聞き返すと、相手の本音が見えることがあります。答えの中にもサインがないか、見てみよう。" : null);
}
/* 相談する：信頼できる人のアドバイスを受けて、気づける側の選択へ */
/* ===== 相談の演出：画面の下から家族とのトークが上がり、相談してアドバイスが返ってくる ===== */
const CS_WHO = { chu: ["お母さん", "母", 330], kou: ["お母さん", "母", 330], dai: ["先輩", "先", 150], sha: ["パートナー", "パ", 200], kazoku: ["お母さん", "母", 330] };
async function consultFx(adv) {
  if (prefs.easy || reduced || factor() === 0 || S.skip) return;
  const who = CS_WHO[roleOf(S.sc)] || ["家族", "家", 330];
  const last = [...$("log").querySelectorAll(".row.them p, .shot .t")].pop();
  const quote = last ? last.textContent.slice(0, 40) : "";
  const old = $("csSheet"); if (old) old.remove();
  $("screen").insertAdjacentHTML("beforeend", `<div class="cs-sheet" id="csSheet" aria-hidden="true">
    <div class="cs-head"><span class="cs-av" style="--h:${who[2]}">${esc(who[1])}</span><b>${esc(who[0])}</b><small>相談中…</small></div>
    <div class="cs-body"><div class="cs-me">${quote ? `<span class="cs-quote">${esc(quote)}</span>` : ""}これ、どう思う？</div><div class="cs-them typing"><i></i><i></i><i></i></div></div></div>`);
  const sh = $("csSheet");
  await pause(1000); if (!sh.isConnected) return;
  const t = sh.querySelector(".cs-them"); t.classList.remove("typing"); t.textContent = adv.split(who[0]).join("わたし");
  sh.querySelector(".cs-head small").textContent = "既読";
  await pause(1500);
  if (!sh.isConnected) return;
  sh.classList.add("out"); setTimeout(() => sh.remove(), 360);
}
async function consult(n, typed) {
  const my = S.run, info = nodeInfo(n), safe = info.safe;
  lockComposer();
  if (typed) { sendMe(maskTx(typed)); if (info.who && !info.ally && talkScene()) { await pause(300); if (my !== RUN) return; await showReaction(typed, info.who); if (my !== RUN) return; } }
  else { append(`<div class="act">${inPerson() ? "いったん待ってもらって、家族や友だちに相談した" : "返事をする前に、家族や友だちに相談した"}</div>`); S.lastFrom = null; }
  await pause(500); if (my !== RUN) return;
  const adv = safe.act ? `「${safe.act.replace(/[。！!…]+$/, "")}のがいいと思う」` : `「『${safe.say}』って返してみたら？」`;
  await consultFx(adv.replace(/^「|」$/g, "")); if (my !== RUN) return;
  await showItem(["narr", `相談したら、${adv}とアドバイスをもらった`]); if (my !== RUN) return;
  choose(safe, { histText: "家族や友だちに相談した" });
}
/* 自分の言葉で返す：ことばから「断る・確かめる」か「受け入れる」かを読み取って進める */
function freeReply(n, raw) {
  const t = raw.normalize("NFKC").toLowerCase();
  const info = nodeInfo(n);
  let safe = W_SAFE.filter((w) => t.includes(w)).length;
  let risk = W_RISK.filter((w) => t.includes(w)).length;
  const leak = /[0-9]{4,}|\S+@\S+/.test(t);
  if (leak) risk += 2;
  const asking = W_ASK.test(t);
  if (asking && !leak && risk === 0 && safe <= 1 && info.canAsk && !/相談|確認|確かめ|かけ直|警察|188/.test(t)) return askBack(n, "", raw);
  if (asking && risk === 0) safe++;
  if (info.canTalk && /相談/.test(t) && risk === 0) return consult(n, raw);
  let pick = null, how = "";
  const best = (list) => {
    const sc = list.map((c) => [c, simOf(raw, c.say || c.act)]).sort((a, b) => b[1] - a[1]);
    return sc.length === 1 || (sc[0] && sc[0][1] > 0 && sc[0][1] > sc[1][1]) ? sc[0][0] : null;
  };
  const goods = n.choices.filter((c) => c.ok === true), bads = n.choices.filter((c) => c.ok === false);
  if (goods.length && bads.length && safe !== risk) {
    const group = safe > risk ? goods : bads;
    pick = best(group) || group[0]; how = safe > risk ? "断る・確かめる返信" : "相手の話に乗る返信";
  } else {
    pick = best(n.choices); how = "いちばん近い選択";
  }
  if (!pick) {
    S.pending = raw;
    return choicesUI(n, `「${esc(maskTx(raw))}」は、下のどれにいちばん近い？ えらぶと、あなたの言葉のまま返信します。`);
  }
  choose(pick, { myText: raw, read: how });
}
async function choose(c, opt) {
  opt ||= {};
  const my = S.run;
  lockComposer();
  const mine = opt.myText ? maskTx(opt.myText) : null;
  S.hist.push({ node: S.node, text: opt.histText || (mine ? `「${mine}」` : c.say || c.act), sign: c.sign, ok: c.ok, scene: S.scene, clock: S.clock, signsBefore: Object.assign({}, S.signs) });
  if (mine) {
    if (talkScene()) sendMe(mine); else { append(`<div class="act">${esc(mine)}</div>`); S.lastFrom = null; }
    /* 書いた言葉に、相手がその場で反応する（相手がだます側のときだけ） */
    const ni = nodeInfo(S.sc.nodes[S.node]);
    if (talkScene() && ni.who && !ni.ally) { await pause(300); if (my !== RUN) return; await showReaction(opt.myText, ni.who); if (my !== RUN) return; }
    append(`<div class="readchip">${mascot("sm")}<span><small>ミヌケの読み取り：${esc(opt.read || "いちばん近い選択")}</small><b>${esc(c.say || c.act)}</b></span></div>`);
    S.lastFrom = null;
    if (opt.read === "断る・確かめる返信" && judgeReply(opt.myText).tone === "ok") savePhrase(opt.myText, S.sc.tag);
    if (mine !== opt.myText) append(`<div class="sys">本物の番号やアドレスは、練習でも書かないでね（この入力はどこにも送られません）</div>`);
  } else if (c.say) sendMe(c.say);
  else { append(`<div class="act">${esc(c.act)}</div>`); S.lastFrom = null; }
  if (c.sign && S.sc.signs[c.sign]) {
    /* サインがかくれていたメッセージに印をつける */
    const target = [...$("log").querySelectorAll(".row.them:not(.typing):not(.react), .shot")].pop();
    const cat = CATS[S.sc.signs[c.sign].cat];
    if (target && !target.classList.contains("flag") && cat) {
      target.classList.add("flag", c.ok ? "flag-ok" : "flag-ng");
      (target.querySelector(".bub") || target).insertAdjacentHTML("beforeend", `<span class="flag-tag"><b>${cat.ic}</b>${esc(cat.n)}のサイン</span>`);
    }
    S.signs[c.sign] = c.ok ? "caught" : "missed";
    S.xp = (S.xp || 0) + addXP(c.ok ? 10 : 3);
    const p = prog(S.sc.id);
    if (p.signs[c.sign] !== "caught") p.signs[c.sign] = S.signs[c.sign];
    saveProgress();
    await pause(450);
    if (my !== RUN) return;
    await stopCard(c.sign, c.ok);
    if (my !== RUN) return;
    append(`<div class="chip ${c.ok ? "ok" : "ng"}"><i></i><span>サイン：${esc(S.sc.signs[c.sign].t)}　<b>${c.ok ? "気づけた" : "見逃した"}</b></span></div>`);
    renderSide(c.sign); renderDots();
  } else {
    await pause(400);
  }
  if (my !== RUN) return;
  if (S.honne && c.sign) { if (honneReact(c.ok)) await pause(700); if (my !== RUN) return; }
  playNode(c.next);
}
function stopCard(signId, ok) {
  return new Promise((resolve) => {
    const sg = S.sc.signs[signId];
    const cat = CATS[sg.cat];
    const stop = $("stop");
    stop.className = "stop " + (ok ? "ok" : "ng");
    stop.innerHTML = `<div class="tape"></div><div class="in">
      <div class="v">${mascot("md")}<div><b>${ok ? "ナイス判断！" : "STOP！"}</b><span>${ok ? "ここで気づけた。" : "実はここが分かれ道。ここで気づけた"}</span></div></div>
      ${cat ? `<div class="st-medal-row"><span class="st-medal" aria-hidden="true"><span class="st-coin"><i>${esc(cat.ic)}</i></span>${ok ? `<span class="st-burst"></span>` : ""}</span>
        <div class="st-meta"><span class="cat-tag">${esc(cat.n)}のサイン</span>
        <span class="st-dots" aria-label="この話のサイン">${Object.keys(S.sc.signs).map((k) => `<i class="${S.signs[k] || ""}${k === signId ? " now" : ""}"></i>`).join("")}</span></div></div>` : ""}
      <h3 id="stopTitle">${esc(sg.t)}</h3><p>${esc(sg.d)}</p>
      <button type="button" id="stopGo">ストーリーにもどる</button></div>`;
    $("overlay").hidden = false;
    sfx(ok ? "ok" : "stop");
    const done = () => { $("overlay").hidden = true; S.closeStop = null; resolve(); };
    $("stopGo").onclick = done;
    $("stopGo").focus({ preventScroll: true });
    S.closeStop = done;
  });
}
/* ===== 自分の言葉への「相手の反応」：書いた内容に合わせて、相手がその場で返してくる ===== */
const ALLY_RE = /祖|おばあ|おじい|母|父|姉|兄|弟|妹|友|同級生|先生|本物|公式|親|家族|カード裏/;
const REACT = [
  [/警察|110|9110/, "警察？ そんな大げさな話じゃないですよ"],
  [/188|消費生活|消費者/, "そういう窓口に言っても、どうにもなりませんよ"],
  [/親|家族|母|父|ママ|パパ|兄|姉|先生|おばあ|おじい/, "ご家族に話すと、話がややこしくなりますよ"],
  [/友/, "友だちに話さなくても、だいじょうぶですよ"],
  [/公式|確認|確かめ|調べ|かけ直|折り返|検索/, "確認しなくてもだいじょうぶです。こちらが担当ですから"],
  [/書面|契約書|持ち帰/, "書面は、あとでちゃんとお渡ししますから"],
  [/考え|保留|待って|あとで|後で/, "考えている時間はないんです。今決めてもらえますか"],
  [/怪し|あやし|詐欺|さぎ|おかしい/, "あやしいなんて、ひどいなあ。ちゃんとした話ですよ"]
];
function reactTo(raw) {
  const mine = maskTx(raw.trim());
  const j = judgeReply(raw);
  const quote = [...mine].length <= 18 ? `「${mine.replace(/[。！!？?]+$/, "")}」…ですか。` : "";
  const live = inPerson();
  if (/[0-9]{4,}|\S+@\S+/.test(raw)) return { k: "them", t: "ありがとうございます。こちらで確認しますね" };
  if (/ブロック|通報|無視|スルー/.test(raw)) return { k: "narr", t: live ? "（相手は一瞬だまりこんだ）" : "（既読がついたまま、返事が止まった）" };
  if (j.tone === "ng") return { k: "them", t: "ありがとうございます！ では、さっそく進めますね" };
  if (j.tone === "ok") {
    const hit = REACT.find(([re]) => re.test(raw));
    return { k: "them", t: quote + (hit ? hit[1] : "でも、本当にいいんですか？ あとで後悔しますよ") };
  }
  return null;
}
async function showReaction(raw, who) {
  const r = reactTo(raw);
  if (!r) return;
  if (r.k === "them") { await showItem(["them", r.t, who]); const row = [...$("log").querySelectorAll(".row.them:not(.typing)")].pop(); if (row) row.classList.add("react"); }
  else await showItem(["narr", r.t]);
}

/* ===== 相手はあきらめない：早く見抜いて「被害なし」になったとき、相手が別の手口でもう一度近づいてくる ===== */
const ENC_REFUSE = "その話はお断りします。もう連絡しないでください";
const ENC_GIVE = "…やっぱり、もう少し話を聞かせてください";
function encoreSigns() {
  const sc = S.sc, cand = new Set();
  Object.values(sc.nodes).forEach((n) => (n.choices || []).forEach((c) => { if (c.ok === false && c.sign) cand.add(c.sign); }));
  Object.entries(sc.signs).forEach(([k, s]) => { if (s.re) cand.add(k); });
  return [...cand].filter((k) => !S.signs[k] && sc.signs[k] && sc.signs[k].cat !== "soudan").slice(0, 2);
}
function encoreScene() {
  const st = S.sc.nodes[S.sc.start].scene;
  if (!st || !["dm", "talk", "call", "live"].includes(st.type) || !st.who) return null;
  const c = S.sc.cast[st.who];
  return c && !ALLY_RE.test(c.n + (c.r || "")) ? st : null;
}
function encoreChoice(note) {
  return new Promise((resolve) => {
    const ph = "自分の言葉で返信（例：もう連絡しないでください）";
    $("composer").innerHTML = `<div class="q"><span>しつこい相手。どうする？</span></div>
      ${note ? `<div class="readnote" role="status">${mascot("sm")}<span>${note}</span></div>` : ""}
      <div class="choices">
        <button class="choice say" type="button" id="ch-enc-0"><span class="ch-key" aria-hidden="true">A</span><span class="ch-tx"><small>返信する</small><span>${ENC_REFUSE}</span></span><span class="ch-ic" aria-hidden="true">${ICON_SAY}</span></button>
        <button class="choice say" type="button" id="ch-enc-1"><span class="ch-key" aria-hidden="true">B</span><span class="ch-tx"><small>返信する</small><span>${ENC_GIVE}</span></span><span class="ch-ic" aria-hidden="true">${ICON_SAY}</span></button>
        <button class="choice do" type="button" id="ch-enc-2"><span class="ch-key" aria-hidden="true">C</span><span class="ch-tx"><small>行動する</small><span>${inPerson() ? "その場を離れて、家族に話す" : "返信せずにブロックして、通報する"}</span></span><span class="ch-ic" aria-hidden="true">${ICON_ACT}</span></button>
      </div>
      <form class="freebar" id="freeForm" autocomplete="off"><label class="sr" for="freeIn">自分の言葉で返信する</label>
        <input id="freeIn" type="text" maxlength="80" enterkeyhint="send" placeholder="${ph}"><button type="submit" aria-label="送信">${ICON_SEND}</button></form>`;
    $("ch-enc-0").onclick = () => resolve({ ok: true, say: ENC_REFUSE });
    $("ch-enc-1").onclick = () => resolve({ ok: false, say: ENC_GIVE });
    $("ch-enc-2").onclick = () => resolve({ ok: true, act: $("ch-enc-2").querySelector(".ch-tx > span").textContent });
    $("freeForm").onsubmit = (e) => {
      e.preventDefault();
      const v = $("freeIn").value.trim(); if (!v) return;
      const j = judgeReply(v);
      if (j.tone === "mid") return resolve({ retry: true, mine: v });
      resolve({ ok: j.tone === "ok", mine: v });
    };
  });
}
async function runEncore() {
  const my = S.run, keys = encoreSigns(), scn = encoreScene();
  if (!keys.length || !scn) return;
  await pause(500); if (my !== RUN) return;
  append(`<div class="encore-div"><span>でも、相手はあきらめない…</span></div>`);
  S.scene = null; setScene(scn);
  append(`<div class="timechip">数日後</div>`);
  let won = 0;
  let first = true;
  for (const k of keys) {
    const sg = S.sc.signs[k];
    const line = sg.re || (sg.ask && sg.ask[1]) || (PRESS[sg.cat] || PRESS.jouken)[0];
    /* 最初は、画面の上に「新着」の通知として届く */
    if (first && scn.type !== "live") {
      const c = S.sc.cast[scn.who] || {};
      pushNote(scn.app || "メッセージ", scn.type === "call" ? `着信：${c.n || ""}` : c.n || "新着メッセージ", scn.type === "call" ? "また、あの番号から…" : [...line].slice(0, 22).join("") + "…");
      await pause(1200); if (my !== RUN) return;
    }
    first = false;
    await showItem(["them", line, scn.who]); if (my !== RUN) return;
    let res = await encoreChoice();
    while (res.retry) {
      lockComposer(); sendMe(maskTx(res.mine)); await pause(400); if (my !== RUN) return;
      await showItem(["them", (PRESS[sg.cat] || PRESS.jouken)[1], scn.who]); if (my !== RUN) return;
      res = await encoreChoice(`「${esc(maskTx(res.mine))}」だと、断っているのか伝わらなかったみたい。はっきり返してみよう。`);
    }
    if (my !== RUN) return;
    lockComposer();
    if (res.mine) { sendMe(maskTx(res.mine)); if (res.ok && judgeReply(res.mine).tone === "ok") savePhrase(res.mine, S.sc.tag); await pause(300); await showReaction(res.mine, scn.who); }
    else if (res.say) sendMe(res.say);
    else { append(`<div class="act">${esc(res.act)}</div>`); S.lastFrom = null; }
    if (my !== RUN) return;
    const target = [...$("log").querySelectorAll(".row.them:not(.typing):not(.react)")].pop();
    const cat = CATS[sg.cat];
    if (target && !target.classList.contains("flag") && cat) {
      target.classList.add("flag", res.ok ? "flag-ok" : "flag-ng");
      target.querySelector(".bub").insertAdjacentHTML("beforeend", `<span class="flag-tag"><b>${cat.ic}</b>${esc(cat.n)}のサイン</span>`);
    }
    S.signs[k] = res.ok ? "caught" : "missed";
    const p = prog(S.sc.id); if (p.signs[k] !== "caught") p.signs[k] = S.signs[k]; saveProgress();
    S.xp = (S.xp || 0) + addXP(res.ok ? 10 : 3);
    await pause(400); if (my !== RUN) return;
    await stopCard(k, res.ok); if (my !== RUN) return;
    append(`<div class="chip ${res.ok ? "ok" : "ng"}"><i></i><span>サイン：${esc(sg.t)}　<b>${res.ok ? "気づけた" : "見逃した"}</b></span></div>`);
    renderSide(k); renderDots();
    if (res.ok) won++;
    else {
      /* 流されたら、ちゃんと失敗にする：被害の通知が届き、相手は消える */
      await pause(500); if (my !== RUN) return;
      harmFx(sg.cat);
      await pause(900); if (my !== RUN) return;
      await showItem(["narr", HARM_TEXT[sg.cat] || HARM_TEXT.kane]); if (my !== RUN) return;
      if (!inPerson()) append(`<div class="sys">相手のアカウントは、もう見つからない</div>`);
      return { fail: sg };
    }
  }
  await showItem(["narr", inPerson() ? "それから、相手が来ることはなかった" : "それから、相手からの連絡は来なくなった"]); if (my !== RUN) return;
  if (!inPerson()) append(`<div class="sys">相手のアカウントは、いつの間にか消えていた</div>`);
  if (won === keys.length) { S.xp = (S.xp || 0) + addXP(10); append(`<div class="chip ok"><i></i><span><b>しつこい相手も撃退！</b>　ボーナス +10 XP</span></div>`); }
  return { won: true };
}

/* ===== 毎回ちがう話：材料を組み合わせて、遊ぶたびに新しいストーリーを作る ===== */
const GEN_CACHE = {};
function genScenario(seed) {
  const id = "mix-" + seed;
  if (GEN_CACHE[id]) return GEN_CACHE[id];
  const G = window.DL && window.DL.gen;
  if (!G) return null;
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const vals = {};
  const fill = (s) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vals[k] ||= pick(G.fills[k] || [k])));
  const h = G.hooks[Math.floor(r() * G.hooks.length)];
  const rest = h.beats.map((_, i) => i).slice(1).map((i) => [i, r()]).sort((a, b) => a[1] - b[1]);
  const idx = [0, ...rest.slice(0, 2).map((x) => x[0]).sort((a, b) => a - b)];
  const extra = rest.slice(2).map((x) => x[0]);
  const used = idx.map((i) => h.beats[i]);
  const clock = fill("{time}");
  const signs = {};
  used.forEach((b, i) => { signs["s" + i] = { cat: b.cat, t: b.t, d: b.d, re: fill(b.say[b.say.length - 1]) }; });
  extra.forEach((i, j) => { const b = h.beats[i]; signs["x" + j] = { cat: b.cat, t: b.t, d: b.d, re: fill(b.say[b.say.length - 1]) }; });
  signs.report = { cat: "soudan", t: "被害にあっても、ひとりで抱えない", d: "やり取りや支払いの記録を残して、家族や188、警察（#9110）に相談すれば、取れる手段が見つかることもあります。" };
  /* アプリの画面の場面は、吹き出しではなく画面のカードで見せる */
  const asCard = h.scene.type === "web";
  const lines = (arr) => (asCard ? (arr.length ? [["card", fill(h.opp.n), arr.map(fill)]] : []) : arr.map((l) => ["them", fill(l)]));
  const say = (t) => (asCard ? { act: fill(t) } : { say: fill(t) });
  const pair = (b, i) => [Object.assign(say(b.safe), { next: "e" + (i + 1), sign: "s" + i, ok: true }), Object.assign(say(b.risky), { next: i < 2 ? "n" + (i + 2) : "n4", sign: "s" + i, ok: false })];
  /* 3つめの選択：「少し考えさせて」。相手はせかしてきて、もう一度えらぶ */
  const beatNode = (b, i, extraLog) => ({
    log: [...(extraLog || []), ...lines(b.say)],
    choices: [...pair(b, i), Object.assign(say(asCard ? "すぐには決めず、少し考える" : "少し考えさせてください"), { next: "w" + i })]
  });
  const waitNode = (b, i) => ({
    log: asCard ? [["think", "（少し考えてみる。もう一度、画面をよく見てみよう）"]]
      : [["them", COMPROMISE[b.cat] || PRESS.isogi[1]], ["think", "（言い方を変えてきた…）"]],
    choices: pair(b, i)
  });
  const nodes = {
    n1: Object.assign({ scene: Object.assign({}, h.scene, { who: "opp" }), time: clock }, beatNode(used[0], 0, lines(h.open))),
    n2: beatNode(used[1], 1),
    n3: beatNode(used[2], 2),
    w0: waitNode(used[0], 0), w1: waitNode(used[1], 1), w2: waitNode(used[2], 2),
    n4: { scene: { type: "home", app: "自分の部屋" }, time: "数日後", log: [["narr", fill(h.harm)]], choices: [
      { act: "家族に話して、警察と188に相談する", next: "e4", sign: "report", ok: true },
      { act: "恥ずかしくて、だれにも言えない", next: "e5", sign: "report", ok: false }] }
  };
  [["e1", "safe", "s1"], ["e2", "safe", "s2"], ["e3", "safe", "s3"], ["e4", "partial", "p"], ["e5", "bad", "b"]].forEach(([k, end, e]) => { nodes[k] = { end, h: fill(h.ends[e][0]), p: fill(h.ends[e][1]) }; });
  const sc = { id, gen: true, seed, genre: h.genre, tag: h.tag, title: fill(h.title), sub: fill(h.sub), mins: 3, level: 2, clock, intro: fill(h.intro),
    cast: { opp: { n: fill(h.opp.n), i: h.opp.i, h: h.opp.h, r: h.opp.r } }, signs, start: "n1", nodes };
  DEBRIEF[id] = Object.assign({}, h.db, { flow: used.map((b) => b.t) });
  return (GEN_CACHE[id] = sc);
}
/* ===== 手口の解剖：この相手が、どの手口を何回使ってきたか ===== */
function tacticsHTML(sc) {
  const met = Object.entries(S.signs).map(([k, v]) => ({ cat: (sc.signs[k] || {}).cat, v })).filter((x) => x.cat && x.cat !== "soudan");
  if (!met.length) return "";
  const by = {};
  met.forEach((x) => (by[x.cat] ||= []).push(x.v));
  const rows = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
  const st = sc.nodes[sc.start].scene || {};
  const c = st.who && sc.cast[st.who];
  const opp = c && !ALLY_RE.test(c.n + (c.r || "")) ? c : null;
  const caught = met.filter((x) => x.v === "caught").length;
  return `<div class="tactics">
    <div class="tc-head">${opp ? `<span class="tc-av">${av(sc, st.who)}<i aria-hidden="true">?</i></span>` : ""}
      <div><span class="eyebrow">手口の解剖</span><b>${opp ? esc(opp.n.replace(/（？）/g, "")) + " が使ってきた手口" : "この話に出てきた手口"}</b>
      <span>${rows.length}種類・${met.length}回。いちばん多かったのは「${esc(CATS[rows[0][0]].n)}」。あなたが見抜けたのは ${caught}/${met.length}</span></div></div>
    <ul class="tc-rows">${rows.map(([cat, vs], i) => `<li style="--d:${i}"><span class="tc-ic" aria-hidden="true">${CATS[cat].ic}</span><span class="tc-n">${esc(CATS[cat].n)}</span>
      <span class="tc-dots">${vs.map((v) => `<i class="${v}" title="${v === "caught" ? "気づけた" : "見逃した"}"></i>`).join("")}</span><span class="tc-c">${vs.filter((v) => v === "caught").length}/${vs.length}</span></li>`).join("")}</ul>
    <p class="tc-leg"><i class="caught"></i>気づけた　<i class="missed"></i>見逃した</p></div>`;
}
/* 今日の1話：日付で決まる「毎回ちがう話」。同じ日なら、だれでも同じ話 */
function todaySeed() { const d = new Date(); return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 7 + 13; }
/* ===== 裏側：通った会話を、だます側の「台本」として見る。メッセージごとに、相手のねらいを書きこむ ===== */
const AIM = {
  umai: "得をすると思わせて、話にのせる", isogi: "考える時間をなくして、すぐ決めさせる", himitsu: "まわりに相談させず、止められないようにする",
  kane: "取り返せない方法で、お金を払わせる", kojin: "個人情報やカードの情報を手に入れる", kankei: "親しさや好意で、断りにくくする",
  jouken: "大事な条件を見せずに、契約させる", tsuuchi: "本物の連絡だと思わせて、信用させる", soudan: "相談させずに、ひとりで決めさせる"
};
function scriptHTML(sc) {
  const seen = new Set(), rows = [];
  S.path.forEach((id) => {
    if (seen.has(id)) return; seen.add(id);
    const n = sc.nodes[id];
    if (!n || n.end || !n.log) return;
    const sgKey = ((n.choices || []).find((c) => c.ok === false && c.sign) || (n.choices || []).find((c) => c.sign) || {}).sign;
    const sg = sgKey && sc.signs[sgKey];
    const who0 = (n.scene && n.scene.who) || null;
    const lines = n.log.filter((l) => l[0] === "them" || l[0] === "card").map((l) => {
      if (l[0] === "card") return { who: l[1], text: l[2].join("／") };
      const c = sc.cast[l[2] || who0] || {};
      if (ALLY_RE.test((c.n || "") + (c.r || ""))) return null;
      return { who: c.n || "", text: l[1] };
    }).filter(Boolean).slice(-2);
    if (!lines.length) return;
    rows.push({ lines, sg, mine: S.signs[sgKey] });
  });
  if (!rows.length) return `<p class="ura-lead">この話では、相手の台本を表示できる場面がありませんでした。</p>`;
  return `<div class="ura"><p class="ura-lead">あなたが通った会話を、<b>だます側の目線</b>で見てみよう。赤い線のところが、そのメッセージにこめられた相手の「ねらい」です。</p>
    <ol class="ura-list">${rows.map((r, i) => `<li style="--d:${i}">
      <div class="ura-msgs">${r.lines.map((l) => `<div class="ura-msg"><span class="ura-who">${esc(l.who)}</span><p>${esc(l.text)}</p></div>`).join("")}</div>
      ${r.sg ? `<div class="ura-aim ${r.mine || ""}"><span class="ura-tag">${CATS[r.sg.cat].ic} ${esc(CATS[r.sg.cat].n)}</span><b>ねらい：${esc(AIM[r.sg.cat] || "")}</b>
        <span>${esc(r.sg.t)}</span>${r.mine ? `<em>${r.mine === "caught" ? "あなたは見抜いた" : "あなたは見逃した"}</em>` : ""}</div>`
        : `<div class="ura-aim none"><b>ねらい：話を進めて、信用させる</b></div>`}
    </li>`).join("")}</ol></div>`;
}
function mixHTML() {
  const n = (window.DL && window.DL.gen && window.DL.gen.hooks.length) || 0;
  if (!n) return "";
  const plays = Object.keys(progress).filter((k) => /^mix-/.test(k)).length;
  return `<section class="mix bleed b-brand" aria-label="毎回ちがう話">
    <div class="mix-in"><div><span class="eyebrow">ENDLESS STORY</span><h2>毎回ちがう話</h2>
      <p>${n}の場面と、いくつもの手口を組み合わせて、開くたびに新しいストーリーが生まれます。全部のシナリオを遊び終わっても、終わりはありません。</p>
      ${plays ? `<p class="mix-rec">これまでに <b>${plays}</b> 話を体験</p>` : ""}</div>
      <div class="mix-btns">
        ${(() => { const id = "mix-" + todaySeed(), sc = byId(id), done = !!(progress[id] && (progress[id].ends || []).length);
          return sc ? `<a class="mix-today${done ? " done" : ""}" href="#${id}" id="mixToday"><span class="eyebrow">今日の1話${done ? "　体験ずみ" : ""}</span><b>${esc(sc.tag)}</b><span>${esc(sc.title)}</span></a>` : ""; })()}
        <a class="btn primary big" href="#mix" id="mixGo">新しい話をはじめる</a></div></div></section>`;
}
function rankOf(endType, caught, missed) {
  const met = caught + missed, rate = met ? caught / met : 0;
  if (endType === "safe" && rate >= 0.99) return { r: "見抜きマスター", m: "完ぺき！ 最初のサインから見抜けたね。この感覚をまわりにも教えてあげて。" };
  if (endType === "safe") return { r: "しっかり見抜けた", m: "途中で気づいて、被害ゼロで抜け出せた。ほかの結末も見てみよう。" };
  if (endType === "partial") return { r: "ギリギリ回避", m: "被害は少し出たけど、最後に止まれた。どこで気づけたらよかったか、もう一度見てみよう。" };
  if (rate >= 0.5) return { r: "あと一歩", m: "気づけたサインもあったのに、流れに乗せられてしまった。次は別の選択で。" };
  return { r: "ヒヤリ体験", m: "これが現実なら大変。でも体験だからこそ、ここで覚えられる。サインを見直してもう一回！" };
}
async function endFlow(id, n) {
  const my = S.run;
  if (n.end === "safe" && !S.encored) {
    S.encored = true;
    const r = await runEncore(); if (my !== RUN) return;
    if (r && r.fail) {
      /* 一度は見抜けたのに、しつこさに負けた → 被害の結末にする */
      const bad = { end: "bad", h: "しつこさに負けて、被害にあってしまった", p: `最初は見抜けていたのに、相手は別の手口でもどってきた。「${r.fail.t}」――ここで流されてしまった。一度断っても、相手は何度でも来る。何度来ても、同じように断ってOK。被害にあったら、すぐに家族と188・警察（#9110）へ。` };
      S.node = id + "~enc";
      return showEnd(S.node, bad);
    }
  }
  /* 被害はなくても、サインを2つ以上見逃していたら「ギリギリ」としてあつかう */
  const missedN = Object.values(S.signs).filter((v) => v === "missed").length;
  if (n.end === "safe" && missedN >= 2) {
    n = Object.assign({}, n, { end: "partial", lab: "被害なし（ギリギリ）", p: `${n.p} ただし、見逃したサインが${missedN}つ。かなり危ないところまで進んでいました。` });

  }
  if (n.end === "bad") {
    /* 被害の結末：お金や情報が抜き取られた通知が届く */
    const miss = [...S.hist].reverse().find((h) => h.sign && h.ok === false);
    const cat = miss ? S.sc.signs[miss.sign].cat : "kane";
    await pause(300); if (my !== RUN) return;
    if (cat === "soudan") hitScreen(); else harmFx(cat);
    await pause(1000); if (my !== RUN) return;
  }
  showEnd(id, n);
}
/* ===== エンドカード：結末に着いた瞬間、事件ファイルにハンコが押される ===== */
const ENDCARD = {
  safe:    ["CASE CLOSED", "被害なし", "見抜いて、守りきった"],
  partial: ["DAMAGE CONTROL", "被害を最小限に", "気づいて、止められた"],
  bad:     ["DAMAGE", "被害が発生", "次は、ここで止まろう"]
};
function showEndCard(sc, n) {
  const old = $("endcard"); if (old) old.remove();
  if (prefs.easy) return;
  const [en, ja, sub] = ENDCARD[n.end] || ENDCARD.partial;
  const ks = Object.keys(sc.signs), c = ks.filter((k) => S.signs[k] === "caught").length;
  const no = sc.gen ? "MIX" : `No.${String(SCENARIOS.indexOf(sc) + 1).padStart(3, "0")}`;
  $("screen").insertAdjacentHTML("beforeend", `<div class="endcard e-${n.end}" id="endcard" aria-hidden="true">
    <div class="ec-file"><span>CASE FILE</span><span>${no}</span></div>
    <div class="ec-stamp"><b>${en}</b><span>${ja}</span></div>
    <div class="ec-sub">${sub}<small>気づけたサイン ${c} / ${ks.length}</small></div></div>`);
  const el = $("endcard");
  setTimeout(() => { if (el.isConnected) { el.classList.add("out"); setTimeout(() => el.remove(), 400); } }, reduced || factor() === 0 ? 500 : 1700);
}
function showEnd(id, n) {
  const sc = S.sc, p = prog(sc.id);
  const isNewEnd = !String(id).includes("~") && !p.ends.includes(id);
  if (isNewEnd) p.ends.push(id);
  S.xp = (S.xp || 0) + addXP(isNewEnd ? 20 : 5);
  if (n.end === "safe" && !Object.values(S.signs).includes("missed")) p.perfect = true;
  if (n.end === "safe") { confetti(); sfx("end"); }
  showEndCard(sc, n);
  markToday();
  saveProgress();
  { const ks = Object.keys(sc.signs); logPlay(sc, id, n, ks.filter((k) => S.signs[k] === "caught").length, ks.filter((k) => S.signs[k] === "missed").length); }
  setTimeout(checkAch, 1600);
  append(`<div class="end"><div class="tape"></div><div class="in"><span class="stamp s-${n.end}" aria-hidden="true">${STAMP[n.end]}</span><span class="label ${n.end}">結末｜${n.lab || ENDLAB[n.end]}</span><h3>${esc(n.h)}</h3><p>${esc(n.p)}</p></div></div>`);
  const endBtns = () => {
    $("composer").innerHTML = `<div class="pair">
    <button class="choice go" type="button" id="btn-result">結果を見る</button>
    <button class="choice" type="button" id="btn-retry"><small>同じシナリオ</small><span>別の選択でもう一度</span></button>
    <button class="choice honne-btn" type="button" id="btn-honne"><small>相手の心の声つき</small><span>本音モードでもう一度</span></button>
    ${!sc.gen && DEBRIEF[sc.id] && !S.taught ? `<button class="choice teach-btn" type="button" id="btn-teach"><small>1か月後のエピローグ</small><span>友だちから相談が来た</span></button>` : ""}</div>`;
    $("btn-result").onclick = () => openResult(id, n, isNewEnd);
    $("btn-retry").onclick = () => { if (!$("result").hidden) closeResult(); openScenario(sc.id); };
    $("btn-honne").onclick = () => { if (!$("result").hidden) closeResult(); HONNE_NEXT = true; openScenario(sc.id); };
    if ($("btn-teach")) $("btn-teach").onclick = () => { if (!$("result").hidden) closeResult(); epilogue(sc, endBtns); };
  };
  endBtns();
  renderSide(); renderDots();
  setTimeout(() => { if (S && S.sc === sc && S.node === id && $("result").hidden) openResult(id, n, isNewEnd); }, reduced || factor() === 0 ? 300 : 2000);
}

/* ===== 1か月後のエピローグ：同じ手口のメッセージを、友だちから相談される。こんどは教える側 ===== */
function friendRow(text) {
  const cont = S.lastFrom === "__friend";
  const el = append(`<div class="row them ep-friend${cont ? " cont" : ""}"><span class="av-slot">${cont ? "" : `<span class="av sm" style="--h:160" aria-hidden="true">友</span>`}</span><span class="bub">${cont ? "" : `<span class="nm">クラスの友だち</span>`}<p>${esc(text)}</p></span><span class="meta">${esc(S.clock)}</span></div>`);
  S.lastFrom = "__friend"; speak(text, 160, "them");
  return el;
}
async function epilogue(sc, back) {
  const my = S.run, d = DEBRIEF[sc.id] || {}, f = firstMsg(sc);
  const good = `それ、あやしいよ。${d.point ? `「${d.point}」だよ。` : ""}まずは、いっしょにおうちの人に話そう`;
  waitingUI();
  append(`<div class="timechip">1か月後</div>`);
  append(`<div class="scene-div">LINE｜クラスの友だち</div>`); S.lastFrom = null;
  await pause(400); if (my !== RUN) return;
  friendRow("ねえ、ちょっと聞いて。こんなのが届いたんだけど……");
  await pause(700); if (my !== RUN) return;
  append(`<div class="shot ep-shot"><div class="t">友だちのスマホの画面｜${esc(f.app)}${f.name ? `・${esc(f.name)}` : ""}</div><ul><li>${esc(f.text)}</li></ul></div>`); S.lastFrom = null;
  await pause(800); if (my !== RUN) return;
  friendRow("これ、大丈夫かな？ ちょっと気になってて");
  const ask = () => {
    const opts = shuffle([["good", good], ["bad", "いい話っぽいし、やってみたら？ ダメだったら、そこでやめればいいし"], ["meh", "とりあえず返事だけしてみたら？ どんな人か、話してみないとわからないよ"]]);
    $("composer").innerHTML = `<div class="q"><span>友だちに、どう返す？</span></div><div class="choices">${opts.map(([k, t], i) =>
      `<button class="choice say" type="button" id="ep-${k}"><span class="ch-key" aria-hidden="true">${"ABC"[i]}</span><span class="ch-tx"><small>友だちに返信する</small><span>${esc(t)}</span></span><span class="ch-ic" aria-hidden="true">${ICON_SAY}</span></button>`).join("")}</div>`;
    opts.forEach(([k, t]) => ($("ep-" + k).onclick = () => answer(k, t)));
  };
  const answer = async (k, t) => {
    lockComposer(); sendMe(t);
    await pause(800); if (my !== RUN) return;
    if (k === "good") {
      friendRow("そうなんだ……！ 教えてくれてありがとう。危なかった");
      await pause(500); if (my !== RUN) return;
      append(`<div class="chip ok ep-chip"><i></i><span>エピローグ：<b>友だちを守れた</b>　＋15 XP</span></div>`); S.lastFrom = null;
      S.taught = true; const p = prog(sc.id); p.taught = true; saveProgress(); addXP(15); sfx("ok"); toast("友だちを守れた！"); setTimeout(checkAch, 1200);
      return back();
    }
    friendRow(k === "bad" ? "そうだよね、やってみる！" : "そっか。じゃあ、気にしないでおくね");
    await pause(700); if (my !== RUN) return;
    append(`<div class="narr ep-narr">${k === "bad" ? "（1週間後、友だちは「お金がもどってこない」と泣いていた……）" : "（数日後、友だちは同じ相手から、もっと強くせかされていた……）"}</div>`); S.lastFrom = null;
    append(`<div class="readnote" role="status">${mascot("sm")}<span>友だちが相談してくれたときは、チャンス。この話で学んだ「${esc(d.point || "サイン")}」を、そのまま伝えてあげよう。</span></div>`);
    sfx("stop");
    $("composer").innerHTML = `<div class="pair"><button class="choice go" type="button" id="ep-again">もう一度、返事をえらぶ</button><button class="choice" type="button" id="ep-back"><small>エピローグをやめる</small><span>結末にもどる</span></button></div>`;
    $("ep-again").onclick = () => { friendRow("……やっぱり、もう一回聞いてもいい？"); ask(); };
    $("ep-back").onclick = back;
  };
  ask();
}
/* 「被害なし」の結末で、テープ色の紙吹雪を少しだけ */
function confetti() {
  if (reduced || document.hidden) return;
  document.querySelectorAll("canvas.confetti").forEach((c) => c.remove());
  const cv = document.createElement("canvas");
  cv.className = "confetti"; cv.setAttribute("aria-hidden", "true");
  const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  document.body.appendChild(cv);
  const x = cv.getContext("2d");
  const cs = getComputedStyle(document.documentElement);
  const cols = ["--accent", "--safe", "--ink", "--gold"].map((v) => cs.getPropertyValue(v).trim() || "#FFC21A");
  const ps = Array.from({ length: 110 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  const step = (t) => {
    const k = (t - t0) / 1800;
    x.clearRect(0, 0, W, H);
    ps.forEach((p) => { p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.globalAlpha = Math.max(0, 1 - k); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); });
    if (k < 1) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
  setTimeout(() => cv.remove(), 2600);
}
function renderDots() {
  const sc = S.sc;
  $("playDots").innerHTML = Object.keys(sc.signs).map((k) => `<i class="${S.signs[k] || ""}" title="${S.signs[k] ? esc(sc.signs[k].t) : "未発見"}"></i>`).join("");
  /* あぶなさメーター：見逃すと上がり、気づくと下がる（0〜5） */
  const vals = Object.values(S.signs);
  const lv = Math.max(0, Math.min(5, vals.filter((v) => v === "missed").length * 2 - vals.filter((v) => v === "caught").length + (vals.length ? 1 : 0)));
  /* ピンチ演出：あぶなさに合わせて、画面のふちが赤く脈打つ。サインに気づくと金色に光る */
  { const scr = $("screen"), cN = vals.filter((v) => v === "caught").length, mN = vals.filter((v) => v === "missed").length;
    scr.dataset.danger = lv >= 3 ? String(lv) : "";
    if (S._fc != null && !reduced) {
      const fx = cN > S._fc ? "fx-catch" : mN > S._fm ? "fx-miss" : "";
      if (fx) { scr.classList.remove("fx-catch", "fx-miss"); void scr.offsetWidth; scr.classList.add(fx); setTimeout(() => scr.classList.remove(fx), 900); }
    }
    S._fc = cN; S._fm = mN; }
  const words = ["平穏", "平穏", "ちょっと注意", "あやしい", "かなり危険", "危険！"];
  $("meter").innerHTML = `<span class="m-lab">あぶなさ</span><span class="m-bars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lv ? "on l" + lv : ""}"></i>`).join("")}</span><span class="m-word">${words[lv]}</span>`;
  $("meter").dataset.lv = lv;
  if ($("guard")) $("guard").innerHTML = guardHTML();
  if ($("guard2")) $("guard2").innerHTML = guardHTML(true);
}
/* 守りゲージ：見逃したサインの種類ごとに、守れているもの（お金・個人情報・人間関係・冷静さ）が減っていく */
const GUARD = [
  ["money", "お金", ["kane", "umai"], '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'],
  ["info", "個人情報", ["kojin", "tsuuchi"], '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'],
  ["people", "人間関係", ["kankei", "himitsu", "soudan"], '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M14.5 14.6c2.8 0 6 1.8 6 5.4"/>'],
  ["calm", "冷静さ", ["isogi", "jouken"], '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>']
];
function guardVals() {
  const v = { money: 3, info: 3, people: 3, calm: 3 };
  Object.entries(S.signs).forEach(([k, st]) => {
    if (st !== "missed") return;
    const cat = (S.sc.signs[k] || {}).cat, g = GUARD.find((x) => x[2].includes(cat));
    if (g) v[g[0]] = Math.max(0, v[g[0]] - 1);
  });
  return v;
}
function guardHTML(still) {
  const v = guardVals();
  const prev = S.gprev || {};
  if (!still) S.gprev = v;
  return GUARD.map(([k, n, , ic]) => `<span class="gd gd-${v[k]}${!still && prev[k] > v[k] ? " drop" : ""}" title="${n}：${["ほぼ失った", "かなり危ない", "少し減った", "守れている"][v[k]]}">
    <span class="gd-ic" aria-hidden="true">${svgI(ic)}</span><span class="gd-n">${n}</span><span class="gd-pips" aria-label="${n} ${v[k]}/3">${[1, 2, 3].map((i) => `<i class="${i <= v[k] ? "on" : ""}"></i>`).join("")}</span></span>`).join("");
}
function renderSide(flash) {
  const sc = S.sc, p = prog(sc.id), ids = Object.keys(sc.signs);
  $("signs").innerHTML = ids.map((k) => {
    const sg = sc.signs[k], now = S.signs[k], ever = p.signs[k];
    if (now) return `<li class="${k === flash ? "flash" : ""}"><span class="st ${now}">${now === "caught" ? "今回 気づけた" : "今回 見逃した"}</span><b>${esc(sg.t)}</b><span class="d">${esc(sg.d)}</span></li>`;
    if (ever) return `<li><span class="st seen">${ever === "caught" ? "前に気づけた" : "前に見逃した"}</span><b>${esc(sg.t)}</b><span class="d">${esc(sg.d)}</span></li>`;
    return `<li class="locked"><span class="st locked">未発見</span><b>？？？？？</b><span class="d">${esc(CATS[sg.cat] ? CATS[sg.cat].n + "のサイン" : "")}。別の選択で出会えるかも</span></li>`;
  }).join("");
  const found = ids.filter((k) => S.signs[k] || p.signs[k]).length;
  $("zcount").textContent = `${found} / ${ids.length} 発見`;
  const eids = endIds(sc);
  $("ecount").textContent = `${p.ends.length} / ${eids.length} 回収`;
  $("ends").innerHTML = eids.map((e) => { const n = sc.nodes[e], got = p.ends.includes(e); return `<span class="${got ? "got " + n.end : ""}">${got ? esc(n.h) : "？？？"}</span>`; }).join("");
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === prefs.tempo)));
}

/* ===== 結果・シェア ===== */
function shareText(sc, n, rk, caught, total) {
  return `だまされ体験ラボ「${sc.title}」で、結末「${n.h}」にたどりついた！\n気づけたサイン ${caught}/${total}　判定：${rk.r}\n#だまされ体験ラボ`;
}
/* ===== 似ている話：同じ系統のサインが出てくる話を、ちがう場面から3本えらぶ ===== */
const simCats = (sc) => new Set(Object.values(sc.signs).map((s) => s.cat).filter((c) => c !== "soudan"));
function similarOf(sc, n = 3) {
  const mine = simCats(sc), role = roleOf(sc);
  return SCENARIOS.filter((s) => s !== sc && !s.gen).map((s) => {
    const cs = simCats(s), common = [...mine].filter((c) => cs.has(c));
    const score = common.length * 3 + (s.genre !== sc.genre ? 1.5 : 0) + (roleOf(s) === role ? 1 : 0) + (cleared(s.id) ? 0 : 2) + Math.random();
    return { s, common, score };
  }).filter((x) => x.common.length >= 2).sort((a, b) => b.score - a.score).slice(0, n);
}
function similarHTML(sc) {
  if (sc.gen) return "";
  const list = similarOf(sc);
  if (!list.length) return "";
  return `<div class="sim-box"><div class="side-h" style="margin:0"><h2>同じサインが出てくる、別の話</h2><span>場面がかわっても、手口は同じ</span></div>
    <div class="sim-list">${list.map(({ s, common }) => { const g = GENRES[s.genre];
      return `<a class="sim-card" href="#${s.id}" style="--gh:${g.h}"><span class="sim-top"><span class="sim-tag">${esc(s.tag)}</span>${cleared(s.id) ? `<span class="sim-done">体験ずみ</span>` : `<span class="sim-new">まだ</span>`}</span>
        <b>${esc(s.title)}</b>
        <span class="sim-cats">${common.slice(0, 3).map((c) => `<i><em aria-hidden="true">${CATS[c].ic}</em>${esc(CATS[c].n)}</i>`).join("")}</span></a>`; }).join("")}</div></div>`;
}
function openResult(id, n, isNewEnd) {
  const sc = S.sc, p = prog(sc.id);
  const ids = Object.keys(sc.signs);
  const caught = ids.filter((k) => S.signs[k] === "caught").length;
  const missed = ids.filter((k) => S.signs[k] === "missed").length;
  const rk = rankOf(n.end, caught, missed);
  const met = caught + missed;
  const text = shareText(sc, n, rk, caught, met);
  const url = `${SHARE_URL}#${sc.id}`;
  const full = `${text}\n${url}`;
  const idx = SCENARIOS.indexOf(sc);
  const cn = courseNext(sc);
  const ex = examStep(sc, n, caught, met);
  const next = (cn && cn.s) || SCENARIOS.slice(idx + 1).concat(SCENARIOS.slice(0, idx)).find((s) => !(progress[s.id] && (progress[s.id].ends || []).length)) || SCENARIOS[(idx + 1) % SCENARIOS.length];
  const talk = talkText(sc, n);
  $("resultSheet").innerHTML = `<div class="tape"></div><div class="in">
    <div class="rank">${mascot()}<div><small>判定</small><b id="resTitle">${esc(rk.r)}</b><span>${esc(rk.m)}</span></div><span class="stamp s-${n.end}" aria-hidden="true">${STAMP[n.end]}</span></div>
    <div><span class="label ${n.end}">結末｜${n.lab || ENDLAB[n.end]}${isNewEnd ? "（はじめて回収！）" : ""}</span><p style="margin-top:6px;font-weight:700">${esc(n.h)}</p></div>
    <p class="xpgain">見抜きポイント <b>+${S.xp || 0} XP</b>　${lvInfo().title}（Lv.${lvInfo().lv}）</p>
    <div class="resgrid"><div><b>${caught}</b><span>気づけたサイン</span></div><div><b>${missed}</b><span>見逃したサイン</span></div><div><b>${p.ends.length}/${endIds(sc).length}</b><span>回収した結末</span></div></div>
    <div class="guard guard-res" aria-label="守れたもの">${guardHTML(true)}</div>
    ${S.hints ? `<p class="hintnote">${mascot("sm")}ミヌケのヒントを ${S.hints} 回使いました。次はヒントなしで挑戦してみよう。</p>` : ""}
    ${S.nudges ? `<p class="hintnote nudge-note">${mascot("sm")}相手は ${S.nudges} 回、返事をせかしてきました。${n.end === "bad" ? "せかされると、考える時間がなくなります。次は「時間をおく」も使ってみよう。" : "せかされても、自分のペースで考えられました。"}</p>` : ""}
    ${S.evidence ? `<p class="hintnote">${mascot("sm")}記録を ${S.evidence} 件残しました。${n.end === "safe" ? "何もなくても、記録はあとで役に立つことがあります。" : "相談するとき、この記録が大事な証拠になります。"}</p>` : ""}
    ${ex ? `<div class="co-res exam-res"><span class="eyebrow">${ex.note}</span><b>${EXAM.i + 1 < EXAM.ids.length ? "この調子で、次の話へ" : "3話そろいました。結果を見よう"}</b><span class="co-bar" aria-hidden="true"><i style="width:${Math.round((EXAM.i + 1) / EXAM.ids.length * 100)}%"></i></span></div>` : ""}
    ${cn ? `<div class="co-res">${cn.s ? `<span class="eyebrow">コース「${esc(cn.c.n)}」</span><b>${cn.done} / ${cn.all} 本クリア</b><span>次は「${esc(cn.s.tag)}」の話です。</span>` : `<span class="eyebrow">コース修了</span><b>「${esc(cn.c.n)}」を全部体験しました</b><span>ホームの「学びのコース」で、ほかのコースにも挑戦してみよう。</span><button class="btn small primary ce-res" type="button" data-cert="${cn.c.id}">修了証をつくる</button>`}<span class="co-bar" aria-hidden="true"><i style="width:${Math.round(cn.done / cn.all * 100)}%"></i></span></div>` : ""}
    <div class="rtabs" role="tablist" aria-label="結果の見かた">
      <button type="button" role="tab" id="rtab-0" data-tab="0" aria-selected="true" aria-controls="rpane-0">ふりかえり</button>
      <button type="button" role="tab" id="rtab-1" data-tab="1" aria-selected="false" aria-controls="rpane-1">裏側</button>
      <button type="button" role="tab" id="rtab-2" data-tab="2" aria-selected="false" aria-controls="rpane-2">まとめ</button>
      <button type="button" role="tab" id="rtab-3" data-tab="3" aria-selected="false" aria-controls="rpane-3">伝える</button>
    </div>
    <div class="rpane" role="tabpanel" id="rpane-0" aria-labelledby="rtab-0">
    ${tacticsHTML(sc)}
    ${noteHTML(sc)}
    <div><div class="side-h"><h2>ストーリーマップ</h2><span>結末 ${p.ends.length} / ${endIds(sc).length}</span></div><div class="mapbox">${storyMap(sc, S.path, id)}${MAP_LEGEND}</div></div>
    ${missed ? `<div><div class="side-h"><h2>見逃したサイン</h2></div><ul class="signs">${ids.filter((k) => S.signs[k] === "missed").map((k) => `<li><span class="st missed">見逃した</span><b>${esc(sc.signs[k].t)}</b><span class="d">${esc(sc.signs[k].d)}</span></li>`).join("")}</ul></div>` : ""}
    ${S.hist.length ? `<div><div class="side-h"><h2>あなたが通ったルート</h2><span>分かれ道からやり直せます</span></div>
      <ol class="route">${S.hist.map((h, i) => `<li class="${h.sign ? (h.ok ? "ok" : "ng") : ""}">
        <span class="rt-mark" aria-hidden="true">${h.sign ? (h.ok ? "◎" : "▲") : "・"}</span>
        <div class="rt-body"><span class="rt-text">${esc(h.text)}</span>${h.sign ? `<span class="rt-sign">${h.ok ? "気づけた" : "見逃した"}：${esc(sc.signs[h.sign].t)}</span>` : ""}</div>
        <button class="linkbtn" type="button" data-replay="${i}" id="replay-${i}">ここから</button></li>`).join("")}</ol></div>` : ""}
    </div>
    <div class="rpane" role="tabpanel" id="rpane-1" aria-labelledby="rtab-1" hidden>
    ${scriptHTML(sc)}
    </div>
    <div class="rpane" role="tabpanel" id="rpane-2" aria-labelledby="rtab-2" hidden>
    ${DEBRIEF[sc.id] ? debriefHTML(sc) : ""}
    </div>
    <div class="rpane" role="tabpanel" id="rpane-3" aria-labelledby="rtab-3" hidden>
    <div class="talkbox"><div class="side-h" style="margin:0"><h2>家族や友だちに話してみよう</h2></div>
      <p class="talk-lead">知っている人が多いほど、だまされにくくなります。体験したことを、身近な人にひとこと伝えてみよう。</p>
      <p class="talk-msg" id="talkMsg">${esc(talk)}</p>
      <div class="sharebtns"><button class="btn small" type="button" id="talkCopy">このひとことをコピー</button>
        <a class="btn small" id="talkLine" href="https://line.me/R/share?text=${encodeURIComponent(talk + "\n" + url)}" target="_blank" rel="noopener">LINEで家族に送る</a></div></div>
    <div class="sharebox">
      <div class="side-h" style="margin:0"><h2>結果をシェアする</h2></div>
      <img id="shareImg" alt="結果カードの画像：${esc(sc.title)}／${esc(rk.r)}／気づけたサイン ${caught}/${met}">
      <span class="hint">画像は長押し（パソコンは右クリック）で保存できます。</span>
      <textarea class="sharetext" id="shareText" aria-label="シェア用の文章">${esc(full)}</textarea>
      <div class="sharebtns">
        <a class="btn small dark" id="shareX" href="https://x.com/intent/post?text=${encodeURIComponent(full)}" target="_blank" rel="noopener">Xでポスト</a>
        <a class="btn small" id="shareLine" href="https://line.me/R/share?text=${encodeURIComponent(full)}" target="_blank" rel="noopener">LINEで送る</a>
        <button class="btn small" type="button" id="shareCopy">文章をコピー</button>
      </div>
    </div>
    </div>
    ${similarHTML(sc)}
    <div class="resbtns">
      <button class="btn" type="button" id="resRetry">別の選択でもう一度</button>
      <button class="btn honne-btn" type="button" id="resHonne">本音モードでもう一度</button>
      ${sc.gen || !DEBRIEF[sc.id] ? "" : `<button class="btn call-btn" type="button" id="resCall"><span class="c8-mini" aria-hidden="true">188</span>相談する練習</button>`}
      ${ex ? `<a class="btn primary" href="${ex.href}" id="resNext">${ex.label}</a>` : sc.gen ? `<a class="btn primary" href="#mix" id="resNext">もう1話：毎回ちがう話</a>` : `<a class="btn primary" href="#${next.id}" id="resNext">${cn && cn.s ? "コースの次へ" : "次へ"}：${esc(next.tag)}</a>`}
    </div>
    <button class="qback" type="button" id="resClose" style="justify-self:center">閉じて会話を見返す</button>
  </div>`;
  $("result").hidden = false;
  /* 結果のタブ：ふりかえり／まとめ／伝える・シェア（左右キーでも移動） */
  const tabs = [...$("resultSheet").querySelectorAll("[data-tab]")];
  const pick = (i, focus) => {
    tabs.forEach((b, k) => { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; $("rpane-" + k).hidden = k !== i; });
    if (focus) tabs[i].focus();
    /* 新しいタブの中身が、タブのすぐ下から見えるように送る */
    const sh = $("resultSheet"), bar = sh.querySelector(".rtabs"), pane = $("rpane-" + i);
    const gap = pane.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
    if (gap < 0) sh.scrollTo({ top: sh.scrollTop + gap - 12, behavior: reduced ? "auto" : "smooth" });
  };
  tabs.forEach((b, k) => {
    b.tabIndex = k === 0 ? 0 : -1;
    b.onclick = () => pick(k);
    b.onkeydown = (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); pick((k + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true); } };
  });
  $("shareCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(full); toast("コピーしました"); }
    catch (e) { const ta = $("shareText"); ta.focus(); ta.select(); toast("選択しました。コピーしてください"); }
  };
  $("talkCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(talk); toast("コピーしました"); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("talkMsg")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("選択しました。コピーしてください"); }
  };
  $("resRetry").onclick = () => { closeResult(); openScenario(sc.id); };
  bindNote(sc);
  $("resHonne").onclick = () => { closeResult(); HONNE_NEXT = true; openScenario(sc.id); };
  if ($("resCall")) $("resCall").onclick = () => openCall(sc, n.end);
  $("resultSheet").querySelectorAll("[data-replay]").forEach((b) => (b.onclick = () => replayFrom(+b.dataset.replay)));
  $("resClose").onclick = () => closeResult();
  $("resNext").onclick = () => closeResult(true);
  $("resultSheet").querySelectorAll(".sim-card").forEach((a) => (a.onclick = () => closeResult(true)));
  $("resClose").focus({ preventScroll: true });
  drawCard(sc, n, rk, caught, met).then((src) => { const img = $("shareImg"); if (img && src) img.src = src; });
}
/* ===== 印刷用ワークシート：その話のあらすじ・流れ・サイン・問いを、A4の1枚に ===== */
function printWorksheet(sc) {
  if (!sc) return;
  const d = DEBRIEF[sc.id] || {};
  let el = $("printSheet");
  if (!el) { el = document.createElement("div"); el.id = "printSheet"; document.body.appendChild(el); }
  const signs = Object.values(sc.signs).filter((s) => s.cat !== "soudan");
  el.innerHTML = `<div class="ps">
    <header class="ps-h"><div><span class="ps-site">だまされ体験ラボ　ワークシート</span><h1>${esc(sc.title)}</h1><span class="ps-tag">${esc(sc.tag)}</span></div>
      <div class="ps-name">年　　組　　番<br>名前</div></header>
    <section><h2>1. どんな話？</h2><p>${esc(sc.intro)}</p></section>
    ${d.flow ? `<section><h2>2. よくある流れ</h2><ol class="ps-flow">${d.flow.map((f) => `<li>${esc(f)}</li>`).join("")}</ol></section>` : ""}
    <section><h2>3. かくれていたサイン　<small>体験して気づけたものに ✓</small></h2>
      <ul class="ps-signs">${signs.map((s) => `<li><span class="ps-box"></span><b>${esc(s.t)}</b><span>（${esc(CATS[s.cat].n)}）</span></li>`).join("")}</ul></section>
    ${d.ask ? `<section><h2>4. 考えてみよう</h2>${d.ask.map((q) => `<div class="ps-q"><p>${esc(q)}</p><div class="ps-lines"><i></i><i></i></div></div>`).join("")}</section>` : ""}
    <section><h2>5. 自分の言葉で、断りのひとことを書こう</h2>
      ${d.say ? `<p class="ps-ex">例：${d.say.map((s) => "「" + esc(s) + "」").join("　")}</p>` : ""}<div class="ps-lines"><i></i><i></i></div></section>
    <footer class="ps-f"><b>困ったら相談</b>　消費者ホットライン 188　／　警察相談専用電話 #9110（緊急時は110番）<span>${esc(PAGES_URL)}#${esc(sc.id)}</span></footer>
  </div>`;
  window.print();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-print]");
  if (b) printWorksheet(byId(b.dataset.print));
});
function debriefHTML(sc) {
  const d = DEBRIEF[sc.id];
  return `<div class="debrief"><div class="side-h"><h2>このシナリオのまとめ</h2></div>
    <p class="db-point">${mascot("sm")}<b>${esc(d.point)}</b></p>
    <p class="db-real">${esc(d.real)}</p>
    ${d.flow ? `<div><span class="eyebrow">よくある流れ　どこでも止まれる</span><ol class="db-flow">${d.flow.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>` : ""}
    ${d.say ? `<div><span class="eyebrow">そのまま使える、断りのひとこと</span><div class="db-say">${d.say.map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>` : ""}
    ${d.after ? `<div class="db-after"><span class="eyebrow">もし被害にあったら、すぐやること</span><ol>${d.after.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>` : ""}
    <div class="db-law"><span class="eyebrow">知っておきたいこと</span><ul>${d.law.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>
    <div class="db-ask"><span class="eyebrow">考えてみよう</span><ul>${d.ask.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>
    <div class="db-print"><button class="btn small" type="button" data-print="${esc(sc.id)}">${svgI('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>')} 印刷用ワークシート</button><span>授業で配れる、A4の1枚にまとめます</span></div></div>`;
}
/* 分かれ道からやり直す：その選択の直前の状態にもどして、その場面から再生する */
function replayFrom(i) {
  const h = S.hist[i];
  if (!h) return;
  closeResult(true);
  RUN++;
  const sc = S.sc;
  S = { sc, run: RUN, signs: Object.assign({}, h.signsBefore), order: {}, scene: null, clock: h.clock, lastFrom: null, skip: false, path: [], hist: S.hist.slice(0, i) };
  $("overlay").hidden = true;
  $("log").innerHTML = "";
  $("clock").textContent = S.clock;
  append(`<div class="chip"><i></i><span>分かれ道 ${i + 1} からやり直し</span></div>`);
  if (h.scene) setScene(h.scene);
  renderSide(); renderDots();
  playNode(h.node);
}
function closeResult(silent) {
  if ($("result").hidden) return;
  $("result").hidden = true;
  if (!silent) { const b = $("btn-result"); if (b) b.focus({ preventScroll: true }); }
}
$("result").addEventListener("click", (e) => { if (e.target === $("result")) closeResult(); });

async function drawCard(sc, n, rk, caught, total) {
  /* シェア用の画像：紺と金の落ち着いたデザイン。表示がライトでもダークでも同じ色で描く */
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load('900 44px "Zen Kaku Gothic New"'), document.fonts.load('700 26px "Zen Kaku Gothic New"')]).catch(() => {});
    }
    const W = 1200, H = 630, F = '"Zen Kaku Gothic New", sans-serif';
    const NAVY = "#1E3A5F", NAVY2 = "#0F2440", GOLD = "#C9A227", PAPER = "#FBF8F1", INK = "#1B2534", MUTED = "#5B6676";
    const END = { safe: ["#14805D", "被害なし"], partial: ["#A8851C", "ギリギリ"], bad: ["#B83A2E", "被害にあった"] }[n.end] || ["#1E3A5F", ""];
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    const wrap = (text, X, Y, maxW, lh, maxLines) => {
      let line = "", lines = [];
      for (const ch of text) { if (x.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch; }
      if (line) lines.push(line);
      if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…"; }
      lines.forEach((l, i) => x.fillText(l, X, Y + i * lh));
      return lines.length;
    };
    x.textBaseline = "top";
    /* 背景：紙の色＋左に紺の帯 */
    x.fillStyle = PAPER; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, NAVY); g.addColorStop(1, NAVY2);
    x.fillStyle = g; x.fillRect(0, 0, 400, H);
    x.fillStyle = GOLD; x.fillRect(400, 0, 6, H);
    /* 左：サイト名・結末・判定・気づけたサイン */
    x.fillStyle = GOLD; x.font = `700 24px ${F}`; x.fillText("だまされ体験ラボ", 48, 52);
    x.fillStyle = "rgba(245,247,250,.7)"; x.font = `500 18px ${F}`; x.fillText("だまされる前に、気づく練習を。", 48, 86);
    rr(48, 150, 304, 64, 32); x.fillStyle = END[0]; x.fill();
    x.fillStyle = "#fff"; x.font = `900 30px ${F}`; x.textAlign = "center"; x.fillText(END[1], 200, 166); x.textAlign = "left";
    x.fillStyle = "rgba(245,247,250,.7)"; x.font = `700 20px ${F}`; x.fillText("判定", 48, 250);
    let fz = 44; x.font = `900 ${fz}px ${F}`;
    while (x.measureText(rk.r).width > 304 && fz > 24) { fz -= 2; x.font = `900 ${fz}px ${F}`; }
    x.fillStyle = "#F5F7FA"; x.fillText(rk.r, 48, 280);
    x.fillStyle = "rgba(245,247,250,.7)"; x.font = `700 20px ${F}`; x.fillText("気づけたサイン", 48, 372);
    x.fillStyle = GOLD; x.font = `900 64px ${F}`; x.fillText(`${caught}`, 48, 400);
    const cw = x.measureText(`${caught}`).width;
    x.fillStyle = "rgba(245,247,250,.8)"; x.font = `700 34px ${F}`; x.fillText(` / ${total}`, 48 + cw, 424);
    x.fillStyle = "rgba(245,247,250,.55)"; x.font = `500 18px ${F}`; x.fillText("azakeiten.github.io/damasare-lab", 48, 560);
    /* 右：話のタイトルと結末 */
    const L = 456, RW = W - L - 56;
    x.font = `700 20px ${F}`;
    const tagW = x.measureText(sc.tag).width + 32;
    rr(L, 56, tagW, 38, 19); x.fillStyle = "#E8EEF5"; x.fill();
    x.fillStyle = NAVY; x.fillText(sc.tag, L + 16, 64);
    x.fillStyle = INK; x.font = `900 40px ${F}`;
    const tl = wrap(sc.title, L, 120, RW, 56, 3);
    let y = 120 + tl * 56 + 18;
    x.fillStyle = MUTED; x.font = `700 24px ${F}`;
    y += wrap("結末：" + n.h, L, y, RW, 36, 2) * 36 + 24;
    /* 守りゲージ */
    const v = guardVals();
    x.fillStyle = MUTED; x.font = `700 18px ${F}`; x.fillText("守れたもの", L, Math.max(y, 400));
    const gy = Math.max(y, 400) + 34, gw = RW / 4;
    GUARD.forEach(([k, name], i) => {
      const gx = L + i * gw;
      x.fillStyle = INK; x.font = `700 20px ${F}`; x.fillText(name, gx, gy);
      const c = v[k] >= 3 ? "#14805D" : v[k] === 2 ? GOLD : "#B83A2E";
      for (let p = 0; p < 3; p++) { rr(gx + p * 30, gy + 34, 24, 14, 4); x.fillStyle = p < v[k] ? c : "#D9DEE5"; x.fill(); }
    });
    x.fillStyle = MUTED; x.font = `700 20px ${F}`; x.textAlign = "right";
    x.fillText("#だまされ体験ラボ", W - 56, H - 56);
    return cv.toDataURL("image/png");
  } catch (e) { return null; }
}

/* ===== 見抜きレベル（経験値） ===== */
const TITLES = [[1, "見習い"], [3, "気づき上手"], [5, "見抜き名人"], [8, "だまされ知らず"], [12, "見抜きマスター"], [16, "ラボの番人"], [21, "伝説の見抜き手"]];
function lvInfo() {
  const xp = store.get("dl3-xp", 0) || 0;
  const lv = Math.floor(Math.sqrt(xp / 40)) + 1;
  const cur = 40 * (lv - 1) ** 2, nxt = 40 * lv ** 2;
  const title = TITLES.filter(([l]) => lv >= l).pop()[1];
  return { xp, lv, title, pct: Math.round(((xp - cur) / (nxt - cur)) * 100), toNext: nxt - xp };
}
function addXP(n) {
  const before = lvInfo().lv;
  store.set("dl3-xp", (store.get("dl3-xp", 0) || 0) + n);
  const after = lvInfo();
  if (after.lv > before) setTimeout(() => toast(`レベルアップ！ Lv.${after.lv}「${after.title}」`), 600);
  renderLvPill();
  return n;
}
function renderLvPill() {
  const i = lvInfo();
  $("lvPill").innerHTML = `<b>Lv.${i.lv}</b><span class="lvbar"><i style="width:${i.pct}%"></i></span>`;
  $("lvPill").title = `見抜きレベル ${i.lv}「${i.title}」 次のレベルまで ${i.toNext} XP`;
}

/* ===== 見抜きチャレンジ：あやしい？ だいじょうぶ？ ===== */
let CH = null;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function chPools() {
  const bad = sqPool().map((p) => {
    const n = p.sc;
    return { bad: true, app: firstMsg(n).app, from: p.who || "知らない相手", type: firstMsg(n).type, text: p.text, cat: p.sign.cat, head: p.sign.t, why: p.sign.d, src: n.id };
  });
  const tpl = (window.DL.templates || []).map((t) => ({ ...t, bad: true, tpl: true }));
  const good = (window.DL.benign || []).map((b) => ({ ...b, bad: false }));
  return { bad, tpl, good };
}
function fillTpl(t, r) {
  const F = window.DL.fills || {};
  const pick = (k) => { const a = F[k] || [k]; return a[Math.floor(r() * a.length)]; };
  const sub = (s) => s.replace(/\{(\w+)\}/g, (_, k) => pick(k));
  return { ...t, from: sub(t.from), text: sub(t.text), head: CATS[t.cat] ? CATS[t.cat].n + "のサイン" : "あやしいサイン" };
}
function chDraw(r) {
  const P = CH.pools;
  const x = r();
  let it;
  if (x < 0.38) it = { ...P.good[Math.floor(r() * P.good.length)] };
  else if (x < 0.62) it = fillTpl(P.tpl[Math.floor(r() * P.tpl.length)], r);
  else it = { ...P.bad[Math.floor(r() * P.bad.length)] };
  const key = it.text;
  if (CH.used.has(key) && CH.used.size < 120) return chDraw(r);
  CH.used.add(key);
  return it;
}
function startChallenge(mode) {
  const today = new Date();
  const seed = mode === "daily" ? Number(`${today.getFullYear()}${today.getMonth() + 1}${today.getDate()}`) : Math.floor(Math.random() * 1e9);
  CH = { mode, r: rng(seed), pools: chPools(), used: new Set(), i: 0, score: 0, correct: 0, combo: 0, best: 0, lives: 3, total: mode === "endless" ? Infinity : 10, cur: null, answered: null, xp: 0 };
  CH.cur = mode === "pair" ? chDrawPair(CH.r) : chDraw(CH.r);
  renderChallenge();
}
/* どっちが安全？：ふつうの連絡と、あやしいメッセージを1通ずつ並べる */
function chDrawPair(r) {
  const P = CH.pools;
  let good = P.good[Math.floor(r() * P.good.length)];
  for (let k = 0; k < 20 && CH.used.has(good.text); k++) good = P.good[Math.floor(r() * P.good.length)];
  CH.used.add(good.text);
  const bad = r() < 0.5 ? fillTpl(P.tpl[Math.floor(r() * P.tpl.length)], r) : { ...P.bad[Math.floor(r() * P.bad.length)] };
  const pair = r() < 0.5 ? [{ ...good, bad: false }, bad] : [bad, { ...good, bad: false }];
  return { pair };
}
function chAnswerPair(idx) {
  const right = !CH.cur.pair[idx].bad;
  CH.answered = { idx, right };
  if (right) { CH.correct++; CH.combo++; CH.best = Math.max(CH.best, CH.combo); CH.score += 10; CH.xp += addXP(5); sfx("ok"); }
  else { CH.combo = 0; sfx("stop"); }
  renderChallenge();
}
function chAnswer(saysBad) {
  const it = CH.cur, right = saysBad === it.bad;
  CH.answered = { saysBad, right };
  if (right) { CH.combo++; CH.correct++; CH.best = Math.max(CH.best, CH.combo); const pts = 10 + Math.min(10, (CH.combo - 1) * 2); CH.score += pts; CH.xp += addXP(5); sfx("ok"); }
  else { CH.combo = 0; if (CH.mode === "endless") CH.lives--; sfx("stop"); }
  renderChallenge();
}
function chNext() {
  CH.i++;
  const over = CH.mode === "endless" ? CH.lives <= 0 : CH.i >= CH.total;
  if (over) { CH.over = true; chFinish(); }
  else { CH.cur = CH.mode === "pair" ? chDrawPair(CH.r) : chDraw(CH.r); CH.answered = null; }
  renderChallenge();
}
function chFinish() {
  if (CH.mode === "daily") {
    const d = store.get("dl3-daily", {}) || {};
    const k = dayKey(new Date());
    if (!d[k]) { d[k] = CH.correct; store.set("dl3-daily", d); CH.xp += addXP(30); CH.firstToday = true; }
  } else if (CH.mode === "pair") {
    const best = store.get("dl3-pair", 0) || 0;
    if (CH.correct > best) { store.set("dl3-pair", CH.correct); CH.newBest = true; }
  } else {
    const best = store.get("dl3-endless", 0) || 0;
    if (CH.score > best) { store.set("dl3-endless", CH.score); CH.newBest = true; }
  }
  markToday();
}
function chCard(it) {
  return `<div class="ch-msg"><div class="ch-from"><span class="nt-ic" style="--gh:210" aria-hidden="true">${SCENE_ICON[it.type] || SCENE_ICON.dm}</span><b>${esc(it.from)}</b><span>${esc(it.app)}</span></div>
    <p>${esc(it.text)}</p></div>`;
}
/* ===== ことばで返すトレーニング：あやしいメッセージに、自分の言葉で返信を書く ===== */
let RT = null;
function judgeReply(raw) {
  const t = raw.normalize("NFKC").toLowerCase();
  const safe = W_SAFE.filter((w) => t.includes(w)).length;
  const risk = W_RISK.filter((w) => t.includes(w)).length;
  const leak = /[0-9]{4,}|\S+@\S+/.test(t);
  const asking = W_ASK.test(t);
  const action = /相談|確認|確かめ|かけ直|公式|警察|188|9110|ブロック|通報|調べ/.test(t);
  const short = [...raw].length <= 25;
  if (leak) return { stars: 0, tone: "ng", h: "番号やアドレスが入っています", m: "練習でも、本物の番号やアドレスは書かないでね。実際のやり取りでは、相手に個人情報を渡さないのがいちばん大事です。" };
  if (risk > safe) return { stars: 0, tone: "ng", h: "相手の話に乗ってしまう返信かも", m: "「はい」「お願いします」「払います」など、引き受ける言葉が入っています。いったん止まって、断るか確かめる返信にしてみよう。" };
  if (safe > risk) {
    const stars = 1 + (short ? 1 : 0) + (action ? 1 : 0);
    const tips = [!short && "もう少し短くてもOK。理由をくわしく言わなくても断れます", !action && "「親に相談します」「公式で確かめます」のように、次にやることを足すとさらに強い"].filter(Boolean);
    return { stars, tone: "ok", h: stars === 3 ? "短く、はっきり、確かめる。満点の返し！" : "断る・確かめる返信になっています", m: tips.length ? tips.join("。") + "。" : "この返しなら、相手も引き下がるしかありません。" };
  }
  if (asking) return { stars: 1, tone: "mid", h: "聞き返すのは、いい作戦", m: "相手の答えに、あやしさが出ることがあります。でも、最後は「断る」か「確かめる」で終わらせよう。" };
  return { stars: 0, tone: "mid", h: "気持ちが伝わりにくいかも", m: "「やめておきます」「親に相談します」のように、断るのか、確かめるのかが分かる言葉を入れてみよう。" };
}
function savePhrase(text, from) {
  const t = maskTx(text.trim());
  if (!t) return false;
  const list = store.get("dl3-phrases", []) || [];
  if (list.some((x) => x.t === t)) return false;
  list.unshift({ t, from: from || "", at: Date.now() });
  store.set("dl3-phrases", list.slice(0, 60));
  return true;
}
function startReply() {
  const pool = shuffle(chPools().bad.filter((b) => DEBRIEF[b.src]));
  const items = [], seen = new Set();
  for (const b of pool) { if (items.length >= 5) break; if (!seen.has(b.src)) { seen.add(b.src); items.push(b); } }
  RT = { items, i: 0, res: null, stars: 0, xp: 0, last: "" };
  renderChallenge();
  setTimeout(() => { const f = $("rtIn"); if (f) f.focus({ preventScroll: true }); }, 30);
}
function renderReply(el, head) {
  if (RT.i >= RT.items.length) {
    const max = RT.items.length * 3;
    const best = Math.max(store.get("dl3-reply", 0) || 0, RT.stars);
    store.set("dl3-reply", best);
    el.innerHTML = head + `<div class="ch-board ch-end">${mascot("md")}<span class="eyebrow">ことばで返す　結果</span>
      <b class="ch-big">★ ${RT.stars} / ${max}</b>
      <p>${RT.stars >= max - 2 ? "自分の言葉で、しっかり断れています。" : RT.stars >= max / 2 ? "いい調子。短く、次にやることを入れると、もっと強い返しになります。" : "例の返しを参考に、短い「断りのひとこと」を自分の言葉にしてみよう。"}（自己ベスト ★${best}）</p>
      <p class="xpgain">見抜きポイント <b>+${RT.xp} XP</b></p>
      <div class="row-btns"><a class="btn small" href="#help" id="rtBook">ことば帳を見る</a>
        <button class="btn small primary" type="button" id="rtAgain">もう一度（問題が変わります）</button>
        <button class="btn small" type="button" id="rtMenu">チャレンジの最初へ</button></div></div>`;
    $("rtAgain").onclick = () => startReply();
    $("rtMenu").onclick = () => { RT = null; renderChallenge(); };
    $("rtBook").onclick = () => { RT = null; };
    return;
  }
  const it = RT.items[RT.i], r = RT.res, d = DEBRIEF[it.src] || {}, sc = byId(it.src);
  el.innerHTML = head + `<div class="ch-board rt-board">
    <div class="ch-top"><span>第 ${RT.i + 1} / ${RT.items.length} 問</span><span>★ <b>${RT.stars}</b></span><button class="linkbtn" type="button" id="rtQuit">やめる</button></div>
    ${chCard(it)}
    ${r ? `<div class="rt-mine"><span class="eyebrow">あなたの返信</span><p>${esc(maskTx(RT.last))}</p></div>
      <div class="rt-res rt-${r.tone}"><div class="rt-stars" aria-label="${r.stars}つ星">${[0, 1, 2].map((k) => `<i class="${k < r.stars ? "on" : ""}">★</i>`).join("")}</div>
        <b>${esc(r.h)}</b><p>${esc(r.m)}</p></div>
      <div class="rt-why"><span class="eyebrow">このメッセージのサイン</span><b>${esc(it.head || "")}</b><p>${esc(it.why || "")}</p></div>
      ${d.say ? `<div><span class="eyebrow">たとえば、こんな返し方</span><div class="db-say">${d.say.map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>` : ""}
      <div class="row-btns">${r.tone === "ok" ? `<button class="btn small" type="button" id="rtSave">わたしのことば帳に保存</button>` : ""}
        ${sc ? `<a class="btn small" href="#${sc.id}">この話を体験する</a>` : ""}
        <button class="btn small primary" type="button" id="rtNext">${RT.i + 1 < RT.items.length ? "次のメッセージ" : "結果を見る"}</button></div>`
    : `<form class="rt-form" id="rtForm" autocomplete="off"><label for="rtIn" class="rt-q">あなたなら、どう返す？</label>
        <div class="freebar"><input id="rtIn" type="text" maxlength="80" enterkeyhint="send" placeholder="自分の言葉で返信を書く（例：親に相談してから決めます）">
          <button type="submit" aria-label="送信">${ICON_SEND}</button></div>
        <p class="rt-note">書いた返信は、この端末の中だけで判定します。本物の個人情報は書かないでね。</p></form>`}
  </div>`;
  $("rtQuit").onclick = () => { RT = null; renderChallenge(); };
  if (!r) {
    $("rtForm").onsubmit = (e) => {
      e.preventDefault();
      const v = $("rtIn").value.trim(); if (!v) return;
      RT.last = v; RT.res = judgeReply(v); RT.stars += RT.res.stars;
      if (RT.res.stars) { RT.xp += addXP(RT.res.stars * 2); }
      sfx(RT.res.tone === "ok" ? "ok" : "stop");
      renderChallenge();
      const n = $("rtNext"); if (n) n.focus({ preventScroll: true });
    };
  } else {
    if ($("rtSave")) $("rtSave").onclick = () => { const ok = savePhrase(RT.last, sc ? sc.tag : ""); $("rtSave").disabled = true; $("rtSave").textContent = ok ? "保存しました" : "保存ずみです"; };
    $("rtNext").onclick = () => { RT.i++; RT.res = null; RT.last = ""; renderChallenge(); setTimeout(() => { const f = $("rtIn"); if (f) f.focus({ preventScroll: true }); }, 30); };
  }
}
/* わたしの断りことば帳（相談先のページ） */
/* ===== 家族といっしょに使う（相談先ページ） ===== */
/* ===== だましが届く時間：全シナリオの「はじまりの時刻」を、24時間の時計にならべる ===== */
let CK_H = null;
const CK_BANDS = [
  [5, 10, "朝", "出かける前のあわただしい時間。「今すぐ」と言われると、確かめる時間がないまま動いてしまいます。"],
  [11, 14, "昼", "昼休みのすきま時間。短い時間で返事をしようとして、文面をよく読まずにリンクを押しがちです。"],
  [15, 18, "夕方", "学校や仕事の帰り道。駅前の声かけや、帰宅を待ちかまえた訪問・電話が多い時間です。"],
  [19, 23, "夜", "疲れて、ひとりになる時間。だれにも相談できないまま、DMや電話で話が進みやすくなります。"],
  [0, 4, "深夜", "眠くて判断がにぶる時間。深夜のメッセージには、朝になってから返事をしよう。"]
];
const ckBand = (h) => CK_BANDS.find(([a, b]) => h >= a && h <= b);
function ckData() {
  const by = Array.from({ length: 24 }, () => []);
  SCENARIOS.forEach((sc) => { const m = /^(\d{1,2}):\d{2}$/.exec(sc.clock || ""); if (m && +m[1] < 24) by[+m[1]].push(sc); });
  return by;
}
function clockHTML() {
  const by = ckData(), cnt = by.map((a) => a.length), max = Math.max(1, ...cnt), all = cnt.reduce((a, b) => a + b, 0);
  const top = cnt.indexOf(Math.max(...cnt));
  const h = CK_H == null ? top : CK_H;
  const night = [19, 20, 21, 22, 23].reduce((a, k) => a + cnt[k], 0);
  const C = 160, R0 = 56, L = 82;
  const pt = (k, r) => { const a = (k / 24) * Math.PI * 2 - Math.PI / 2; return [(C + Math.cos(a) * r).toFixed(1), (C + Math.sin(a) * r).toFixed(1)]; };
  const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 12 ? 1 : 0} 1 ${x1} ${y1}`; };
  const bars = cnt.map((n, k) => {
    const [x0, y0] = pt(k + 0.5, R0), [x1, y1] = pt(k + 0.5, R0 + 4 + (n / max) * L);
    const [hx, hy] = pt(k + 0.5, R0 + L / 2 + 6);
    return `<g class="ck-b${k === h ? " on" : ""}${k === top ? " top" : ""}" role="button" tabindex="0" data-hr="${k}" aria-label="${k}時台：${n}本" aria-pressed="${k === h}">
      <line class="ck-hit" x1="${pt(k + 0.5, R0)[0]}" y1="${pt(k + 0.5, R0)[1]}" x2="${pt(k + 0.5, R0 + L + 6)[0]}" y2="${pt(k + 0.5, R0 + L + 6)[1]}"/>
      <line class="ck-bar" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/><title>${k}時台 ${n}本</title></g>`;
  }).join("");
  const labels = [0, 3, 6, 9, 12, 15, 18, 21].map((k) => { const [x, y] = pt(k, R0 + L + 18); return `<text class="ck-lab" x="${x}" y="${y}">${k}</text>`; }).join("");
  const band = ckBand(h) || CK_BANDS[3];
  const list = by[h];
  return `<section class="sec ck-sec" id="clock24" aria-label="だましが届く時間">
    <div class="sec-h"><h2>だましが届く時間</h2><p>${all}本の話の「はじまりの時刻」を、24時間の時計にならべました。いちばん多いのは<b>${top}時台</b>。夜の19〜23時に、全体の${Math.round((night / all) * 100)}%が集まっています。</p></div>
    <div class="ck-wrap">
      <svg class="ck-svg" viewBox="0 0 320 320" role="group" aria-label="24時間の時計。時間をえらぶと、その時間に始まる話が出ます">
        <path class="ck-night" d="${arc(18, 24, R0 + L / 2 + 4)}"/><path class="ck-night" d="${arc(0, 6, R0 + L / 2 + 4)}"/>
        <circle class="ck-face" cx="${C}" cy="${C}" r="${R0 - 6}"/>
        ${bars}${labels}
        <text class="ck-ch" x="${C}" y="${C - 6}">${h}<tspan class="ck-chs">時台</tspan></text>
        <text class="ck-cn" x="${C}" y="${C + 22}">${list.length}本</text>
      </svg>
      <div class="ck-side" aria-live="polite">
        <span class="ck-band"><i>${esc(band[2])}</i>${band[0]}〜${band[1]}時</span>
        <p class="ck-tip">${esc(band[3])}</p>
        <div class="ck-list">${list.length ? list.slice(0, 10).map((sc) => `<a class="ck-item" href="#${sc.id}"><span class="ck-t">${esc(sc.clock)}</span><span>${esc(sc.tag)}</span></a>`).join("") + (list.length > 10 ? `<span class="ck-more">ほか ${list.length - 10}本</span>` : "") : `<span class="ck-more">この時間に始まる話は、まだありません。</span>`}</div>
        <div class="ck-step" role="group" aria-label="時間をかえる"><button class="btn small" type="button" data-hr="${(h + 23) % 24}" aria-label="1時間前">← ${(h + 23) % 24}時</button><button class="btn small" type="button" data-hr="${(h + 1) % 24}" aria-label="1時間あと">${(h + 1) % 24}時 →</button></div>
      </div>
    </div></section>`;
}
function bindClock() {
  const sec = $("clock24"); if (!sec) return;
  const go = (k, focus) => {
    CK_H = k; const t = document.createElement("div"); t.innerHTML = clockHTML(); sec.replaceWith(t.firstElementChild); bindClock();
    if (focus) { const g = document.querySelector(`#clock24 .ck-b[data-hr="${k}"]`); if (g) g.focus(); }
  };
  sec.querySelectorAll("[data-hr]").forEach((el) => {
    el.addEventListener("click", () => go(+el.dataset.hr, el.matches(".ck-b")));
    if (el.matches(".ck-b")) el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(+el.dataset.hr, true); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go((+el.dataset.hr + 1) % 24, true); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go((+el.dataset.hr + 23) % 24, true); }
    });
  });
}
/* ===== だましの決まり文句ランキング：全シナリオの相手のセリフから、よく使われる言葉を数える ===== */
const KIMARI = [
  [/今日だけ|今日中|本日中|今夜だけ|今すぐ|いますぐ/, "今日だけ・今すぐ", "考える時間をなくして、その場で決めさせる言葉"],
  [/あなただけ|あなたにだけ|きみにだけ|おまえにだけ|特別に|特待生/, "あなただけ・特別に", "特別あつかいして、うれしい気持ちにさせる言葉"],
  [/必ず(もうか|当た|増え|デビュー|取り返|返す|合格|通|戻|稼げ)|絶対(に)?(もうか|当た|増え|安全|大丈夫|損)|ぜったい(もうか|当た)|(元本|全額|合格|単位|収入|当選)保証|保証します/, "必ず・絶対・保証", "リスクがないように思わせる言葉"],
  [/だれにも言わ|誰にも言わ|内緒|ないしょ|ふたりだけの秘密|には言わないで|言わないでね|話さないほうがいい|親には(言わ|内緒|話さ)/, "だれにも言わないで", "まわりに相談させないための言葉"],
  [/取り返せ|元が取れ|回収でき/, "すぐ取り返せる", "先に払わせるための言葉"],
  [/無料|タダ|ゼロ円|(?<![0-9０-９,，])[0０]円/, "無料・ゼロ円", "入口のハードルを下げる言葉"],
  [/残り[0-9０-９]+(名|席|個|枠|口|人|セット)|あと[0-9０-９]+(名|席|個|口|人|セット)|残りわずか|枠が(埋|なく|残り)|早い者勝ち|ほかにも(希望|欲しい)/, "残りわずか", "あせらせて、比べさせない言葉"],
  [/みなさん.{0,8}(買われ|始め|やって|入って|受けて|使って|提出|申し込|手続き|付けて|そうして)|みんな.{0,6}(やって|稼いで|もうか|入って|払って|そうして|使って|増やし|倍)/, "みんなやっている", "自分だけ取り残されると思わせる言葉"],
  [/手数料|登録料|保証料|参加費|入会金|着手金/, "手数料・登録料", "お金を払わせる口実"],
  [/大丈夫|だいじょうぶ|ご安心/, "大丈夫・ご安心ください", "不安を打ち消して、確かめさせない言葉"]
];
function kimariHTML() {
  const rows = KIMARI.map(([re, label, note]) => {
    const hits = [];
    SCENARIOS.forEach((sc) => {
      let ex = null;
      Object.values(sc.nodes).some((n) => (n.log || []).some((l) => {
        if (l[0] !== "them") return false;
        const c = sc.cast[l[2] || (n.scene && n.scene.who)] || {};
        if (ALLY_RE.test((c.n || "") + (c.r || ""))) return false;
        if (re.test(l[1])) { ex = l[1]; return true; }
        return false;
      }));
      if (ex) hits.push({ sc, ex });
    });
    return { label, note, hits };
  }).sort((a, b) => b.hits.length - a.hits.length);
  const max = Math.max(1, ...rows.map((r) => r.hits.length));
  return `<section class="sec kimari" aria-label="だましの決まり文句ランキング">
    <div class="sec-h"><h2>だましの決まり文句ランキング</h2><p>${SCENARIOS.length}本の話で、相手が使ってきた言葉を数えました。この言葉が出たら、いったん止まろう。</p></div>
    <ol class="km-list">${rows.map((r, i) => {
      const ex = r.hits[(i * 7) % Math.max(1, r.hits.length)];
      return `<li style="--d:${i}"><span class="km-rank">${i + 1}</span>
        <div class="km-body"><div class="km-top"><b>「${esc(r.label)}」</b><span class="km-n">${r.hits.length}本</span></div>
          <span class="km-bar" aria-hidden="true"><i style="width:${Math.round((r.hits.length / max) * 100)}%"></i></span>
          <span class="km-note">${esc(r.note)}</span>
          ${ex ? `<a class="km-ex" href="#${ex.sc.id}">「${esc([...ex.ex].slice(0, 44).join(""))}${[...ex.ex].length > 44 ? "…" : ""}」<small>— ${esc(ex.sc.tag)}</small></a>` : ""}</div></li>`;
    }).join("")}</ol></section>`;
}
function familyHTML() {
  const c = COURSES.find((x) => x.id === "kazoku");
  const list = c ? courseOf(c) : [];
  const nx = list.find((s) => !cleared(s.id)) || list[0];
  return `<section class="sec family" aria-label="家族といっしょに使う">
    <div class="sec-h"><h2>家族といっしょに使う</h2><p>おじいちゃん・おばあちゃんや親といっしょに体験すると、家族みんなの守りになります。</p></div>
    <div class="fam-grid">
      <div class="fam-card"><span class="fam-n">1</span><b>「やさしい表示」と「読み上げ」</b><span>文字と選択肢が大きくなり、えらぶだけで進めるようになります。読み上げをオンにすると、相手のメッセージを声で読みます。</span>
        <div class="row-btns"><button class="btn small" type="button" data-easybtn>やさしい表示：オフ</button><button class="btn small" type="button" data-voicebtn>読み上げ：オフ</button></div></div>
      <div class="fam-card"><span class="fam-n">2</span><b>「家族を守る編」を一緒に</b><span>家族を名のる電話、訪問の業者、役所やカード会社を名のる連絡など、${list.length}本の話をまとめました。</span>
        ${nx ? `<a class="btn small primary" href="#${nx.id}" data-course="kazoku">一緒にはじめる：${esc(nx.tag)}</a>` : ""}</div>
      <div class="fam-card"><span class="fam-n">3</span><b>家族の「合言葉」を決める</b><span>電話やメッセージでお金の話が出たら、合言葉を聞く。いつもの番号にかけ直す。家族で決めておくと安心です。</span></div>
    </div>
  </section>`;
}
/* ===== 届いたメッセージをチェック：貼りつけた文から、サインの言葉を見つけて色をつける（端末の中だけで判定） ===== */
const CHECK_PAT = {
  tsuuchi: /https?:\/\/\S+|[a-z0-9-]+\.(top|xyz|icu|cn|shop|online|site)\b|【重要】|【緊急】|【最終(通知|警告)】|不正(な)?(ログイン|利用|アクセス)|アカウント(が|を)?(停止|凍結|ロック|制限)|未納|不在(のため|連絡)?|お荷物|配達(できません|予定)|当選(しました|されました)|下記(の)?(URL|リンク)|こちらから(ご)?(確認|手続き|ログイン)|(スマホ|携帯)が(壊れ|こわれ)|(新しい)?(アカウント|番号)(に|を)(変え|かえ|新しく)/gi,
  isogi: /今日なら|今日だけ|今日の(契約|うち)|今日決め|本日中|至急|今すぐ|すぐに|期限(が|は|内)|\d+時間以内|残り\d+|あと\d+(名|人|枠|日)|締め?切り|お急ぎ|早い者勝ち|(停止|削除|差し押さえ)(され|し)ます/g,
  umai: /1日d+分|作業だけ|スマホだけで|無料|タダで|当選|プレゼント|高収入|月\d+万|日給\d+|日払い|かんたん|簡単|稼げ|もうか|儲か|元本保証|必ず(もうか|儲か|当た|増え)|絶対(に)?(もうか|儲か|損)|副業|在宅で|半額|キャッシュバック|特別価格|割引|特別に|おゆずり/g,
  kane: /振り?込|送金|電子マネー|ギフト(カード|コード|券)|手数料|登録料|保証金|前払い|先払い|PayPay|ペイペイ|コンビニで|ATM|暗号資産|仮想通貨|ビットコイン|立て替え|代引き|(カード|コード)の番号を(送|教え)/g,
  kojin: /パスワード|暗証番号|認証コード|確認コード|ログインID|カード番号|セキュリティコード|有効期限|口座番号|マイナンバー|身分証|免許証|本人確認|生年月日/g,
  himitsu: /内緒|ないしょ|秘密|だれにも|誰にも|(言わ|話さ)ないで|LINEで|ラインで|DMで|別のアプリ|テレグラム|Telegram/gi,
  jouken: /定期(購入|コース)|自動更新|解約(できません|は|料)|月額|週額|初回(のみ|限定)?|お試し|分割|ローン|リボ/g,
  kankei: /大変なことに|危ない(です|ですよ)|事故が起き|さみしい|寂しい|会いたい|信じて|わかってあげ|あなただけ|あなたにだけ|選ばれた|ご縁|特別な(あなた|方)/g
};
const CHECK_EX = [
  "【重要】お客様のアカウントで不正なログインが確認されました。24時間以内に下記URLからパスワードを再設定しない場合、アカウントは停止されます。 https://xxxx-account.top/",
  "はじめまして！スマホで1日5分の作業だけで月20万円になってます。くわしくはLINEで教えますね。最初に登録料3,000円だけかかります",
  "お母さんだよ。スマホが壊れて新しくしたの。コンビニで電子マネーを5万円分買って、カードの番号を送ってくれる？ お父さんには内緒にしてね"
];
function checkMsg(text) {
  const hits = [];
  Object.entries(CHECK_PAT).forEach(([cat, re]) => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { if (!m[0]) { re.lastIndex++; continue; } hits.push({ s: m.index, e: m.index + m[0].length, cat, t: m[0] }); } });
  hits.sort((a, b) => a.s - b.s || b.e - a.e);
  const keep = []; let end = -1;
  hits.forEach((h) => { if (h.s >= end) { keep.push(h); end = h.e; } });
  let html = "", p = 0;
  keep.forEach((h) => { html += esc(text.slice(p, h.s)) + `<mark class="ck-m ck-${h.cat}" title="${esc(CATS[h.cat].n)}">${esc(h.t)}</mark>`; p = h.e; });
  html += esc(text.slice(p));
  const cats = [...new Set(keep.map((h) => h.cat))];
  return { html, cats, keep };
}
/* ===== 立ち止まりフローチャート：いま来ている話を、6つの質問で点検する ===== */
const FLOW_Q = [
  { c: "kane",    q: "お金・電子マネー・ポイントを払う、送る話が出ている？", y: "お金の話が出た" },
  { c: "isogi",   q: "「今日だけ」「今すぐ」「期限まで」と急かされている？", y: "急かされている" },
  { c: "himitsu", q: "「だれにも言わないで」「別のアプリで」と言われた？", y: "秘密・場所を移す" },
  { c: "kojin",   q: "名前・住所・写真・パスワード・番号を聞かれた？", y: "個人情報を聞かれた" },
  { c: "umai",    q: "「必ずもうかる」「無料」「あなただけ」など、話がうますぎる？", y: "うますぎる話" },
  { c: "check",   q: "相手が本物か、公式のサイトや窓口で、自分で確かめた？", y: "自分で確かめた", inv: true }
];
let FL = [];
function flowVerdict() {
  const yes = FL.filter((a, i) => !FLOW_Q[i].inv && a).length, checked = FL[5] === true;
  const risk = yes + (checked ? 0 : 1);
  if (risk >= 3) return { k: "stop", h: "いったん止まろう", d: "あやしいサインがいくつも重なっています。返事も支払いもしないで、家族やまわりの大人に、画面を見せて相談しよう。", act: ["返事・支払い・入力をしない", "画面を保存する", "家族や先生に見せる", "188か#9110に相談"] };
  if (risk >= 1) return { k: "check", h: "確かめてから動こう", d: "気になるサインがあります。相手のことを、公式のサイトや窓口で自分で確かめるまで、決めないでおこう。", act: ["公式サイトを自分で検索する", "家族に一言話す", "その場で決めない"] };
  return { k: "ok", h: "いまのところ、大きなサインはなし", d: "それでも、話が変わったら、もう一度この質問をしてみよう。「お金」「急かす」が出てきたら、そこで止まる。", act: ["話が変わったら、もう一度点検", "迷ったら家族に一言"] };
}
function flowHTML() {
  const i = FL.length, done = i >= FLOW_Q.length;
  const steps = FLOW_Q.map((s, k) => {
    const a = FL[k], st = k < i ? (s.inv ? (a ? "good" : "warn") : (a ? "warn" : "good")) : k === i ? "now" : "todo";
    return `<li class="fl-step ${st}"><span class="fl-dot" aria-hidden="true">${k < i ? (st === "warn" ? "!" : "✓") : k + 1}</span>
      <div class="fl-body"><p class="fl-q">${esc(s.q)}</p>
      ${k < i ? `<span class="fl-a">${a ? "はい" : "いいえ"}${st === "warn" ? `<em>${esc(s.inv ? "まだ確かめていない" : s.y)}</em>` : ""}</span>` : k === i ? `<div class="fl-btns"><button class="btn small" type="button" data-fl="1">はい</button><button class="btn small" type="button" data-fl="0">いいえ</button></div>` : ""}</div></li>`;
  }).join("");
  let res = "";
  if (done) {
    const v = flowVerdict(), cats = FLOW_Q.filter((s, k) => !s.inv && FL[k]).map((s) => s.c);
    const recs = cats.length ? SCENARIOS.filter((sc) => !sc.gen).map((sc) => { const cs = new Set(Object.values(sc.signs).map((x) => x.cat)); return { sc, n: cats.filter((c) => cs.has(c)).length + Math.random() * 0.5 }; }).sort((a, b) => b.n - a.n).slice(0, 3) : [];
    res = `<div class="fl-res ${v.k}" role="status"><span class="fl-badge">${v.k === "stop" ? "STOP" : v.k === "check" ? "CHECK" : "OK"}</span><b>${esc(v.h)}</b><p>${esc(v.d)}</p>
      <ol class="fl-act">${v.act.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
      ${recs.length ? `<div class="fl-recs"><span>このサインが出てくる話で、練習しておこう</span>${recs.map(({ sc }) => `<a href="#${sc.id}">${esc(sc.tag)}</a>`).join("")}</div>` : ""}
      <div class="row-btns"><button class="btn small" type="button" id="flReset">はじめから</button>${v.k !== "ok" ? `<a class="btn small primary" href="tel:188">188に電話する</a>` : ""}</div></div>`;
  }
  return `<section class="sec fl-sec" id="flow" aria-label="立ち止まりフローチャート"><div class="sec-h"><h2>立ち止まりフローチャート</h2><p>いま来ているメッセージや電話、お誘い。6つの質問に「はい・いいえ」で答えると、止まるべきかがわかります。</p></div>
    <div class="fl-box"><ol class="fl-steps">${steps}</ol>${res}</div></section>`;
}
function bindFlow() {
  const sec = $("flow"); if (!sec) return;
  const re = (focusSel) => { const t = document.createElement("div"); t.innerHTML = flowHTML(); $("flow").replaceWith(t.firstElementChild); bindFlow(); const f = document.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); };
  sec.querySelectorAll("[data-fl]").forEach((b) => (b.onclick = () => { FL.push(b.dataset.fl === "1"); if (FL.length >= FLOW_Q.length) { store.set("dl3-flowed", true); setTimeout(checkAch, 600); } re(FL.length >= FLOW_Q.length ? "#flReset" : "#flow [data-fl]"); }));
  if ($("flReset")) $("flReset").onclick = () => { FL = []; re("#flow [data-fl]"); };
}
function checkerHTML() {
  return `<section class="sec checker" id="checker" aria-label="届いたメッセージをチェック">
    <div class="sec-h"><h2>届いたメッセージをチェック</h2><p>あやしいと思ったメッセージを貼りつけると、サインになりやすい言葉に色をつけます。判定はこの端末の中だけで行い、どこにも送りません。</p></div>
    <div class="ck-box">
      <label class="sr" for="ckIn">チェックするメッセージ</label>
      <textarea id="ckIn" rows="5" maxlength="1200" placeholder="ここにメッセージを貼りつける（名前や番号など、本物の個人情報は消してからにしよう）"></textarea>
      <div class="ck-row"><span class="ck-ex-h">例で試す：</span>${CHECK_EX.map((_, i) => `<button class="chipbtn sm" type="button" data-ckex="${i}">例${i + 1}</button>`).join("")}
        <button class="btn small primary" type="button" id="ckGo">チェックする</button></div>
      <div id="ckOut" aria-live="polite"></div>
    </div></section>`;
}
function renderCheck() {
  const v = $("ckIn").value.trim(), out = $("ckOut");
  if (v && !store.get("dl3-checked", false)) { store.set("dl3-checked", true); setTimeout(checkAch, 800); }
  if (!v) { out.innerHTML = ""; return; }
  const r = checkMsg(v), n = r.cats.length;
  const lv = n === 0 ? ["ck-l0", "目立つサインは見つかりませんでした", "それでも安心とはかぎりません。知らない相手からのお金や個人情報の話には、いつも注意しよう。"]
    : n === 1 ? ["ck-l1", "注意：サインが1種類あります", "これだけで詐欺とは言えませんが、相手が本物か、公式の方法で確かめてから動こう。"]
    : n <= 3 ? ["ck-l2", `あやしい：サインが${n}種類あります`, "いくつかのサインが重なっています。リンクを押したり、返信したりする前に、家族や188に相談しよう。"]
    : ["ck-l3", `とてもあやしい：サインが${n}種類あります`, "詐欺によく見られる組み合わせです。返信・入金・入力はせず、すぐに家族や188・#9110に相談しよう。"];
  const score = (s) => Object.values(s.signs).filter((g) => r.cats.includes(g.cat)).length;
  const recs = SCENARIOS.map((s) => ({ s, k: score(s) })).filter((x) => x.k).sort((a, b) => b.k - a.k || (played(a.s) - played(b.s))).slice(0, 3);
  out.innerHTML = `<div class="ck-res ${lv[0]}">
      <div class="ck-meter" aria-hidden="true">${[0, 1, 2, 3].map((k) => `<i class="${k < (n >= 4 ? 4 : n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 3 : 4) ? "on" : ""}"></i>`).join("")}</div>
      <b>${esc(lv[1])}</b><p>${esc(lv[2])}</p></div>
    <div class="ck-text">${r.html}</div>
    ${n ? `<ul class="ck-cats">${r.cats.map((c) => `<li><span class="ck-dot ck-${c}" aria-hidden="true"></span><div><b>${CATS[c].ic} ${esc(CATS[c].n)}</b><span>「${esc(r.keep.filter((h) => h.cat === c).map((h) => h.t).slice(0, 3).join("」「"))}」</span><p>${esc(CATS[c].d)}</p></div></li>`).join("")}</ul>` : ""}
    ${recs.length ? `<div class="ck-recs"><span class="eyebrow">似たサインが出てくる話</span>${recs.map((x) => `<a class="ck-rec" href="#${x.s.id}"><span class="gtag" style="--gh:${GENRES[x.s.genre].h}">${esc(x.s.tag)}</span><b>${esc(x.s.title)}</b></a>`).join("")}</div>` : ""}
    <p class="ck-note">${mascot("sm")}<span>この判定は、言葉の目安です。サインがなくても詐欺のことも、あっても本物の連絡のこともあります。迷ったら、消費者ホットライン188へ。</span></p>`;
}
function bindChecker() {
  if (!$("ckIn")) return;
  $("ckGo").onclick = renderCheck;
  document.querySelectorAll("[data-ckex]").forEach((b) => (b.onclick = () => { $("ckIn").value = CHECK_EX[+b.dataset.ckex]; renderCheck(); }));
  $("ckIn").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) renderCheck(); };
  if (window.__gotoChecker) { window.__gotoChecker = false; setTimeout(() => $("checker").scrollIntoView({ block: "start" }), 50); }
}
/* ===== わが家の守りの約束カード：家族で約束をえらび、画像にして残す ===== */
const PLEDGES = [
  ["お金の話が出たら、いったん電話を切って家族に相談する", "電話"],
  ["家族を名のる電話には、いつもの番号にかけ直す", "電話"],
  ["家の電話は、ふだんから留守番電話にしておく", "電話"],
  ["キャッシュカードと暗証番号は、だれにも渡さない・教えない", "お金"],
  ["「電子マネーで払って」と言われたら、詐欺と考える", "お金"],
  ["SMSやメールのリンクは押さず、公式アプリで確かめる", "スマホ"],
  ["「だれにも言わないで」と言われたら、すぐ家族に話す", "気持ち"],
  ["訪問の業者は、ドアを開ける前にインターホンで確かめる", "訪問"],
  ["その場で契約しない。書面をもらって、家族と読む", "契約"],
  ["だまされても責めない。早く話してくれたら「ありがとう」", "気持ち"]
];
function pledgeState() {
  const s = store.get("dl3-pledge", null) || {};
  return { name: s.name || "", who: s.who || "", picks: Array.isArray(s.picks) ? s.picks : [0, 1, 3, 4, 6, 9] };
}
function pledgeHTML() {
  const s = pledgeState();
  return `<section class="sec pledge" id="pledge" aria-label="わが家の守りの約束カード">
    <div class="sec-h"><h2>わが家の守りの約束カード</h2><p>家族で話し合って、守りの約束を6つまでえらぼう。カードにして保存すれば、冷蔵庫や電話のそばにはっておけます。</p></div>
    <div class="pl-wrap">
      <div class="pl-form">
        <label class="pl-field"><span>家の呼び名（例：山田家、うちの家族）</span><input id="plName" type="text" maxlength="12" value="${esc(s.name)}" placeholder="うちの家族"></label>
        <label class="pl-field"><span>迷ったときに、まず連絡する人</span><input id="plWho" type="text" maxlength="14" value="${esc(s.who)}" placeholder="例：お母さん、となりのおばさん"></label>
        <fieldset class="pl-list"><legend>約束をえらぶ <b id="plCount">${s.picks.length}</b> / 6</legend>
          ${PLEDGES.map(([t, tag], i) => `<label class="pl-item"><input type="checkbox" data-pl="${i}" ${s.picks.includes(i) ? "checked" : ""}><span class="pl-tag">${esc(tag)}</span><span>${esc(t)}</span></label>`).join("")}
        </fieldset>
        <p class="pl-note">${mascot("sm")}<span>家族の「合言葉」は、カードには書かずに、家族の中だけで覚えておこう。入力した内容は、この端末の中だけに保存されます。</span></p>
      </div>
      <div class="pl-preview"><canvas id="plCv" width="1080" height="1350" aria-label="約束カードのプレビュー"></canvas>
        <div class="row-btns"><button class="btn small primary" type="button" id="plSave">画像を保存</button><button class="btn small" type="button" id="plPrint">印刷する</button></div></div>
    </div></section>`;
}
function drawPledge() {
  const cv = $("plCv"); if (!cv) return;
  const s = pledgeState(), x = cv.getContext("2d"), W = 1080, H = 1350;
  const NAVY = "#14243A", NAVY2 = "#0B1522", GOLD = "#C9A227", GOLD2 = "#D6B97F", F = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif', M = '"Shippori Mincho", "Yu Mincho", serif';
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, NAVY); g.addColorStop(1, NAVY2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = GOLD; x.lineWidth = 4; x.strokeRect(36, 36, W - 72, H - 72);
  x.lineWidth = 1.5; x.strokeRect(50, 50, W - 100, H - 100);
  x.textBaseline = "top"; x.textAlign = "center";
  x.fillStyle = GOLD2; x.font = `700 28px ${F}`; x.fillText("FAMILY PLEDGE", W / 2, 100);
  const name = (s.name || "うちの家族").trim();
  let fz = 76; x.font = `800 ${fz}px ${M}`;
  const title = `${name}の 守りの約束`;
  while (x.measureText(title).width > W - 200 && fz > 44) { fz -= 4; x.font = `800 ${fz}px ${M}`; }
  x.fillStyle = "#F5F7FA"; x.fillText(title, W / 2, 148);
  x.fillStyle = GOLD; x.fillRect(W / 2 - 60, 160 + fz + 14, 120, 4);
  x.textAlign = "left";
  const wrap = (t, X, Y, w, lh) => { let line = "", y = Y; for (const ch of t) { if (x.measureText(line + ch).width > w) { x.fillText(line, X, y); line = ch; y += lh; } else line += ch; } if (line) x.fillText(line, X, y); return y + lh; };
  const picks = s.picks.slice(0, 6), by = H - 260;
  const big = picks.length <= 4, fs = big ? 38 : 34, lh = big ? 52 : 46, gap = big ? 40 : 24;
  let y = 290;
  picks.forEach((i, k) => {
    x.fillStyle = GOLD; x.beginPath(); x.arc(150, y + 26, 28, 0, Math.PI * 2); x.fill();
    x.fillStyle = NAVY; x.font = `900 30px ${F}`; x.textAlign = "center"; x.fillText(String(k + 1), 150, y + 10); x.textAlign = "left";
    x.fillStyle = "#F5F7FA"; x.font = `700 ${fs}px ${F}`;
    y = wrap(PLEDGES[i][0], 205, y + 6, W - 205 - 130, lh) + gap - 6;
  });
  if (!picks.length) { x.fillStyle = "rgba(245,247,250,.6)"; x.font = `700 34px ${F}`; x.fillText("約束をえらんでください", 150, y); }
  x.fillStyle = "rgba(255,255,255,.07)"; x.fillRect(100, by, W - 200, 150);
  x.fillStyle = GOLD2; x.font = `700 26px ${F}`; x.fillText("迷ったら、まず", 140, by + 26);
  const wt = `${(s.who || "家族").trim()}に連絡`; let wf = 40; x.font = `900 ${wf}px ${F}`;
  while (x.measureText(wt).width > 440 && wf > 22) { wf -= 2; x.font = `900 ${wf}px ${F}`; }
  x.fillStyle = "#F5F7FA"; x.fillText(wt, 140, by + 64);
  x.textAlign = "right"; x.fillStyle = GOLD2; x.font = `700 24px ${F}`; x.fillText("消費者ホットライン", W - 140, by + 26);
  x.fillStyle = "#F5F7FA"; x.font = `900 48px ${F}`; x.fillText("188　#9110", W - 140, by + 60);
  x.fillStyle = "rgba(245,247,250,.55)"; x.font = `500 22px ${F}`; x.textAlign = "center";
  const d = new Date();
  x.fillText(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日に決めました　｜　だまされ体験ラボ`, W / 2, H - 92);
}
/* ===== 守りの待ち受け：ロック画面に置いておく、ひとことの壁紙をつくる ===== */
const WP_PHRASES = [
  ["急かされたら、", "いったん止まる。"],
  ["うますぎる話は、", "まず疑う。"],
  ["お金の話は、", "家族に聞いてから。"],
  ["リンクは押さず、", "公式から確かめる。"],
  ["「秘密にして」は、", "話していいサイン。"],
  ["迷ったら、", "188に電話。"]
];
const WP_THEMES = {
  navy:  { n: "紺と金",   bg: ["#14243A", "#0B1522"], ink: "#F5F7FA", ac: "#D6B97F" },
  dawn:  { n: "あさやけ", bg: ["#3A2340", "#E0866A"], ink: "#FFF6EE", ac: "#FFD27A" },
  mint:  { n: "ミント",   bg: ["#E3F4EE", "#9ED3C3"], ink: "#123B33", ac: "#0E7A5E" },
  paper: { n: "和紙",     bg: ["#FBF8F1", "#EFE6D2"], ink: "#1B2534", ac: "#B08A2E" }
};
const wpState = () => Object.assign({ p: 0, t: "navy" }, store.get("dl3-wp", {}) || {});
function wpHTML() {
  const s = wpState();
  return `<section class="sec wp-sec" id="wallpaper" aria-label="守りの待ち受け"><div class="sec-h"><h2>守りの待ち受けをつくる</h2><p>スマホのロック画面に、守りのひとことを。あやしい通知が来たとき、まず目に入ります。</p></div>
    <div class="wp-wrap">
      <div class="wp-phone"><canvas id="wpCv" width="1080" height="1920" aria-label="待ち受けのプレビュー"></canvas><span class="wp-clock" aria-hidden="true"><b>9:41</b><small>${(() => { const d = new Date(); return `${d.getMonth() + 1}月${d.getDate()}日 ${"日月火水木金土"[d.getDay()]}曜日`; })()}</small></span></div>
      <div class="wp-form">
        <fieldset class="wp-f"><legend>ひとこと</legend>${WP_PHRASES.map((p, i) => `<label class="wp-opt"><input type="radio" name="wpP" value="${i}"${s.p === i ? " checked" : ""}><span>${esc(p.join(""))}</span></label>`).join("")}</fieldset>
        <fieldset class="wp-f"><legend>色</legend><div class="wp-sw">${Object.entries(WP_THEMES).map(([k, t]) => `<label class="wp-c" style="--a:${t.bg[0]};--b:${t.bg[1]}"><input type="radio" name="wpT" value="${k}"${s.t === k ? " checked" : ""}><i aria-hidden="true"></i><span>${esc(t.n)}</span></label>`).join("")}</div></fieldset>
        <div class="row-btns"><button class="btn small primary" type="button" id="wpSave">画像を保存</button></div>
        <p class="pl-note">${mascot("sm")}<span>保存した画像を、スマホの設定から「壁紙（ロック画面）」にえらんでください。上のほうは時計が重なるので、ひとことは下に置いています。</span></p>
      </div>
    </div></section>`;
}
function drawWp() {
  const cv = $("wpCv"); if (!cv) return;
  const s = wpState(), t = WP_THEMES[s.t] || WP_THEMES.navy, p = WP_PHRASES[s.p] || WP_PHRASES[0];
  const x = cv.getContext("2d"), W = 1080, H = 1920, F = '"Zen Kaku Gothic New", "Yu Gothic", sans-serif', M = '"Shippori Mincho", "Yu Mincho", serif';
  const g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, t.bg[0]); g.addColorStop(1, t.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  /* うすい盾のもよう */
  x.save(); x.globalAlpha = 0.07; x.fillStyle = t.ink; x.translate(W * 0.78, H * 0.5);
  x.beginPath(); x.moveTo(0, -260); x.lineTo(220, -170); x.lineTo(200, 90); x.quadraticCurveTo(140, 250, 0, 330); x.quadraticCurveTo(-140, 250, -200, 90); x.lineTo(-220, -170); x.closePath(); x.fill(); x.restore();
  /* ひとこと（下半分） */
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  x.fillStyle = t.ac; x.fillRect(110, 1060, 90, 8);
  x.fillStyle = t.ink;
  const fit = (txt, max, size, font) => { let fz = size; x.font = `800 ${fz}px ${font}`; while (x.measureText(txt).width > max && fz > 50) { fz -= 4; x.font = `800 ${fz}px ${font}`; } return fz; };
  const f1 = fit(p[0], W - 220, 96, M); x.fillText(p[0], 110, 1200);
  x.fillStyle = t.ac; const f2 = fit(p[1], W - 220, 120, M); x.fillText(p[1], 110, 1200 + Math.max(f1, f2) + 40);
  /* 下の相談先 */
  const by = H - 330;
  x.globalAlpha = 0.9; x.strokeStyle = t.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(110, by); x.lineTo(W - 110, by); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = t.ink; x.font = `700 34px ${F}`; x.fillText("迷ったら", 110, by + 70);
  x.font = `900 76px ${F}`; x.fillText("188", 110, by + 160);
  x.font = `700 30px ${F}`; x.fillText("消費者ホットライン", 300, by + 150);
  x.textAlign = "right"; x.font = `900 76px ${F}`; x.fillText("#9110", W - 110, by + 160);
  x.font = `700 26px ${F}`; x.globalAlpha = 0.75; x.fillText("警察相談", W - 110, by + 70); x.globalAlpha = 1;
}
function bindWp() {
  if (!$("wpCv")) return;
  const save = () => {
    const p = document.querySelector('input[name="wpP"]:checked'), t = document.querySelector('input[name="wpT"]:checked');
    store.set("dl3-wp", { p: p ? +p.value : 0, t: t ? t.value : "navy" });
    drawWp();
  };
  document.querySelectorAll('input[name="wpP"], input[name="wpT"]').forEach((r) => (r.onchange = save));
  $("wpSave").onclick = () => { store.set("dl3-wped", true); setTimeout(checkAch, 800); const a = document.createElement("a"); a.href = $("wpCv").toDataURL("image/png"); a.download = "mamori-machiuke.png"; a.click(); };
  drawWp();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(drawWp);
}
function bindPledge() {
  if (!$("plCv")) return;
  const save = () => {
    const picks = [...document.querySelectorAll("[data-pl]")].filter((b) => b.checked).map((b) => +b.dataset.pl);
    store.set("dl3-pledge", { name: $("plName").value.trim(), who: $("plWho").value.trim(), picks });
    $("plCount").textContent = picks.length;
    document.querySelectorAll("[data-pl]").forEach((b) => { b.disabled = !b.checked && picks.length >= 6; b.closest(".pl-item").classList.toggle("off", b.disabled); });
    drawPledge();
  };
  document.querySelectorAll("[data-pl]").forEach((b) => (b.onchange = save));
  $("plName").oninput = save; $("plWho").oninput = save;
  $("plSave").onclick = () => { store.set("dl3-pledged", true); setTimeout(checkAch, 800); const a = document.createElement("a"); a.href = $("plCv").toDataURL("image/png"); a.download = "mamori-yakusoku.png"; a.click(); };
  $("plPrint").onclick = () => { store.set("dl3-pledged", true); setTimeout(checkAch, 800);
    const url = $("plCv").toDataURL("image/png"), ps = $("printSheet") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "printSheet" }));
    ps.innerHTML = `<img src="${url}" alt="守りの約束カード" style="width:100%;max-width:170mm;display:block;margin:0 auto">`;
    window.print();
  };
  save();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(drawPledge);
}
function phraseBookHTML() {
  const list = store.get("dl3-phrases", []) || [];
  return `<section class="sec" aria-label="わたしの断りことば帳" id="phraseBook">
    <div class="sec-h"><h2>わたしの断りことば帳</h2><p>チャレンジの「ことばで返す」や、体験の中で自分の言葉で書いた「断る・確かめる」返信が集まります。この端末の中だけに保存されます。</p></div>
    ${list.length ? `<div class="pbook">${list.map((x, i) => `<div class="pb-item"><p>「${esc(x.t)}」</p><small>${esc(x.from || "")}</small><button class="linkbtn" type="button" data-pdel="${i}" aria-label="「${esc(x.t)}」を消す">消す</button></div>`).join("")}</div>`
      : `<div class="jr-empty">${mascot("md")}<span>まだありません。チャレンジの「ことばで返す」で、自分の断りのひとことを作ってみよう。</span><a class="btn small primary" href="#challenge" id="pbGo">ことばで返すへ</a></div>`}
  </section>`;
}
function bindPhraseBook() {
  document.querySelectorAll("[data-pdel]").forEach((b) => (b.onclick = () => {
    const list = store.get("dl3-phrases", []) || [];
    list.splice(+b.dataset.pdel, 1); store.set("dl3-phrases", list);
    $("phraseBook").outerHTML = phraseBookHTML(); bindPhraseBook();
  }));
}
/* ===== 見抜き検定：毎回ちがう話を3本続けて、見抜き率と結末で級を決める ===== */
/* ===== サインさがし：メッセージの「あやしいところ」をタップで見つける ===== */
/* ===== 画面のワナさがし：本物そっくりの画面から、だます仕掛け（ダークパターン）をタップで見つける ===== */
/* 各部品：[種類, 文, ワナの説明（ワナでなければ null）] */
const WANA = [
  { app: "通販サイト", title: "購入の画面", parts: [
    ["img", "（商品の写真）美容サプリ「キラリ」", null],
    ["timer", "このページの特別価格は あと 04:59", "カウントダウンで急がせる仕掛け。ページを開き直すと、また5分から始まることもあります。"],
    ["price", "初回 500円（税込）", null],
    ["stock", "残り 2個！ ほかに 18人が見ています", "在庫の少なさや、ほかの人の数を見せて、あせらせる仕掛けです。本当の数とはかぎりません。"],
    ["check", "☑ お得な定期便に申し込む（いつでも解約OK）", "最初からチェックが入っているオプション。外し忘れると、定期購入の契約になります。"],
    ["tiny", "※2回目以降は 9,800円。4回以上の購入が条件です。", "大事な条件が、小さくうすい文字で書かれています。総額を必ず確かめましょう。"],
    ["btn", "今すぐ購入する", null]
  ]},
  { app: "動画サブスク", title: "解約の画面", parts: [
    ["h", "本当に解約しますか？", null],
    ["guilt", "解約すると、あなたのお気に入りリスト 128本が すべて消えます😢", "罪悪感や損をする気持ちに訴えて、解約を思いとどまらせる仕掛けです。"],
    ["btn", "解約をやめて、特典を受け取る", "目立つボタンが「解約をやめる」ほうになっている。押したいボタンと逆を大きくしています。"],
    ["link", "それでも解約する", "解約のボタンが、小さくうすい文字のリンクになっていて、見つけにくくされています。"],
    ["note", "解約手続きの前に、アンケート（全12問）への回答が必要です", "解約までの手順をわざと長くして、あきらめさせる仕掛けです。"],
    ["p", "次回の請求日：毎月1日", null]
  ]},
  { app: "ゲーム", title: "ガチャの画面", parts: [
    ["h", "★5キャラ 排出率アップ中！", null],
    ["timer", "終了まで あと 2時間", "期限で急がせる仕掛け。同じようなイベントは、何度もくり返し行われます。"],
    ["price", "10連ガチャ：ジュエル 3,000個", "お金ではなく「ジュエル」の数で見せて、実際にいくら使っているかを分かりにくくしています。3,000個で約4,800円のことも。"],
    ["stock", "あと1回で ★5確定！（天井まで残り 90回）", "「あと1回」を大きく見せて、本当はまだ遠いことを小さく書いています。"],
    ["p", "排出率の一覧はこちら", null],
    ["btn", "ジュエルを買って引く", null]
  ]},
  { app: "無料アプリ", title: "はじめの設定", parts: [
    ["h", "写真をアニメ風に変身！（無料）", null],
    ["check", "☑ 連絡先へのアクセスを許可", "写真のアプリに、連絡先は関係ありません。関係のない権限は許可しないこと。"],
    ["check", "☑ 位置情報を常に許可", "常に位置を知られる設定。アプリの機能に必要か確かめましょう。"],
    ["btn", "3日間 無料ではじめる", "大きなボタンは「無料体験」。3日後に自動で有料に切りかわることが、下に小さく書かれています。"],
    ["tiny", "無料期間終了後、週額 1,200円で自動更新されます", "週額で書いて安く見せる仕掛け。月にすると約5,000円です。"],
    ["link", "あとで（制限つきで使う）", null]
  ]},
  { app: "ネット通販", title: "ブランド財布のお店", parts: [
    ["img", "（商品の写真）有名ブランドの長財布", null],
    ["price", "定価 98,000円 → 9,800円（90%OFF）", "人気ブランドが90%引きは、偽物か、お金だけ取る偽サイトの可能性が高い値段です。"],
    ["p", "送料無料・全国配送", null],
    ["note", "お支払いは銀行振込のみ（振込先：ヤマダ タロウ）", "支払い方法が振込だけで、振込先が個人名なのは、偽の通販サイトによくある特徴です。"],
    ["tiny", "ご注文の確認されました。迅速に発送いたします。", "少し不自然な日本語。海外の偽サイトが自動で訳した文章のことがあります。"],
    ["link", "会社概要（住所・電話番号の記載なし）", "運営会社の住所や電話番号がないお店は、トラブルのときに連絡がとれません。"],
    ["btn", "カートに入れる", null]
  ]},
  { app: "投資アプリ", title: "ホーム画面", parts: [
    ["h", "あなたの資産：53,000円", null],
    ["price", "先週の利益 +285%！", "いちばん良い時期の数字だけを大きく見せています。こんな利益が続く投資はありません。"],
    ["stock", "元本保証・損をすることはありません", "元本を保証して高い利益をうたう投資は、法律で禁止されています。"],
    ["p", "（チャートのグラフ）", null],
    ["note", "出金には、手数料30%と本人認証料が必要です", "引き出すときに次々とお金を求めるのは、引き出せない詐欺アプリの特徴です。"],
    ["btn", "LINEで先生に相談する", "アプリの外に連れ出して、個人的にお金の話をするのはサインです。"]
  ]},
  { app: "フリマアプリ", title: "商品のページ", parts: [
    ["img", "（商品の写真）最新のゲーム機 新品", null],
    ["price", "15,000円（相場の半額）", "相場よりずっと安いのは、写真だけの商品や、お金だけ取る目的のことがあります。"],
    ["stock", "出品者：評価 0件・登録 昨日", "登録したばかりで評価のない出品者は、慎重に。"],
    ["note", "アプリの外で取引すると10%引きにします。くわしくはプロフィールのURLへ", "アプリの外での取引に誘うのは、補償が受けられなくなるワナです。多くのフリマアプリで禁止されています。"],
    ["p", "商品の状態：新品・未開封", null],
    ["btn", "購入手続きへ", null]
  ]},
  { app: "ブラウザ", title: "急に出てきた画面", parts: [
    ["timer", "警告！ あなたのスマホは 3つのウイルスに感染しています", "ブラウザのページが、スマホの中のウイルスを調べることはできません。不安にさせる偽の警告です。"],
    ["stock", "スキャン中… 87%", "それらしく見せるための、動くだけの表示です。"],
    ["guilt", "このページを閉じると、写真や連絡先がすべて消えます", "閉じさせないためのおどし。ページは閉じてだいじょうぶです。"],
    ["btn", "今すぐサポートに電話する 0120-XXX-XXX", "偽のサポートに電話させて、遠隔操作のアプリや有料のサポート契約をさせる手口です。"],
    ["tiny", "© 2026 Security Center", null]
  ]}
];
let WN = null;
function startWana() { WN = { items: shuffle(WANA).slice(0, 4), i: 0, sel: new Set(), done: false, score: 0, found: 0, traps: 0, wrong: 0, xp: 0 }; renderChallenge(); $("v-challenge").scrollIntoView({ block: "start" }); }
function wanaJudge(it, sel) {
  let found = 0, wrong = 0, traps = 0;
  it.parts.forEach((p, k) => { if (p[2]) { traps++; if (sel.has(k)) found++; } else if (sel.has(k)) wrong++; });
  return { found, wrong, traps, pts: Math.max(0, found * 2 - wrong + (found === traps && !wrong ? 2 : 0)) };
}
function renderWana(el, head) {
  if (WN.i >= WN.items.length) {
    const best = Math.max(store.get("dl3-wana", 0) || 0, WN.score); store.set("dl3-wana", best); setTimeout(checkAch, 800);
    el.innerHTML = head + `<div class="ch-board ch-end">${mascot("md")}<span class="eyebrow">画面のワナさがし　結果</span><b class="ch-big">${WN.score} 点</b>
      <div class="sp-sum"><span><b>${WN.found}/${WN.traps}</b>見つけたワナ</span><span><b>${WN.wrong}</b>うたがいすぎ</span></div>
      <p>${WN.found === WN.traps ? "画面の仕掛けを、すべて見やぶれました。" : "見落としたワナは、ふだんの買い物やアプリの画面でも、よく使われています。"}</p>
      <p class="xpgain">見抜きポイント <b>+${WN.xp} XP</b>（これまでの最高：${best}点）</p>
      <div class="row-btns"><button class="btn small primary" type="button" id="wnAgain">もう一度</button><button class="btn small" type="button" id="wnMenu">チャレンジの最初へ</button></div></div>`;
    $("wnAgain").onclick = startWana; $("wnMenu").onclick = () => { WN = null; renderChallenge(); };
    return;
  }
  const it = WN.items[WN.i], done = WN.done, r = done ? wanaJudge(it, WN.sel) : null;
  let n = 0;
  const part = (p, k) => {
    const on = WN.sel.has(k), trap = !!p[2];
    const st = !done ? (on ? " on" : "") : trap ? (on ? " hit" : " miss") : (on ? " wrong" : "");
    const num = done && trap ? `<i class="sp-n" aria-hidden="true">${it.parts.slice(0, k + 1).filter((x) => x[2]).length}</i>` : "";
    return `<button type="button" class="wn-p wn-${p[0]}${st}" data-k="${k}" ${done ? "disabled" : ""} aria-pressed="${on}">${num}${esc(p[1])}</button>`;
  };
  el.innerHTML = head + `<div class="ch-board wn-board">
    <div class="ch-top"><span>第 ${WN.i + 1} / ${WN.items.length} 問</span><span><b>${WN.score}</b> 点</span><button class="linkbtn" type="button" id="wnQuit">やめる</button></div>
    <p class="sp-q">${done ? "答え合わせ" : "この画面にかくれた<b>ワナ</b>（だます仕掛け）を、ぜんぶタップしよう"}</p>
    <div class="wn-phone"><div class="wn-bar"><span>${esc(it.app)}</span><b>${esc(it.title)}</b></div><div class="wn-screen">${it.parts.map(part).join("")}</div></div>
    ${done ? `<div class="sp-res ${r.found === r.traps && !r.wrong ? "perfect" : ""}"><b>+${r.pts} 点</b><span>ワナ ${r.found}/${r.traps} 見つけた${r.wrong ? `・うたがいすぎ ${r.wrong}` : ""}</span></div>
      <ol class="sp-why">${it.parts.filter((p) => p[2]).map((p) => { n++; const k = it.parts.indexOf(p); return `<li class="${WN.sel.has(k) ? "hit" : "miss"}"><span class="sp-n">${n}</span><div>${WN.sel.has(k) ? "" : `<em>見落とし</em>`}<b>「${esc(p[1])}」</b><p>${esc(p[2])}</p></div></li>`; }).join("")}</ol>
      <div class="row-btns"><button class="btn small primary" type="button" id="wnNext">${WN.i + 1 < WN.items.length ? "次の画面" : "結果を見る"}</button></div>`
    : `<div class="row-btns"><span class="sp-cnt">${WN.sel.size}か所 えらんでいます</span><button class="btn small primary" type="button" id="wnCheck" ${WN.sel.size ? "" : "disabled"}>答え合わせ</button></div>`}
  </div>`;
  $("wnQuit").onclick = () => { WN = null; renderChallenge(); };
  if (!done) {
    el.querySelectorAll(".wn-p").forEach((b) => (b.onclick = () => {
      const k = +b.dataset.k; WN.sel.has(k) ? WN.sel.delete(k) : WN.sel.add(k);
      b.classList.toggle("on", WN.sel.has(k)); b.setAttribute("aria-pressed", WN.sel.has(k));
      $("wnCheck").disabled = !WN.sel.size; el.querySelector(".sp-cnt").textContent = `${WN.sel.size}か所 えらんでいます`;
    }));
    $("wnCheck").onclick = () => {
      const res = wanaJudge(it, WN.sel);
      WN.done = true; WN.score += res.pts; WN.found += res.found; WN.traps += res.traps; WN.wrong += res.wrong;
      if (res.found) WN.xp += addXP(res.found * 3);
      sfx(res.found === res.traps && !res.wrong ? "ok" : "stop");
      renderChallenge(); const nx = $("wnNext"); if (nx) nx.focus({ preventScroll: true });
    };
  } else $("wnNext").onclick = () => { WN.i++; WN.sel = new Set(); WN.done = false; renderChallenge(); $("v-challenge").scrollIntoView({ block: "start" }); };
}
let SP = null;
const SPOT = (window.DL && window.DL.spot) || [];
function startSpot() {
  SP = { items: shuffle(SPOT).slice(0, 6), i: 0, sel: new Set(), done: false, score: 0, xp: 0, found: 0, flags: 0, wrong: 0 };
  renderChallenge();
  $("v-challenge").scrollIntoView({ block: "start" });
}
const spotMax = (it) => it.parts.filter(Array.isArray).length * 2 + 2;
function spotJudge(it, sel) {
  let found = 0, wrong = 0, flags = 0;
  it.parts.forEach((p, k) => { if (Array.isArray(p)) { flags++; if (sel.has(k)) found++; } else if (sel.has(k)) wrong++; });
  const pts = Math.max(0, found * 2 - wrong + (found === flags && !wrong ? 2 : 0));
  return { found, wrong, flags, pts };
}
function renderSpot(el, head) {
  if (SP.i >= SP.items.length) {
    const max = SP.items.reduce((a, it) => a + spotMax(it), 0);
    const best = Math.max(store.get("dl3-spot", 0) || 0, SP.score);
    store.set("dl3-spot", best);
    setTimeout(checkAch, 800);
    const rate = SP.flags ? Math.round(SP.found / SP.flags * 100) : 0;
    el.innerHTML = head + `<div class="ch-board ch-end">${mascot("md")}<span class="eyebrow">サインさがし　結果</span>
      <b class="ch-big">${SP.score} / ${max} 点</b>
      <div class="sp-sum"><span><b>${SP.found}/${SP.flags}</b>見つけたサイン</span><span><b>${rate}%</b>見つけた割合</span><span><b>${SP.wrong}</b>うたがいすぎ</span></div>
      <p>${rate >= 90 && SP.wrong <= 2 ? "サインを見る目が、しっかり育っています。" : rate >= 60 ? "いい調子。見落としたサインは、系統ごとに図鑑で見直そう。" : "最初は見落として当然。答え合わせの解説を読むと、次は目に入るようになります。"}</p>
      <p class="xpgain">見抜きポイント <b>+${SP.xp} XP</b>（これまでの最高：${best}点）</p>
      <div class="row-btns"><button class="btn small primary" type="button" id="spAgain">もう一度（問題が変わります）</button>
        <button class="btn small" type="button" id="spMenu">チャレンジの最初へ</button></div></div>`;
    $("spAgain").onclick = () => startSpot();
    $("spMenu").onclick = () => { SP = null; renderChallenge(); };
    return;
  }
  const it = SP.items[SP.i], done = SP.done, r = done ? spotJudge(it, SP.sel) : null;
  const sc = byId(it.src);
  const chip = (p, k) => {
    const flag = Array.isArray(p), on = SP.sel.has(k), tx = flag ? p[0] : p;
    let cls = "sp-p";
    if (!done) cls += on ? " on" : "";
    else cls += flag ? (on ? " hit" : " miss") : (on ? " wrong" : " plain");
    const mark = done && flag ? `<i class="sp-n" aria-hidden="true">${it.parts.slice(0, k + 1).filter(Array.isArray).length}</i>` : "";
    return `<button type="button" class="${cls}" data-k="${k}" ${done ? "disabled" : ""} aria-pressed="${on}">${mark}${esc(tx)}</button>`;
  };
  let n = 0;
  el.innerHTML = head + `<div class="ch-board sp-board">
    <div class="ch-top"><span>第 ${SP.i + 1} / ${SP.items.length} 問</span><span><b>${SP.score}</b> 点</span><button class="linkbtn" type="button" id="spQuit">やめる</button></div>
    <p class="sp-q">${done ? "答え合わせ" : "あやしいと思うところを、<b>ぜんぶ</b>タップしよう"}</p>
    <div class="sp-msg"><div class="sp-from"><span class="sp-app">${esc(it.app)}</span><b>${esc(it.from)}</b></div>
      <div class="sp-text">${it.parts.map(chip).join("")}</div></div>
    ${done ? `<div class="sp-res ${r.found === r.flags && !r.wrong ? "perfect" : ""}"><b>+${r.pts} 点</b><span>サイン ${r.found}/${r.flags} 見つけた${r.wrong ? `・うたがいすぎ ${r.wrong}` : ""}${r.found === r.flags && !r.wrong ? "・パーフェクト！" : ""}</span></div>
      <ol class="sp-why">${it.parts.filter(Array.isArray).map((p) => { n++; const k = it.parts.indexOf(p); return `<li class="${SP.sel.has(k) ? "hit" : "miss"}"><span class="sp-n">${n}</span><div><span class="cat-tag">${CATS[p[1]].ic} ${esc(CATS[p[1]].n)}</span>${SP.sel.has(k) ? "" : `<em>見落とし</em>`}<b>「${esc(p[0])}」</b><p>${esc(p[2])}</p></div></li>`; }).join("")}</ol>
      ${r.wrong ? `<p class="sp-note">${mascot("sm")}グレーの線は、ふつうのあいさつや説明です。全部をうたがうと、本物の連絡まで見のがしてしまうことも。</p>` : ""}
      <div class="row-btns">${sc ? `<a class="btn small" href="#${sc.id}">この手口の話を体験する</a>` : ""}<button class="btn small primary" type="button" id="spNext">${SP.i + 1 < SP.items.length ? "次のメッセージ" : "結果を見る"}</button></div>`
    : `<div class="row-btns"><span class="sp-cnt">${SP.sel.size}か所 えらんでいます</span><button class="btn small primary" type="button" id="spCheck" ${SP.sel.size ? "" : "disabled"}>答え合わせ</button></div>`}
  </div>`;
  $("spQuit").onclick = () => { SP = null; renderChallenge(); };
  if (!done) {
    el.querySelectorAll(".sp-p").forEach((b) => (b.onclick = () => {
      const k = +b.dataset.k;
      SP.sel.has(k) ? SP.sel.delete(k) : SP.sel.add(k);
      b.classList.toggle("on", SP.sel.has(k)); b.setAttribute("aria-pressed", SP.sel.has(k));
      $("spCheck").disabled = !SP.sel.size;
      el.querySelector(".sp-cnt").textContent = `${SP.sel.size}か所 えらんでいます`;
    }));
    $("spCheck").onclick = () => {
      const res = spotJudge(it, SP.sel);
      SP.done = true; SP.score += res.pts; SP.found += res.found; SP.flags += res.flags; SP.wrong += res.wrong;
      if (res.found) SP.xp += addXP(res.found * 3);
      sfx(res.found === res.flags && !res.wrong ? "ok" : "stop");
      renderChallenge();
      const nx = $("spNext"); if (nx) nx.focus({ preventScroll: true });
    };
  } else {
    $("spNext").onclick = () => { SP.i++; SP.sel = new Set(); SP.done = false; renderChallenge(); $("v-challenge").scrollIntoView({ block: "start" }); };
  }
}
let EXAM = null;
const EXAM_GRADES = [[90, "名人", "どんな手口も見抜ける、見抜きの名人です。"], [75, "上級", "ほとんどの手口に気づけています。"], [55, "中級", "大事なサインには気づけています。あと一歩。"], [0, "初級", "ここからがスタート。サイン図鑑で手口を見直そう。"]];
function startExam() {
  const G = window.DL && window.DL.gen;
  if (!G) return;
  const ids = [], hooks = new Set();
  let tries = 0;
  while (ids.length < 3 && tries++ < 60) {
    const seed = Math.floor(Math.random() * 1e9), sc = genScenario(seed);
    if (sc && !hooks.has(sc.tag)) { hooks.add(sc.tag); ids.push(sc.id); }
  }
  EXAM = { ids, i: 0, res: [] };
  location.hash = "#" + ids[0];
}
/* 結果画面から呼ぶ：検定中の話なら記録して、次へのボタンを返す */
function examStep(sc, n, caught, met) {
  if (!EXAM || EXAM.ids[EXAM.i] !== sc.id) return null;
  if (!EXAM.res[EXAM.i]) EXAM.res[EXAM.i] = { tag: sc.tag, end: n.end, caught, met };
  const last = EXAM.i >= EXAM.ids.length - 1;
  return { label: last ? "検定の結果を見る" : `検定：次の話へ（${EXAM.i + 2} / ${EXAM.ids.length}）`, href: last ? "#challenge" : "#" + EXAM.ids[EXAM.i + 1], note: `見抜き検定　${EXAM.i + 1} / ${EXAM.ids.length} 話目` };
}
function examScore() {
  const r = EXAM.res, caught = r.reduce((a, x) => a + x.caught, 0), met = r.reduce((a, x) => a + x.met, 0);
  const endPts = r.reduce((a, x) => a + (x.end === "safe" ? 10 : x.end === "partial" ? 5 : 0), 0);
  const score = Math.round((met ? caught / met : 0) * 70 + endPts);
  return { score, caught, met, grade: EXAM_GRADES.find(([min]) => score >= min) };
}
function examHTML(head) {
  const s = examScore(), [, g, msg] = s.grade;
  const best = store.get("dl3-exam", null);
  const isBest = !best || s.score > best.score;
  if (!EXAM.saved) { EXAM.saved = true; if (isBest) store.set("dl3-exam", { score: s.score, grade: g, at: Date.now() }); EXAM.xp = addXP(30); setTimeout(checkAch, 400); }
  return head + `<div class="ch-board exam-end">
    <span class="eyebrow">見抜き検定　結果</span>
    <div class="cert" id="certBox"><canvas id="certCv" width="1200" height="840" aria-label="見抜き検定の認定証：${g}"></canvas></div>
    <div class="exam-sum"><b class="ch-big">${g}</b><span>${s.score} 点（見抜いたサイン ${s.caught}/${s.met}）</span><p>${msg}${isBest && best ? "　自己ベスト更新！" : ""}</p></div>
    <ol class="exam-list">${EXAM.res.map((x, i) => `<li><span>${i + 1}話目</span><b>${esc(x.tag)}</b><span class="label ${x.end}">${ENDLAB[x.end]}</span><small>サイン ${x.caught}/${x.met}</small></li>`).join("")}</ol>
    <p class="xpgain">見抜きポイント <b>+${EXAM.xp || 30} XP</b></p>
    <div class="row-btns"><button class="btn small" type="button" id="certSave">認定証を画像で保存</button>
      <button class="btn small primary" type="button" id="examAgain">もう一度受ける</button>
      <button class="btn small" type="button" id="examMenu">チャレンジの最初へ</button></div></div>`;
}
function drawCert(g, score) {
  const cv = $("certCv"); if (!cv) return;
  const x = cv.getContext("2d"), W = cv.width, H = cv.height;
  const navy = "#1E3A5F", gold = "#C9A227", paper = "#FBF8F1";
  x.fillStyle = paper; x.fillRect(0, 0, W, H);
  x.strokeStyle = navy; x.lineWidth = 14; x.strokeRect(30, 30, W - 60, H - 60);
  x.strokeStyle = gold; x.lineWidth = 3; x.strokeRect(58, 58, W - 116, H - 116);
  x.textAlign = "center"; x.fillStyle = navy;
  x.font = '700 34px "Zen Kaku Gothic New", sans-serif'; x.fillText("だまされ体験ラボ", W / 2, 150);
  x.font = '900 86px "Zen Kaku Gothic New", sans-serif'; x.fillText("見抜き検定　認定証", W / 2, 270);
  x.fillStyle = gold; x.fillRect(W / 2 - 160, 300, 320, 4);
  x.fillStyle = navy; x.font = '900 150px "Zen Kaku Gothic New", sans-serif'; x.fillText(g, W / 2, 480);
  x.font = '700 40px "Zen Kaku Gothic New", sans-serif'; x.fillText(`${score} 点`, W / 2, 550);
  x.font = '500 30px "Zen Kaku Gothic New", sans-serif'; x.fillStyle = "#3A4656";
  x.fillText("毎回ちがう3つの話で、だましのサインを見抜く力を示しました。", W / 2, 625);
  const d = new Date();
  x.fillText(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`, W / 2, 690);
  x.beginPath(); x.arc(W - 160, H - 145, 56, 0, Math.PI * 2); x.strokeStyle = "#B83A2E"; x.lineWidth = 6; x.stroke();
  x.fillStyle = "#B83A2E"; x.font = '900 27px "Zen Kaku Gothic New", sans-serif'; x.fillText("見抜き", W - 160, H - 150); x.fillText("合格", W - 160, H - 118);
}
function renderChallenge() {
  const el = $("v-challenge");
  const lv = lvInfo();
  const best = store.get("dl3-endless", 0) || 0;
  const daily = (store.get("dl3-daily", {}) || {})[dayKey(new Date())];
  const head = `<div class="help-hero bleed b-hero ch-hero"><div class="eyebrow">CHALLENGE</div><h1>見抜きチャレンジ</h1>
    <p>届いたメッセージを見て、<b>あやしい</b>か<b>だいじょうぶ</b>かを判定しよう。ふつうの連絡もまざっています。問題は毎回変わるので、何度でも挑戦できます。</p>
    <div class="ch-level"><div><span class="eyebrow">見抜きレベル</span><b>Lv.${lv.lv}　${esc(lv.title)}</b><span class="lvbar big"><i style="width:${lv.pct}%"></i></span><small>次のレベルまで ${lv.toNext} XP（合計 ${lv.xp} XP）</small></div></div></div>`;
  if (RT) return renderReply(el, head);
  if (SP) return renderSpot(el, head);
  if (WN) return renderWana(el, head);
  if (EXAM && EXAM.res.length === EXAM.ids.length && EXAM.res.every(Boolean)) {
    el.innerHTML = examHTML(head);
    const s = examScore();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => drawCert(s.grade[1], s.score));
    $("certSave").onclick = () => { const a = document.createElement("a"); a.href = $("certCv").toDataURL("image/png"); a.download = "minuke-kentei.png"; a.click(); };
    $("examAgain").onclick = () => startExam();
    $("examMenu").onclick = () => { EXAM = null; renderChallenge(); };
    return;
  }
  if (!CH || (!CH.cur && !CH.over)) {
    el.innerHTML = head + `<div class="ch-modes">
      <div class="ch-mode"><span class="eyebrow">日替わり</span><h2>今日のチャレンジ</h2><p>今日の10問。同じ日なら、だれでも同じ問題です。最初の挑戦の結果が記録されます。</p>
        <p class="ch-rec">${daily !== undefined ? `今日の記録：<b>${daily} / 10</b>` : "まだ挑戦していません"}</p>
        <button class="btn primary" type="button" id="chDaily">今日の10問をはじめる</button></div>
      <div class="ch-mode"><span class="eyebrow">何度でも</span><h2>エンドレス</h2><p>まちがえられるのは3回まで。連続で正解するとボーナス。どこまで見抜けるか挑戦しよう。</p>
        <p class="ch-rec">最高記録：<b>${best} 点</b></p>
        <button class="btn primary" type="button" id="chEndless">エンドレスをはじめる</button></div>
      <div class="ch-mode"><span class="eyebrow">見くらべる</span><h2>どっちが安全？</h2><p>2通のメッセージのうち、安全なのはどっち？ ふつうの連絡と、あやしいメッセージの「ちがい」を見つける10問です。</p>
        <p class="ch-rec">最高記録：<b>${store.get("dl3-pair", 0) || 0} / 10</b></p>
        <button class="btn primary" type="button" id="chPair">見くらべる10問をはじめる</button></div>
      <div class="ch-mode"><span class="eyebrow">書いて練習</span><h2>ことばで返す</h2><p>あやしいメッセージに、自分の言葉で返信を書く5問。断れているか、短くはっきりしているかを★3つで判定します。</p>
        <p class="ch-rec">最高記録：<b>★ ${store.get("dl3-reply", 0) || 0} / 15</b></p>
        <button class="btn primary" type="button" id="chReply">ことばで返す5問をはじめる</button></div>
      <div class="ch-mode"><span class="eyebrow">タップで見つける</span><h2>サインさがし</h2><p>メッセージの中の「あやしいところ」を、自分でタップして見つける6問。見落としも、うたがいすぎも、答え合わせで全部わかります。</p>
        <p class="ch-rec">最高記録：<b>${store.get("dl3-spot", 0) || 0} 点</b></p>
        <button class="btn primary" type="button" id="chSpot">サインさがしをはじめる</button></div>
      <div class="ch-mode ch-mode-new"><span class="eyebrow">画面を見やぶる</span><h2>画面のワナさがし</h2><p>通販の購入画面、サブスクの解約画面、ガチャ、アプリの設定。本物そっくりの画面にかくれた「だます仕掛け」を見つける4問（全8画面から出題）。</p>
        <p class="ch-rec">最高記録：<b>${store.get("dl3-wana", 0) || 0} 点</b></p>
        <button class="btn primary" type="button" id="chWana">ワナさがしをはじめる</button></div>
      <div class="ch-mode ch-mode-exam"><span class="eyebrow">腕だめし</span><h2>見抜き検定</h2><p>毎回ちがう話を3本つづけて体験。見抜いたサインの数と結末で、初級・中級・上級・名人の級が決まります。合格すると認定証がもらえます。</p>
        <p class="ch-rec">${(() => { const b = store.get("dl3-exam", null); return b ? `これまでの最高：<b>${esc(b.grade)}（${b.score}点）</b>` : "まだ受けていません"; })()}</p>
        <button class="btn primary" type="button" id="chExam">検定を受ける（約10分）</button></div>
    </div>
    <div class="ch-xp"><h2>XP（経験値）のため方</h2><ul><li>シナリオでサインに気づく <b>+10</b>（見逃しても学べたら +3）</li><li>新しい結末を見る <b>+20</b></li><li>チャレンジ・クイズで正解 <b>+5</b></li><li>今日のチャレンジをクリア <b>+30</b></li></ul></div>`;
    $("chDaily").onclick = () => startChallenge("daily");
    $("chEndless").onclick = () => startChallenge("endless");
    $("chPair").onclick = () => startChallenge("pair");
    $("chReply").onclick = () => startReply();
    $("chSpot").onclick = () => startSpot();
    $("chWana").onclick = () => startWana();
    $("chExam").onclick = () => startExam();
    return;
  }
  if (CH.over && CH.mode === "pair") {
    const text = `だまされ体験ラボ「どっちが安全？」で ${CH.correct}/10 問 見抜けた！\n#だまされ体験ラボ\n${SHARE_URL}`;
    el.innerHTML = head + `<div class="ch-board ch-end">${mascot("md")}<span class="eyebrow">どっちが安全？　結果</span>
      <b class="ch-big">${CH.correct} / 10 問</b>
      <p>${CH.correct >= 9 ? "ちがいがしっかり見えています。" : CH.correct >= 6 ? "いい調子。ふつうの連絡の「ふつうさ」も、見るポイントです。" : "まずは、ふつうの連絡がどんな形かを覚えるのが近道です。"}${CH.newBest ? "　自己ベスト更新！" : ""}</p>
      <p class="xpgain">見抜きポイント <b>+${CH.xp} XP</b></p>
      <div class="row-btns"><a class="btn small" href="https://x.com/intent/post?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Xでシェア</a>
        <button class="btn small primary" type="button" id="chAgain">もう一度</button>
        <button class="btn small" type="button" id="chMenu">チャレンジの最初へ</button></div></div>`;
    $("chAgain").onclick = () => startChallenge("pair");
    $("chMenu").onclick = () => { CH = null; renderChallenge(); };
    return;
  }
  if (CH.mode === "pair") {
    const [x, y] = CH.cur.pair, a = CH.answered;
    const card = (it, i) => `<div class="pair-col ${a ? (it.bad ? "is-bad" : "is-good") : ""}">${chCard(it)}
      ${a ? `<span class="pair-tag">${it.bad ? "あやしい" : "安全"}</span>` : `<button class="btn primary pair-pick" type="button" id="chPick${i}">こちらが安全</button>`}</div>`;
    const bad = x.bad ? x : y;
    el.innerHTML = head + `<div class="ch-board ch-board-wide">
      <div class="ch-top"><span>第 ${CH.i + 1} / 10 問</span><span>正解 <b>${CH.correct}</b></span>${CH.combo >= 2 ? `<span class="combo">${CH.combo}連続！</span>` : ""}<button class="linkbtn" type="button" id="chQuit">やめる</button></div>
      <p class="pair-q">安全なのは、どっち？</p>
      <div class="pair">${card(x, 0)}${card(y, 1)}</div>
      ${a ? `<div class="ch-ans ${a.right ? "ok" : "ng"}" role="status"><b>${a.right ? "正解！" : "ざんねん"}</b>
          <span class="cat-tag">${esc(bad.head || "")}</span><p>あやしい方：${esc(bad.why || "")}</p>
          <p>安全な方：${esc((x.bad ? y : x).why || "")}</p>
          <button class="btn primary" type="button" id="chNextBtn">${CH.i + 1 >= 10 ? "結果を見る" : "次の2通"}</button></div>` : ""}
    </div>`;
    $("chQuit").onclick = () => { CH = null; renderChallenge(); };
    if (a) { $("chNextBtn").onclick = chNext; $("chNextBtn").focus({ preventScroll: true }); }
    else { $("chPick0").onclick = () => chAnswerPair(0); $("chPick1").onclick = () => chAnswerPair(1); }
    return;
  }
  if (CH.over) {
    const isDaily = CH.mode === "daily";
    const text = isDaily ? `だまされ体験ラボ「今日のチャレンジ」で ${CH.correct}/10 問 見抜けた！\n#だまされ体験ラボ\n${SHARE_URL}` : `だまされ体験ラボ「見抜きチャレンジ」で ${CH.score}点（${CH.correct}問正解・最大${CH.best}連続）！\n#だまされ体験ラボ\n${SHARE_URL}`;
    el.innerHTML = head + `<div class="ch-board ch-end">${mascot("md")}<span class="eyebrow">${isDaily ? "今日のチャレンジ" : "エンドレス"}　結果</span>
      <b class="ch-big">${isDaily ? `${CH.correct} / 10 問` : `${CH.score} 点`}</b>
      <p>${isDaily ? (CH.correct >= 9 ? "すばらしい！ ほとんど見抜けました。" : CH.correct >= 6 ? "いい調子。まちがえた問題の解説を思い出そう。" : "まずはシナリオで、サインをじっくり体験してみよう。") : `${CH.correct}問正解・最大${CH.best}連続${CH.newBest ? "　自己ベスト更新！" : ""}`}</p>
      <p class="xpgain">見抜きポイント <b>+${CH.xp} XP</b>${isDaily && !CH.firstToday ? "（今日の記録は最初の挑戦のまま）" : ""}</p>
      <div class="row-btns"><a class="btn small" href="https://x.com/intent/post?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Xでシェア</a>
        <a class="btn small" href="https://line.me/R/share?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">LINEで送る</a>
        <button class="btn small primary" type="button" id="chAgain">${isDaily ? "エンドレスに挑戦" : "もう一度"}</button>
        <button class="btn small" type="button" id="chMenu">チャレンジの最初へ</button></div></div>`;
    $("chAgain").onclick = () => startChallenge("endless");
    $("chMenu").onclick = () => { CH = null; renderChallenge(); };
    return;
  }
  const it = CH.cur, a = CH.answered;
  const status = CH.mode === "daily" ? `<span>第 ${CH.i + 1} / 10 問</span>` : `<span class="lives" aria-label="のこりライフ ${CH.lives}">${"●".repeat(CH.lives)}<s>${"●".repeat(3 - CH.lives)}</s></span>`;
  el.innerHTML = head + `<div class="ch-board">
    <div class="ch-top">${status}<span>スコア <b>${CH.score}</b></span>${CH.combo >= 2 ? `<span class="combo">${CH.combo}連続！</span>` : ""}<button class="linkbtn" type="button" id="chQuit">やめる</button></div>
    ${chCard(it)}
    ${a ? `<div class="ch-ans ${a.right ? "ok" : "ng"}" role="status"><b>${a.right ? "正解！" : "ざんねん"}　これは${it.bad ? "あやしい" : "だいじょうぶ"}メッセージ</b>
        ${it.bad ? `<span class="cat-tag">${esc(it.head || "")}</span>` : ""}<p>${esc(it.why || "")}</p>
        ${it.src ? `<a class="linkbtn" href="#${it.src}">この話をシナリオで体験する</a>` : ""}
        <button class="btn primary" type="button" id="chNextBtn">${(CH.mode === "daily" && CH.i + 1 >= 10) || (CH.mode === "endless" && CH.lives <= 0) ? "結果を見る" : "次のメッセージ"}</button></div>`
      : `<div class="ch-btns"><button class="ch-b bad" type="button" id="chBad">あやしい</button><button class="ch-b good" type="button" id="chGood">だいじょうぶ</button></div>`}
  </div>`;
  $("chQuit").onclick = () => { CH = null; renderChallenge(); };
  if (a) { $("chNextBtn").onclick = chNext; $("chNextBtn").focus({ preventScroll: true }); }
  else { $("chBad").onclick = () => chAnswer(true); $("chGood").onclick = () => chAnswer(false); }
}

/* ===== ホームの「今日のチャレンジ」への近道 ===== */
/* ===== 今日のメニュー：一度遊んだ人に、今日やることをホームのいちばん上でまとめて見せる ===== */
/* ===== 季節の注意報：月ごとに、いま気をつけたい手口を出す ===== */
const SEASON = {
  1: ["成人式と新年", "成人式のあとの同窓会、お年玉の使い道、振袖の前払いに注意。", ["dousoukai", "otoshidama", "furisode", "kubari"]],
  2: ["受験と卒業", "合格を急ぐ気持ち、卒業旅行、入学前のSNSにつけこむ話が増えます。", ["kyozai", "koukuuken", "rental", "kyokasho"]],
  3: ["新生活の準備", "部屋探し、引っ越し、入学前のSNS。新しい生活の前は、ねらわれやすい時期です。", ["chintai", "kaishu", "kyokasho", "gakuwari"]],
  4: ["新学期・新入生", "サークル勧誘、入学の日の勧誘、先輩を名のるアカウントに注意。", ["circle", "gakuwari", "kyokasho", "baito"]],
  5: ["連休と旅行", "旅行の予約、ホテルを名のるメッセージ、格安航空券に注意。", ["hotel", "koukuuken", "rental", "wifi"]],
  6: ["ボーナスと副業", "「スキマ時間でかせげる」の誘いや、投資の話が増える時期です。", ["side", "task", "invest", "shoken"]],
  7: ["夏休みのはじまり", "高額バイトや海外バイト、SNSで知り合った人に注意。", ["yami", "kaigai", "offapp", "shashin"]],
  8: ["夏休み", "時間がある夏休みは、ゲームやSNS、くじの課金が増えます。", ["oripa", "jewel", "aiapp", "kakin"]],
  9: ["台風と防災", "災害のあとは、修理や防災グッズの訪問販売、募金詐欺が増えます。", ["hoken", "bousai", "tenken", "bokin"]],
  10: ["推し活とイベント", "ライブやイベントのチケット、グッズの抽選、ライブ配信の通販に注意。", ["ticket", "chusen", "livecom", "ouen"]],
  11: ["年末の買い物", "セールの時期は、偽の通販サイトや不在通知のSMSが増えます。", ["nisetsuhan", "phishing", "etc", "teiki"]],
  12: ["年末年始", "帰省の時期は、家族をねらう電話や、お金配りの話に注意。", ["oreore", "kazokuline", "kubari", "cardtel"]]
};
function seasonHTML() {
  const m = new Date().getMonth() + 1, s = SEASON[m];
  if (!s) return "";
  const list = s[2].map(byId).filter(Boolean);
  if (!list.length) return "";
  return `<section class="season" aria-label="季節の注意報">
    <div class="ss-h"><span class="ss-badge">${m}月の注意報</span><div><h2>${esc(s[0])}</h2><p>${esc(s[1])}</p></div></div>
    <div class="ss-list">${list.map((sc) => {
      const done = (((progress[sc.id] || {}).ends) || []).length > 0;
      return `<a class="ss-item${done ? " done" : ""}" href="#${sc.id}"><small>${esc(sc.tag)}${done ? "　✓体験ずみ" : ""}</small><b>${esc(sc.title)}</b></a>`;
    }).join("")}</div></section>`;
}
function dashHTML(t) {
  if (!t.gotEnds) return "";
  const lv = lvInfo();
  const tiles = [];
  /* 今日の1話 */
  const mid = "mix-" + todaySeed(), msc = byId(mid);
  if (msc) {
    const done = !!(progress[mid] && (progress[mid].ends || []).length);
    tiles.push({ href: "#" + mid, ic: '<path d="M4 5h16v11H9l-5 4z"/>', h: "今日の1話", b: msc.tag, s: done ? "体験ずみ。また明日" : "日付で決まる、今日だけの話", done });
  }
  /* 今日のチャレンジ */
  const d = (store.get("dl3-daily", {}) || {})[dayKey(new Date())];
  tiles.push({ href: "#challenge", ic: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', h: "今日のチャレンジ", b: d !== undefined ? `${d} / 10 問` : "10問・約3分", s: d !== undefined ? "挑戦ずみ" : "まだ挑戦していません", done: d !== undefined });
  /* つづき：コースの次か、まだ遊んでいない話 */
  const c = COURSES.find((x) => x.id === prefs.course);
  const cnx = c && courseOf(c).find((s) => !cleared(s.id));
  const nx = cnx || nextUnplayed();
  if (nx) tiles.push({ href: "#" + nx.id, ic: '<path d="M7 4.5v15l13-7.5z"/>', h: cnx ? `つづき：${c.n}` : "つづき：まだの話", b: nx.tag, s: `約${nx.mins}分` });
  /* 苦手克服：いちばん見逃しの多い系統 */
  const stat = {};
  SCENARIOS.forEach((sc) => Object.entries(sc.signs).forEach(([k, sg]) => {
    const st = ((progress[sc.id] || {}).signs || {})[k];
    if (!st) return;
    const s = (stat[sg.cat] ||= { met: 0, caught: 0 }); s.met++; if (st === "caught") s.caught++;
  }));
  const weak = Object.entries(stat).filter(([, s]) => s.met >= 2).sort((a, b) => a[1].caught / a[1].met - b[1].caught / b[1].met)[0];
  if (weak && weak[1].caught / weak[1].met < 0.9) {
    const rec = SCENARIOS.find((sc) => Object.entries(sc.signs).some(([k, sg]) => sg.cat === weak[0] && ((progress[sc.id] || {}).signs || {})[k] !== "caught"));
    if (rec) tiles.push({ href: "#" + rec.id, ic: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', h: "苦手克服", b: `「${CATS[weak[0]].n}」を練習`, s: `見抜き率 ${Math.round(weak[1].caught / weak[1].met * 100)}%` });
  }
  /* 検定 */
  const ex = store.get("dl3-exam", null);
  tiles.push({ href: "#challenge", ic: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-2 8 5.5-3 5.5 3-2-8"/>', h: "見抜き検定", b: ex ? `最高：${ex.grade}` : "まだ受けていません", s: ex ? `${ex.score}点。級を上げよう` : "3話で級が決まる", exam: true });
  return `<section class="dash" aria-label="今日のメニュー">
    <div class="dash-h"><div><span class="eyebrow">TODAY</span><h2>今日のメニュー</h2></div>
      <div class="dash-me"><span>Lv.${lv.lv}　${esc(lv.title)}</span>${streak() >= 2 ? `<b>${streak()}日つづけて体験中</b>` : ""}</div></div>
    <div class="dash-grid">${tiles.map((x) => `<a class="dtile${x.done ? " done" : ""}${x.exam ? " exam" : ""}" href="${x.href}"${x.exam ? ' data-exam="1"' : ""}>
      <span class="dt-ic" aria-hidden="true">${svgI(x.ic)}</span><small>${esc(x.h)}</small><b>${esc(x.b)}</b><span>${esc(x.s)}</span>${x.done ? `<i class="dt-ok" aria-label="済み">✓</i>` : ""}</a>`).join("")}</div>
  </section>`;
}
function todayChHTML() {
  const d = (store.get("dl3-daily", {}) || {})[dayKey(new Date())];
  return `<a class="today-ch" href="#challenge" id="todayCh"><span class="tc-ic" aria-hidden="true">${svgI('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>')}</span>
    <span class="tc-tx"><small>今日のチャレンジ（10問・日替わり）</small><b>${d !== undefined ? `今日の記録 ${d} / 10　もう一度は「エンドレス」で` : "まだ挑戦していません。3分で挑戦"}</b></span><span class="tc-go" aria-hidden="true">→</span></a>`;
}

/* ===== ことば辞典（相談先ページ） ===== */
function wordsHTML() {
  const W = window.DL.words || [];
  if (!W.length) return "";
  return `<section class="sec" aria-label="知っておきたいことば"><div class="sec-h"><h2>知っておきたいことば</h2><p>ストーリーに出てくる制度や手口の名前を、やさしく説明します。正確な条件は、各機関のサイトや188で確認してください。</p></div>
    <div class="words">${W.map((x) => `<details class="word"><summary><b>${esc(x.w)}</b>${x.r ? `<small>${esc(x.r)}</small>` : ""}</summary><p>${esc(x.d)}</p></details>`).join("")}</div></section>`;
}

/* ===== スクリーンモード：教室で、大きな画面に1通ずつ映して考える ===== */
let PR = null;
function openPresent() {
  CH = { mode: "present", r: rng(Math.floor(Math.random() * 1e9)), pools: chPools(), used: new Set() };
  PR = { i: 0, total: 10, cur: chDraw(CH.r), shown: false };
  let el = $("present");
  if (!el) { el = document.createElement("div"); el.id = "present"; el.className = "present"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "スクリーンモード"); document.body.appendChild(el); }
  el.hidden = false;
  try { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); } catch (e) {}
  renderPresent();
}
function closePresent() {
  const el = $("present"); if (el) el.hidden = true;
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  CH = null; PR = null;
}
function renderPresent() {
  const el = $("present"), it = PR.cur;
  el.innerHTML = `<div class="pr-top"><span class="pr-brand">${mascot("sm")}だまされ体験ラボ</span><span class="pr-n">${PR.i + 1} / ${PR.total}</span><button class="pr-close" type="button" id="prClose">終了する</button></div>
    <div class="pr-body">
      <div class="pr-msg"><div class="pr-from"><span aria-hidden="true">${SCENE_ICON[it.type] || SCENE_ICON.dm}</span><b>${esc(it.from)}</b><span>${esc(it.app)}</span></div><p>${esc(it.text)}</p></div>
      ${PR.shown ? `<div class="pr-ans ${it.bad ? "bad" : "good"}"><b>${it.bad ? "あやしい" : "だいじょうぶ"}</b>${it.bad && it.head ? `<span>${esc(it.head)}</span>` : ""}<p>${esc(it.why || "")}</p></div>`
        : `<p class="pr-q">このメッセージ、あやしいと思う人？　だいじょうぶだと思う人？</p>`}
    </div>
    <div class="pr-foot">${PR.shown ? `<button class="btn primary pr-btn" type="button" id="prNext">${PR.i + 1 >= PR.total ? "おしまい" : "次のメッセージ"}</button>` : `<button class="btn primary pr-btn" type="button" id="prShow">答えを見る</button>`}</div>`;
  $("prClose").onclick = closePresent;
  if ($("prShow")) $("prShow").onclick = () => { PR.shown = true; renderPresent(); };
  if ($("prNext")) $("prNext").onclick = () => {
    if (PR.i + 1 >= PR.total) { el.innerHTML = `<div class="pr-top"><span class="pr-brand">${mascot("sm")}だまされ体験ラボ</span><button class="pr-close" type="button" id="prClose">終了する</button></div>
      <div class="pr-body pr-end"><b>おつかれさまでした</b><p>今日のポイント：「急かす」「先にお金」「個人情報」「秘密にさせる」が出てきたら、いったん止まって、だれかに相談。</p><p class="pr-tel"><span>188</span>消費者ホットライン　<span>#9110</span>警察相談専用電話</p></div>`;
      $("prClose").onclick = closePresent; return; }
    PR.i++; PR.cur = chDraw(CH.r); PR.shown = false; renderPresent();
  };
  const b = $("prShow") || $("prNext"); if (b) b.focus({ preventScroll: true });
}
document.addEventListener("keydown", (e) => {
  if (!PR || !$("present") || $("present").hidden) return;
  if (e.key === "Escape") closePresent();
  if (e.key === "ArrowRight" || e.key === " ") { const b = $("prShow") || $("prNext"); if (b) { e.preventDefault(); b.click(); } }
});

/* ===== 設定 ===== */
document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => {
  prefs.tempo = b.dataset.t; savePrefs();
  document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.t === prefs.tempo)));
}));
function applyFs() {
  document.documentElement.dataset.fs = prefs.fs === "l" ? "l" : "m";
  $("fsBtn").setAttribute("aria-pressed", String(prefs.fs === "l"));
}
$("fsBtn").onclick = () => { prefs.fs = prefs.fs === "l" ? "m" : "l"; savePrefs(); applyFs(); };
/* 表示の明るさ：自動（端末に合わせる）→ ライト → ダーク */
const THEMES = { auto: "自動", light: "ライト", dark: "ダーク", contrast: "くっきり" };
function applyTheme(init) {
  const t = prefs.theme in THEMES ? prefs.theme : "auto";
  if (t === "auto") { if (!init) document.documentElement.removeAttribute("data-theme"); }
  else document.documentElement.dataset.theme = t;
  $("themeLab").textContent = THEMES[t];
}
$("themeBtn").onclick = () => {
  const order = ["auto", "light", "dark", "contrast"];
  prefs.theme = order[(order.indexOf(prefs.theme in THEMES ? prefs.theme : "auto") + 1) % order.length];
  savePrefs(); applyTheme(false);
};
applyTheme(true);
function applySound() { $("soundBtn").setAttribute("aria-pressed", String(!!prefs.sound)); $("soundBtn").textContent = prefs.sound ? "効果音：オン" : "効果音：オフ"; }
$("soundBtn").onclick = () => { prefs.sound = !prefs.sound; savePrefs(); applySound(); sfx("ok"); };
applySound();
/* やさしい表示：文字と選択肢を大きく、小さな行動と自由入力をかくして、大きな選択肢だけで進める */
function applyEasy() {
  document.documentElement.dataset.easy = prefs.easy ? "1" : "0";
  document.querySelectorAll("[data-easybtn], #easyBtn").forEach((b) => { b.setAttribute("aria-pressed", String(!!prefs.easy)); b.textContent = prefs.easy ? "やさしい表示：オン" : "やさしい表示：オフ"; });
}
function toggleEasy() { prefs.easy = !prefs.easy; savePrefs(); applyEasy(); toast(prefs.easy ? "やさしい表示にしました" : "ふつうの表示にもどしました"); }
$("easyBtn").onclick = toggleEasy;
applyEasy();
/* 読み上げ：相手のメッセージを声で読む。相手ごとに声の高さを変える（ブラウザの音声合成を使い、どこにも送らない） */
const CAN_VOICE = "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
let jaVoice = null;
function pickVoice() { if (!CAN_VOICE) return; jaVoice = speechSynthesis.getVoices().find((v) => /^ja/i.test(v.lang)) || null; }
if (CAN_VOICE) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, h, kind) {
  if (!prefs.voice || !CAN_VOICE || !text) return;
  const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "（リンク）").replace(/[😀-🙏✨🙇🙏☺️😊😳]/gu, ""));
  u.lang = "ja-JP"; if (jaVoice) u.voice = jaVoice;
  u.rate = prefs.easy ? 0.9 : 1.05;
  u.pitch = kind === "narr" ? 1 : 0.65 + (((h || 0) * 7) % 360) / 360 * 0.9;
  u.volume = kind === "narr" ? 0.85 : 1;
  speechSynthesis.speak(u);
}
function hush() { if (CAN_VOICE) speechSynthesis.cancel(); }
function applyVoice() {
  document.querySelectorAll("[data-voicebtn], #voiceBtn").forEach((b) => {
    b.hidden = !CAN_VOICE;
    b.setAttribute("aria-pressed", String(!!prefs.voice)); b.textContent = prefs.voice ? "読み上げ：オン" : "読み上げ：オフ";
  });
}
function toggleVoice() {
  prefs.voice = !prefs.voice; savePrefs(); applyVoice();
  if (prefs.voice) speak("読み上げをオンにしました。相手のメッセージを声で読みます。", 0, "narr"); else hush();
}
if ($("voiceBtn")) $("voiceBtn").onclick = toggleVoice;
applyVoice();
/* 選択肢は A〜F のキーでもえらべる（入力欄に書いているときはのぞく） */
document.addEventListener("keydown", (e) => {
  if (document.body.dataset.view !== "play" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (!$("overlay").hidden || !$("result").hidden) return;
  const i = "abcdefghij".indexOf(e.key.toLowerCase());
  if (i < 0 || e.key.length !== 1) return;
  const b = [...$("composer").querySelectorAll("button[id^='ch-']")].filter((x) => !x.disabled)[i];
  if (b) { e.preventDefault(); b.click(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("result").hidden) closeResult();
  else if (!$("overlay").hidden && S && S.closeStop) S.closeStop();
});
window.addEventListener("hashchange", route);

if (ORG.name) { $("footOrg").hidden = false; $("footOrg").innerHTML = orgBadge(); }
if (store.get("dl3-ach", null) === null) store.set("dl3-ach", achievements().filter((a) => a.got).map((a) => a.id));
renderLvPill();
applyFs();
route();
})();
