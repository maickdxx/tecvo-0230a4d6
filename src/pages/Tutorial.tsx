import { AppLayout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TutorialModule } from "@/components/tutorial";
import { BookOpen } from "lucide-react";
import { tutorialModules } from "@/data/tutorialModules";

export default function Tutorial() {
  return (
    <AppLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tutorial</h1>
            <p className="text-muted-foreground">Aprenda a usar todas as funcionalidades do Tecvo</p>
          </div>
        </div>

        <Tabs defaultValue="primeiros-passos" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-max">
              {tutorialModules.map((module) => {
                const Icon = module.icon;
                return (
                  <TabsTrigger key={module.id} value={module.id} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{module.title}</span>
                    <span className="sm:hidden">{module.title.split(" ")[0]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {tutorialModules.map((module) => (
            <TabsContent key={module.id} value={module.id} className="mt-4">
              <TutorialModule module={module} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
