import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeedback } from "@/hooks/useFeedback";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

const feedbackSchema = z.object({
  type: z.enum(["bug", "melhoria", "sugestao"]),
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres").max(200),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres").max(2000),
});

export function FeedbackForm() {
  const [type, setType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { createFeedback } = useFeedback();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = feedbackSchema.safeParse({ type, title, description });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    createFeedback.mutate({ type: parsed.data.type, title: parsed.data.title, description: parsed.data.description }, {
      onSuccess: () => {
        toast({ title: "Feedback enviado!", description: "Obrigado pela sua contribuição." });
        setType("");
        setTitle("");
        setDescription("");
      },
      onError: () => {
        toast({ title: "Erro ao enviar feedback", description: "Tente novamente.", variant: "destructive" });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedback-type">Tipo</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="feedback-type">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bug">🐛 Bug</SelectItem>
            <SelectItem value="melhoria">📈 Melhoria</SelectItem>
            <SelectItem value="sugestao">💡 Sugestão</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-title">Título</Label>
        <Input
          id="feedback-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resumo do feedback"
          maxLength={200}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-description">Descrição</Label>
        <Textarea
          id="feedback-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva em detalhes..."
          rows={4}
          maxLength={2000}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <Button type="submit" disabled={createFeedback.isPending} className="w-full gap-2">
        <Send className="h-4 w-4" />
        {createFeedback.isPending ? "Enviando..." : "Enviar Feedback"}
      </Button>
    </form>
  );
}
