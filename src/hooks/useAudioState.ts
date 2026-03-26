import { create } from 'zustand';

interface AudioState {
  currentlyPlaying: string | null;
  setCurrentlyPlaying: (id: string | null) => void;
}

export const useAudioState = create<AudioState>((set) => ({
  currentlyPlaying: null,
  setCurrentlyPlaying: (id) => set({ currentlyPlaying: id }),
}));
