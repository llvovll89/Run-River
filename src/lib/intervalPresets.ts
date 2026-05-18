export interface IntervalPreset {
  id: string;
  name: string;
  description: string;
  warmupSeconds?: number;
  runSeconds: number;
  restSeconds: number;
  sets: number; // 0 = 파틀렉(무한/수동)
  cooldownSeconds?: number;
}

export const INTERVAL_PRESETS: IntervalPreset[] = [
  {
    id: "buildup",
    name: "5K 빌드업",
    description: "워밍업 3분 · 1분 달리기 / 30초 휴식 × 5세트 · 쿨다운 3분",
    warmupSeconds: 180,
    runSeconds: 60,
    restSeconds: 30,
    sets: 5,
    cooldownSeconds: 180,
  },
  {
    id: "interval",
    name: "인터벌 8×",
    description: "워밍업 5분 · 2분 달리기 / 2분 휴식 × 8세트 · 쿨다운 5분",
    warmupSeconds: 300,
    runSeconds: 120,
    restSeconds: 120,
    sets: 8,
    cooldownSeconds: 300,
  },
  {
    id: "fartlek",
    name: "파틀렉",
    description: "자유 반복 · 버튼으로 페이즈 전환",
    runSeconds: 0,
    restSeconds: 0,
    sets: 0,
  },
];
