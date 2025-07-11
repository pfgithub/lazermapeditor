import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultMap, type Beatmap, type Song } from "@/store";
import { exportToOszFile, exportToUnamap, loadFromUnamap } from "@/lib/export";

interface MetadataTabProps {
  map: Beatmap;
  setMap: (map: Beatmap) => void;
  song: Song | null;
  setSong: (song: File | null) => void;
}

export function MetadataTab({ map, setMap, song, setSong }: MetadataTabProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const songInputRef = useRef<HTMLInputElement>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);

  const handleSongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.;
    if (file) {
      setSong(file);
    }
  };

  const handleMetadataChange = (
    field: keyof Pick<Beatmap, "title" | "artist" | "creator" | "version">,
    value: string,
  ) => {
    setMap({ ...map, [field]: value });
  };

  const handleSaveProject = async () => {
    try {
      const blob = await exportToUnamap(map, song);
      const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*]/g, "").trim() || "untitled";
      const filename = `${sanitizeFilename(map.artist)} - ${sanitizeFilename(map.title)}.unamap`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error saving project! " + (e as Error).toString());
      console.error(e);
    }
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.;
    if (!file) return;

    try {
      if (confirm("Loading a project will overwrite your current unsaved changes. Continue?")) {
        const { map: loadedMap, songFile: loadedSongFile } = await loadFromUnamap(file);
        setMap(loadedMap);
        setSong(loadedSongFile);
      }
    } catch (err) {
      alert("Failed to load project: " + (err as Error).message);
      console.error(err);
    } finally {
      // Reset the input so the same file can be loaded again
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleExport = async () => {
    try {
      if (!song) return;

      const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*]/g, "").trim() || "undefined";

      const artist = sanitizeFilename(map.artist);
      const title = sanitizeFilename(map.title);
      const creator = sanitizeFilename(map.creator);
      const version = `[${sanitizeFilename(map.version)}]`;
      const filename = `${artist} - ${title} (${creator}) ${version}.osz`;

      const blob = await exportToOszFile(map, song);

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }catch(e) {
      alert("got error! " + (e as Error).toString());
      console.error(e);
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-[hsl(224,71%,4%)] rounded-lg border border-[hsl(217.2,32.6%,17.5%)]">
      <form className="space-y-8 max-w-2xl mx-auto" onSubmit={(e) => e.preventDefault()}>
        <div>
          <h2 className="text-lg font-semibold border-b border-[hsl(217.2,32.6%,17.5%)] pb-2 mb-4">Beatmap Info</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input id="title" value={map.title} onChange={(e) => handleMetadataChange("title", e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="artist" className="text-right">
                Artist
              </Label>
              <Input id="artist" value={map.artist} onChange={(e) => handleMetadataChange("artist", e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creator" className="text-right">
                Creator
              </Label>
              <Input id="creator" value={map.creator} onChange={(e) => handleMetadataChange("creator", e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="version" className="text-right">
                Difficulty Name
              </Label>
              <Input id="version" value={map.version} onChange={(e) => handleMetadataChange("version", e.target.value)} className="col-span-3" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold border-b border-[hsl(217.2,32.6%,17.5%)] pb-2 mb-4">Assets</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Image</Label>
              <div className="col-span-3">
                <input type="file" accept="image/*" ref={imageInputRef} className="hidden" />
                <Button type="button" onClick={() => imageInputRef.current?.click()} variant="outline">
                  Select Image (Not Implemented)
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
                <span className="text-sm text-[hsl(215,20.2%,65.1%)] truncate">{song?.name ?? "No song selected."}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold border-b border-[hsl(217.2,32.6%,17.5%)] pb-2 mb-4">Actions</h2>
          <div className="flex flex-col gap-2">
            <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => loadProjectInputRef.current?.click()}>
                    Load Project
                </Button>
                <input type="file" accept=".unamap" ref={loadProjectInputRef} className="hidden" onChange={handleLoadProject} />
                <Button type="button" onClick={handleSaveProject}>
                    Save Project
                </Button>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleExport} disabled={!song}>
                Export to .osz file
              </Button>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="destructive" onClick={() => confirm("Really clear map?") ? setMap(defaultMap) : void 0} disabled={!song}>
                Clear map
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
