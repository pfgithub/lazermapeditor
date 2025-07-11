import type { Beatmap, Song } from "@/store";
import JSZip from "jszip";

/**
 * Generates the content for a .osu file from the application's state.
 * @param map - The beatmap data.
 * @param song - The song data.
 * @returns A string containing the full content of the .osu file.
 */
export function exportToOsuFile(map: Beatmap, song: Song | null): string {
  const lines: string[] = [];

  const sanitizeString = (str: string) => (str || "").trim();

  lines.push("osu file format v14");
  lines.push("");

  // [General]
  lines.push("[General]");
  lines.push(`AudioFilename: ${song?.name ?? "audio.mp3"}`);
  lines.push("AudioLeadIn: 0");
  lines.push("PreviewTime: -1");
  lines.push("Countdown: 0");
  lines.push("SampleSet: Soft");
  lines.push("StackLeniency: 0.7");
  lines.push("Mode: 3"); // 3 for osu!mania
  lines.push("LetterboxInBreaks: 0");
  lines.push("WidescreenStoryboard: 0");
  lines.push("");

  // [Editor]
  lines.push("[Editor]");
  lines.push("Bookmarks: ");
  lines.push("DistanceSpacing: 1");
  lines.push("BeatDivisor: 4");
  lines.push("GridSize: 32");
  lines.push("TimelineZoom: 2.5");
  lines.push("");

  // [Metadata]
  lines.push("[Metadata]");
  lines.push(`Title:${sanitizeString(map.title)}`);
  lines.push(`TitleUnicode:${sanitizeString(map.title)}`);
  lines.push(`Artist:${sanitizeString(map.artist)}`);
  lines.push(`ArtistUnicode:${sanitizeString(map.artist)}`);
  lines.push(`Creator:${sanitizeString(map.creator)}`);
  lines.push(`Version:${sanitizeString(map.version)}`);
  lines.push("Source:");
  lines.push("Tags:");
  lines.push("BeatmapID:0");
  lines.push("BeatmapSetID:-1");
  lines.push("");

  // [Difficulty]
  lines.push("[Difficulty]");
  lines.push("HPDrainRate:8");
  lines.push("CircleSize:4"); // Key count for Mania
  lines.push("OverallDifficulty:8");
  lines.push("ApproachRate:5"); // Not used in Mania, but should be present.
  lines.push("SliderMultiplier:1.4");
  lines.push("SliderTickRate:1");
  lines.push("");

  // [Events]
  lines.push("[Events]");
  lines.push("//Background and Video events");
  lines.push("//Break Periods");
  lines.push("//Storyboard Layer 0 (Background)");
  lines.push("//Storyboard Layer 1 (Fail)");
  lines.push("//Storyboard Layer 2 (Pass)");
  lines.push("//Storyboard Layer 3 (Foreground)");
  lines.push("//Storyboard Sound Samples");
  lines.push("");

  // [TimingPoints]
  lines.push("[TimingPoints]");
  map.timing
    .sort((a, b) => a.startTime - b.startTime)
    .forEach((segment) => {
      const time = Math.round(segment.startTime * 1000);
      const beatLength = 60000 / segment.bpm;
      // time,beatLength,meter,sampleSet,sampleIndex,volume,uninherited,effects
      lines.push(`${time},${beatLength},4,2,0,100,1,0`); // sampleSet 2=soft
    });
  lines.push("");

  // [HitObjects]
  lines.push("[HitObjects]");
  const columnWidth = 512 / 4;
  const getX = (key: number) => Math.floor(columnWidth * key + columnWidth / 2);

  map.notes
    .sort((a, b) => a.startTime - b.startTime)
    .forEach((note) => {
      if (typeof note.key !== "number") return;
      const x = getX(note.key);
      const time = Math.round(note.startTime * 1000);
      const hitSample = "0:0:0:0:";

      if (Math.abs(note.endTime - note.startTime) < 0.001) {
        // Regular Note
        const type = 1; // Bit 0 for circle
        // x,y,time,type,hitSound,objectParams,hitSample
        lines.push(`${x},192,${time},${type},0,${hitSample}`);
      } else {
        // Hold Note
        const type = 128; // Bit 7 for hold
        const endTime = Math.round(note.endTime * 1000);
        const objectParams = `${endTime}:${hitSample}`;
        // x,y,time,type,hitSound,objectParams
        lines.push(`${x},192,${time},${type},0,${objectParams}`);
      }
    });
  lines.push("");
  console.log(lines);

  return lines.join("\r\n");
}

/**
 * Generates a .osz file (a zip archive) containing the .osu file and song.
 * @param map - The beatmap data.
 * @param song - The song data.
 * @returns A promise that resolves with a Blob of the .osz file.
 */
export async function exportToOszFile(map: Beatmap, song: Song): Promise<Blob> {
  try {
    const osuFileContent = exportToOsuFile(map, song);

    const songFileBlob = song.blob;

    const zip = new JSZip();

    const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*]/g, "").trim() || "undefined";
    const artist = sanitizeFilename(map.artist);
    const title = sanitizeFilename(map.title);
    const creator = sanitizeFilename(map.creator);
    const version = `[${sanitizeFilename(map.version)}]`;

    const osuFilename = `${artist} - ${title} (${creator}) ${version}.osu`;

    zip.file(osuFilename, osuFileContent);
    zip.file(song.name, songFileBlob);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    return zipBlob;
  }catch(e) {
    console.log("got error", e);
    throw e;
  }
}
