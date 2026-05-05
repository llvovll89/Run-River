export interface IntervalPreset {
  id: string;
  name: string;
  description: string;
  runSeconds: number;
  restSeconds: number;
  sets: number; // 0 = 파틀렉(무한/수동)
}

export const INTERVAL_PRESETS: IntervalPreset[] = [
  { id: "buildup",  name: "5K 빌드업",  description: "1분 달리기 / 30초 휴식 × 5세트", runSeconds: 60,  restSeconds: 30,  sets: 5 },
  { id: "interval", name: "인터벌 8×",  description: "2분 달리기 / 2분 휴식 × 8세트",  runSeconds: 120, restSeconds: 120, sets: 8 },
  { id: "fartlek",  name: "파틀렉",     description: "자유 반복 · 버튼으로 페이즈 전환", runSeconds: 0,   restSeconds: 0,   sets: 0 },
];
