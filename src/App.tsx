import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./index.css";
import { useRef } from "react";

function MetadataTab() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4 h-full overflow-y-auto">
      <form className="grid gap-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="map-name" className="text-right">
            Map Name
          </Label>
          <Input id="map-name" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="artist" className="text-right">
            Artist
          </Label>
          <Input id="artist" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="map-author" className="text-right">
            Map Author
          </Label>
          <Input id="map-author" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="difficulty-name" className="text-right">
            Difficulty Name
          </Label>
          <Input id="difficulty-name" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Image</Label>
          <div className="col-span-3">
            <input type="file" accept="image/*" ref={imageInputRef} className="hidden" />
            <Button type="button" onClick={() => imageInputRef.current?.click()} variant="outline">
              Select Image
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">Song</Label>
          <div className="col-span-3">
            <input type="file" accept="audio/*" ref={songInputRef} className="hidden" />
            <Button type="button" onClick={() => songInputRef.current?.click()} variant="outline">
              Select Song
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CanvasTab() {
  return (
    <div className="w-full h-full">
      <canvas className="w-full h-full bg-card border rounded-lg"></canvas>
    </div>
  );
}

export function App() {
  return (
    <main className="w-screen h-screen flex flex-col bg-background text-foreground">
      <Tabs defaultValue="metadata" className="w-full h-full flex flex-col p-2 gap-2">
        <TabsList className="mx-auto shrink-0">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="timing">Timing</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="flex-grow min-h-0 bg-card rounded-lg border">
          <MetadataTab />
        </TabsContent>
        <TabsContent value="design" className="flex-grow min-h-0">
          <CanvasTab />
        </TabsContent>
        <TabsContent value="timing" className="flex-grow min-h-0">
          <CanvasTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default App;
