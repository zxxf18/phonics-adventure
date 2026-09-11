'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import soundData from './phonics-data.json';
import { getCurrentUser, logout, startLogin, type AuthUser } from './auth-client';

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
type GameSceneKey = 'battle' | 'delivery' | 'maze' | 'builder' | 'pipes' | 'railway' | 'robot' | 'garden' | 'bridge' | 'space' | 'pirate' | 'kitchen';
type StageSceneKey = Exclude<GameSceneKey, 'maze'>;
type QuestionMode = 'sound' | 'word';
type QuestionModeSetting = 'mixed' | QuestionMode;
type GameFeedback = { selected: number; correct: boolean } | null;

const mainTabs: { id: MainTab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏝️', label: '探险首页' },
  { id: 'learn', icon: '🌈', label: '系统学习' },
  { id: 'catalog', icon: '📚', label: '音标图鉴' },
  { id: 'games', icon: '🎮', label: '游戏乐园' },
];

const gameScenes: { id: GameSceneKey; icon: string; title: string; description: string }[] = [
  { id: 'battle', icon: '🧙', title: '怪兽对战', description: '听准声音，释放随机技能' },
  { id: 'delivery', icon: '🛵', title: '森林快递', description: '送对门牌，遇见兔兔朋友' },
  { id: 'maze', icon: '🧭', title: '宝藏迷宫', description: '走进 7×7 随机迷宫' },
  { id: 'builder', icon: '🏗️', title: '起重建房', description: '吊起材料，逐层盖好房子' },
  { id: 'pipes', icon: '🔧', title: '管道急修', description: '判断裂口，选工具止住水' },
  { id: 'railway', icon: '🚂', title: '铁路调度', description: '拨动道岔，把列车送到站' },
  { id: 'robot', icon: '🤖', title: '机器人装配', description: '从传送带挑选正确零件' },
  { id: 'garden', icon: '🌱', title: '云朵花园', description: '播下声音种子，培育花园' },
  { id: 'bridge', icon: '🌉', title: '峡谷搭桥', description: '选对桥材，铺路救小动物' },
  { id: 'space', icon: '🚀', title: '星际对接', description: '校准信标，让飞船安全靠港' },
  { id: 'pirate', icon: '🏴‍☠️', title: '海盗航线', description: '看海图转舵，驶向藏宝岛' },
  { id: 'kitchen', icon: '🧁', title: '魔法厨房', description: '按配方投料，完成甜点订单' },
];

const sceneCopy: Record<StageSceneKey, {
  success: string[];
  failure: string[];
  optionIcons: string[];
}> = {
  battle: {
    optionIcons: ['🔥', '⚡', '❄️'],
    success: ['火焰飞弹命中！', '闪电连击成功！', '冰晶风暴胜利！'],
    failure: ['怪兽发动怒吼波！', '怪兽丢来大石头！', '怪兽使出尾巴扫击！'],
  },
  delivery: {
    optionIcons: ['📦', '✉️', '🎁'],
    success: ['小兔子挥手说谢谢！', '兔兔送你一根胡萝卜！', '兔兔邀请你参加茶会！'],
    failure: ['大灰狼嗷呜一声！', '狼先生突然打开门！', '大灰狼追着车跑来啦！'],
  },
  builder: {
    optionIcons: ['🧱', '🪵', '🪟'],
    success: ['砖块稳稳吊到二楼！', '屋梁安装得又直又牢！', '新窗户正好嵌进墙里！'],
    failure: ['吊错了材料，只能放回去！', '绳扣松开，木料摔裂啦！', '材料尺寸不对，起重机报警！'],
  },
  pipes: {
    optionIcons: ['🔧', '🩹', '🪛'],
    success: ['扳手拧紧了松动接口！', '密封贴堵住了细小裂缝！', '螺丝刀固定好了阀门！'],
    failure: ['裂缝变大，水喷出来啦！', '工具不合适，接口还在漏水！', '阀门被拧反，水花四溅！'],
  },
  railway: {
    optionIcons: ['↖️', '⬆️', '↗️'],
    success: ['道岔切换成功，列车准点进站！', '信号灯变绿，列车安全通过！', '轨道接通，动物乘客到站啦！'],
    failure: ['道岔拨错，列车停在缓冲垫前！', '红灯亮起，列车需要重新调度！', '轨道没有接通，列车原地鸣笛！'],
  },
  robot: {
    optionIcons: ['🦾', '⚙️', '🔋'],
    success: ['机械手臂安装完成！', '齿轮严丝合缝地转起来！', '能量电池点亮了机器人！'],
    failure: ['零件型号不对，传送带退货！', '齿轮卡住，机器人打了个喷嚏！', '电池装反，控制台闪红灯！'],
  },
  garden: {
    optionIcons: ['🌱', '🌷', '🌻'],
    success: ['声音种子长出了彩虹花！', '云朵洒下雨，花园又开一角！', '向日葵抬头跟你打招呼！'],
    failure: ['种子睡着了，还没有发芽！', '浇错花盆，只长出一撮杂草！', '乌云吹来，把种子帽吹跑啦！'],
  },
  bridge: {
    optionIcons: ['🪵', '🧱', '🪢'],
    success: ['新桥板牢牢扣在峡谷上！', '石墩落位，桥面更稳啦！', '绳索拉紧，小动物又前进一步！'],
    failure: ['桥板太短，掉进软泥里啦！', '石块有裂纹，不能继续使用！', '绳结打错，桥面晃了起来！'],
  },
  space: {
    optionIcons: ['📡', '🛰️', '🧭'],
    success: ['信标校准，飞船沿光轨进港！', '两艘飞船顺利完成对接！', '导航坐标正确，星星伙伴获救！'],
    failure: ['坐标偏移，飞船绕站一圈！', '信号连上了小行星，只好紧急断开！', '光轨方向反了，飞船启动刹车！'],
  },
  pirate: {
    optionIcons: ['🗺️', '🧭', '🔭'],
    success: ['船舵转对方向，抵达藏宝岛！', '罗盘指针锁定了黄金海湾！', '望远镜里出现闪亮宝箱！'],
    failure: ['航线绕进漩涡，只好掉头！', '罗盘看反，驶到了螃蟹礁！', '只找到一只漂流的旧靴子！'],
  },
  kitchen: {
    optionIcons: ['🥚', '🍓', '🥛'],
    success: ['蛋糕蓬蓬地出炉啦！', '饼干变成了小星星！', '魔法布丁闪闪发光！'],
    failure: ['配方放错，锅里冒出紫色泡泡！', '投料顺序错了，面团变成黏黏怪！', '烤箱打了一个大喷嚏！'],
  },
};

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
  feedback,
  labelFor,
  onAnswer,
}: {
  round: number;
  options: number[];
  feedback: GameFeedback;
  labelFor: (index: number) => string;
  onAnswer: (index: number) => void;
}) {
  const maze = useMemo(() => buildMaze(round), [round]);
  const [position, setPosition] = useState(maze.start);
  const [trail, setTrail] = useState(() => new Set([`${maze.start.x}-${maze.start.y}`]));
  const [bumped, setBumped] = useState(false);
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
    const exitIndex = maze.exits.findIndex((exit) => exit.x === next.x && exit.y === next.y);
    if (exitIndex >= 0) onAnswer(options[exitIndex]);
  }, [feedback, maze, onAnswer, options, position]);

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

  return <div className="maze-shell">
    <div className="maze-legend"><span>起点 🦁</span><b>走过的路会留下脚印</b><span>三条出口</span></div>
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
          {exitIndex >= 0 && <b className="maze-exit">{labelFor(options[exitIndex])}</b>}
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

function SceneStage({ scene, feedback, outcome, progress }: { scene: StageSceneKey; feedback: GameFeedback; outcome: number; progress: number }) {
  const copy = sceneCopy[scene];
  const state = feedback ? (feedback.correct ? 'success' : 'failure') : 'waiting';
  const message = feedback ? (feedback.correct ? copy.success[outcome % 3] : copy.failure[outcome % 3]) : '听清题目，选一个答案开始行动！';
  const className = `mission-stage mission-${scene} state-${state} variant-${outcome % 3}`;
  const caption = <p className="mission-caption">{message}</p>;

  if (scene === 'battle') return <div className={className} aria-live="polite">
    <span className="battle-wizard">🧙‍♀️</span><span className="battle-spell">{feedback ? (feedback.correct ? ['🔥', '⚡', '❄️'][outcome % 3] : ['🌪️', '🪨', '💨'][outcome % 3]) : '✨'}</span><span className="battle-monster">👾</span>{caption}
  </div>;

  if (scene === 'delivery') return <div className={className} aria-live="polite">
    <span className="delivery-scooter">🛵<i>📦</i></span><span className="delivery-path"/><span className="delivery-home">🏠</span><span className="delivery-reveal">{feedback ? (feedback.correct ? ['🐰', '🐇', '🥕'][outcome % 3] : '🐺') : '❓'}</span>{caption}
  </div>;

  if (scene === 'builder') return <div className={className} aria-live="polite">
    <div className="builder-crane"><span>🏗️</span><i/><b>{feedback ? (feedback.correct ? ['🧱', '🪵', '🪟'][outcome % 3] : ['🪨', '💔', '📦'][outcome % 3]) : '📦'}</b></div>
    <div className="builder-house" aria-label={`房屋完成 ${Math.min(progress, 4)} 部分`}>{[0, 1, 2, 3].map((part) => <i className={part < Math.min(progress, 4) ? 'built' : ''} key={part}/>) }<span>🏠</span></div>
    <b className="mission-meter">建造进度 {Math.min(progress, 4)}/4</b>{caption}
  </div>;

  if (scene === 'pipes') return <div className={className} aria-live="polite">
    <div className="pipe-network">{[0, 1, 2, 3].map((joint) => <i className={joint < Math.min(progress, 4) ? 'fixed' : joint === Math.min(progress, 4) ? 'leaking' : ''} key={joint}/>)}</div>
    <span className="pipe-tool">{feedback ? (feedback.correct ? ['🔧', '🩹', '🪛'][outcome % 3] : '🔨') : '🧰'}</span><span className="water-spray">💦</span>
    <b className="mission-meter">已修复 {Math.min(progress, 4)}/4 个漏点</b>{caption}
  </div>;

  if (scene === 'railway') return <div className={className} aria-live="polite">
    <span className="rail-signal">{feedback?.correct ? '🟢' : feedback ? '🔴' : '🟡'}</span><div className="rail-tracks"><i/><i/><i/></div><span className="rail-train">🚂</span><span className="rail-station">🚉</span>{caption}
  </div>;

  if (scene === 'robot') return <div className={className} aria-live="polite">
    <div className="robot-belt"><span>⚙️</span><span>🔋</span><span>🦾</span></div><span className="robot-body">{progress >= 4 ? '🤖' : '🦿'}</span><span className="robot-part">{feedback ? (feedback.correct ? ['🦾', '⚙️', '🔋'][outcome % 3] : '❌') : '🔩'}</span>
    <b className="mission-meter">装配进度 {Math.min(progress, 4)}/4</b>{caption}
  </div>;

  if (scene === 'garden') return <div className={className} aria-live="polite">
    <span className="garden-cloud">☁️</span><span className="watering-can">{feedback?.correct ? '🚿' : '🪣'}</span><div className="garden-plants">{[0, 1, 2, 3, 4].map((plant) => <i key={plant}>{plant < Math.min(progress, 5) ? ['🌱', '🌷', '🌻'][plant % 3] : '🟤'}</i>)}</div><span className="garden-weed">{feedback && !feedback.correct ? '🌵' : ''}</span>{caption}
  </div>;

  if (scene === 'bridge') return <div className={className} aria-live="polite">
    <span className="bridge-left">🦁</span><span className="bridge-right">🐿️</span><div className="bridge-deck">{[0, 1, 2, 3, 4].map((board) => <i className={board < Math.min(progress, 5) ? 'placed' : ''} key={board}/>)}</div><span className="bridge-piece">{feedback ? (feedback.correct ? '🪵' : '💥') : '🧰'}</span>
    <b className="mission-meter">桥面完成 {Math.min(progress, 5)}/5</b>{caption}
  </div>;

  if (scene === 'space') return <div className={className} aria-live="polite">
    <span className="space-stars">✦　·　🪐　·　✧</span><div className="space-orbit"/><span className="space-ship">🚀</span><span className="space-station">🛰️</span><span className="space-rock">{feedback && !feedback.correct ? '☄️' : ''}</span>{caption}
  </div>;

  if (scene === 'pirate') return <div className={className} aria-live="polite">
    <div className="pirate-route">·　·　·　·　✕</div><span className="pirate-ship">⛵</span><span className="pirate-island">🏝️</span><span className="pirate-find">{feedback ? (feedback.correct ? '💰' : ['🥾', '🦀', '🌿'][outcome % 3]) : '🗺️'}</span>{caption}
  </div>;

  return <div className={className} aria-live="polite">
    <div className="kitchen-order">订单：{['🎂', '⭐', '🍮'][outcome % 3]}</div><span className="kitchen-chef">🧑‍🍳</span><span className="kitchen-ingredient">{feedback ? (feedback.correct ? ['🥚', '🍓', '🥛'][outcome % 3] : '🧦') : '❓'}</span><span className="kitchen-pot">🫕</span><span className="kitchen-result">{feedback ? (feedback.correct ? ['🎂', '🍪', '🍮'][outcome % 3] : '🫧') : ''}</span>{caption}
  </div>;
}

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
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
  const [gameScene, setGameScene] = useState<GameSceneKey>('battle');
  const [questionModeSetting, setQuestionModeSetting] = useState<QuestionModeSetting>('mixed');
  const [randomSceneMode, setRandomSceneMode] = useState(false);
  const [gameOutcome, setGameOutcome] = useState(0);
  const [gameFeedback, setGameFeedback] = useState<GameFeedback>(null);
  const [sceneProgress, setSceneProgress] = useState<Record<GameSceneKey, number>>(() => Object.fromEntries(gameScenes.map((scene) => [scene.id, 0])) as Record<GameSceneKey, number>);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const progress = Math.round((learned.length / sounds.length) * 100);
  const questionMode: QuestionMode = questionModeSetting === 'mixed' ? (gameRound % 2 === 1 ? 'sound' : 'word') : questionModeSetting;
  const currentScene = gameScenes.find((scene) => scene.id === gameScene) ?? gameScenes[0];
  useEffect(() => { void getCurrentUser().then(setUser).finally(() => setAuthReady(true)); }, []);

  const gameOptions = useMemo(() => {
    const candidates = [gameQuestion, (gameQuestion + 11) % sounds.length, (gameQuestion + 27) % sounds.length];
    const shift = gameRound % candidates.length;
    return [...candidates.slice(shift), ...candidates.slice(0, shift)];
  }, [gameQuestion, gameRound]);

  function remember(index: number) {
    setLearned((old) => old.includes(index) ? old : [...old, index]);
  }

  function openTab(tab: MainTab, nextLearnTab?: LearnTab) {
    if (tab !== 'home' && !user) { if (authReady) startLogin(); return; }
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
    if (!user) { if (authReady) startLogin(); return; }
    remember(item.index);
    playPlaylist([item.phonemeAudio], key, announce ? `正在播放 ${item.symbol}` : undefined);
  }

  function playWord(word: WordExample, key = `word-${word.word}`) {
    if (!user) { if (authReady) startLogin(); return; }
    playPlaylist([word.audio], key, `正在播放 ${word.word}`);
  }

  function playGrapheme(item: Grapheme) {
    if (!user) { if (authReady) startLogin(); return; }
    const related = item.sounds.map(soundByIndex);
    related.forEach((sound) => remember(sound.index));
    playPlaylist(related.map((sound) => sound.phonemeAudio), `grapheme-${item.mark}-${item.example}`, `正在播放 ${item.mark} 的声音`);
  }

  function answerGame(selected: number) {
    if (gameFeedback) return;
    const correct = selected === gameQuestion;
    setGameFeedback({ selected, correct });
    setGameOutcome(randomIndex(3));
    if (correct) {
      setGameScore((score) => score + 1);
      setGameStreak((streak) => streak + 1);
      setSceneProgress((old) => ({ ...old, [gameScene]: old[gameScene] + 1 }));
      remember(sounds[gameQuestion].index);
    } else {
      setGameStreak(0);
    }
    const nextQuestion = (gameQuestion * 7 + gameRound * 13 + 5) % sounds.length;
    window.setTimeout(() => {
      setGameRound((round) => round + 1);
      setGameQuestion(nextQuestion === gameQuestion ? (nextQuestion + 1) % sounds.length : nextQuestion);
      setGameFeedback(null);
      if (randomSceneMode) {
        const choices = gameScenes.filter((scene) => scene.id !== gameScene);
        setGameScene(choices[randomIndex(choices.length)].id);
      }
    }, 2200);
  }

  function chooseScene(scene: GameSceneKey) {
    if (gameFeedback) return;
    setRandomSceneMode(false);
    setGameScene(scene);
  }

  function chooseRandomScene() {
    if (gameFeedback) return;
    const choices = gameScenes.filter((scene) => scene.id !== gameScene);
    setRandomSceneMode(true);
    setGameScene(choices[randomIndex(choices.length)].id);
  }

  function optionLabel(index: number) {
    return questionMode === 'sound' ? sounds[index].symbol : sounds[index].words[0].word;
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
      {user ? <button className="auth-button" onClick={() => void logout()}>{user.display_name || user.username} · 退出</button> : <button className="auth-button" onClick={() => startLogin()}>登录夜不洛</button>}
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
      <div className="star-pill" aria-label={`已认识 ${learned.length} 个声音`}>⭐ <b>{learned.length}</b><span>/48</span></div>
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
          <button onClick={() => { chooseRandomScene(); openTab('games'); }}>随机来一局 →</button>
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
      <div className="section-heading game-heading"><div><span className="section-kicker">SOUND QUEST ARCADE</span><h2>🎮 声音游戏乐园</h2><p>十二种游戏拥有不同任务和反馈。可以指定题型，也可以在“听音选音标”和“根据音标选单词”之间自动交替。</p></div><div className="game-score"><span>⭐ {gameScore}</span><span>🔥 {gameStreak}</span></div></div>

      <div className="question-mode-picker" aria-label="选择题型">
        <span>题型</span>
        <button className={questionModeSetting === 'mixed' ? 'active' : ''} onClick={() => setQuestionModeSetting('mixed')} disabled={Boolean(gameFeedback)}>🔀 混合交替</button>
        <button className={questionModeSetting === 'sound' ? 'active' : ''} onClick={() => setQuestionModeSetting('sound')} disabled={Boolean(gameFeedback)}>🔊 听音选音标</button>
        <button className={questionModeSetting === 'word' ? 'active' : ''} onClick={() => setQuestionModeSetting('word')} disabled={Boolean(gameFeedback)}>🔤 看音标选单词</button>
      </div>

      <div className="scene-picker" aria-label="选择游戏场景">
        <button className={`random-scene ${randomSceneMode ? 'active' : ''}`} onClick={chooseRandomScene} disabled={Boolean(gameFeedback)}><span>🎲</span><b>随机来一局</b><small>每题自动换场景</small></button>
        {gameScenes.map((scene) => <button key={scene.id} className={gameScene === scene.id && !randomSceneMode ? 'active' : ''} onClick={() => chooseScene(scene.id)} disabled={Boolean(gameFeedback)}><span>{scene.icon}</span><b>{scene.title}</b><small>{scene.description}</small></button>)}
      </div>

      <div className={`game-board adventure-board theme-${gameScene}`}>
        <div className="game-progress"><span>第 {gameRound} 题</span><div><i style={{ width: `${((gameRound - 1) % 10 + 1) * 10}%` }} /></div><small>{randomSceneMode ? '🎲 随机场景中' : currentScene.title}</small></div>
        <div className="question-heading"><span>{questionMode === 'sound' ? '听音辨认' : '单词侦探'}</span><h3>{questionMode === 'sound' ? '听一听，选出正确的音标' : <>哪个单词包含 <strong>{sounds[gameQuestion].symbol}</strong> 这个音？</>}</h3></div>
        <button className={`treasure-sound ${playing === 'game-question' ? 'playing' : ''}`} onClick={() => playSound(sounds[gameQuestion], 'game-question', false)}><span>🔊</span><b>{questionMode === 'sound' ? '点击听题目' : `听听 ${sounds[gameQuestion].symbol}`}</b><small>可以重复播放</small></button>

        {gameScene === 'maze' ? <MazeGame key={gameRound} round={gameRound} options={gameOptions} feedback={gameFeedback} labelFor={optionLabel} onAnswer={answerGame} /> : <>
          <SceneStage scene={gameScene} feedback={gameFeedback} outcome={gameOutcome} progress={sceneProgress[gameScene]} />
          <div className={`game-options scene-options options-${gameScene}`}>{gameOptions.map((index, optionIndex) => {
            const item = sounds[index];
            const isCorrect = gameFeedback && index === gameQuestion;
            const isWrong = gameFeedback && gameFeedback.selected === index && !gameFeedback.correct;
            const copy = sceneCopy[gameScene];
            return <button key={`${gameRound}-${index}`} className={isCorrect ? 'correct' : isWrong ? 'wrong' : ''} onClick={() => answerGame(index)} disabled={Boolean(gameFeedback)}>
              <i>{copy.optionIcons[optionIndex]}</i>
              <strong>{questionMode === 'sound' ? item.symbol : item.words[0].word}</strong>
              <span>{questionMode === 'sound' ? soundGroup(item) : gameFeedback ? `${item.words[0].ipa} · ${item.words[0].meaning}` : item.words[0].meaning}</span>
              {isCorrect && <em>答对啦！</em>}{isWrong && <em>再听一听</em>}
            </button>;
          })}</div>
        </>}
        <p className="game-tip">💡 小提示：先完整听完，再做选择。迷宫支持键盘方向键；建造、修理、装配等任务会累积进度。</p>
      </div>
    </section>}

    <footer><span>🌈</span><p><b>音标探险岛</b><small>让每一个声音都变成好玩的发现</small></p><span>🧸</span></footer>

    {audioNotice && <div className="audio-toast" role="status">🔊 {audioNotice}</div>}
    <nav className="mobile-nav" aria-label="手机快捷导航">{mainTabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => openTab(tab.id)}><span>{tab.icon}</span>{tab.label.replace('探险', '').replace('系统', '').replace('音标', '').replace('游戏', '') || '游戏'}</button>)}</nav>
  </main>;
}
