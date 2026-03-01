import { useState, useEffect } from "react";

const QUESTIONS = [
  { title: "炭酸飲料といえば？", left: "コーラ", right: "サイダー" },
  { title: "朝ごはんといえば？", left: "パン", right: "ご飯" },
  { title: "休日の過ごし方は？", left: "家でまったり", right: "外出する" },
  { title: "カップ麺といえば？", left: "カップヌードル", right: "どん兵衛" },
  { title: "ペットを飼うなら？", left: "犬", right: "猫" },
  { title: "映画を見るなら？", left: "映画館", right: "自宅で配信" },
  { title: "スマホといえば？", left: "iPhone", right: "Android" },
  { title: "旅行先は？", left: "国内", right: "海外" },
];

const STORAGE_KEY = "migimigi_votes";

export default function App() {
  const [questions, setQuestions] = useState(QUESTIONS);
  const [current, setCurrent] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [votes, setVotes] = useState({});
  const [animating, setAnimating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bgSide, setBgSide] = useState(null);

  const q = questions[current];
  const qKey = q?.title;
  const leftVotes = votes[qKey]?.left || 0;
  const rightVotes = votes[qKey]?.right || 0;
  const totalVotes = leftVotes + rightVotes;
  const leftPct = totalVotes ? Math.round((leftVotes / totalVotes) * 100) : 50;
  const rightPct = totalVotes ? 100 - leftPct : 50;

  useEffect(() => {
    async function loadVotes() {
      try {
        if (window.storage) {
          const result = await window.storage.get(STORAGE_KEY);
          if (result) setVotes(JSON.parse(result.value));
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setVotes(JSON.parse(saved));
        }
      } catch (e) {}
    }
    loadVotes();
  }, []);

  async function saveVote(key, side) {
    const newVotes = { ...votes };
    if (!newVotes[key]) newVotes[key] = { left: 0, right: 0 };
    newVotes[key][side]++;
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
    setBgSide(side);
    setAnimating(true);
    saveVote(qKey, side);
    setTimeout(() => {
      setRevealed(true);
      setAnimating(false);
    }, 600);
  }

  function handleNext() {
    if (current < questions.length - 1) {
      setAnimating(true);
      setBgSide(null);
      setTimeout(() => {
        setCurrent(c => c + 1);
        setChosen(null);
        setRevealed(false);
        setAnimating(false);
      }, 400);
    } else {
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
      setBgSide(null);
      setTimeout(() => {
        setCurrent(questions.length);
        setChosen(null);
        setRevealed(false);
        setAnimating(false);
        setAiLoading(false);
      }, 400);
    } catch (e) {
      setAiLoading(false);
      setCurrent(0);
      setChosen(null);
      setRevealed(false);
      setBgSide(null);
    }
  }

  const bg = bgSide === 'left' ? '#ff6b35' : bgSide === 'right' ? '#4ecdc4' : '#1a1a2e';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body, #root {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        body {
          font-family: 'Zen Maru Gothic', sans-serif;
          overscroll-behavior: none;
        }

        .app {
          width: 100vw;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          position: relative;
          overflow: hidden;
          transition: background 0.5s ease;
        }

        .counter {
          position: absolute;
          top: 16px;
          right: 20px;
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .deco {
          position: absolute;
          border-radius: 50%;
          background: white;
          opacity: 0.06;
          pointer-events: none;
        }

        .inner {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          transition: opacity 0.3s, transform 0.3s;
        }

        .label {
          background: rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 6px 18px;
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .title {
          color: white;
          font-size: clamp(28px, 7vw, 48px);
          font-weight: 900;
          text-align: center;
          line-height: 1.3;
          text-shadow: 0 3px 20px rgba(0,0,0,0.3);
        }

        .choices {
          width: 100%;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .btn {
          flex: 1;
          min-height: 120px;
          border: none;
          border-radius: 20px;
          font-family: 'Zen Maru Gothic', sans-serif;
          font-size: clamp(20px, 5vw, 36px);
          font-weight: 900;
          color: white;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.3s;
          letter-spacing: 0.03em;
        }

        .btn-left {
          background: linear-gradient(135deg, #ff6b35, #f7931e);
          box-shadow: 0 6px 24px rgba(255,107,53,0.5);
        }

        .btn-right {
          background: linear-gradient(135deg, #4ecdc4, #44a8b3);
          box-shadow: 0 6px 24px rgba(78,205,196,0.5);
        }

        .btn:hover:not(:disabled) { transform: scale(1.04) translateY(-3px); }
        .btn:active:not(:disabled) { transform: scale(0.96); }
        .btn.unchosen { opacity: 0.3; transform: scale(0.93); }
        .btn.chosen { transform: scale(1.06) translateY(-4px); }

        .vs {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          background: #1a1a2e;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }

        .result {
          width: 100%;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(12px);
          border-radius: 20px;
          padding: 20px;
          color: white;
          animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .result-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          opacity: 0.7;
          text-align: center;
          margin-bottom: 16px;
          text-transform: uppercase;
        }

        .bar-row { margin-bottom: 10px; }

        .bar-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 700;
        }

        .bar-pct { font-size: 20px; font-weight: 900; }

        .bar-track {
          height: 12px;
          border-radius: 6px;
          background: rgba(255,255,255,0.15);
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.8s cubic-bezier(0.34,1.56,0.64,1);
        }

        .result-msg {
          margin-top: 14px;
          text-align: center;
          font-size: 14px;
          opacity: 0.8;
        }

        .next-btn {
          background: white;
          color: #1a1a2e;
          border: none;
          border-radius: 50px;
          padding: 16px 40px;
          font-family: 'Zen Maru Gothic', sans-serif;
          font-weight: 900;
          font-size: 17px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .next-btn:hover {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        }

        .loading {
          color: rgba(255,255,255,0.7);
          font-size: 15px;
          font-weight: 700;
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="app" style={{ background: bg }}>
        <div className="deco" style={{ width: 350, height: 350, top: -120, left: -120 }} />
        <div className="deco" style={{ width: 250, height: 250, bottom: -80, right: -80 }} />

        <div className="counter">Q {current + 1} / {questions.length}</div>

        <div className="inner" style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(20px)' : 'translateY(0)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="label">どっちを選ぶ？</div>
            <h1 className="title" style={{ marginTop: 12 }}>{q?.title}</h1>
          </div>

          <div className="choices">
            <button
              className={`btn btn-left ${revealed && chosen !== 'left' ? 'unchosen' : ''} ${revealed && chosen === 'left' ? 'chosen' : ''}`}
              onClick={() => handleChoose('left')}
              disabled={!!chosen}
            >{q?.left}</button>

            <div className="vs">VS</div>

            <button
              className={`btn btn-right ${revealed && chosen !== 'right' ? 'unchosen' : ''} ${revealed && chosen === 'right' ? 'chosen' : ''}`}
              onClick={() => handleChoose('right')}
              disabled={!!chosen}
            >{q?.right}</button>
          </div>

          {revealed && (
            <>
              <div className="result">
                <div className="result-label">みんなの結果（{totalVotes}票）</div>

                <div className="bar-row">
                  <div className="bar-header">
                    <span>{q?.left}</span>
                    <span className="bar-pct">{leftPct}%</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${leftPct}%`, background: 'linear-gradient(90deg,#ff6b35,#f7931e)' }} />
                  </div>
                </div>

                <div className="bar-row">
                  <div className="bar-header">
                    <span>{q?.right}</span>
                    <span className="bar-pct">{rightPct}%</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${rightPct}%`, background: 'linear-gradient(90deg,#4ecdc4,#44a8b3)' }} />
                  </div>
                </div>

                <div className="result-msg">
                  あなたは <strong>「{chosen === 'left' ? q?.left : q?.right}」</strong> を選びました
                  {" "}{leftPct === rightPct ? "🤝 同率！" : (chosen === 'left' ? leftPct : rightPct) > 50 ? "👏 多数派！" : "🦄 少数派！"}
                </div>
              </div>

              {aiLoading ? (
                <div className="loading">AIが次の問題を考え中… 🤔</div>
              ) : (
                <button className="next-btn" onClick={handleNext}>
                  {current === questions.length - 1 ? "AIに次を作ってもらう ✨" : "次の問題へ →"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}