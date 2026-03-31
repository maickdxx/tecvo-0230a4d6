import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, FileText, Users, MessageCircle, History, UsersRound, ArrowRight, X, ChevronDown } from "lucide-react";
import { trackFBCustomEvent } from "@/lib/fbPixel";
import { SocialProofNotification } from "@/components/landing/SocialProofNotification";

const TOTAL_STEPS = 6;

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.12 } },
};

const benefits = [
  { icon: Calendar, title: "Veja sua agenda organizada todos os dias", desc: "Nunca mais esqueça um serviço agendado." },
  { icon: FileText, title: "Envie ordens de serviço profissionais", desc: "Impressione seus clientes com documentos prontos." },
  { icon: Users, title: "Tenha todos os seus clientes em um só lugar", desc: "Histórico, endereço, equipamentos — tudo acessível." },
  { icon: MessageCircle, title: "Fale com seus clientes pelo WhatsApp", desc: "Sem sair do sistema, direto e rápido." },
  { icon: History, title: "Consulte todo o histórico de serviços", desc: "Saiba exatamente o que foi feito em cada cliente." },
  { icon: UsersRound, title: "Controle sua equipe com facilidade", desc: "Agenda, tarefas e desempenho da equipe em tempo real." },
];

export default function ParaVoce() {
  const [step, setStep] = useState(1);
  const [rejected, setRejected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Tecvo — Essa plataforma é para você?";
    trackFBCustomEvent("ParaVocePagina");
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const progress = ((step) / TOTAL_STEPS) * 100;

  if (rejected) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-6">
        <motion.div {...fadeUp} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[#2547D0]/10 flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-[#2547D0]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Essa plataforma não foi desenvolvida para o seu tipo de operação.</h2>
          <p className="text-white/50 mb-8">A Tecvo é exclusiva para o setor de ar-condicionado. Mas desejamos sucesso no seu negócio!</p>
          <button onClick={() => window.close()} className="text-[#2547D0] font-medium hover:underline">
            Fechar página
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white overflow-hidden">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/5">
        <motion.div
          className="h-full bg-[#2547D0]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Logo */}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-[#2547D0] flex items-center justify-center">
          <span className="text-white font-black text-lg">T</span>
        </div>
        <span className="font-bold text-lg text-white tracking-tight">tecvo</span>
      </div>

      <div className="min-h-screen flex items-center justify-center px-6 py-24">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step key="s1">
              <motion.div {...fadeUp} className="text-center max-w-lg mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2547D0]/10 border border-[#2547D0]/20 text-[#5B7FF5] text-sm font-medium mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2547D0] animate-pulse" />
                  Plataforma exclusiva
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1] mb-6 tracking-tight">
                  Essa plataforma é<br />
                  <span className="text-[#2547D0]">para você?</span>
                </h1>

                <p className="text-white/60 text-lg leading-relaxed mb-4">
                  A Tecvo foi criada exclusivamente para empresas e profissionais do setor de <strong className="text-white/80">ar-condicionado</strong>.
                </p>
                <p className="text-white/50 text-base leading-relaxed mb-12">
                  Aqui você encontra ferramentas pensadas para quem trabalha com instalação, manutenção, limpeza, PMOC e gestão de serviços.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={next}
                    className="px-8 py-4 bg-[#2547D0] hover:bg-[#1d3bb0] text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_0_30px_rgba(37,71,208,0.3)] hover:shadow-[0_0_40px_rgba(37,71,208,0.45)] text-base"
                  >
                    Sou do ramo de ar-condicionado
                  </button>
                  <button
                    onClick={() => setRejected(true)}
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-medium rounded-xl transition-all duration-200 border border-white/10 text-base"
                  >
                    Não sou desse ramo
                  </button>
                </div>
              </motion.div>
            </Step>
          )}

          {step === 2 && (
            <Step key="s2">
              <motion.div {...fadeUp} className="text-center max-w-lg mx-auto">
                <div className="text-5xl mb-8">😔</div>
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight mb-6 tracking-tight">
                  Quantos clientes você já <span className="text-red-400">perdeu</span> porque esqueceu de avisar a manutenção?
                </h2>
                <p className="text-white/55 text-lg leading-relaxed mb-4">
                  Você faz o serviço, o cliente some... e você nunca mais fala com ele.
                </p>
                <p className="text-white/70 text-lg font-medium mb-6">
                  Isso não é falta de cliente.<br />
                  <span className="text-white">É falta de sistema.</span>
                </p>
                <p className="text-white/40 text-sm leading-relaxed mb-12">
                  Essa é só uma das dezenas de funcionalidades que a Tecvo usa para ajudar empresas de ar-condicionado a crescer com organização e recorrência.
                </p>
                <ContinueButton onClick={next} />
              </motion.div>
            </Step>
          )}

          {step === 3 && (
            <Step key="s3">
              <motion.div {...fadeUp} className="text-center max-w-lg mx-auto">
                <div className="text-5xl mb-8">⚡</div>
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight mb-6 tracking-tight">
                  O Tecvo trabalha<br /><span className="text-[#2547D0]">por você.</span>
                </h2>
                <div className="space-y-4 text-left bg-white/[0.03] rounded-2xl p-6 border border-white/[0.06] mb-12">
                  {[
                    "O sistema lembra automaticamente seus clientes de limpeza e manutenção.",
                    "Você para de depender da memória e começa a ter recorrência.",
                    "Clientes voltam. Agenda enche. Receita previsível.",
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#22C55E]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                      </div>
                      <p className="text-white/70 text-base leading-relaxed">{t}</p>
                    </div>
                  ))}
                </div>
                <ContinueButton onClick={next} />
              </motion.div>
            </Step>
          )}

          {step === 4 && (
            <Step key="s4">
              <motion.div {...fadeUp} className="max-w-2xl mx-auto">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
                    Tudo que você precisa,<br /><span className="text-[#2547D0]">num só lugar</span>
                  </h2>
                  <p className="text-white/50">Sem complicação. Feito para o seu dia a dia.</p>
                </div>
                <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {benefits.map((b, i) => (
                    <motion.div
                      key={i}
                      variants={fadeUp}
                      className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#2547D0]/10 flex items-center justify-center flex-shrink-0">
                        <b.icon className="w-5 h-5 text-[#5B7FF5]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-[15px] mb-1">{b.title}</h3>
                        <p className="text-white/45 text-sm leading-relaxed">{b.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
                <div className="text-center mt-10">
                  <ContinueButton onClick={next} />
                </div>
              </motion.div>
            </Step>
          )}

          {step === 5 && (
            <Step key="s5">
              <motion.div {...fadeUp} className="text-center max-w-lg mx-auto">
                <div className="text-5xl mb-8">🔒</div>
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight mb-6 tracking-tight">
                  A Tecvo <span className="text-[#2547D0]">não é para todo mundo.</span>
                </h2>
                <p className="text-white/60 text-lg leading-relaxed mb-4">
                  É para quem quer parar de trabalhar no improviso e começar a crescer com organização.
                </p>
                <p className="text-white/70 text-lg font-medium mb-12">
                  Se você leva seu negócio a sério,<br />
                  <span className="text-white">você vai entender o valor disso.</span>
                </p>
                <ContinueButton onClick={next} />
              </motion.div>
            </Step>
          )}

          {step === 6 && (
            <Step key="s6">
              <motion.div {...fadeUp} className="text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-[#2547D0] flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(37,71,208,0.4)]">
                  <span className="text-white font-black text-3xl">T</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
                  Comece agora e veja<br /><span className="text-[#2547D0]">na prática</span>
                </h2>
                <p className="text-white/55 text-lg mb-10">
                  Crie sua conta grátis em menos de 1 minuto.<br />Sem compromisso. Sem cartão.
                </p>
                <button
                  onClick={() => navigate("/cadastro")}
                  className="px-10 py-5 bg-[#2547D0] hover:bg-[#1d3bb0] text-white font-bold rounded-xl transition-all duration-200 shadow-[0_0_40px_rgba(37,71,208,0.35)] hover:shadow-[0_0_50px_rgba(37,71,208,0.5)] text-lg group"
                >
                  Criar minha conta grátis
                  <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            </Step>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-8 py-4 bg-[#2547D0] hover:bg-[#1d3bb0] text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_0_30px_rgba(37,71,208,0.3)] hover:shadow-[0_0_40px_rgba(37,71,208,0.45)] text-base group"
    >
      Continuar
      <ChevronDown className="inline-block ml-2 w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
    </button>
  );
}
