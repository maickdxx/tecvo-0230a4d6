import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SupportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  variant?: "default" | "whatsapp" | "chat";
}

export function SupportCard({
  icon: Icon,
  title,
  description,
  buttonText,
  onClick,
  variant = "default",
}: SupportCardProps) {
  return (
    <Card className="flex flex-col h-full transition-shadow hover:shadow-lg">
      <CardHeader className="text-center pb-4">
        <div
          className={cn(
            "mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-4",
            variant === "whatsapp" && "bg-green-100 dark:bg-green-900/30",
            variant === "chat" && "bg-blue-100 dark:bg-blue-900/30",
            variant === "default" && "bg-primary/10"
          )}
        >
          <Icon
            className={cn(
              "h-7 w-7",
              variant === "whatsapp" && "text-green-600 dark:text-green-400",
              variant === "chat" && "text-blue-600 dark:text-blue-400",
              variant === "default" && "text-primary"
            )}
          />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <Button
          onClick={onClick}
          className={cn(
            "w-full",
            variant === "whatsapp" && "bg-green-600 hover:bg-green-700",
            variant === "chat" && "bg-blue-600 hover:bg-blue-700"
          )}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}
