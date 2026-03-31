import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, Video, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MarketingReels() {
  const [copied, setCopied] = useState(false);

  const script = `Cara… eu não aguento mais isso…
Cliente me cobrando, já esqueci serviço…
trabalho o dia inteiro… e nada anda…`;

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success("Roteiro copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="container max-w-5xl py-8 space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Marketing: Storyboard de Reels</h1>
          <p className="text-muted-foreground">
            Visualize o roteiro e a estrutura do vídeo criado para gerar identificação com seu público.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Visual Storyboard (Simulation) */}
          <Card className="bg-slate-950 text-white border-slate-800 overflow-hidden shadow-2xl">
            <CardHeader className="border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Video className="h-4 w-4 text-red-500" />
                  Preview do Reel (Simulação)
                </CardTitle>
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                  9:16 Vertical
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 aspect-[9/16] relative flex flex-col items-center justify-center bg-slate-950">
              {/* Background Chaos Icons */}
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <AlertCircle className="absolute top-10 left-10 h-20 w-20 text-red-500 animate-pulse" />
                <AlertCircle className="absolute bottom-20 right-10 h-32 w-32 text-red-500 opacity-50" />
                <AlertCircle className="absolute top-1/2 left-1/4 h-12 w-12 text-red-500" />
              </div>

              {/* Character Proxy */}
              <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center">
                <div className="h-24 w-24 rounded-full bg-slate-900 border-2 border-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-bounce">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                </div>
                
                <div className="space-y-4">
                  <p className="text-lg italic text-slate-400">"Cara… eu não aguento mais isso..."</p>
                  <div className="bg-red-600 text-white font-black text-2xl px-4 py-2 rounded transform -rotate-2 shadow-lg">
                    NÃO AGUENTO MAIS
                  </div>
                </div>
              </div>

              {/* Instructions Overlay */}
              <div className="absolute inset-0 bg-black/60 flex flex-center items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer group">
                <div className="text-center p-6">
                  <Play className="h-12 w-12 text-white mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-white">Ver Storyboard Completo</p>
                  <p className="text-xs text-slate-300 mt-2">Código Remotion pronto para renderização</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details & Script */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Roteiro Sugerido</CardTitle>
                <CardDescription>Atuação: Estilo desabafo, sem olhar para a câmera.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg relative group">
                  <pre className="text-sm whitespace-pre-wrap font-sans italic leading-relaxed">
                    {script}
                  </pre>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={copyScript}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Legendas em Tela
                  </h4>
                  <ul className="grid grid-cols-1 gap-2">
                    <li className="text-xs bg-secondary p-2 rounded border leading-tight">"Não aguento mais"</li>
                    <li className="text-xs bg-secondary p-2 rounded border leading-tight">"Cliente esquecido"</li>
                    <li className="text-xs bg-secondary p-2 rounded border leading-tight">"Agenda bagunçada"</li>
                    <li className="text-xs bg-secondary p-2 rounded border leading-tight">"Trabalhando muito, sem sair do lugar"</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Objetivo do Vídeo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Este vídeo foi projetado para gerar **identificação imediata** com prestadores de serviço que sofrem com a desorganização. 
                  Ao mostrar a dor (caos, cobranças, esquecimento), preparamos o terreno para apresentar o **Tecvo** como a solução definitiva.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}