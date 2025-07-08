import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Song } from "@/store";

interface MetadataTabProps {
  song: Song | null;
  setSong: (song: File | null) => void;
}

export function MetadataTab({ song, setSong }: MetadataTabProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);

  const handleSongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSong(file);
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-card rounded-lg border">
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
          <div className="col-span-3 flex items-center gap-4">
            <input type="file" accept="audio/*" ref={songInputRef} className="hidden" onChange={handleSongChange} />
            <Button type="button" onClick={() => songInputRef.current?.click()} variant="outline">
              Select Song
            </Button>
            <span className="text-sm text-muted-foreground truncate">{song?.name ?? "No song selected."}</span>
          </div>
        </div>
      </form>
    </div>
  );
}
