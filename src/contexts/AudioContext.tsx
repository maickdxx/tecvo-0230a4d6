import React, { createContext, useContext, useState, useCallback } from 'react';

interface AudioContextType {
  activeId: string | null;
  play: (id: string) => void;
  stop: (id: string) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const play = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const stop = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  return (
    <AudioContext.Provider value={{ activeId, play, stop }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioGlobal = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioGlobal must be used within an AudioProvider');
  }
  return context;
};
