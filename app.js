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
const byId = (id) => SCENARIOS.find((s) => s.id === id);
const endIds = (sc) => Object.keys(sc.nodes).filter((k) => sc.nodes[k].end);
const mascot = (cls) => `<svg class="mascot ${cls || ""}" aria-hidden="true"><use href="#minuke"></use></svg>`;
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

/* ===== ルーティング（#home / #zukan / #help / #シナリオID） ===== */
function route() {
  const h = (location.hash || "").replace(/^#/, "") || "home";
  closeResult(true);
  if (byId(h)) return showView("play", h);
  if (h === "zukan" || h === "help" || h === "teach") return showView(h);
  showView("home");
}
function showView(name, scId) {
  ["home", "play", "zukan", "help", "teach"].forEach((v) => { $("v-" + v).hidden = v !== name; });
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const on = a.dataset.nav === name || (name === "play" && a.dataset.nav === "home");
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (name !== "play") { RUN++; }
  if (name === "home") renderHome();
  if (name === "zukan") renderZukan();
  if (name === "help") renderHelp();
  if (name === "teach") renderTeach();
  if (name === "play") openScenario(scId);
  window.scrollTo(0, 0);
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
    <div class="nt-head"><span class="nt-app">${esc(f.app)}</span><span class="nt-time">${esc(sc.clock || "")}</span>${badge}</div>
    <div class="nt-body">${av(sc, f.who)}<div><b>${esc(f.name)}</b><p class="nt-prev">${esc(f.text)}</p></div></div>
    <div class="body"><span class="gtag">${esc(sc.tag)}</span><h3>${esc(sc.title)}</h3>
      <div class="meta"><span>約${sc.mins}分</span><span>むずかしさ <span class="lvl">${lvl(sc.level)}</span></span><span>結末 ${played}/${ne}</span><span>サイン ${caught}/${ns}</span></div>
      <div class="pbar" aria-hidden="true"><i style="width:${Math.round((played / ne) * 100)}%"></i></div>
    </div></a>`;
}
/* 最初に届くメッセージ（通知のプレビュー用） */
function firstMsg(sc) {
  let node = sc.nodes[sc.start], app = "", who = "", text = "";
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    if (node.scene) { app = app || node.scene.app; who = who || node.scene.who; }
    const m = (node.log || []).find((l) => l[0] === "them" || l[0] === "card");
    if (m) {
      if (m[0] === "them") { text = m[1]; if (m[2]) who = m[2]; } else { text = `${m[1]}：${m[2][0]}`; }
      break;
    }
    node = node.choices && sc.nodes[node.choices[0].next];
  }
  const c = sc.cast[who] || {};
  return { app: app || "メッセージ", who, name: c.n || "", text };
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

function renderHome() {
  const t = totals();
  const rate = t.met ? Math.round((t.caught / t.met) * 100) : null;
  const next = nextUnplayed();
  const lastId = store.get("dl3-last", null);
  const last = lastId && byId(lastId);
  const contHTML = t.gotEnds
    ? `<div class="cont">${mascot("md")}<div class="t"><b>${t.cleared === SCENARIOS.length ? "全シナリオ クリア！ 残りの結末も探してみよう" : `${t.cleared} / ${SCENARIOS.length} シナリオ クリア`}</b>
       <span>${next ? `次のおすすめ：${esc(next.title)}` : "サイン図鑑で、見逃したサインを見直そう"}</span></div>
       ${last ? `<a class="btn small" href="#${last.id}">もう一度：${esc(last.tag)}</a>` : ""}
       ${next ? `<a class="btn small primary" href="#${next.id}">つづきから</a>` : `<a class="btn small primary" href="#zukan">図鑑を見る</a>`}</div>`
    : "";

  $("v-home").innerHTML = `
  <div class="hero bleed b-hero">
    <div>
      <div class="eyebrow">18歳からの消費者トラブル体験ゲーム</div>
      <h1>その誘い、<br><em>どこで見抜ける？</em></h1>
      <p class="lead">スマホに届いたメッセージに、あなたが返信して物語が動きます。副業、投資、推し活、恋愛、ひとり暮らし。${SCENARIOS.length}の場面を体験して、手口ではなく「おかしいと気づくサイン」を覚えよう。</p>
      <div class="ctas">
        <a class="btn primary" href="#${(next || SCENARIOS[0]).id}" id="ctaStart">まずは体験してみる <small>約5分</small></a>
        <a class="btn" href="#quizSec" id="ctaQuiz">自分に近い話を診断</a>
      </div>
      <div class="hero-org">${orgBadge()}</div>
    </div>
    ${demoHTML()}
  </div>
  ${tapeRun()}
  <div class="stats">
    <div class="stat"><b>${SCENARIOS.length}</b><span>シナリオ</span></div>
    <div class="stat"><b>${t.signs}</b><span>気づくサイン</span></div>
    <div class="stat"><b>${t.gotEnds}<small style="font-size:.6em"> / ${t.ends}</small></b><span>回収した結末</span></div>
    <div class="stat"><b>${rate === null ? "—" : rate + "%"}</b><span>あなたの見抜き率</span></div>
  </div>
  ${contHTML}
  ${todaySignHTML()}

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

  <section class="sec" aria-label="シナリオ一覧">
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

  renderFilters(); renderLib(); bindLibTools(); renderQuiz(); renderSQ(); runDemo();
  $("ctaQuiz").onclick = (e) => { e.preventDefault(); $("quizSec").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); };
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
  el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { SQ.picked = b.dataset.c; if (SQ.picked === it.sign.cat) SQ.score++; renderSQ(); const n = $("sqNext"); if (n) n.focus({ preventScroll: true }); }));
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
function renderFilters() {
  const opts = [["all", "すべて"], ...Object.entries(GENRES).map(([k, g]) => [k, g.n])];
  $("filters").innerHTML = opts.map(([k, n]) => `<button class="chipbtn" type="button" id="f-${k}" data-f="${k}" aria-pressed="${filter === k}">${esc(n)}</button>`).join("");
  $("filters").querySelectorAll("button").forEach((b) => (b.onclick = () => { filter = b.dataset.f; renderFilters(); renderLib(); }));
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
  let list = SCENARIOS.filter((s) => filter === "all" || s.genre === filter);
  if (q) list = list.filter((s) => [s.title, s.sub, s.tag, s.intro, GENRES[s.genre].n, ...Object.values(s.signs).map((x) => x.t)].join(" ").toLowerCase().includes(q));
  if (SORTS[libSort].f) list = list.slice().sort(SORTS[libSort].f);
  if (!list.length) {
    $("lib").innerHTML = `<div class="lib-empty">${mascot("md")}<p>「${esc(libQ)}」に合う話が見つかりませんでした。別のことばで探してみてね。</p></div>`;
    return;
  }
  if (filter === "all" && !q && libSort === "rec") {
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
    { id: "quiz", ic: "満", n: "クイズ満点", d: "サインあてクイズで5問正解", got: (prefs.sqBest || 0) >= 5 }
  ];
}
function checkAch() {
  const had = new Set(store.get("dl3-ach", []) || []);
  const now = achievements().filter((a) => a.got);
  const fresh = now.filter((a) => !had.has(a.id));
  store.set("dl3-ach", now.map((a) => a.id));
  fresh.forEach((a, i) => setTimeout(() => toast(`称号を手に入れた！「${a.n}」`), i * 2400));
}
function achHTML() {
  const list = achievements();
  return `<section class="sec" aria-label="称号"><div class="sec-h"><h2>称号　${list.filter((a) => a.got).length} / ${list.length}</h2><p>体験を重ねると手に入ります。まだの称号は、条件を見てチャレンジしてみよう。</p></div>
    <div class="medals">${list.map((a) => `<div class="medal${a.got ? " got" : ""}"><span class="md-ic" aria-hidden="true">${a.ic}</span><div><b>${esc(a.n)}</b><span>${esc(a.d)}</span></div>${a.got ? `<span class="md-st">獲得</span>` : ""}</div>`).join("")}</div></section>`;
}

/* ===== 図鑑 ===== */
let resetArmed = false;
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
  ${achHTML()}
  ${catRows.map((r) => `<section class="zgroup" aria-label="${esc(r.c.n)}">
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
    progress = {}; saveProgress(); resetArmed = false; renderZukan(); toast("記録をリセットしました");
  };
  if ($("resetCancel")) $("resetCancel").onclick = () => { resetArmed = false; renderZukan(); };
}

/* ===== 相談先 ===== */
function renderHelp() {
  $("v-help").innerHTML = `
  <div class="help-hero bleed b-hero"><div class="eyebrow">IF SOMETHING HAPPENS</div><h1>困ったら、ひとりで抱えない</h1>
    <p style="color:var(--muted)">だまされたのは恥ずかしいことではありません。早く相談するほど、取れる手段が増えます。迷ったら、まず188へ。</p></div>
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
function renderTeach() {
  const genreOf = (sc) => GENRES[sc.genre].n;
  const catsOf = (sc) => [...new Set(Object.values(sc.signs).map((s) => s.cat))].map((c) => CATS[c] ? CATS[c].n : c).join("、");
  $("v-teach").innerHTML = `
  <div class="help-hero bleed b-hero"><div class="eyebrow">FOR TEACHERS &amp; FAMILIES</div><h1>授業や家庭で使う</h1>
    <p style="color:var(--muted)">2022年4月から成年年齢は18歳になり、18歳になると親の同意なく契約できるかわりに、未成年者取消権が使えなくなりました。このページは、高校生から大学1年生くらいの人といっしょに体験し、話し合うためのガイドです。1シナリオは約3〜7分。登録やログインは不要です。</p>
    ${ORG.name ? `<div class="hero-org">${orgBadge()}</div>` : ""}</div>

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
  $("composer").innerHTML = `<button class="choice go" type="button" id="goBtn"><span class="ch-ic" aria-hidden="true">${ICON_PLAY}</span><span>ストーリーをはじめる</span></button>`;
  const begin = () => {
    prog(sc.id).plays++; saveProgress();
    /* 始まったら、あらすじは見出しだけに折りたたんで、会話の場所を広くする */
    const intro = $("log").querySelector(".intro");
    if (intro) intro.classList.add("mini");
    S.scene = null; S.lastFrom = null;
    playNode(sc.start);
  };
  $("goBtn").onclick = () => {
    if (store.get("dl3-coach", false)) return begin();
    showCoach(begin);
  };
  /* スマホでは、開いたらスマホ画面が画面いっぱいに見える位置まで送る */
  if (matchMedia("(max-width: 860px)").matches) requestAnimationFrame(() => document.querySelector(".phone-col").scrollIntoView({ block: "start" }));
}
const ICON_SAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>`;
const ICON_ACT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>`;
/* はじめての人向けの3ステップ案内（1回だけ） */
function showCoach(done) {
  const stop = $("stop");
  stop.className = "stop coach";
  stop.innerHTML = `<div class="tape"></div><div class="in">
    <div class="v">${mascot("md")}<div><b id="stopTitle">遊び方</b><span>3つだけ覚えればOK</span></div></div>
    <ol class="coach-steps">
      <li><b>返信か、行動をえらぶ</b><span>メッセージが届いたら、下のボタンから選ぼう。正解の位置は毎回変わるよ。</span></li>
      <li><b>選ぶたびに「STOP」</b><span>そこにかくれていたサインを、ミヌケが解説するよ。</span></li>
      <li><b>迷ったら「ミヌケのヒント」</b><span>結末やサインは、図鑑と称号に集まっていくよ。</span></li>
    </ol>
    <button type="button" id="coachGo">わかった、はじめる</button></div>`;
  $("overlay").hidden = false;
  $("coachGo").focus({ preventScroll: true });
  const close = () => { $("overlay").hidden = true; S.closeStop = null; store.set("dl3-coach", true); done(); };
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

function setHead() {
  const sc = S.sc, scn = S.scene || {};
  const keys = [scn.who, ...(scn.also || [])].filter((k) => k && sc.cast[k]);
  let name, status = scn.status || "";
  if (scn.type === "live") { name = keys.map((k) => sc.cast[k].n).join("・"); status = status || "目の前で話している"; }
  else if (scn.type === "home") { name = scn.name || "ひとりの時間"; status = status || "スマホを見ながら考えている"; }
  else { name = scn.name || (scn.who && sc.cast[scn.who] ? sc.cast[scn.who].n : ""); }
  const avs = scn.type === "home" ? `<span class="av ghost" aria-hidden="true">家</span>` : `<span class="avs">${keys.map((k) => av(sc, k)).join("")}</span>`;
  $("head").innerHTML = `<span class="chev" aria-hidden="true">‹</span>${avs}
    <span class="who"><b>${esc(name)}</b>${status ? `<span>${esc(status)}</span>` : ""}</span><span class="app">${esc(scn.app || "")}</span>`;
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
    if (factor() > 0) {
      const tEl = append(`<div class="row them typing${cont ? " cont" : ""}">${slot}<span class="bub">${nm}<p><i></i><i></i><i></i></p></span></div>`);
      await pause(Math.min(1500, 350 + a.length * 22));
      tEl.remove();
      if (S.run !== RUN) return;
    }
    append(`<div class="row them${cont ? " cont" : ""}">${slot}<span class="bub">${nm}<p>${esc(a)}</p></span><span class="meta">${esc(S.clock)}</span></div>`);
    S.lastFrom = who;
    await pause(260);
  } else if (k === "me") {
    await pause(500); sendMe(a); await pause(500);
  } else if (k === "think") {
    await pause(700); append(`<div class="think">${esc(a)}</div>`); S.lastFrom = null; await pause(500);
  } else if (k === "narr") {
    await pause(300); append(`<div class="narr">${esc(a)}</div>`); S.lastFrom = null; await pause(900);
  } else if (k === "sys") {
    await pause(300); append(`<div class="sys">${esc(a)}</div>`); S.lastFrom = null; await pause(500);
  } else if (k === "card") {
    await pause(400);
    const wide = ["web", "home", "live", "call"].includes(scn.type);
    append(`<div class="shot${wide ? " wide" : ""}"><div class="t">${esc(a)}</div><ul>${b.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`);
    S.lastFrom = null; await pause(1100);
  }
}
function sendMe(text) {
  const el = append(`<div class="row me"><span class="bub"><p>${esc(text)}</p></span><span class="meta"><span class="rd"></span>${esc(S.clock)}</span></div>`);
  S.lastFrom = "__me";
  const rd = el.querySelector(".rd");
  if (S.scene && (S.scene.type === "talk" || S.scene.type === "dm")) setTimeout(() => { rd.textContent = "既読 "; }, 600 * (TEMPO[prefs.tempo] || 0.3));
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
  }
  if (n.end) return showEnd(id, n);
  waitingUI();
  for (const it of n.log) { await showItem(it); if (my !== RUN) return; }
  choicesUI(n);
}
function waitingUI() {
  $("composer").innerHTML = `<div class="waiting"><span>会話が進んでいます…</span><button class="linkbtn" type="button" id="skipBtn">すぐ表示</button></div>`;
  $("skipBtn").onclick = () => { S.skip = true; };
}
function choicesUI(n) {
  const order = (S.order[S.node] ||= n.choices.map((_, i) => i).sort(() => Math.random() - 0.5));
  const hintSign = n.choices.map((c) => c.sign && S.sc.signs[c.sign]).find(Boolean);
  $("composer").innerHTML = `<div class="q"><span>あなたならどうする？</span>${hintSign ? `<button class="linkbtn hintbtn" type="button" id="hintBtn">${mascot("sm")}ミヌケのヒント</button>` : ""}</div>` + order.map((i) => {
    const c = n.choices[i];
    return `<button class="choice ${c.say ? "say" : "do"}" type="button" id="ch-${S.node}-${i}" data-i="${i}"><span class="ch-ic" aria-hidden="true">${c.say ? ICON_SAY : ICON_ACT}</span><span class="ch-tx"><small>${c.say ? "返信する" : "行動する"}</small><span>${esc(c.say || c.act)}</span></span></button>`;
  }).join("");
  $("composer").querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => choose(n.choices[+b.dataset.i])));
  if ($("hintBtn")) $("hintBtn").onclick = () => {
    const cat = CATS[hintSign.cat];
    S.hints = (S.hints || 0) + 1;
    $("hintBtn").outerHTML = `<span class="hint" role="status">${mascot("sm")}<span>この場面には「<b>${esc(cat.n)}</b>」のサインがかくれているかも。${esc(cat.d)}</span></span>`;
  };
  const firstBtn = $("composer").querySelector("button");
  if (firstBtn && document.activeElement && document.activeElement.closest && document.activeElement.closest("#composer")) firstBtn.focus({ preventScroll: true });
}
async function choose(c) {
  const my = S.run;
  $("composer").querySelectorAll("button").forEach((b) => (b.disabled = true));
  S.hist.push({ node: S.node, text: c.say || c.act, sign: c.sign, ok: c.ok, scene: S.scene, clock: S.clock, signsBefore: Object.assign({}, S.signs) });
  if (c.say) sendMe(c.say);
  else { append(`<div class="act">${esc(c.act)}</div>`); S.lastFrom = null; }
  if (c.sign && S.sc.signs[c.sign]) {
    /* サインがかくれていたメッセージに印をつける */
    const target = [...$("log").querySelectorAll(".row.them:not(.typing), .shot")].pop();
    const cat = CATS[S.sc.signs[c.sign].cat];
    if (target && !target.classList.contains("flag") && cat) {
      target.classList.add("flag", c.ok ? "flag-ok" : "flag-ng");
      (target.querySelector(".bub") || target).insertAdjacentHTML("beforeend", `<span class="flag-tag"><b>${cat.ic}</b>${esc(cat.n)}のサイン</span>`);
    }
    S.signs[c.sign] = c.ok ? "caught" : "missed";
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
      ${cat ? `<span class="cat-tag">${esc(cat.n)}のサイン</span>` : ""}
      <h3 id="stopTitle">${esc(sg.t)}</h3><p>${esc(sg.d)}</p>
      <button type="button" id="stopGo">ストーリーにもどる</button></div>`;
    $("overlay").hidden = false;
    const done = () => { $("overlay").hidden = true; S.closeStop = null; resolve(); };
    $("stopGo").onclick = done;
    $("stopGo").focus({ preventScroll: true });
    S.closeStop = done;
  });
}
function rankOf(endType, caught, missed) {
  const met = caught + missed, rate = met ? caught / met : 0;
  if (endType === "safe" && rate >= 0.99) return { r: "見抜きマスター", m: "完ぺき！ 最初のサインから見抜けたね。この感覚をまわりにも教えてあげて。" };
  if (endType === "safe") return { r: "しっかり見抜けた", m: "途中で気づいて、被害ゼロで抜け出せた。ほかの結末も見てみよう。" };
  if (endType === "partial") return { r: "ギリギリ回避", m: "被害は少し出たけど、最後に止まれた。どこで気づけたらよかったか、もう一度見てみよう。" };
  if (rate >= 0.5) return { r: "あと一歩", m: "気づけたサインもあったのに、流れに乗せられてしまった。次は別の選択で。" };
  return { r: "ヒヤリ体験", m: "これが現実なら大変。でも体験だからこそ、ここで覚えられる。サインを見直してもう一回！" };
}
function showEnd(id, n) {
  const sc = S.sc, p = prog(sc.id);
  const isNewEnd = !p.ends.includes(id);
  if (isNewEnd) p.ends.push(id);
  if (n.end === "safe" && !Object.values(S.signs).includes("missed")) p.perfect = true;
  if (n.end === "safe") confetti();
  saveProgress();
  setTimeout(checkAch, 1600);
  append(`<div class="end"><div class="tape"></div><div class="in"><span class="stamp s-${n.end}" aria-hidden="true">${STAMP[n.end]}</span><span class="label ${n.end}">結末｜${ENDLAB[n.end]}</span><h3>${esc(n.h)}</h3><p>${esc(n.p)}</p></div></div>`);
  $("composer").innerHTML = `<div class="pair">
    <button class="choice go" type="button" id="btn-result">結果を見る</button>
    <button class="choice" type="button" id="btn-retry"><small>同じシナリオ</small><span>別の選択でもう一度</span></button></div>`;
  $("btn-result").onclick = () => openResult(id, n, isNewEnd);
  $("btn-retry").onclick = () => { openScenario(sc.id); };
  renderSide(); renderDots();
  setTimeout(() => { if (S && S.sc === sc && S.node === id) openResult(id, n, isNewEnd); }, reduced || factor() === 0 ? 300 : 1400);
}

/* 「被害なし」の結末で、テープ色の紙吹雪を少しだけ */
function confetti() {
  if (reduced) return;
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
}
function renderDots() {
  const sc = S.sc;
  $("playDots").innerHTML = Object.keys(sc.signs).map((k) => `<i class="${S.signs[k] || ""}" title="${S.signs[k] ? esc(sc.signs[k].t) : "未発見"}"></i>`).join("");
  /* あぶなさメーター：見逃すと上がり、気づくと下がる（0〜5） */
  const vals = Object.values(S.signs);
  const lv = Math.max(0, Math.min(5, vals.filter((v) => v === "missed").length * 2 - vals.filter((v) => v === "caught").length + (vals.length ? 1 : 0)));
  const words = ["平穏", "平穏", "ちょっと注意", "あやしい", "かなり危険", "危険！"];
  $("meter").innerHTML = `<span class="m-lab">あぶなさ</span><span class="m-bars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lv ? "on l" + lv : ""}"></i>`).join("")}</span><span class="m-word">${words[lv]}</span>`;
  $("meter").dataset.lv = lv;
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
  const next = SCENARIOS.slice(idx + 1).concat(SCENARIOS.slice(0, idx)).find((s) => !(progress[s.id] && (progress[s.id].ends || []).length)) || SCENARIOS[(idx + 1) % SCENARIOS.length];
  $("resultSheet").innerHTML = `<div class="tape"></div><div class="in">
    <div class="rank">${mascot()}<div><small>判定</small><b id="resTitle">${esc(rk.r)}</b><span>${esc(rk.m)}</span></div><span class="stamp s-${n.end}" aria-hidden="true">${STAMP[n.end]}</span></div>
    <div><span class="label ${n.end}">結末｜${ENDLAB[n.end]}${isNewEnd ? "（はじめて回収！）" : ""}</span><p style="margin-top:6px;font-weight:700">${esc(n.h)}</p></div>
    <div class="resgrid"><div><b>${caught}</b><span>気づけたサイン</span></div><div><b>${missed}</b><span>見逃したサイン</span></div><div><b>${p.ends.length}/${endIds(sc).length}</b><span>回収した結末</span></div></div>
    ${S.hints ? `<p class="hintnote">${mascot("sm")}ミヌケのヒントを ${S.hints} 回使いました。次はヒントなしで挑戦してみよう。</p>` : ""}
    <div><div class="side-h"><h2>ストーリーマップ</h2><span>結末 ${p.ends.length} / ${endIds(sc).length}</span></div><div class="mapbox">${storyMap(sc, S.path, id)}${MAP_LEGEND}</div></div>
    ${missed ? `<div><div class="side-h"><h2>見逃したサイン</h2></div><ul class="signs">${ids.filter((k) => S.signs[k] === "missed").map((k) => `<li><span class="st missed">見逃した</span><b>${esc(sc.signs[k].t)}</b><span class="d">${esc(sc.signs[k].d)}</span></li>`).join("")}</ul></div>` : ""}
    ${S.hist.length ? `<div><div class="side-h"><h2>あなたが通ったルート</h2><span>分かれ道からやり直せます</span></div>
      <ol class="route">${S.hist.map((h, i) => `<li class="${h.sign ? (h.ok ? "ok" : "ng") : ""}">
        <span class="rt-mark" aria-hidden="true">${h.sign ? (h.ok ? "◎" : "▲") : "・"}</span>
        <div class="rt-body"><span class="rt-text">${esc(h.text)}</span>${h.sign ? `<span class="rt-sign">${h.ok ? "気づけた" : "見逃した"}：${esc(sc.signs[h.sign].t)}</span>` : ""}</div>
        <button class="linkbtn" type="button" data-replay="${i}" id="replay-${i}">ここから</button></li>`).join("")}</ol></div>` : ""}
    ${DEBRIEF[sc.id] ? debriefHTML(sc) : ""}
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
    <div class="resbtns">
      <button class="btn" type="button" id="resRetry">別の選択でもう一度</button>
      <a class="btn primary" href="#${next.id}" id="resNext">次へ：${esc(next.tag)}</a>
    </div>
    <button class="qback" type="button" id="resClose" style="justify-self:center">閉じて会話を見返す</button>
  </div>`;
  $("result").hidden = false;
  $("shareCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(full); toast("コピーしました"); }
    catch (e) { const ta = $("shareText"); ta.focus(); ta.select(); toast("選択しました。コピーしてください"); }
  };
  $("resRetry").onclick = () => { closeResult(); openScenario(sc.id); };
  $("resultSheet").querySelectorAll("[data-replay]").forEach((b) => (b.onclick = () => replayFrom(+b.dataset.replay)));
  $("resClose").onclick = () => closeResult();
  $("resNext").onclick = () => closeResult(true);
  $("resClose").focus({ preventScroll: true });
  drawCard(sc, n, rk, caught, met).then((src) => { const img = $("shareImg"); if (img && src) img.src = src; });
}
function debriefHTML(sc) {
  const d = DEBRIEF[sc.id];
  return `<div class="debrief"><div class="side-h"><h2>このシナリオのまとめ</h2></div>
    <p class="db-point">${mascot("sm")}<b>${esc(d.point)}</b></p>
    <p class="db-real">${esc(d.real)}</p>
    ${d.flow ? `<div><span class="eyebrow">よくある流れ　どこでも止まれる</span><ol class="db-flow">${d.flow.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>` : ""}
    ${d.say ? `<div><span class="eyebrow">そのまま使える、断りのひとこと</span><div class="db-say">${d.say.map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>` : ""}
    ${d.after ? `<div class="db-after"><span class="eyebrow">もし被害にあったら、すぐやること</span><ol>${d.after.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div>` : ""}
    <div class="db-law"><span class="eyebrow">知っておきたいこと</span><ul>${d.law.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>
    <div class="db-ask"><span class="eyebrow">考えてみよう</span><ul>${d.ask.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div></div>`;
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
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load('40px "Dela Gothic One"'), document.fonts.load('700 30px "Zen Maru Gothic"')]).catch(() => {});
    }
    const cs = getComputedStyle(document.documentElement);
    const col = (v) => cs.getPropertyValue(v).trim() || "#000";
    const W = 1200, H = 630;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const ink = col("--ink"), surf = col("--surface"), acc = col("--accent"), muted = col("--muted");
    x.fillStyle = col("--bg"); x.fillRect(0, 0, W, H);
    x.save(); x.beginPath(); x.rect(0, 0, W, 34); x.clip();
    for (let i = -40; i < W + 40; i += 40) { x.fillStyle = acc; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, 0); x.lineTo(i - 14, 34); x.lineTo(i - 34, 34); x.fill(); x.fillStyle = ink; x.beginPath(); x.moveTo(i + 20, 0); x.lineTo(i + 40, 0); x.lineTo(i + 6, 34); x.lineTo(i - 14, 34); x.fill(); }
    x.restore();
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    x.fillStyle = surf; rr(48, 72, W - 96, H - 120, 32); x.fill();
    x.lineWidth = 4; x.strokeStyle = ink; x.stroke();
    const wrap = (text, X, Y, maxW, lh, maxLines) => {
      let line = "", lines = [];
      for (const ch of text) { if (x.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch; }
      if (line) lines.push(line);
      if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…"; }
      lines.forEach((l, i) => x.fillText(l, X, Y + i * lh));
      return lines.length;
    };
    x.textBaseline = "top";
    x.fillStyle = muted; x.font = '700 26px "Zen Maru Gothic", sans-serif';
    x.fillText("だまされ体験ラボ｜" + sc.tag, 96, 112);
    x.fillStyle = ink; x.font = '44px "Dela Gothic One", sans-serif';
    const tl = wrap(sc.title, 96, 156, 700, 58, 2);
    const y0 = 156 + tl * 58 + 26;
    x.font = '700 28px "Zen Maru Gothic", sans-serif'; x.fillStyle = muted;
    wrap("結末：" + n.h, 96, y0, 700, 40, 2);
    x.fillStyle = acc; rr(96, 420, 300, 120, 20); x.fill(); x.strokeStyle = ink; x.lineWidth = 3; x.stroke();
    x.fillStyle = ink; x.font = '700 22px "Zen Maru Gothic", sans-serif'; x.fillText("判定", 120, 436);
    let fz = 38; x.font = `${fz}px "Dela Gothic One", sans-serif`;
    while (x.measureText(rk.r).width > 252 && fz > 18) { fz -= 2; x.font = `${fz}px "Dela Gothic One", sans-serif`; }
    x.fillText(rk.r, 120, 474 + (38 - fz) / 2);
    x.fillStyle = surf; rr(420, 420, 300, 120, 20); x.fill(); x.strokeStyle = ink; x.stroke();
    x.fillStyle = ink; x.font = '700 22px "Zen Maru Gothic", sans-serif'; x.fillText("気づけたサイン", 444, 436);
    x.font = '44px "Dela Gothic One", sans-serif'; x.fillText(`${caught} / ${total}`, 444, 472);
    // ミヌケ
    const cx = 960, cy = 300, R = 150;
    x.fillStyle = acc; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill(); x.lineWidth = 8; x.strokeStyle = ink; x.stroke();
    x.save(); x.beginPath(); x.arc(cx, cy, R - 4, 0, Math.PI * 2); x.clip();
    x.translate(cx, cy - 60); x.rotate(-0.08);
    for (let i = -210, n = 0; i < 210; i += 16, n++) { x.fillStyle = n % 2 ? ink : acc; x.beginPath(); x.moveTo(i, -24); x.lineTo(i + 16, -24); x.lineTo(i + 32, 24); x.lineTo(i + 16, 24); x.fill(); }
    x.lineWidth = 6; x.strokeStyle = ink; x.strokeRect(-210, -24, 420, 48);
    x.restore();
    x.fillStyle = ink;
    x.beginPath(); x.ellipse(cx - 50, cy + 30, 18, 24, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx + 50, cy + 30, 18, 24, 0, 0, Math.PI * 2); x.fill();
    x.lineWidth = 10; x.lineCap = "round"; x.beginPath(); x.moveTo(cx - 30, cy + 90); x.quadraticCurveTo(cx, cy + 110, cx + 30, cy + 90); x.stroke();
    x.fillStyle = muted; x.font = '700 24px "Zen Maru Gothic", sans-serif'; x.textAlign = "center";
    x.fillText("#だまされ体験ラボ", cx, 500);
    return cv.toDataURL("image/png");
  } catch (e) { return null; }
}

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
const THEMES = { auto: "自動", light: "ライト", dark: "ダーク" };
function applyTheme(init) {
  const t = prefs.theme in THEMES ? prefs.theme : "auto";
  if (t === "auto") { if (!init) document.documentElement.removeAttribute("data-theme"); }
  else document.documentElement.dataset.theme = t;
  $("themeLab").textContent = THEMES[t];
}
$("themeBtn").onclick = () => {
  const order = ["auto", "light", "dark"];
  prefs.theme = order[(order.indexOf(prefs.theme in THEMES ? prefs.theme : "auto") + 1) % 3];
  savePrefs(); applyTheme(false);
};
applyTheme(true);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("result").hidden) closeResult();
  else if (!$("overlay").hidden && S && S.closeStop) S.closeStop();
});
window.addEventListener("hashchange", route);

if (ORG.name) { $("footOrg").hidden = false; $("footOrg").innerHTML = orgBadge(); }
if (store.get("dl3-ach", null) === null) store.set("dl3-ach", achievements().filter((a) => a.got).map((a) => a.id));
applyFs();
route();
})();
