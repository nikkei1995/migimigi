import { useState, useEffect, useRef } from "react";

const QUESTIONS = [
  { title: "炭酸飲料といえば？", left: "コーラ", right: "サイダー" },
  { title: "朝ごはんといえば？", left: "パン", right: "ご飯" },
  { title: "休日の過ごし方は？", left: "家でまったり", right: "外出する" },
  { title: "カップ麺といえば？", left: "日清カップヌードル", right: "どん兵衛" },
  { title: "ペットを飼うなら？", left: "犬", right: "猫" },
  { title: "映画を見るなら？", left: "映画館", right: "自宅で配信" },
  { title: "スマホといえば？", left: "iPhone", right: "Android" },
  { title: "旅行先は？", left: "国内", right: "海外" },
];

const STORAGE_KEY = "migimigi_votes";

function getVotes() {
  try {
    const result = window.storage ? null : JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return result || {};
  } catch { return {}; }
}

export default function App() {
  const [questions, setQuestions] = useState(QUESTIONS);
  const [current, setCurrent] = useState(0);
  const [chosen, setChosen] = useState(null); // 'left' | 'right'
  const [votes, setVotes] = useState({});
  const [animating, setAnimating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bgColor, setBgColor] = useState(null); // null | 'left' | 'right'
  const [totalAnswered, setTotalAnswered] = useState(0);

  const q = questions[current];
  const qKey = q ? `${q.title}` : null;
  const leftVotes = qKey && votes[qKey] ? (votes[qKey].left || 0) : 0;
  const rightVotes = qKey && votes[qKey] ? (votes[qKey].right || 0) : 0;
  const totalVotes = leftVotes + rightVotes;
  const leftPct = totalVotes ? Math.round((leftVotes / totalVotes) * 100) : 50;
  const rightPct = totalVotes ? 100 - leftPct : 50;

  // Load votes from storage on mount
  useEffect(() => {
    async function loadVotes() {
      try {
        if (window.storage) {
          const result = await window.storage.get(STORAGE_KEY);
          if (result) setVotes(JSON.parse(result.value));
        } else {
          setVotes(getVotes());
        }
      } catch (e) {
        setVotes(getVotes());
      }
    }
    loadVotes();
  }, []);

  async function saveVote(qKey, side) {
    const newVotes = { ...votes };
    if (!newVotes[qKey]) newVotes[qKey] = { left: 0, right: 0 };
    newVotes[qKey][side] = (newVotes[qKey][side] || 0) + 1;
    setVotes(newVotes);
    try {
      if (window.storage) {
        await window.storage.set(STORAGE_KEY, JSON.stringify(newVotes), true);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newVotes));
      }
    } catch (e) {}
  }

  function handleChoose(side) {
    if (chosen || animating) return;
    setChosen(side);
    setBgColor(side);
    setAnimating(true);
    saveVote(qKey, side);
    setTotalAnswered(t => t + 1);
    setTimeout(() => {
      setRevealed(true);
      setAnimating(false);
    }, 600);
  }

  function handleNext() {
    if (current < questions.length - 1) {
      setAnimating(true);
      setBgColor(null);
      setTimeout(() => {
        setCurrent(c => c + 1);
        setChosen(null);
        setRevealed(false);
        setAnimating(false);
      }, 400);
    } else {
      // Load new AI question
      generateQuestion();
    }
  }

  async function generateQuestion() {
    setAiLoading(true);
    try {
      const used = questions.map(q => q.title).join(", ");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `日本語で「右か左か」ゲームの新しい質問を1つ作って。以下の形式のJSONのみ返して(マークダウン不要):\n{"title":"〇〇といえば？","left":"選択肢A","right":"選択肢B"}\n\n既に使われた質問: ${used}\n\n身近な話題で、どちらかを選びたくなる面白い対立にして。`
          }]
        })
      });
      const data = await response.json();
      const text = data.content.map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const newQ = JSON.parse(clean);
      setQuestions(qs => [...qs, newQ]);
      setAnimating(true);
      setBgColor(null);
      setTimeout(() => {
        setCurrent(questions.length);
        setChosen(null);
        setRevealed(false);
        setAnimating(false);
        setAiLoading(false);
      }, 400);
    } catch (e) {
      // fallback: restart
      setAiLoading(false);
      setCurrent(0);
      setChosen(null);
      setRevealed(false);
      setBgColor(null);
    }
  }

  const isLast = current === questions.length - 1;

  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "'Zen Maru Gothic', 'Noto Sans JP', sans-serif",
      background: bgColor === 'left' ? '#ff6b35' : bgColor === 'right' ? '#4ecdc4' : '#1a1a2e',
      transition: "background 0.5s ease",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      position: "relative",
      overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=Noto+Sans+JP:wght@400;700&display=swap');
        
        * { box-sizing: border-box; }
        
        .btn-choice {
          flex: 1;
          padding: 32px 20px;
          border: none;
          cursor: pointer;
          font-family: 'Zen Maru Gothic', sans-serif;
          font-size: clamp(22px, 5vw, 42px);
          font-weight: 900;
          color: white;
          border-radius: 20px;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.3s;
          position: relative;
          overflow: hidden;
          min-width: 0;
          letter-spacing: 0.03em;
        }
        .btn-choice:hover:not(:disabled) {
          transform: scale(1.04) translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        }
        .btn-choice:active:not(:disabled) {
          transform: scale(0.97);
        }
        .btn-left {
          background: linear-gradient(135deg, #ff6b35, #f7931e);
          box-shadow: 0 6px 24px rgba(255,107,53,0.4);
        }
        .btn-right {
          background: linear-gradient(135deg, #4ecdc4, #44a8b3);
          box-shadow: 0 6px 24px rgba(78,205,196,0.4);
        }
        .btn-choice.unchosen {
          opacity: 0.35;
          transform: scale(0.95);
        }
        .btn-choice.chosen {
          transform: scale(1.06) translateY(-5px);
          box-shadow: 0 16px 50px rgba(0,0,0,0.4);
        }
        .bar-fill {
          transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .next-btn {
          background: white;
          color: #1a1a2e;
          border: none;
          border-radius: 50px;
          padding: 16px 40px;
          font-family: 'Zen Maru Gothic', sans-serif;
          font-weight: 900;
          font-size: 18px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          margin-top: 24px;
          animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .next-btn:hover {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        .result-section {
          animation: fadeSlideUp 0.5s ease both;
          width: 100%;
        }
        .title-area {
          animation: fadeSlideUp 0.4s ease both;
        }
        .vs-badge {
          width: 52px;
          height: 52px;
          background: #1a1a2e;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 16px;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          font-family: 'Zen Maru Gothic', sans-serif;
          z-index: 2;
        }
        .deco-circle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.08;
          pointer-events: none;
        }
        .counter {
          position: absolute;
          top: 20px;
          right: 20px;
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
        }
      `}</style>

      {/* Decorative background circles */}
      <div className="deco-circle" style={{ width: 400, height: 400, background: 'white', top: -100, left: -150, animation: 'float 8s ease-in-out infinite' }} />
      <div className="deco-circle" style={{ width: 250, height: 250, background: 'white', bottom: -80, right: -80, animation: 'float 6s ease-in-out infinite reverse' }} />

      <div className="counter">Q {current + 1} / {questions.length}</div>

      <div style={{
        width: "100%",
        maxWidth: 640,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
        opacity: animating ? 0 : 1,
        transform: animating ? 'translateY(20px)' : 'translateY(0)',
        transition: "opacity 0.3s, transform 0.3s"
      }}>

        {/* Title */}
        <div className="title-area" style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-block",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
            borderRadius: 16,
            padding: "8px 20px",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.15em",
            marginBottom: 14,
            textTransform: "uppercase"
          }}>どっちを選ぶ？</div>
          <h1 style={{
            color: "white",
            fontSize: "clamp(26px, 6vw, 48px)",
            fontWeight: 900,
            margin: 0,
            textShadow: "0 3px 20px rgba(0,0,0,0.3)",
            lineHeight: 1.3,
            fontFamily: "'Zen Maru Gothic', sans-serif",
            letterSpacing: "0.02em"
          }}>{q?.title}</h1>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 16, width: "100%", alignItems: "center" }}>
          <button
            className={`btn-choice btn-left ${revealed && chosen !== 'left' ? 'unchosen' : ''} ${revealed && chosen === 'left' ? 'chosen' : ''}`}
            onClick={() => handleChoose('left')}
            disabled={!!chosen}
          >
            {q?.left}
          </button>

          <div className="vs-badge">VS</div>

          <button
            className={`btn-choice btn-right ${revealed && chosen !== 'right' ? 'unchosen' : ''} ${revealed && chosen === 'right' ? 'chosen' : ''}`}
            onClick={() => handleChoose('right')}
            disabled={!!chosen}
          >
            {q?.right}
          </button>
        </div>

        {/* Results */}
        {revealed && (
          <div className="result-section">
            <div style={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              borderRadius: 20,
              padding: "20px 24px",
              color: "white"
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.7, textAlign: "center", marginBottom: 16, textTransform: "uppercase" }}>
                みんなの結果 ({totalVotes}票)
              </div>

              {/* Left bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14, fontWeight: 700 }}>
                  <span>{q?.left}</span>
                  <span style={{ fontSize: 20, fontWeight: 900 }}>{leftPct}%</span>
                </div>
                <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                  <div className="bar-fill" style={{ height: "100%", width: `${leftPct}%`, background: "linear-gradient(90deg,#ff6b35,#f7931e)", borderRadius: 6 }} />
                </div>
              </div>

              {/* Right bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14, fontWeight: 700 }}>
                  <span>{q?.right}</span>
                  <span style={{ fontSize: 20, fontWeight: 900 }}>{rightPct}%</span>
                </div>
                <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                  <div className="bar-fill" style={{ height: "100%", width: `${rightPct}%`, background: "linear-gradient(90deg,#4ecdc4,#44a8b3)", borderRadius: 6 }} />
                </div>
              </div>

              <div style={{ marginTop: 14, textAlign: "center", fontSize: 14, opacity: 0.7 }}>
                あなたは <strong style={{ opacity: 1, fontSize: 16 }}>「{chosen === 'left' ? q?.left : q?.right}」</strong> を選びました
                {" "}{leftPct === rightPct ? "🤝 同率！" : (chosen === 'left' ? leftPct : rightPct) > 50 ? "👏 多数派！" : "🦄 少数派！"}
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              {aiLoading ? (
                <div style={{ color: "rgba(255,255,255,0.7)", marginTop: 24, fontSize: 15, fontWeight: 700 }}>
                  AIが次の問題を考え中… 🤔
                </div>
              ) : (
                <button className="next-btn" onClick={handleNext}>
                  {isLast ? "AIに次の問題を作ってもらう ✨" : "次の問題へ →"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
