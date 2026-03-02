import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const ANSWERED_KEY = "migimigi_answered";
function getAnswered() {
  try { return JSON.parse(localStorage.getItem(ANSWERED_KEY) || "{}"); } catch { return {}; }
}
function markAnswered(key) {
  const a = getAnswered(); a[key] = true;
  localStorage.setItem(ANSWERED_KEY, JSON.stringify(a));
}

// サンプル問題タイトル（DBのtitleと一致させる）
const SAMPLE_TITLES = new Set([
  "炭酸飲料といえば？","朝ごはんといえば？","休日の過ごし方は？","カップ麺といえば？",
  "ペットを飼うなら？","映画を見るなら？","スマホといえば？","旅行先は？",
  "派閥はどっち？","夏といえば？","スイーツといえば？","運動するなら？",
  "コーヒーの飲み方は？","SNSといえば？","音楽を聴くなら？","買い物するなら？",
  "寝るときは？","風呂派？シャワー派？","仕事・勉強するなら？","好きなシーズンは？",
]);

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.method === "POST" ? "return=representation" : "",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// 投票集計：question（テキスト）で集計する
function buildVoteMap(votes) {
  const map = {};
  for (const v of (votes || [])) {
    const key = v.question;
    if (!key) continue;
    if (!map[key]) map[key] = { left: 0, right: 0 };
    map[key][v.side] = (map[key][v.side] || 0) + 1;
  }
  return map;
}

function calcPct(left, right) {
  const total = left + right;
  if (!total) return { leftPct: 50, rightPct: 50, total: 0 };
  const leftPct = Math.round((left / total) * 100);
  return { leftPct, rightPct: 100 - leftPct, total };
}

// ===== 投票カード =====
function QuestionCard({ q, answered, onVote, onShare, isSample }) {
  const answerKey = String(q.id);
  const [chosen, setChosen] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [votes, setVotes] = useState({ left: q.left_votes || 0, right: q.right_votes || 0 });
  const votingRef = useRef(false); // 二重投票防止
  // サンプルは何度でも回答可。通常問題は回答済み管理
  const isAnswered = !isSample && !!answered[answerKey];
  const { leftPct, rightPct, total } = calcPct(votes.left, votes.right);

  useEffect(() => {
    if (isAnswered) setRevealed(true);
  }, []);

  async function handleVote(side) {
    // 二重タップ・連打を即座にブロック
    if (votingRef.current || chosen || isAnswered) return;
    votingRef.current = true;
    setChosen(side);
    setRevealed(true);
    setVotes(v => ({ ...v, [side]: v[side] + 1 }));
    if (!isSample) {
      markAnswered(answerKey);
      onVote && onVote(answerKey);
    }
    // サンプルも通常問題もDBに保存（question テキストで記録）
    try {
      await sb("/votes", {
        method: "POST",
        body: JSON.stringify({ question: q.title, side }),
      });
    } catch(e) { console.error(e); }
  }

  return (
    <div className={`qcard ${isAnswered && !chosen ? "answered" : ""}`}>
      {isSample && <div className="sample-badge">サンプル</div>}
      {isAnswered && !chosen && <div className="answered-badge">回答済み</div>}
      <div className="qcard-title">{q.title}</div>
      <div className="qcard-choices">
        <button
          className={`qcard-btn left ${revealed && chosen !== "left" ? "unchosen" : ""} ${chosen === "left" ? "chosen" : ""}`}
          onClick={() => handleVote("left")}
          disabled={!!(chosen || isAnswered)}
        >{q.left_label}</button>
        <div className="qcard-vs">VS</div>
        <button
          className={`qcard-btn right ${revealed && chosen !== "right" ? "unchosen" : ""} ${chosen === "right" ? "chosen" : ""}`}
          onClick={() => handleVote("right")}
          disabled={!!(chosen || isAnswered)}
        >{q.right_label}</button>
      </div>
      {revealed && (
        <div className="qcard-result">
          <div className="qcard-bars">
            {[
              ["left", q.left_label, leftPct, "#ff6b35", "linear-gradient(90deg,#ff6b35,#f7931e)"],
              ["right", q.right_label, rightPct, "#4ecdc4", "linear-gradient(90deg,#4ecdc4,#44a8b3)"],
            ].map(([side, label, pct, color, grad]) => (
              <div className="bar-side" key={side}>
                <div className="bar-labels">
                  <span>{label}</span>
                  <span className="bar-pct" style={{ color }}>{pct}%</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct}%`, background: grad }} />
                </div>
              </div>
            ))}
          </div>
          <div className="qcard-meta">
            <span>{total}票</span>
            <button className="share-btn" onClick={() => onShare && onShare(q, leftPct, rightPct)}>📤 シェア</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== シェアモーダル =====
function ShareModal({ data, onClose }) {
  if (!data) return null;
  function doShare() {
    const text = `「${data.q.title}」\n${data.q.left_label} ${data.leftPct}% vs ${data.q.right_label} ${data.rightPct}%\n世間の声を聞いてみよう👇\nhttps://migimigi.vercel.app/`;
    if (navigator.share) navigator.share({ text });
    else { navigator.clipboard.writeText(text); alert("コピーしました！"); }
    onClose();
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">シェアする</div>
        <div className="share-preview">{`「${data.q.title}」\n${data.q.left_label} ${data.leftPct}% vs ${data.q.right_label} ${data.rightPct}%`}</div>
        <button className="modal-btn primary" onClick={doShare}>📤 シェア / コピー</button>
        <button className="modal-btn" onClick={onClose}>キャンセル</button>
      </div>
    </div>
  );
}

// ===== トップ画面 =====
function TopScreen({ onSearch, onPost, onMyPosts, onRanking, onAllQuestions }) {
  const [hot, setHot] = useState([]);
  const [fresh, setFresh] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answered, setAnsweredState] = useState(getAnswered());
  const [shareModal, setShareModal] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [questions, votes] = await Promise.all([
        sb("/questions?select=*&order=created_at.desc&limit=200", { headers: { Prefer: "" } }),
        sb("/votes?select=question,side", { headers: { Prefer: "" } }),
      ]);
      const voteMap = buildVoteMap(votes);
      const enriched = (questions || []).map(q => {
        const lv = voteMap[q.title]?.left || 0;
        const rv = voteMap[q.title]?.right || 0;
        return { ...q, left_votes: lv, right_votes: rv, total: lv + rv };
      });

      const sampleList = enriched.filter(q => SAMPLE_TITLES.has(q.title));
      const userList = enriched.filter(q => !SAMPLE_TITLES.has(q.title));

      setSamples(sampleList);
      setHot([...userList].sort((a, b) => b.total - a.total).slice(0, 3));
      setFresh([...userList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  return (
    <div className="screen">
      <div className="top-header">
        <div className="app-title">右左どっち？</div>
        <div className="header-actions">
          <button className="icon-btn" onClick={onSearch}>🔍</button>
          <button className="icon-btn" onClick={onMyPosts}>👤</button>
          <button className="icon-btn" onClick={onRanking}>🔥</button>
        </div>
      </div>
      <div className="scrollable">
        {loading ? <div className="loading-msg">読み込み中…</div> : (
          <>
            {hot.length > 0 && <>
              <div className="section-label">🔥 人気</div>
              {hot.map(q => <QuestionCard key={q.id} q={q} answered={answered}
                onVote={() => setAnsweredState(getAnswered())}
                onShare={(q, l, r) => setShareModal({ q, leftPct: l, rightPct: r })} />)}
            </>}

            {fresh.length > 0 && <>
              <div className="section-label">🆕 新着</div>
              {fresh.map(q => <QuestionCard key={q.id} q={q} answered={answered}
                onVote={() => setAnsweredState(getAnswered())}
                onShare={(q, l, r) => setShareModal({ q, leftPct: l, rightPct: r })} />)}
            </>}

            <button className="all-questions-btn" onClick={onAllQuestions}>
              💬 みんなが作った質問をもっと見る →
            </button>

            <div className="section-label">📝 サンプル</div>
            {samples.map(q => <QuestionCard key={q.id} q={q} answered={{}} isSample={true}
              onShare={(q, l, r) => setShareModal({ q, leftPct: l, rightPct: r })} />)}
          </>
        )}
        <div style={{ height: 80 }} />
      </div>
      <button className="post-fab" onClick={onPost}>＋ 投稿する</button>
      <ShareModal data={shareModal} onClose={() => setShareModal(null)} />
    </div>
  );
}

// ===== 検索画面 =====
function SearchScreen({ onBack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [answered, setAnsweredState] = useState(getAnswered());
  const [shareModal, setShareModal] = useState(null);

  async function search(q) {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const [questions, votes] = await Promise.all([
        sb(`/questions?title=ilike.*${encodeURIComponent(q)}*&select=*&limit=20`, { headers: { Prefer: "" } }),
        sb("/votes?select=question,side", { headers: { Prefer: "" } }),
      ]);
      const voteMap = buildVoteMap(votes);
      setResults((questions || []).map(q => ({
        ...q,
        left_votes: voteMap[q.title]?.left || 0,
        right_votes: voteMap[q.title]?.right || 0,
      })));
    } catch (e) {}
    setLoading(false);
  }

  return (
    <div className="screen">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <input className="search-input" placeholder="キーワードで検索…" value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }} autoFocus />
      </div>
      <div className="scrollable">
        {loading ? <div className="loading-msg">検索中…</div>
          : results.length === 0 && query ? <div className="loading-msg">見つかりませんでした</div>
          : results.map(q => {
            const isSample = SAMPLE_TITLES.has(q.title);
            return <QuestionCard key={q.id} q={q}
              answered={isSample ? {} : answered}
              isSample={isSample}
              onVote={() => setAnsweredState(getAnswered())}
              onShare={(q, l, r) => setShareModal({ q, leftPct: l, rightPct: r })} />;
          })}
      </div>
      <ShareModal data={shareModal} onClose={() => setShareModal(null)} />
    </div>
  );
}

// ===== 投稿画面 =====
function PostScreen({ onBack }) {
  const [title, setTitle] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(false);

  async function handlePost() {
    if (!title.trim() || !left.trim() || !right.trim()) return;
    setPosting(true);
    try {
      const result = await sb("/questions", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), left_label: left.trim(), right_label: right.trim() }),
      });
      const MY_POSTS_KEY = "migimigi_myposts";
      const ids = JSON.parse(localStorage.getItem(MY_POSTS_KEY) || "[]");
      if (result && result[0]) ids.push(result[0].id);
      localStorage.setItem(MY_POSTS_KEY, JSON.stringify(ids));
      setDone(true);
      setTimeout(() => onBack(), 1400);
    } catch (e) { alert("投稿に失敗しました"); }
    setPosting(false);
  }

  return (
    <div className="screen">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="sub-title">投稿する</div>
      </div>
      <div className="scrollable post-form">
        {done ? <div className="done-msg">✅ 投稿しました！</div> : (
          <>
            <div>
              <div className="form-label">テーマ</div>
              <input className="form-input" placeholder="〇〇といえば？" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-col">
                <div className="form-label left-label">左の選択肢</div>
                <input className="form-input" placeholder="コーラ" value={left} onChange={e => setLeft(e.target.value)} />
              </div>
              <div className="vs-label">VS</div>
              <div className="form-col">
                <div className="form-label right-label">右の選択肢</div>
                <input className="form-input" placeholder="サイダー" value={right} onChange={e => setRight(e.target.value)} />
              </div>
            </div>
            <div className="form-label">プレビュー</div>
            <div className="preview-card">
              <div className="preview-title">{title || "テーマ"}</div>
              <div className="preview-choices">
                <div className="preview-btn left">{left || "左"}</div>
                <div className="preview-vs">VS</div>
                <div className="preview-btn right">{right || "右"}</div>
              </div>
            </div>
            <button className={`post-submit ${(!title || !left || !right) ? "disabled" : ""}`}
              onClick={handlePost} disabled={posting || !title || !left || !right}>
              {posting ? "投稿中…" : "投稿する"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ===== ランキング画面 =====
function RankingScreen({ onBack }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [questions, votes] = await Promise.all([
          sb("/questions?select=*", { headers: { Prefer: "" } }),
          sb("/votes?select=question,side", { headers: { Prefer: "" } }),
        ]);
        const voteMap = buildVoteMap(votes);
        const enriched = (questions || []).map(q => {
          const lv = voteMap[q.title]?.left || 0;
          const rv = voteMap[q.title]?.right || 0;
          const { leftPct, rightPct } = calcPct(lv, rv);
          return { ...q, left_votes: lv, right_votes: rv, total: lv + rv, leftPct, rightPct };
        }).sort((a, b) => b.total - a.total);
        setRanking(enriched);
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="screen">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="sub-title">🔥 人気ランキング</div>
      </div>
      <div className="scrollable">
        {loading ? <div className="loading-msg">読み込み中…</div> : ranking.map((r, i) => (
          <div className="rank-item" key={r.id}>
            <div className="rank-top">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-q">{r.title}</span>
              <span className="rank-total">{r.total}票</span>
            </div>
            <div className="rank-bars">
              {[
                ["left", r.left_label, r.leftPct, "#ff6b35", "linear-gradient(90deg,#ff6b35,#f7931e)"],
                ["right", r.right_label, r.rightPct, "#4ecdc4", "linear-gradient(90deg,#4ecdc4,#44a8b3)"],
              ].map(([side, label, pct, color, grad]) => (
                <div className="rank-bar-wrap" key={side}>
                  <div className="rank-bar-labels">
                    <span>{label}</span>
                    <span style={{ color }}>{pct}%</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: grad }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== みんなの質問一覧画面 =====
function AllQuestionsScreen({ onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answered, setAnsweredState] = useState(getAnswered());
  const [shareModal, setShareModal] = useState(null);
  const [sort, setSort] = useState("new"); // "new" | "hot"

  useEffect(() => {
    async function load() {
      try {
        const [qs, votes] = await Promise.all([
          sb("/questions?select=*&order=created_at.desc&limit=200", { headers: { Prefer: "" } }),
          sb("/votes?select=question,side", { headers: { Prefer: "" } }),
        ]);
        const voteMap = buildVoteMap(votes);
        const userList = (qs || [])
          .filter(q => !SAMPLE_TITLES.has(q.title))
          .map(q => ({
            ...q,
            left_votes: voteMap[q.title]?.left || 0,
            right_votes: voteMap[q.title]?.right || 0,
            total: (voteMap[q.title]?.left || 0) + (voteMap[q.title]?.right || 0),
          }));
        setQuestions(userList);
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, []);

  const sorted = sort === "hot"
    ? [...questions].sort((a, b) => b.total - a.total)
    : [...questions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="screen">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="sub-title">💬 みんなの質問</div>
        <div className="sort-tabs">
          <button className={`sort-tab ${sort === "new" ? "active" : ""}`} onClick={() => setSort("new")}>新着</button>
          <button className={`sort-tab ${sort === "hot" ? "active" : ""}`} onClick={() => setSort("hot")}>人気</button>
        </div>
      </div>
      <div className="scrollable">
        {loading ? <div className="loading-msg">読み込み中…</div>
          : sorted.length === 0 ? <div className="loading-msg">まだ質問がありません</div>
          : sorted.map(q => (
            <QuestionCard key={q.id} q={q} answered={answered}
              onVote={() => setAnsweredState(getAnswered())}
              onShare={(q, l, r) => setShareModal({ q, leftPct: l, rightPct: r })} />
          ))}
      </div>
      <ShareModal data={shareModal} onClose={() => setShareModal(null)} />
    </div>
  );
}

// ===== 自分の投稿画面 =====
function MyPostsScreen({ onBack }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answered, setAnsweredState] = useState(getAnswered());
  const [shareModal, setShareModal] = useState(null);

  useEffect(() => {
    async function load() {
      const myIds = JSON.parse(localStorage.getItem("migimigi_myposts") || "[]");
      if (!myIds.length) { setLoading(false); return; }
      try {
        const [questions, votes] = await Promise.all([
          sb(`/questions?id=in.(${myIds.join(",")})&select=*`, { headers: { Prefer: "" } }),
          sb("/votes?select=question,side", { headers: { Prefer: "" } }),
        ]);
        const voteMap = buildVoteMap(votes);
        setPosts((questions || []).map(q => ({
          ...q,
          left_votes: voteMap[q.title]?.left || 0,
          right_votes: voteMap[q.title]?.right || 0,
        })));
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="screen">
      <div className="sub-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="sub-title">👤 自分の投稿</div>
      </div>
      <div className="scrollable">
        {loading ? <div className="loading-msg">読み込み中…</div>
          : posts.length === 0 ? <div className="loading-msg">まだ投稿がありません</div>
          : posts.map(q => <QuestionCard key={q.id} q={q} answered={answered}
              onVote={() => setAnsweredState(getAnswered())}
              onShare={(q, l, r) => setShareModal({ q, leftPct: l, rightPct: r })} />)}
      </div>
      <ShareModal data={shareModal} onClose={() => setShareModal(null)} />
    </div>
  );
}

// ===== メイン =====
export default function App() {
  const [screen, setScreen] = useState("top");
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #0f0f1a; }
        body { font-family: 'Zen Maru Gothic', sans-serif; color: white; overscroll-behavior: none; }

        .screen { width: 100vw; height: 100dvh; display: flex; flex-direction: column; background: #0f0f1a; }
        .top-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
        .app-title { font-size: 20px; font-weight: 900; letter-spacing: 0.02em; }
        .header-actions { display: flex; gap: 8px; }
        .icon-btn { background: rgba(255,255,255,0.08); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
        .icon-btn:hover { background: rgba(255,255,255,0.15); }
        .sub-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
        .back-btn { background: rgba(255,255,255,0.08); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; font-size: 16px; cursor: pointer; flex-shrink: 0; }
        .sub-title { font-size: 17px; font-weight: 900; }
        .search-input { flex: 1; background: rgba(255,255,255,0.08); border: none; color: white; border-radius: 20px; padding: 10px 16px; font-family: 'Zen Maru Gothic', sans-serif; font-size: 15px; outline: none; }
        .search-input::placeholder { color: rgba(255,255,255,0.3); }
        .scrollable { flex: 1; overflow-y: auto; padding: 12px 16px 80px; }
        .section-label { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; opacity: 0.45; text-transform: uppercase; margin: 20px 4px 10px; }
        .loading-msg { text-align: center; opacity: 0.4; margin-top: 60px; font-size: 15px; }

        .qcard { background: rgba(255,255,255,0.05); border-radius: 20px; padding: 18px; margin-bottom: 12px; position: relative; border: 1px solid rgba(255,255,255,0.06); transition: opacity 0.3s; animation: fadeUp 0.3s ease both; }
        .qcard.answered { opacity: 0.4; }
        .qcard-title { font-size: 16px; font-weight: 900; margin-bottom: 14px; line-height: 1.4; }
        .qcard-choices { display: flex; gap: 10px; align-items: center; }
        .qcard-btn { flex: 1; min-height: 72px; border: none; border-radius: 14px; font-family: 'Zen Maru Gothic', sans-serif; font-size: clamp(14px,4vw,20px); font-weight: 900; color: white; cursor: pointer; transition: transform 0.15s, opacity 0.3s; }
        .qcard-btn.left { background: linear-gradient(135deg,#ff6b35,#f7931e); }
        .qcard-btn.right { background: linear-gradient(135deg,#4ecdc4,#44a8b3); }
        .qcard-btn:hover:not(:disabled) { transform: scale(1.03); }
        .qcard-btn:active:not(:disabled) { transform: scale(0.97); }
        .qcard-btn.unchosen { opacity: 0.3; transform: scale(0.95); }
        .qcard-btn.chosen { transform: scale(1.04); }
        .qcard-vs { width: 36px; height: 36px; flex-shrink: 0; background: #0f0f1a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; }
        .qcard-result { margin-top: 14px; animation: fadeUp 0.3s ease both; }
        .qcard-bars { display: flex; flex-direction: column; gap: 8px; }
        .bar-labels { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 4px; }
        .bar-pct { font-size: 16px; font-weight: 900; }
        .bar-track { height: 10px; border-radius: 5px; background: rgba(255,255,255,0.1); overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 5px; transition: width 0.8s cubic-bezier(0.34,1.56,0.64,1); }
        .qcard-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; opacity: 0.5; }
        .share-btn { background: rgba(255,255,255,0.08); border: none; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; font-family: 'Zen Maru Gothic', sans-serif; font-weight: 700; }
        .share-btn:hover { background: rgba(255,255,255,0.15); }
        .answered-badge { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.08); border-radius: 10px; padding: 3px 10px; font-size: 11px; font-weight: 700; opacity: 0.6; }
        .sample-badge { position: absolute; top: 12px; right: 12px; background: rgba(255,107,53,0.2); color: #ff6b35; border-radius: 10px; padding: 3px 10px; font-size: 11px; font-weight: 700; }

        .post-fab { position: fixed; bottom: 24px; right: 20px; background: linear-gradient(135deg,#ff6b35,#f7931e); border: none; color: white; border-radius: 50px; padding: 16px 24px; font-family: 'Zen Maru Gothic', sans-serif; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 6px 24px rgba(255,107,53,0.5); transition: transform 0.15s; z-index: 10; }
        .post-fab:hover { transform: scale(1.05); }

        .post-form { display: flex; flex-direction: column; gap: 18px; padding: 20px 16px 80px; }
        .form-label { font-size: 13px; font-weight: 700; opacity: 0.6; margin-bottom: 6px; }
        .form-label.left-label { color: #ff6b35; opacity: 1; }
        .form-label.right-label { color: #4ecdc4; opacity: 1; }
        .form-input { width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 14px; padding: 14px 16px; font-family: 'Zen Maru Gothic', sans-serif; font-size: 15px; outline: none; }
        .form-input::placeholder { color: rgba(255,255,255,0.25); }
        .form-row { display: flex; gap: 10px; align-items: center; }
        .form-col { flex: 1; }
        .vs-label { font-weight: 900; opacity: 0.4; flex-shrink: 0; font-size: 13px; }
        .preview-card { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; }
        .preview-title { font-size: 15px; font-weight: 900; margin-bottom: 12px; opacity: 0.8; }
        .preview-choices { display: flex; gap: 8px; align-items: center; }
        .preview-btn { flex: 1; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: white; }
        .preview-btn.left { background: linear-gradient(135deg,#ff6b35,#f7931e); }
        .preview-btn.right { background: linear-gradient(135deg,#4ecdc4,#44a8b3); }
        .preview-vs { font-weight: 900; opacity: 0.4; font-size: 12px; }
        .post-submit { background: linear-gradient(135deg,#ff6b35,#f7931e); border: none; color: white; border-radius: 50px; padding: 18px; font-family: 'Zen Maru Gothic', sans-serif; font-size: 17px; font-weight: 900; cursor: pointer; transition: opacity 0.2s; }
        .post-submit.disabled { opacity: 0.4; }
        .done-msg { text-align: center; font-size: 20px; font-weight: 900; margin-top: 80px; }

        .rank-item { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
        .rank-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .rank-num { font-size: 20px; font-weight: 900; opacity: 0.3; width: 36px; }
        .rank-q { flex: 1; font-size: 14px; font-weight: 700; }
        .rank-total { font-size: 12px; opacity: 0.4; }
        .rank-bars { display: flex; flex-direction: column; gap: 8px; }
        .rank-bar-wrap {}
        .rank-bar-labels { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 4px; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 100; animation: fadeIn 0.2s ease both; }
        .modal { background: #1e1e2e; border-radius: 24px 24px 0 0; padding: 24px 20px 40px; width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 12px; animation: slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
        .modal-title { font-size: 18px; font-weight: 900; text-align: center; margin-bottom: 4px; }
        .share-preview { background: rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; opacity: 0.8; }
        .modal-btn { width: 100%; padding: 16px; border: none; border-radius: 14px; font-family: 'Zen Maru Gothic', sans-serif; font-size: 16px; font-weight: 900; cursor: pointer; background: rgba(255,255,255,0.08); color: white; }
        .modal-btn.primary { background: linear-gradient(135deg,#ff6b35,#f7931e); }

        .all-questions-btn {
          width: 100%; margin: 8px 0 4px; padding: 18px;
          background: rgba(255,255,255,0.06);
          border: 1.5px dashed rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7); border-radius: 16px;
          font-family: 'Zen Maru Gothic', sans-serif;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .all-questions-btn:hover { background: rgba(255,255,255,0.1); color: white; }

        .sort-tabs { display: flex; gap: 6px; margin-left: auto; }
        .sort-tab { background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.5); border-radius: 20px; padding: 6px 14px; font-family: 'Zen Maru Gothic', sans-serif; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .sort-tab.active { background: linear-gradient(135deg,#ff6b35,#f7931e); color: white; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
      `}</style>

      {screen === "top"     && <TopScreen onSearch={() => setScreen("search")} onPost={() => setScreen("post")} onMyPosts={() => setScreen("myposts")} onRanking={() => setScreen("ranking")} onAllQuestions={() => setScreen("all")} />}
      {screen === "all"      && <AllQuestionsScreen onBack={() => setScreen("top")} />}
      {screen === "search"  && <SearchScreen onBack={() => setScreen("top")} />}
      {screen === "post"    && <PostScreen onBack={() => setScreen("top")} />}
      {screen === "ranking" && <RankingScreen onBack={() => setScreen("top")} />}
      {screen === "myposts" && <MyPostsScreen onBack={() => setScreen("top")} />}
    </>
  );
}