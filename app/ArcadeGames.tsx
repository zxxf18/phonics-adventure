'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { makeEchoSequence, railwayDestination, rhythmGrade } from './arcade-rules';

type Sound = { symbol: string; phonemeAudio: string };
type Props = { mode: 'railway' | 'echo' | 'rhythm'; sounds: Sound[] };

// Own audio and pending sequence work so switching games cannot replay old clues.
function useGameAudio() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const [error, setError] = useState('');
  const stop = useCallback(() => { audio.current?.pause(); pending.current?.(); pending.current = null; }, []);
  useEffect(() => stop, [stop]);
  const play = useCallback((url: string) => new Promise<void>((resolve) => {
    stop();
    setError('');
    const player = new Audio(url);
    audio.current = player;
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    pending.current = done;
    player.onended = done;
    player.onerror = () => { setError('声音没有加载成功，请检查网络后重试。'); done(); };
    player.play().catch(() => { setError('请再次点击播放声音。'); done(); });
  }), [stop]);
  return { play, stop, error };
}

export function ArcadeGames({ mode, sounds }: Props) {
  const [session, setSession] = useState(0);
  return <div className="arcade-shell">
    {mode === 'railway' ? <Railway key={session} sounds={sounds} /> : mode === 'echo' ? <Echo key={session} sounds={sounds} /> : <Rhythm key={session} sounds={sounds} />}
    <button className="arcade-restart" onClick={() => setSession((value) => value + 1)}>↻ 重新开始本局</button>
    <p className="arcade-footnote">随时可以点击上方卡片换游戏。</p>
  </div>;
}

const STATION_Y = [75, 210, 345];
const TRAIN_NAMES = ['小熊', '小兔', '狐狸', '小鹿', '熊猫'];
function Railway({ sounds }: { sounds: Sound[] }) {
  const bank = [sounds[0], sounds[5], sounds[20]];
  const [upper, setUpper] = useState(false);
  const [lower, setLower] = useState(false);
  const [green, setGreen] = useState(false);
  const [active, setActive] = useState(false);
  const [train, setTrain] = useState(0);
  const [progress, setProgress] = useState(0);
  const [route, setRoute] = useState<number | null>(null);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const [delivered, setDelivered] = useState(0);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState('先听车票，再拨道岔。红灯会让列车停在路口。');
  const { play, error } = useGameAudio();
  const target = (seed + train * 2) % 3;
  const done = delivered === 5;
  const destination = railwayDestination(upper, lower);
  useEffect(() => {
    if (!active || done) return;
    const timer = setInterval(() => setProgress((value) => {
      if (!green && value >= 0.22 && value < 0.25) return value;
      return Math.min(1, value + 0.012);
    }), 65);
    return () => clearInterval(timer);
  }, [active, green, done]);
  useEffect(() => {
    if (progress < 1 || !active) return;
    const timer = window.setTimeout(() => {
      setActive(false);
      if (route === target) {
        setDelivered((value) => value + 1);
        setTrain((value) => value + 1);
        setMessage('乘客到站！下一辆车的目的地可能不同，先听新车票。');
      } else {
        setRetry((value) => value + 1);
        setMessage('送错站了，列车已返回车库。听听车票，调整道岔再试。');
      }
      setProgress(0); setRoute(null); setGreen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [progress, route, destination, active, target]);
  const currentRoute = route ?? destination;
  const depart = () => { setRoute(destination); setActive(true); };
  const x = 65 + progress * 660;
  const y = progress < .25 ? 210 : 210 + Math.min(1, (progress - .25) / .6) * (STATION_Y[currentRoute] - 210);
  return <>
    <header className="arcade-title"><span>01 / 铁路调度</span><h3>小小站长，准备发车</h3><p>拨道岔 → 检查轨道 → 放行列车。送错可以调整路线重试。</p></header>
    <div className="arcade-status"><b>🚉 到站 {delivered}/5</b><span>↻ 调整 {retry} 次</span><span>{green ? '🟢 通行' : '🔴 路口停车'}</span></div>
    {done ? <div className="arcade-finish"><span>🏅</span><h3>五位乘客都到家了！</h3><p>你完成了整个班次，调整路线 {retry} 次。</p></div> : <>
      <button className="arcade-ticket" onClick={() => void play(bank[target].phonemeAudio)}>🎫 {TRAIN_NAMES[train]}的声音车票 · 点击听目的地</button>
      <svg className="dispatch-map" viewBox="0 0 800 410" role="img" aria-label="铁路地图：上道岔通向苹果站，下道岔分开彩虹站和月亮站">
        <rect width="800" height="410" rx="25" fill="#d9eed0" />
        <path d="M0 300 Q260 245 450 320 T800 270" fill="none" stroke="#acd7ef" strokeWidth="40" />
        {[0, 1, 2].map((index) => <path key={index} d={`M65 210 H230 L660 ${STATION_Y[index]} H735`} fill="none" stroke={currentRoute === index ? '#ce8543' : '#a0b09c'} strokeWidth="12" strokeDasharray={currentRoute === index ? undefined : '9 8'} />)}
        <text x="85" y="165" fontSize="22">车库</text>
        <circle cx="205" cy="210" r="13" fill={green ? '#329b63' : '#d45353'} stroke="white" strokeWidth="4" />
        <text x="235" y="160" fontSize="18" fill="#344f40">① 上道岔</text><text x="370" y="260" fontSize="18" fill="#344f40">② 下道岔</text>
        {bank.map((sound, index) => <g key={sound.symbol}><rect x="665" y={STATION_Y[index]-42} width="120" height="70" rx="14" fill="#fffcef" /><text x="725" y={STATION_Y[index]-10} textAnchor="middle" fontSize="28">{sound.symbol}</text><text x="725" y={STATION_Y[index]+16} textAnchor="middle" fontSize="16">{['苹果站','彩虹站','月亮站'][index]}</text></g>)}
        <text x={x} y={y-8} textAnchor="middle" fontSize="44">🚂</text>
      </svg>
      <div className="arcade-controls"><button disabled={route !== null} onClick={() => setUpper(!upper)}>① {upper ? '转向苹果站' : '通往下道岔'}</button><button disabled={route !== null || upper} onClick={() => setLower(!lower)}>② {lower ? '转向彩虹站' : '转向月亮站'}</button><button onClick={() => setGreen(!green)}>{green ? '🔴 关闭信号' : '🟢 放行'}</button><button disabled={active} onClick={depart}>🚂 从车库发车</button></div>
      <div className="arcade-samples">{bank.map((sound, index) => <button key={sound.symbol} onClick={() => void play(sound.phonemeAudio)}>试听{['苹果','彩虹','月亮'][index]}站 {sound.symbol}</button>)}</div>
    </>}
    <p className="arcade-message" role="status">{error || message}</p>
  </>;
}

function Echo({ sounds }: { sounds: Sound[] }) {
  const bank = [sounds[0], sounds[5], sounds[20]];
  const [seed] = useState(() => Math.floor(Math.random()*100000));
  const [level, setLevel] = useState(1);
  const [steps, setSteps] = useState<number[]>([]);
  const [lit, setLit] = useState(-1);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState(false);
  const [message, setMessage] = useState('先听机关的回声，再敲相同的顺序。可以重复敲同一块石头。');
  const generation = useRef(0);
  const busy = useRef(false);
  const { play, stop, error } = useGameAudio();
  const sequence = makeEchoSequence(level, seed + level);
  const done = level > 4;
  useEffect(() => () => { generation.current += 1; }, []);
  async function listen() {
    if (busy.current || done) return;
    busy.current = true; setListening(true); setSteps([]); setHeard(false);
    const version = ++generation.current;
    for (const index of sequence) {
      if (generation.current !== version) return;
      setLit(index); await play(bank[index].phonemeAudio);
      if (generation.current !== version) return;
      setLit(-1); await new Promise((resolve) => setTimeout(resolve, 280));
    }
    if (generation.current !== version) return;
    setListening(false); setHeard(true); busy.current = false;
  }
  function tap(index: number) {
    if (!heard || listening || done) return;
    void play(bank[index].phonemeAudio);
    if (index !== sequence[steps.length]) { setSteps([]); setMessage('机关轻轻摇头：顺序不同。可以再听一遍，从第一声重试。'); return; }
    const next = [...steps, index];
    if (next.length === sequence.length) { stop(); setLevel(level + 1); setSteps([]); setHeard(false); setMessage('门开啦！伙伴又前进了一站。下一扇门会多一声回响。'); }
    else { setSteps(next); setMessage(`已经记住 ${next.length} 声，继续！`); }
  }
  return <>
    <header className="arcade-title"><span>02 / 回声机关</span><h3>敲开森林的回声门</h3><p>听完整段回声，再用声音石复现。失败可重试，不扣生命。</p></header>
    <div className="echo-doors">{['🌿','🌼','🍄','🏠'].map((icon, index) => <span key={icon} className={level > index + 1 ? 'unlocked' : ''}>{level > index + 1 ? '🔓' : '🔒'}{icon}</span>)}</div>
    {done ? <div className="arcade-finish"><span>🐰</span><h3>所有机关门都打开了！</h3><p>小兔回家了，你完成了 3 到 6 声的记忆挑战。</p></div> : <>
      <button className="arcade-ticket" disabled={listening} onClick={() => void listen()}>{listening ? '👂 正在播放，认真听…' : '🔊 听机关的完整回声'}</button>
      <div className="echo-sequence">{sequence.map((_, index) => <span key={index} className={index < steps.length ? 'filled' : ''}>{index < steps.length ? '✓' : '·'}</span>)}</div>
      <div className="arcade-pads">{bank.map((sound, index) => <button key={sound.symbol} className={lit === index ? 'lit' : ''} disabled={listening || !heard} onClick={() => tap(index)}><b>{['🪨','💎','🌙'][index]}</b>{sound.symbol}</button>)}</div>
    </>}
    <p className="arcade-message" role="status">{error || message}</p>
  </>;
}

function Rhythm({ sounds }: { sounds: Sound[] }) {
  const bank = [sounds[0], sounds[5], sounds[20]];
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hits, setHits] = useState<Record<number, string>>({});
  const [message, setMessage] = useState('先试听三个鼓垫。开始后，音符落到金线附近时敲对应的鼓。');
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(0);
  const elapsedRef = useRef(0);
  const hitsRef = useRef<Record<number, string>>({});
  const { play, error } = useGameAudio();
  const notes = [0,1,2,0,2,1,1,0,2,0,1,2];
  const done = elapsed > 15500;
  useEffect(() => {
    if (!started || paused || done) return;
    let frame = 0;
    function tick(now: number) { const value = now - startedAt.current; elapsedRef.current = value; setElapsed(value); if (value <= 15500) frame = requestAnimationFrame(tick); }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, paused, done]);
  useEffect(() => { const hide = () => { if (document.hidden && started) setPaused(true); }; document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide); }, [started]);
  function hit(lane: number) {
    void play(bank[lane].phonemeAudio);
    if (!started || paused || done) return;
    const candidate = notes.findIndex((value, index) => value === lane && !hitsRef.current[index] && Math.abs(2400+index*1000-elapsedRef.current) <= 340);
    if (candidate < 0) { setMessage('差一点！看准金色横线，下一拍继续。'); return; }
    const grade = rhythmGrade(2400+candidate*1000-elapsedRef.current);
    hitsRef.current = {...hitsRef.current, [candidate]: grade}; setHits(hitsRef.current); setMessage(grade === 'perfect' ? '正好！这一拍很稳。' : '接住了！继续跟上。');
  }
  return <>
    <header className="arcade-title"><span>03 / 声音乐队</span><h3>让声音跟着节拍跳舞</h3><p>看音符轨道，落到金线时敲鼓。漏拍继续演奏，完成 12 拍短曲。</p></header>
    <div className="arcade-status"><b>🎵 接住 {Object.keys(hits).length}/12 拍</b><span>⭐ 精准 {Object.values(hits).filter(value => value === 'perfect').length}</span></div>
    {done ? <div className="arcade-finish"><span>🎉</span><h3>演奏完成！</h3><p>接住 {Object.keys(hits).length} 拍，漏掉 {12-Object.keys(hits).length} 拍。再来一次挑战更稳的节奏。</p></div> : <>
      {!started && <button className="arcade-ticket" onClick={() => { startedAt.current = performance.now(); setStarted(true); }}>▶ 开始合奏</button>}
      {started && <button className="arcade-ticket" onClick={() => { if (paused) startedAt.current = performance.now()-elapsedRef.current; setPaused(!paused); }}>{paused ? '▶ 继续合奏' : 'Ⅱ 暂停合奏'}</button>}
      <div className="rhythm-lanes" aria-label="三条下落音符轨道"><div className="rhythm-line" />{notes.map((lane,index) => {
        const distance = 2400+index*1000-elapsed;
        if (!started || distance > 1800 || distance < -450 || hits[index]) return null;
        return <span key={index} className="falling-note" style={{left:`${(lane+.5)*100/3}%`,top:`${220-distance*.12}px`}}>{bank[lane].symbol}</span>;
      })}</div>
      <div className="arcade-pads">{bank.map((sound,index) => <button key={sound.symbol} onClick={() => hit(index)} disabled={paused}><b>{['🥁','🪘','🔔'][index]}</b>{sound.symbol}</button>)}</div>
    </>}
    <p className="arcade-message" role="status">{error || message}</p>
  </>;
}
