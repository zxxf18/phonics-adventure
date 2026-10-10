'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import soundData from './phonics-data.json';
import { getCurrentUser, type AuthUser } from './auth-client';
import { UserMenu } from './UserMenu';
import {
  GAME_QUESTION_SECONDS,
  GAME_RUN_LENGTH,
  GAME_START_LIVES,
  resolveAnswer,
  shieldForStreak,
} from './game-rules';

type WordExample = { word: string; ipa: string; meaning: string; audio: string };
type SoundItem = {
  index: number;
  symbol: string;
  phonemeAudio: string;
  video: string;
  words: WordExample[];
};
type Grapheme = { mark: string; sounds: number[]; example: string; note?: string };

const sounds = soundData as SoundItem[];
const vowels = sounds.slice(0, 20);
const clusterIndexes = new Set([30, 31, 41, 42]);
const consonants = sounds.slice(20).filter((item) => !clusterIndexes.has(item.index));
const clusters = sounds.filter((item) => clusterIndexes.has(item.index));

const graphemeGroups: { title: string; badge: string; items: Grapheme[] }[] = [
  {
    title: '一个字母，一个线索', badge: '先从简单开始', items: [
      { mark: 'a', sounds: [8], example: 'ant' }, { mark: 'b', sounds: [32], example: 'bread' },
      { mark: 'c', sounds: [23], example: 'cat' }, { mark: 'd', sounds: [33], example: 'dog' },
      { mark: 'e', sounds: [7], example: 'egg' }, { mark: 'f', sounds: [24], example: 'fish' },
      { mark: 'g', sounds: [34], example: 'gate' }, { mark: 'h', sounds: [28], example: 'hut' },
      { mark: 'i', sounds: [6], example: 'sit' }, { mark: 'j', sounds: [40], example: 'jam' },
      { mark: 'k', sounds: [23], example: 'cat' }, { mark: 'l', sounds: [46], example: 'line' },
      { mark: 'm', sounds: [43], example: 'mud' }, { mark: 'n', sounds: [44], example: 'no' },
      { mark: 'o', sounds: [11], example: 'dog' }, { mark: 'p', sounds: [21], example: 'put' },
      { mark: 'r', sounds: [39], example: 'read' }, { mark: 's', sounds: [25], example: 'sit' },
      { mark: 't', sounds: [22], example: 'top' }, { mark: 'u', sounds: [10], example: 'cup' },
      { mark: 'v', sounds: [35], example: 'very' }, { mark: 'w', sounds: [47], example: 'wood' },
      { mark: 'x', sounds: [23, 25], example: 'box', note: '两个声音连起来' },
      { mark: 'y', sounds: [48], example: 'yell' }, { mark: 'z', sounds: [36], example: 'zero' },
    ],
  },
  {
    title: '两个字母，声音变身', badge: '常见字母组合', items: [
      { mark: 'ck', sounds: [23], example: 'chick' }, { mark: 'll', sounds: [46], example: 'full' },
      { mark: 'ss', sounds: [25], example: 'mass' }, { mark: 'sh', sounds: [26], example: 'ship' },
      { mark: 'ch', sounds: [29], example: 'chick' }, { mark: 'th', sounds: [27], example: 'think', note: '清音' },
      { mark: 'th', sounds: [38], example: 'they', note: '浊音' }, { mark: 'ng', sounds: [45], example: 'sing' },
      { mark: 'ai', sounds: [13], example: 'wait' }, { mark: 'ee', sounds: [1], example: 'bee' },
      { mark: 'oo', sounds: [5], example: 'cool', note: '长音' }, { mark: 'oo', sounds: [12], example: 'book', note: '短音' },
      { mark: 'ar', sounds: [3], example: 'shark' }, { mark: 'or', sounds: [4], example: 'board' },
      { mark: 'ur', sounds: [2], example: 'bird' }, { mark: 'ow', sounds: [16], example: 'town', note: '向外滑' },
      { mark: 'ow', sounds: [17], example: 'know', note: '向后滑' }, { mark: 'oi', sounds: [15], example: 'point' },
      { mark: 'er', sounds: [9], example: 'center', note: '非重读音节' },
    ],
  },
  {
    title: '三个以上字母，高级密码', badge: '继续挑战', items: [
      { mark: 'igh', sounds: [14], example: 'why', note: '同一个音' },
      { mark: 'oa', sounds: [17], example: 'mode', note: '同一个音' },
      { mark: 'ear', sounds: [18], example: 'beer', note: '同一个音' },
      { mark: 'air', sounds: [19], example: 'fare', note: '同一个音' },
      { mark: 'ure', sounds: [20], example: 'pure' },
      { mark: 'dge', sounds: [40], example: 'bridge' },
      { mark: 'sion', sounds: [37, 9, 44], example: 'decision', note: '三个声音连起来' },
    ],
  },
];

const wordLookup = new Map(
  sounds.flatMap((sound) => sound.words.map((word) => [word.word.toLowerCase(), word] as const)),
);

function soundGroup(item: SoundItem) {
  if (item.index <= 5) return '长元音';
  if (item.index <= 12) return '短元音';
  if (item.index <= 20) return '双元音';
  if (clusterIndexes.has(item.index)) return '辅音组合';
  if ([21, 22, 23, 24, 25, 26, 27, 28, 29].includes(item.index)) return '清辅音';
  return '浊辅音与其他辅音';
}

function soundByIndex(index: number) {
  return sounds[index - 1];
}

type MainTab = 'home' | 'learn' | 'catalog' | 'games';
type LearnTab = 'vowels' | 'consonants' | 'graphemes';
type GameMode = 'maze' | 'railway' | 'echo' | 'rhythm';
type GameFeedback = { selected: number; correct: boolean; timedOut?: boolean } | null;

const mainTabs: { id: MainTab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏝️', label: '探险首页' },
  { id: 'learn', icon: '🌈', label: '系统学习' },
  { id: 'catalog', icon: '📚', label: '音标图鉴' },
  { id: 'games', icon: '🎮', label: '游戏乐园' },
];

const gameModes: { id: GameMode; icon: string; title: string; description: string }[] = [
  { id: 'maze', icon: '🧭', title: '声音迷宫', description: '走路、收集宝石、找出口' },
  { id: 'railway', icon: '🚂', title: '铁路调度', description: '拨道岔，把列车送到正确车站' },
  { id: 'echo', icon: '🔔', title: '回声机关', description: '记住声音顺序，打开机关门' },
  { id: 'rhythm', icon: '🥁', title: '声音乐队', description: '跟着节拍敲出正确声音' },
];

const MAZE_SIZE = 7;

function seededRandom(seed: number) {
  let state = (seed * 2654435761 + 1013904223) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildMaze(seed: number) {
  const random = seededRandom(seed);
  const nodes = Array.from({ length: (MAZE_SIZE - 1) / 2 }, (_, index) => index * 2 + 1);
  const start = { x: nodes[seed % nodes.length], y: MAZE_SIZE - 2 };
  const cells = new Set<string>();
  const visited = new Set<string>([`${start.x}-${start.y}`]);
  const stack = [start];
  cells.add(`${start.x}-${start.y}`);

  while (stack.length) {
    const current = stack[stack.length - 1];
    const candidates = [[0, -2], [2, 0], [0, 2], [-2, 0]]
      .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy, dx, dy }))
      .filter(({ x, y }) => x > 0 && x < MAZE_SIZE - 1 && y > 0 && y < MAZE_SIZE - 1 && !visited.has(`${x}-${y}`));
    if (!candidates.length) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(random() * candidates.length)];
    cells.add(`${current.x + next.dx / 2}-${current.y + next.dy / 2}`);
    cells.add(`${next.x}-${next.y}`);
    visited.add(`${next.x}-${next.y}`);
    stack.push({ x: next.x, y: next.y });
  }

  const exitXs = [...nodes];
  for (let i = exitXs.length - 1; i > 0; i -= 1) {
    const target = Math.floor(random() * (i + 1));
    [exitXs[i], exitXs[target]] = [exitXs[target], exitXs[i]];
  }
  const exits = exitXs.slice(0, 3).sort((a, b) => a - b).map((x) => ({ x, y: 0 }));
  exits.forEach(({ x, y }) => cells.add(`${x}-${y}`));
  return { size: MAZE_SIZE, cells, start, exits };
}

function randomIndex(length: number) {
  return Math.floor(Math.random() * length);
}

function MazeGame({
  round,
  options,
  correct,
  feedback,
  labelFor,
  onAnswer,
  onCollect,
}: {
  round: number;
  options: number[];
  correct: number;
  feedback: GameFeedback;
  labelFor: (index: number) => string;
  onAnswer: (index: number) => void;
  onCollect: () => void;
}) {
  const maze = useMemo(() => buildMaze(round), [round]);
  const [position, setPosition] = useState(maze.start);
  const [trail, setTrail] = useState(() => new Set([`${maze.start.x}-${maze.start.y}`]));
  const [bumped, setBumped] = useState(false);
  const [collected, setCollected] = useState<Set<string>>(() => new Set());
  const [hintUsed, setHintUsed] = useState(false);
  const gems = useMemo(() => [...maze.cells].filter((cell) => cell.includes('-') && !cell.endsWith('-0')).slice(2, 5), [maze]);
  const wrongFinds = ['🪵 烂树根', '🍾 空瓶子', '🥄 生锈汤勺', '🧦 单只旧袜子', '🥥 空椰子壳'];

  const move = useCallback((dx: number, dy: number) => {
    if (feedback) return;
    const next = { x: position.x + dx, y: position.y + dy };
    if (!maze.cells.has(`${next.x}-${next.y}`)) {
      setBumped(true);
      window.setTimeout(() => setBumped(false), 260);
      return;
    }
    setPosition(next);
    setTrail((old) => new Set(old).add(`${next.x}-${next.y}`));
    const cellKey = `${next.x}-${next.y}`;
    if (gems.includes(cellKey) && !collected.has(cellKey)) {
      setCollected((old) => new Set(old).add(cellKey));
      onCollect();
    }
    const exitIndex = maze.exits.findIndex((exit) => exit.x === next.x && exit.y === next.y);
    if (exitIndex >= 0) onAnswer(options[exitIndex]);
  }, [collected, feedback, gems, maze, onAnswer, onCollect, options, position]);

  useEffect(() => {
    const keyMap: Record<string, [number, number]> = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    };
    const handleKey = (event: KeyboardEvent) => {
      const delta = keyMap[event.key];
      if (!delta) return;
      event.preventDefault();
      move(...delta);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [move]);

  const correctExit = options.indexOf(correct);
  return <div className="maze-shell">
    <div className="maze-legend"><span>起点 🦁</span><b>💎 {collected.size}/{gems.length} 宝石</b><span>三条出口</span></div>
    <div className="maze-tools"><span>{hintUsed ? `出口 ${correctExit + 1} 已标亮` : '找不到路？可以用一次出口提示'}</span><button onClick={() => setHintUsed(true)} disabled={hintUsed || Boolean(feedback)}>🧭 提示出口</button></div>
    <div className={`maze-grid ${bumped ? 'bumped' : ''}`} aria-label="7乘7宝藏迷宫">
      {Array.from({ length: maze.size * maze.size }, (_, index) => {
        const x = index % maze.size;
        const y = Math.floor(index / maze.size);
        const exitIndex = maze.exits.findIndex((exit) => exit.x === x && exit.y === y);
        const isRoad = maze.cells.has(`${x}-${y}`);
        const isHero = position.x === x && position.y === y;
        const isVisited = trail.has(`${x}-${y}`);
        return <div className={`${isRoad ? 'maze-cell road' : 'maze-cell hedge'} ${isVisited ? 'visited' : ''}`} key={`${x}-${y}`}>
          {!isRoad && <span>{(x * maze.size + y + round) % 11 === 0 ? '🌼' : '🌿'}</span>}
          {exitIndex >= 0 && <b className={`maze-exit ${hintUsed && exitIndex === correctExit ? 'hinted' : ''}`}>{labelFor(options[exitIndex])}</b>}
          {isRoad && gems.includes(`${x}-${y}`) && !collected.has(`${x}-${y}`) && <span className="maze-gem">💎</span>}
          {isRoad && collected.has(`${x}-${y}`) && <span className="maze-collected">✨</span>}
          {isRoad && isVisited && !isHero && <i className="maze-footstep">·</i>}
          {isHero && <span className="maze-hero">🦁</span>}
        </div>;
      })}
    </div>
    <div className="maze-controls" aria-label="迷宫方向控制">
      <button onClick={() => move(0, -1)} aria-label="向上">↑</button>
      <button onClick={() => move(-1, 0)} aria-label="向左">←</button>
      <button onClick={() => move(0, 1)} aria-label="向下">↓</button>
      <button onClick={() => move(1, 0)} aria-label="向右">→</button>
    </div>
    <p>⌨️ 可以用键盘方向键，也可以点击方向按钮</p>
    {feedback && <div className={`maze-result ${feedback.correct ? 'win' : 'lose'}`}>
      <span>{feedback.correct ? '🎁💎' : wrongFinds[(round - 1) % wrongFinds.length]}</span>
      <b>{feedback.correct ? '找到宝藏啦！' : '这条路还没有宝藏'}</b>
    </div>}
  </div>;
}

function RailwayGame({ options, correct, feedback, labelFor, onAnswer }: { options: number[]; correct: number; feedback: GameFeedback; labelFor: (index: number) => string; onAnswer: (index: number) => void }) {
  const [switches, setSwitches] = useState([false, false]);
  const [dispatched, setDispatched] = useState(false);
  const correctRoute = options.indexOf(correct);
  const routeCode = switches[0] ? 2 : 0 + (switches[1] ? 1 : 0);
  const dispatch = () => {
    if (feedback || dispatched) return;
    setDispatched(true);
    window.setTimeout(() => onAnswer(routeCode === correctRoute ? correct : options.find((index) => index !== correct) ?? correct), 700);
  };
  return <div className="railway-game" aria-label="铁路调度游戏">
    <div className="railway-header"><span>🚂 调度中心</span><b>把小火车送到声音车站</b><small>先听题目，再拨动两处道岔，最后发车。</small></div>
    <div className={`railway-map ${dispatched ? 'dispatching' : ''}`}><span className="railway-train">🚂</span><i className="railway-track track-main"/><i className={`railway-switch switch-a ${switches[0] ? 'turned' : ''}`}/><i className={`railway-switch switch-b ${switches[1] ? 'turned' : ''}`}/><div className="railway-stations">{options.map((index, station) => <span key={index} className={`railway-station station-${station}`}>🚉<b>{labelFor(index)}</b><small>{station === 0 ? '苹果站' : station === 1 ? '彩虹站' : '月亮站'}</small></span>)}</div></div>
    <div className="railway-controls"><button onClick={() => setSwitches(([a, b]) => [!a, b])} disabled={Boolean(feedback) || dispatched}>🔀 道岔一：{switches[0] ? '右线' : '左线'}</button><button onClick={() => setSwitches(([a, b]) => [a, !b])} disabled={Boolean(feedback) || dispatched}>🔀 道岔二：{switches[1] ? '右线' : '左线'}</button><button className="dispatch-button" onClick={dispatch} disabled={Boolean(feedback) || dispatched}>🚦 发车</button></div>
    <p className="railway-hint">路线 {routeCode + 1} / 4 · 你需要自己安排路线，不是直接点车站。</p>
  </div>;
}

function EchoGame({ options, correct, feedback, labelFor, onAnswer, onPlay }: { options: number[]; correct: number; feedback: GameFeedback; labelFor: (index: number) => string; onAnswer: (index: number) => void; onPlay: (index: number) => void }) {
  const correctPosition = options.indexOf(correct);
  const sequence = [correctPosition, (correctPosition + 1) % 3, (correctPosition + 2) % 3];
  const [heard, setHeard] = useState(false);
  const [steps, setSteps] = useState<number[]>([]);
  const tap = (position: number) => {
    if (feedback || steps.length >= sequence.length) return;
    onPlay(options[position]);
    const next = [...steps, position];
    setSteps(next);
    if (next.length === sequence.length) window.setTimeout(() => onAnswer(next.every((value, index) => value === sequence[index]) ? correct : options.find((index) => index !== correct) ?? correct), 500);
  };
  return <div className="echo-game" aria-label="回声机关游戏">
    <div className="echo-header"><span>🔔 回声机关</span><b>记住三声回响，打开伙伴的门</b><small>先试听机关顺序，再按相同顺序敲响石头。</small></div>
    <button className={`echo-memory ${heard ? 'heard' : ''}`} onClick={() => { setHeard(true); options.forEach((index, position) => window.setTimeout(() => onPlay(index), position * 430)); }} disabled={Boolean(feedback) || steps.length > 0}>🔊 {heard ? '再听一次需要重新开始' : '试听回声顺序'}</button>
    <div className="echo-sequence">{sequence.map((_, index) => <span key={index} className={steps[index] !== undefined ? 'filled' : ''}>{steps[index] === undefined ? '？' : index + 1}</span>)}</div>
    <div className="echo-stones">{options.map((index, position) => <button key={index} className={steps.includes(position) ? 'used' : ''} onClick={() => tap(position)} disabled={Boolean(feedback) || steps.includes(position)}><b>{['🪨', '💎', '🌙'][position]}</b><span>{labelFor(index)}</span></button>)}</div>
    <p className="echo-hint">第 {Math.min(steps.length + 1, 3)} 声：敲出你刚才听到的下一个声音。</p>
  </div>;
}

function RhythmGame({ options, correct, feedback, labelFor, onAnswer, onPlay }: { options: number[]; correct: number; feedback: GameFeedback; labelFor: (index: number) => string; onAnswer: (index: number) => void; onPlay: (index: number) => void }) {
  const target = options.indexOf(correct);
  const [beat, setBeat] = useState(0);
  const [windowOpen, setWindowOpen] = useState(true);
  const pattern = [target, (target + 1) % 3, target, (target + 2) % 3];
  useEffect(() => {
    if (feedback) return;
    const timer = window.setInterval(() => setWindowOpen((open) => !open), 430);
    return () => window.clearInterval(timer);
  }, [feedback]);
  const hit = (position: number) => {
    if (feedback || !windowOpen) return;
    onPlay(options[position]);
    if (position !== pattern[beat]) {
      onAnswer(options.find((index) => index !== correct) ?? correct);
      return;
    }
    if (beat === pattern.length - 1) {
      onAnswer(correct);
      return;
    }
    setBeat((value) => value + 1);
  };
  return <div className="rhythm-game" aria-label="声音乐队游戏">
    <div className="rhythm-header"><span>🥁 声音乐队</span><b>跟着灯光节拍完成一段小合奏</b><small>灯亮时敲正确的声音，错过节拍就要重新来一次。</small></div>
    <div className="rhythm-meter"><span className={windowOpen ? 'on' : ''}/><span className={beat >= 1 ? 'done' : ''}/><span className={beat >= 2 ? 'done' : ''}/><span className={beat >= 3 ? 'done' : ''}/></div>
    <div className="rhythm-pads">{options.map((index, position) => <button key={index} onClick={() => hit(position)} disabled={Boolean(feedback)} className={windowOpen ? '' : 'rest'}><b>{['🥁', '🪘', '🔔'][position]}</b><span>{labelFor(index)}</span></button>)}</div>
    <p className="rhythm-hint">第 {beat + 1} 拍 / 4 拍 · {windowOpen ? '现在敲击' : '等灯亮'}</p>
  </div>;
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [learnTab, setLearnTab] = useState<LearnTab>('vowels');
  const [learned, setLearned] = useState<number[]>([]);
  const [playing, setPlaying] = useState('');
  const [audioNotice, setAudioNotice] = useState('');
  const [catalogIndex, setCatalogIndex] = useState(0);
  const [gameRound, setGameRound] = useState(1);
  const [gameQuestion, setGameQuestion] = useState(20);
  const [gameScore, setGameScore] = useState(0);
  const [gameStreak, setGameStreak] = useState(0);
  const [gameLives, setGameLives] = useState(GAME_START_LIVES);
  const [gameTimeLeft, setGameTimeLeft] = useState(GAME_QUESTION_SECONDS);
  const [gameStatus, setGameStatus] = useState<'playing' | 'over'>('playing');
  const [gameBest, setGameBest] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>('maze');
  const [gameShield, setGameShield] = useState(false);
  const [gameMistakes, setGameMistakes] = useState<number[]>([]);
  const [gameXp, setGameXp] = useState(0);
  const answerGameRef = useRef<(selected: number) => void>(() => undefined);
  const [gameFeedback, setGameFeedback] = useState<GameFeedback>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const progress = Math.round((learned.length / sounds.length) * 100);
  useEffect(() => { void getCurrentUser().then(setUser); }, []);

  useEffect(() => {
    if (activeTab !== 'games' || gameStatus !== 'playing' || gameFeedback) return;
    const timer = window.setInterval(() => {
      setGameTimeLeft((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          answerGameRef.current(-1);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTab, gameStatus, gameRound, gameFeedback]);

  const gameOptions = useMemo(() => {
    const candidates = [gameQuestion, (gameQuestion + 11) % sounds.length, (gameQuestion + 27) % sounds.length];
    const shift = gameRound % candidates.length;
    return [...candidates.slice(shift), ...candidates.slice(0, shift)];
  }, [gameQuestion, gameRound]);

  function remember(index: number) {
    setLearned((old) => old.includes(index) ? old : [...old, index]);
  }

  function openTab(tab: MainTab, nextLearnTab?: LearnTab) {
    setActiveTab(tab);
    if (nextLearnTab) setLearnTab(nextLearnTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleTabKey(event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + mainTabs.length) % mainTabs.length;
    openTab(mainTabs[nextIndex].id);
  }

  function playPlaylist(urls: string[], key: string, notice?: string) {
    playerRef.current?.pause();
    let cursor = 0;
    const playNext = () => {
      const audio = new Audio(urls[cursor]);
      playerRef.current = audio;
      audio.onplay = () => { setPlaying(key); setAudioNotice(notice ?? ''); };
      audio.onerror = () => { setPlaying(''); setAudioNotice('声音加载失败，请再点一次。'); };
      audio.onended = () => {
        cursor += 1;
        if (cursor < urls.length) playNext();
        else setPlaying('');
      };
      audio.play().catch(() => setAudioNotice('浏览器暂时没有播放，请再点一次按钮。'));
    };
    playNext();
  }

  function playSound(item: SoundItem, key = `sound-${item.index}`, announce = true) {
    remember(item.index);
    playPlaylist([item.phonemeAudio], key, announce ? `正在播放 ${item.symbol}` : undefined);
  }

  function playWord(word: WordExample, key = `word-${word.word}`) {
    playPlaylist([word.audio], key, `正在播放 ${word.word}`);
  }

  function playGrapheme(item: Grapheme) {
    const related = item.sounds.map(soundByIndex);
    related.forEach((sound) => remember(sound.index));
    playPlaylist(related.map((sound) => sound.phonemeAudio), `grapheme-${item.mark}-${item.example}`, `正在播放 ${item.mark} 的声音`);
  }

  function startGame() {
    setGameRound(1);
    setGameQuestion(randomIndex(sounds.length));
    setGameScore(0);
    setGameStreak(0);
    setGameLives(GAME_START_LIVES);
    setGameTimeLeft(GAME_QUESTION_SECONDS);
    setGameStatus('playing');
    setGameFeedback(null);
    setGameShield(false);
    setGameMistakes([]);
    setGameXp(0);
  }

  function selectGameMode(mode: GameMode) {
    setGameMode(mode);
    startGame();
  }

  function answerGame(selected: number) {
    if (gameFeedback || gameStatus !== 'playing') return;
    const timedOut = selected < 0;
    const correct = !timedOut && selected === gameQuestion;
    const shielded = !correct && gameShield;
    const resolved = resolveAnswer({ correct, round: gameRound, lives: gameLives, streak: gameStreak, shielded });
    const outcome = resolved;
    setGameFeedback({ selected, correct, timedOut });
    if (correct) {
      setGameScore((score) => score + outcome.score);
      setGameStreak(outcome.streak);
      setGameLives(outcome.lives);
      setGameXp((xp) => xp + outcome.score + 2);
      setGameShield(shieldForStreak(outcome.streak));
      remember(sounds[gameQuestion].index);
    } else {
      setGameMistakes((mistakes) => mistakes.includes(gameQuestion) ? mistakes : [...mistakes, gameQuestion]);
      setGameStreak(outcome.streak);
      setGameLives(outcome.lives);
      setGameShield(false);
    }
    const nextQuestion = (gameQuestion * 7 + gameRound * 13 + 5) % sounds.length;
    window.setTimeout(() => {
      if (outcome.finished) {
        setGameStatus('over');
        setGameBest((best) => Math.max(best, gameScore + outcome.score));
        return;
      }
      setGameRound((round) => round + 1);
      setGameQuestion(nextQuestion === gameQuestion ? (nextQuestion + 1) % sounds.length : nextQuestion);
      setGameTimeLeft(GAME_QUESTION_SECONDS);
      setGameFeedback(null);
    }, 1500);
  }

  useEffect(() => {
    answerGameRef.current = answerGame;
  });

  function optionLabel(index: number) {
    return sounds[index].symbol;
  }

  function playGameOption(index: number) {
    playSound(sounds[index], `game-option-${index}`, false);
  }

  function renderSoundGrid(items: SoundItem[], prefix: string) {
    return <div className="sound-grid">
      {items.map((item) => {
        const example = item.words[0];
        return <article className={`sound-card tone-${item.index % 6} ${playing === `${prefix}-${item.index}` ? 'playing' : ''}`} key={item.index}>
          <span className="sound-number">{String(item.index).padStart(2, '0')}</span>
          <span className="sound-group">{soundGroup(item)}</span>
          <strong>{item.symbol}</strong>
          <button className="sound-listen" onClick={() => playSound(item, `${prefix}-${item.index}`)}>🔈 只听音标</button>
          <button className="word-listen" onClick={() => playWord(example)}>
            <span>{example.word}</span><small>{example.ipa} · {example.meaning}</small>
          </button>
          <span className="learn-star">{learned.includes(item.index) ? '⭐' : '☆'}</span>
        </article>;
      })}
    </div>;
  }

  const current = sounds[catalogIndex];
  return <main id="top" className={`active-${activeTab}`}>
    <header className="topbar">
      <button className="brand" onClick={() => openTab('home')}><span className="brand-mark">Aa</span><span>音标探险岛<small>Phonics Adventure</small></span></button>
      <nav className="desktop-nav" aria-label="主功能导航" role="tablist">
        {mainTabs.map((tab, index) => <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          className={activeTab === tab.id ? 'active' : ''}
          onKeyDown={(event) => handleTabKey(event, index)}
          onClick={() => openTab(tab.id)}
        >{tab.icon} {tab.label}</button>)}
      </nav>
      <div className="topbar-actions">
        <UserMenu user={user} />
        <div className="star-pill" aria-label={`已认识 ${learned.length} 个声音`}>⭐ <b>{learned.length}</b><span>/48</span></div>
      </div>
    </header>

    {activeTab === 'home' && <div id="panel-home" role="tabpanel" aria-label="探险首页" className="tab-panel home-panel">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">听一听 · 看一看 · 玩一玩</span>
          <h1>和声音精灵一起<br/><em>闯过音标世界</em></h1>
          <p>学习、图鉴和游戏现在各有自己的空间。今天想认真听音、查一个音标，还是直接进入随机冒险？</p>
          <div className="hero-actions"><button className="primary-action" onClick={() => openTab('learn', 'vowels')}>▶ 开始学习</button><button className="secondary-action" onClick={() => openTab('games')}>🎲 随机冒险</button></div>
          <div className="hero-facts"><span><b>48</b>个声音</span><span><b>144</b>条例词</span><span><b>12</b>种游戏玩法</span></div>
        </div>
        <div className="hero-scene" aria-hidden="true"><div className="hero-sun">☀️</div><div className="hero-cloud">☁️</div><div className="speech">Ready?</div><div className="mascot">🦁</div><div className="island"><span>🔤</span></div><i>♪</i><i>♫</i></div>
      </section>

      <section className="route-strip home-routes" aria-label="功能入口">
        <button onClick={() => openTab('learn', 'vowels')}><small>01</small><span>🌈</span><b>元音小岛</b></button>
        <button onClick={() => openTab('learn', 'consonants')}><small>02</small><span>🌲</span><b>辅音森林</b></button>
        <button onClick={() => openTab('learn', 'graphemes')}><small>03</small><span>🧩</span><b>字母密码</b></button>
        <button onClick={() => openTab('catalog')}><small>04</small><span>📚</span><b>完整图鉴</b></button>
        <button onClick={() => openTab('games')}><small>05</small><span>🎮</span><b>游戏乐园</b></button>
      </section>

      <section className="home-dashboard">
        <article className="continue-card">
          <span>今日探险进度</span><h2>{learned.length === 0 ? '从第一个声音出发吧！' : `已经认识 ${learned.length} 个声音`}</h2>
          <div className="finish-progress"><i style={{ width: `${progress}%` }} /></div>
          <p>每次点击音标会自动点亮一颗星，完成 48 个声音即可集齐全岛图鉴。</p>
          <button onClick={() => openTab('learn')}>{learned.length === 0 ? '开始第一课' : '继续学习'} →</button>
        </article>
        <article className="game-preview-card">
          <div><span>本次推荐</span><h2>🎲 十二种玩法随机冒险</h2><p>走迷宫、盖房子、修管道、调火车、装机器人……每个游戏都有独立任务、进度和反馈动画。</p></div>
          <div className="preview-icons">🧙 🧭 🏗️ 🔧 🚂 🤖</div>
          <button onClick={() => { startGame(); openTab('games'); }}>随机来一局 →</button>
        </article>
      </section>
    </div>}

    {activeTab === 'learn' && <div id="panel-learn" role="tabpanel" aria-label="系统学习" className="tab-panel learn-panel">
      <section className="page-intro learn-intro"><span className="section-kicker">LEARNING MAP</span><h1>🌈 系统学习地图</h1><p>一次只专注一个学习模块。你可以随时切换，已经点亮的音标星星会保留。</p></section>
      <nav className="subtab-nav" aria-label="学习模块" role="tablist">
        <button className={learnTab === 'vowels' ? 'active' : ''} onClick={() => setLearnTab('vowels')} role="tab" aria-selected={learnTab === 'vowels'}><span>🌈</span><b>元音小岛</b><small>20 个元音</small></button>
        <button className={learnTab === 'consonants' ? 'active' : ''} onClick={() => setLearnTab('consonants')} role="tab" aria-selected={learnTab === 'consonants'}><span>🌲</span><b>辅音森林</b><small>28 个辅音</small></button>
        <button className={learnTab === 'graphemes' ? 'active' : ''} onClick={() => setLearnTab('graphemes')} role="tab" aria-selected={learnTab === 'graphemes'}><span>🧩</span><b>字母密码</b><small>51 个对应</small></button>
      </nav>

      {learnTab === 'vowels' && <section className="module-section vowel-module compact-module">
        <div className="section-heading"><div><span className="section-kicker">第 1 站 · VOWELS</span><h2>🌈 元音小岛</h2><p>20个元音分成短元音、长元音和双元音。先听单独的音，再听完整单词。</p></div><div className="module-count">20<small>个元音</small></div></div>
        {renderSoundGrid(vowels, 'vowel')}
      </section>}

      {learnTab === 'consonants' && <section className="module-section consonant-module compact-module">
        <div className="section-heading"><div><span className="section-kicker">第 2 站 · CONSONANTS</span><h2>🌲 辅音森林</h2><p>塞音要短而干净，摩擦音可以延长。点击“只听音标”，不要把字母名称混进来。</p></div><div className="module-count">28<small>个辅音</small></div></div>
        {renderSoundGrid(consonants, 'consonant')}
        <div className="cluster-heading"><span>进阶小径</span><h3>4个常见辅音组合</h3><p>/ts/、/tr/、/dz/、/dr/ 由两个辅音快速连读。</p></div>
        {renderSoundGrid(clusters, 'cluster')}
      </section>}

      {learnTab === 'graphemes' && <section className="module-section grapheme-module compact-module">
        <div className="section-heading"><div><span className="section-kicker">第 3 站 · LETTER CODES</span><h2>🧩 字母密码实验室</h2><p>同一个声音可能穿不同的“字母外套”。从单个字母开始，再挑战两个、三个和更多字母。</p></div><div className="module-count">51<small>个常见对应</small></div></div>
        {graphemeGroups.map((group) => <div className="grapheme-level" key={group.title}>
          <div className="level-heading"><span>{group.badge}</span><h3>{group.title}</h3></div>
          <div className="grapheme-grid">{group.items.map((item, index) => {
            const example = wordLookup.get(item.example.toLowerCase());
            const symbols = item.sounds.map((sound) => soundByIndex(sound).symbol).join(' + ');
            return <article className="grapheme-card" key={`${item.mark}-${item.example}-${index}`}>
              <div className="letter-mark">{item.mark}</div><div className="letter-arrow">→</div><strong>{symbols}</strong>
              {item.note && <span className="grapheme-note">{item.note}</span>}
              <button onClick={() => playGrapheme(item)}>🔈 听声音</button>
              {example && <button className="grapheme-word" onClick={() => playWord(example)}>🔊 {example.word}<small>{example.ipa}</small></button>}
            </article>;
          })}</div>
        </div>)}
      </section>}
    </div>}

    {activeTab === 'catalog' && <section id="panel-catalog" role="tabpanel" aria-label="音标图鉴" className="catalog module-section tab-panel catalog-page">
      <div className="section-heading catalog-heading"><div><span className="section-kicker">第 4 站 · ALL SOUNDS</span><h2>📚 48音标完整图鉴</h2><p>按顺序查看每一个音标、教学视频和3个常见例词，也可以用下方按钮快速跳转。</p></div><div className="module-count">{catalogIndex + 1}<small>/ 48</small></div></div>
      <div className="catalog-stage">
        <button className="catalog-arrow" onClick={() => setCatalogIndex((index) => (index - 1 + sounds.length) % sounds.length)} aria-label="上一个音标">‹</button>
        <article className="catalog-card">
          <div className="catalog-main">
            <span className="catalog-group">{soundGroup(current)}</span><strong>{current.symbol}</strong>
            <button className="big-listen" onClick={() => playSound(current, `catalog-${current.index}`)}>🔈 只听音标本身</button>
            <div className="catalog-words">{current.words.map((word) => <button key={word.word} onClick={() => playWord(word)}><span>🔊 {word.word}</span><small>{word.ipa}</small><em>{word.meaning}</em></button>)}</div>
          </div>
          <div className="video-wrap"><video key={current.video} src={current.video} controls preload="metadata" playsInline aria-label={`${current.symbol} 发音口型视频`} /><span>🎬 发音口型视频</span></div>
        </article>
        <button className="catalog-arrow" onClick={() => setCatalogIndex((index) => (index + 1) % sounds.length)} aria-label="下一个音标">›</button>
      </div>
      <div className="catalog-list" aria-label="全部音标快捷选择">{sounds.map((item, index) => <button key={item.index} className={index === catalogIndex ? 'selected' : ''} onClick={() => setCatalogIndex(index)}><b>{item.symbol}</b><small>{item.words[0].word}</small></button>)}</div>
    </section>}

    {activeTab === 'games' && <section id="panel-games" role="tabpanel" aria-label="游戏乐园" className="game module-section tab-panel games-page">
      <div className="section-heading game-heading"><div><span className="section-kicker">SOUND QUEST ARCADE</span><h2>🎮 声音探险乐园</h2><p>每一种玩法都让你真正操作起来：走迷宫、调度列车、记住回声，或跟着节拍合奏。</p></div><div className="game-score"><span>⭐ {gameScore}</span><span>🔥 {gameStreak}</span><span>✨ {gameXp} XP</span></div></div>

      <div className="game-mode-deck game-mode-deck-v2" aria-label="选择游戏玩法">{gameModes.map((mode) => <button key={mode.id} className={gameMode === mode.id ? 'active' : ''} onClick={() => selectGameMode(mode.id)} disabled={gameStatus === 'playing'}><span>{mode.icon}</span><b>{mode.title}</b><small>{mode.description}</small></button>)}</div>

      <div className="maze-game-intro"><span>{gameModes.find((mode) => mode.id === gameMode)?.icon} 当前任务 · {gameModes.find((mode) => mode.id === gameMode)?.title}</span><b>{gameMode === 'maze' ? '听清声音，穿过迷宫，找到正确出口' : gameMode === 'railway' ? '拨动道岔，让火车驶向正确车站' : gameMode === 'echo' ? '听住三声回响，再按相同顺序开门' : '踩准节拍，完成一段声音合奏'}</b><small>本局结束后可以直接切换任务，选择器不会被结算动画锁住。</small></div>

      <div className={`game-board adventure-board theme-${gameMode}`}>
        <div className="game-run-stats" aria-label="本局状态"><span>❤️ {gameLives}</span><span className={gameTimeLeft <= 3 ? 'urgent' : ''}>⏱️ {gameTimeLeft}s</span><span>🔥 {gameStreak} 连击</span><span>{gameShield ? '🛡️ 护盾' : '○ 护盾未充能'}</span><span>🏆 {gameScore}</span></div>
        {gameStatus === 'over' ? <div className="game-results" role="status">
          <span className="results-badge">探险结算</span>
          <h3>{gameLives > 0 ? '全程通关！' : '差一点就成功了！'}</h3>
          <p>本局得分 <strong>{gameScore}</strong> · 最佳成绩 <strong>{Math.max(gameBest, gameScore)}</strong></p>
          <p className="results-detail">{gameLives > 0 ? `完成 ${GAME_RUN_LENGTH} 题，连击最高 ${gameStreak}。` : '生命耗尽，听清音标后再来挑战一次。'}{gameMistakes.length ? ` 还有 ${gameMistakes.length} 个声音放进了复习篮。` : ''}</p>
          {gameMistakes.length > 0 && <div className="mistake-review" aria-label="本局错题复习">{gameMistakes.slice(0, 4).map((index) => <button key={index} onClick={() => playSound(sounds[index], `review-${index}`)}><b>{sounds[index].symbol}</b><span>{sounds[index].words[0].word}</span><i>🔊</i></button>)}</div>}
          <button className="restart-game" onClick={startGame}>↻ 再来一局</button>
        </div> : <>
          <div className="game-progress"><span>第 {gameRound} / {GAME_RUN_LENGTH} 关</span><div><i style={{ width: `${(gameRound / GAME_RUN_LENGTH) * 100}%` }} /></div><small>宝石越多，探险奖励越高</small></div>
          <div className="question-heading"><span>{gameMode === 'maze' ? '声音守门人' : gameMode === 'railway' ? '列车调度任务' : gameMode === 'echo' ? '回声记忆任务' : '节拍合奏任务'}</span><h3>点击上方按钮先听一听题目声音</h3></div>
          <button className={`treasure-sound ${playing === 'game-question' ? 'playing' : ''}`} onClick={() => playSound(sounds[gameQuestion], 'game-question', false)}><span>🔊</span><b>点击听守门人的声音</b><small>可以重复播放</small></button>

          {gameMode === 'maze' && <MazeGame key={gameRound} round={gameRound} options={gameOptions} correct={gameQuestion} feedback={gameFeedback} labelFor={optionLabel} onAnswer={answerGame} onCollect={() => { setGameXp((xp) => xp + 2); setGameScore((score) => score + 1); }} />}
          {gameMode === 'railway' && <RailwayGame key={gameRound} options={gameOptions} correct={gameQuestion} feedback={gameFeedback} labelFor={optionLabel} onAnswer={answerGame} />}
          {gameMode === 'echo' && <EchoGame key={gameRound} options={gameOptions} correct={gameQuestion} feedback={gameFeedback} labelFor={optionLabel} onAnswer={answerGame} onPlay={playGameOption} />}
          {gameMode === 'rhythm' && <RhythmGame key={gameRound} options={gameOptions} correct={gameQuestion} feedback={gameFeedback} labelFor={optionLabel} onAnswer={answerGame} onPlay={playGameOption} />}
          <p className="game-tip">💡 连续答对 3 关会充满护盾；每种任务的操作方式都不同，先听清声音再行动。</p>
        </>}
      </div>
    </section>}

    <footer><span>🌈</span><p><b>音标探险岛</b><small>让每一个声音都变成好玩的发现</small></p><span>🧸</span></footer>

    {audioNotice && <div className="audio-toast" role="status">🔊 {audioNotice}</div>}
    <nav className="mobile-nav" aria-label="手机快捷导航">{mainTabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => openTab(tab.id)}><span>{tab.icon}</span>{tab.label.replace('探险', '').replace('系统', '').replace('音标', '').replace('游戏', '') || '游戏'}</button>)}</nav>
  </main>;
}
