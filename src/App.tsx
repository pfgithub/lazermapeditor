import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignTab } from "@/components/DesignTab";
import { MetadataTab } from "@/components/MetadataTab";
import { TimingTab } from "@/components/TimingTab";
import "./index.css";
import { useEffect } from "react";
import { useAppStore } from "./store";
import { AudioPlayer } from "./components/AudioPlayer";

// Types are now in src/store.ts

export function App() {
  const { map, song, setMap, setSongFile, loadFromDb, isInitialized } = useAppStore();

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  // Global cleanup for blob URL on app close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentSong = useAppStore.getState().song;
      if (currentSong?.url) {
        URL.revokeObjectURL(currentSong.url);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background text-foreground">
        <p>Loading project from database...</p>
      </div>
    );
  }

  return (
    <main className="w-screen h-screen flex flex-col bg-background text-foreground p-2 gap-2">
      <div className="shrink-0">
        <AudioPlayer />
      </div>
      <Tabs defaultValue="metadata" className="w-full flex-grow flex flex-col gap-2 min-h-0">
        <TabsList className="mx-auto shrink-0">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="flex-grow min-h-0 bg-card rounded-lg border">
          <MetadataTab song={song} setSong={setSongFile} />
        </TabsContent>
        <TabsContent value="design" className="flex-grow min-h-0">
          <DesignTab map={map} />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0 bg-card rounded-lg border">
          <TimingTab map={map} setMap={setMap} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default App;
