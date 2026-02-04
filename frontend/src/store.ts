import { create } from 'zustand';

export type PanelId = 'summary' | 'power' | 'effectiveLength' | 'angles' | 'speed' | 'forceCurve';

export interface PanelConfig {
  id: PanelId;
  label: string;
  visible: boolean;
}

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'summary', label: 'Piece Summary', visible: true },
  { id: 'power', label: 'Power', visible: true },
  { id: 'effectiveLength', label: 'Effective Length', visible: true },
  { id: 'angles', label: 'Catch & Finish Angles', visible: true },
  { id: 'speed', label: 'Boat Speed & Rating', visible: true },
  { id: 'forceCurve', label: 'Force Curve', visible: true },
];

interface DashboardState {
  selectedAthletes: Set<number>;
  currentStroke: number;
  totalStrokes: number;
  showCrewAverage: boolean;
  panels: PanelConfig[];

  toggleAthlete: (seat: number) => void;
  selectAllAthletes: () => void;
  deselectAllAthletes: () => void;
  setCurrentStroke: (stroke: number) => void;
  setTotalStrokes: (total: number) => void;
  toggleCrewAverage: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  togglePanel: (id: PanelId) => void;
  movePanelUp: (id: PanelId) => void;
  movePanelDown: (id: PanelId) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedAthletes: new Set([1, 2, 3, 4, 5, 6, 7, 8]),
  currentStroke: 1,
  totalStrokes: 1,
  showCrewAverage: true,
  panels: DEFAULT_PANELS,

  toggleAthlete: (seat) =>
    set((state) => {
      const newSet = new Set(state.selectedAthletes);
      if (newSet.has(seat)) {
        newSet.delete(seat);
      } else {
        newSet.add(seat);
      }
      return { selectedAthletes: newSet };
    }),

  selectAllAthletes: () =>
    set({ selectedAthletes: new Set([1, 2, 3, 4, 5, 6, 7, 8]) }),

  deselectAllAthletes: () =>
    set({ selectedAthletes: new Set() }),

  setCurrentStroke: (stroke) =>
    set((state) => ({
      currentStroke: Math.max(1, Math.min(stroke, state.totalStrokes)),
    })),

  setTotalStrokes: (total) =>
    set({ totalStrokes: total }),

  toggleCrewAverage: () =>
    set((state) => ({ showCrewAverage: !state.showCrewAverage })),

  stepForward: () =>
    set((state) => ({
      currentStroke: Math.min(state.currentStroke + 1, state.totalStrokes),
    })),

  stepBackward: () =>
    set((state) => ({
      currentStroke: Math.max(state.currentStroke - 1, 1),
    })),

  togglePanel: (id) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, visible: !p.visible } : p
      ),
    })),

  movePanelUp: (id) =>
    set((state) => {
      const panels = [...state.panels];
      const idx = panels.findIndex((p) => p.id === id);
      if (idx > 0) {
        [panels[idx - 1], panels[idx]] = [panels[idx], panels[idx - 1]];
      }
      return { panels };
    }),

  movePanelDown: (id) =>
    set((state) => {
      const panels = [...state.panels];
      const idx = panels.findIndex((p) => p.id === id);
      if (idx < panels.length - 1) {
        [panels[idx], panels[idx + 1]] = [panels[idx + 1], panels[idx]];
      }
      return { panels };
    }),
}));

export const ATHLETE_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#EAB308',
  4: '#22C55E',
  5: '#06B6D4',
  6: '#3B82F6',
  7: '#8B5CF6',
  8: '#EC4899',
};

export const CREW_COLOR = '#6B7280';
