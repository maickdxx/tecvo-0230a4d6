import { 
  AbsoluteFill, 
  useCurrentFrame, 
  interpolate, 
  spring, 
  useVideoConfig,
  Sequence
} from "remotion";
import { AlertCircle, Clock, Users, Calendar, ArrowRightCircle } from "lucide-react";

export const SceneBurnout = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animations
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const shake = Math.sin(frame * 0.5) * 2;

  return (
    <AbsoluteFill className="bg-slate-950 text-white flex flex-col items-center justify-center p-12 overflow-hidden">
      {/* Background elements to represent chaos */}
      <AbsoluteFill className="opacity-20">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: `${(i * 137) % 100}%`,
              left: `${(i * 253) % 100}%`,
              transform: `rotate(${(frame + i * 40) % 360}deg) scale(${0.5 + Math.sin(frame / 20 + i) * 0.2})`,
            }}
          >
            <AlertCircle size={100} className="text-red-500" />
          </div>
        ))}
      </AbsoluteFill>

      {/* Main Character Proxy (Icon with high tension) */}
      <div 
        className="relative z-10 flex flex-col items-center gap-8"
        style={{ transform: `translateY(${shake}px) scale(${scaleSpring})` }}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
          <div className="bg-slate-900 border-4 border-red-500 p-8 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.3)]">
            <AlertCircle size={120} className="text-red-500" />
          </div>
        </div>

        {/* Narrative Spoken Script (Subtitles) */}
        <div className="text-center max-w-md space-y-4 px-4">
          <Sequence from={0} durationInFrames={90}>
            <p className="text-2xl font-light italic text-slate-300 italic animate-pulse">
              "Cara… eu não aguento mais isso…"
            </p>
          </Sequence>
          <Sequence from={90} durationInFrames={120}>
            <p className="text-2xl font-light italic text-slate-300 italic">
              "Cliente me cobrando, já esqueci serviço…"
            </p>
          </Sequence>
          <Sequence from={210} durationInFrames={90}>
            <p className="text-2xl font-light italic text-slate-300 italic">
              "trabalho o dia inteiro… e nada anda…"
            </p>
          </Sequence>
        </div>
      </div>

      {/* Dynamic Captions (Reels style) */}
      <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center gap-4 px-8 z-20">
        <Sequence from={15} durationInFrames={60}>
          <div className="bg-red-600 text-white font-black text-4xl px-6 py-3 rounded-lg transform -rotate-2 shadow-xl">
            NÃO AGUENTO MAIS
          </div>
        </Sequence>
        
        <Sequence from={75} durationInFrames={60}>
          <div className="bg-orange-600 text-white font-black text-4xl px-6 py-3 rounded-lg transform rotate-1 shadow-xl flex items-center gap-3">
            <Users size={40} />
            CLIENTE ESQUECIDO
          </div>
        </Sequence>

        <Sequence from={135} durationInFrames={60}>
          <div className="bg-amber-600 text-white font-black text-4xl px-6 py-3 rounded-lg transform -rotate-1 shadow-xl flex items-center gap-3">
            <Calendar size={40} />
            AGENDA BAGUNÇADA
          </div>
        </Sequence>

        <Sequence from={195} durationInFrames={105}>
          <div className="bg-slate-100 text-slate-900 font-black text-3xl px-6 py-3 rounded-lg transform rotate-1 shadow-xl text-center leading-tight">
            TRABALHANDO MUITO,<br />SEM SAIR DO LUGAR
          </div>
        </Sequence>
      </div>

      {/* Floating Icons of Chaos */}
      <Sequence from={60}>
        <div className="absolute top-40 right-10 animate-bounce">
          <Clock size={48} className="text-slate-500 opacity-50" />
        </div>
      </Sequence>
      <Sequence from={120}>
        <div className="absolute top-60 left-10 animate-pulse">
          <AlertCircle size={48} className="text-red-500 opacity-50" />
        </div>
      </Sequence>
      
      {/* ProgressBar */}
      <div className="absolute bottom-10 left-10 right-10 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-red-500 transition-all"
          style={{ width: `${(frame / 300) * 100}%` }}
        />
      </div>
    </AbsoluteFill>
  );
};