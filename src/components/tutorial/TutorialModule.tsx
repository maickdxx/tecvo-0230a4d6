import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TutorialStep } from "./TutorialStep";

export interface TutorialStepData {
  title: string;
  description: string;
  tips?: string[];
  warning?: string;
}

export interface TutorialModuleData {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  steps: TutorialStepData[];
}

interface TutorialModuleProps {
  module: TutorialModuleData;
}

export function TutorialModule({ module }: TutorialModuleProps) {
  const Icon = module.icon;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{module.title}</CardTitle>
            <CardDescription>{module.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {module.steps.map((step, index) => (
            <AccordionItem key={index} value={`step-${index}`}>
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </div>
                  <span className="font-medium">{step.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pl-9">
                  <TutorialStep
                    stepNumber={index + 1}
                    title={step.title}
                    description={step.description}
                    tips={step.tips}
                    warning={step.warning}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
