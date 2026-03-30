import { ArrowLeft, Sun, Moon, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useColorTheme, type ColorTheme } from "@/hooks/useColorTheme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface AppearanceSettingsProps {
  onBack: () => void;
}

const modeOptions = [
  { id: "light", name: "Claro", icon: Sun },
  { id: "dark", name: "Escuro", icon: Moon },
  { id: "system", name: "Sistema", icon: Monitor },
];

const colorThemes: { id: ColorTheme; name: string; hsl: string }[] = [
  { id: "blue", name: "Azul", hsl: "230 72% 52%" },
  { id: "purple", name: "Roxo", hsl: "262 72% 52%" },
  { id: "orange", name: "Laranja", hsl: "24 90% 50%" },
  { id: "green", name: "Verde", hsl: "160 72% 38%" },
];

export function AppearanceSettings({ onBack }: AppearanceSettingsProps) {
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const { user, profile, refreshProfile } = useAuth();

  const handleModeChange = async (mode: string) => {
    setTheme(mode);
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_mode: mode })
        .eq("user_id", user.id);
      
      if (error) throw error;
      refreshProfile();
    } catch (err) {
      console.error("Error saving theme mode:", err);
      toast({
        title: "Erro ao salvar preferência",
        description: "Suas alterações podem não ser sincronizadas entre dispositivos.",
        variant: "destructive",
      });
    }
  };

  const handleColorChange = async (newColorTheme: ColorTheme) => {
    setColorTheme(newColorTheme);
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ color_theme: newColorTheme })
        .eq("user_id", user.id);
      
      if (error) throw error;
      refreshProfile();
    } catch (err) {
      console.error("Error saving color theme:", err);
      toast({
        title: "Erro ao salvar preferência",
        description: "Suas alterações podem não ser sincronizadas entre dispositivos.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aparência</h1>
          <p className="text-muted-foreground">Personalize o tema da interface</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Modo</p>
        <div className="grid grid-cols-3 gap-4">
          {modeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleModeChange(opt.id)}
                className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`rounded-lg p-3 ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {opt.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color theme selector */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Paleta de cores</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {colorThemes.map((ct) => {
            const isSelected = colorTheme === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => setColorTheme(ct.id)}
                className={`relative flex items-center gap-3 rounded-xl border-2 p-3.5 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`h-8 w-8 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-background ${isSelected ? "ring-current" : "ring-transparent"}`}
                  style={{
                    backgroundColor: `hsl(${ct.hsl})`,
                    color: `hsl(${ct.hsl})`,
                  }}
                />
                <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {ct.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        As preferências são salvas automaticamente no seu navegador.
      </p>
    </div>
  );
}
