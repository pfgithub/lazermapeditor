import type { Beatmap, Song } from "@/store";
import JSZip from "jszip";
import { svCalculate } from "./utils";

/**
 * Generates the content for a .osu file from the application's state.
 * @param map - The beatmap data.
 * @param song - The song data.
 * @returns A string containing the full content of the .osu file.
 */
export function exportToOsuFile(map: Beatmap, song: Song | null): string {
  const lines: string[] = [];

  const sanitizeString = (str: string) => (str || "").trim();

  const timeToOsuTime = (sec: number) => Math.round(sec * 1000) - 20;

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
  lines.push("SliderMultiplier:1");
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
  /*
    time (Integer): Start time of the timing section, in milliseconds from the beginning of the beatmap's audio. The end of the timing section is the next timing point's time (or never, if this is the last timing point).
    beatLength (Decimal): This property has two meanings:
        For uninherited timing points, the duration of a beat, in milliseconds.
        For inherited timing points, a negative inverse slider velocity multiplier, as a percentage. For example, -50 would make all sliders in this timing section twice as fast as SliderMultiplier.
    meter (Integer): Amount of beats in a measure. Inherited timing points ignore this property.
    sampleSet (Integer): Default sample set for hit objects (0 = beatmap default, 1 = normal, 2 = soft, 3 = drum).
    sampleIndex (Integer): Custom sample index for hit objects. 0 indicates osu!'s default hitsounds.
    volume (Integer): Volume percentage for hit objects.
    uninherited (0 or 1): Whether or not the timing point is uninherited.
    effects (Integer): Bit flags that give the timing point extra effects. See the effects section.
  */
  const finalTimingPoints: [time: number, beatLength: number, meter: number, sampleSet: number, sampleIndex: number, volume: number, uninherited: 0 | 1, effects: number][] = [];
  for(const segment of map.timing) {
    const time = timeToOsuTime(segment.startTime);
    const beatLength = 60000 / segment.bpm;
    // time,beatLength,meter,sampleSet,sampleIndex,volume,uninherited,effects
    finalTimingPoints.push([time, beatLength, 4, 2, 0, 100, 1, 0]); // sampleSet 2=soft
  }
  for(const sv of map.notes) {
    if(sv.key !== "sv") continue;
    const pattern = map.svPatterns[sv.svPattern ?? ""];
    if(!pattern) continue;

    /*
    say time is 0 going to 1 
    sv is from: 0.1, to: 0.9
    // that means we have to go from 0 to 9 in 1, then from 
    */

    const calc = svCalculate(pattern.from, pattern.to);

    const rawMidTime = sv.startTime + (sv.endTime - sv.startTime) * calc.durationRatio;
    const startTime = timeToOsuTime(sv.startTime);
    const midTime = timeToOsuTime(rawMidTime);
    const endTime = timeToOsuTime(sv.endTime);

    if(calc.error) continue; // out of range!
    finalTimingPoints.push([startTime, -100 * (1 / calc.startRatio), 0, 2, 0, 100, 0, 0]);
    finalTimingPoints.push([midTime, -100 * (1 / calc.endRatio), 0, 2, 0, 100, 0, 0]);
    finalTimingPoints.push([endTime, -100, 0, 2, 0, 100, 0, 0]);
  }
  finalTimingPoints.sort((a, b) => a[0] - b[0]);
  for(const result of finalTimingPoints) {
    lines.push(result.join(","));
  }
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
      const time = timeToOsuTime(note.startTime);
      const hitSample = "0:0:0:0:";

      if (Math.abs(note.endTime - note.startTime) < 0.001) {
        // Regular Note
        const type = 1; // Bit 0 for circle
        // x,y,time,type,hitSound,objectParams,hitSample
        lines.push(`${x},192,${time},${type},0,${hitSample}`);
      } else {
        // Hold Note
        const type = 128; // Bit 7 for hold
        const endTime = timeToOsuTime(note.endTime);
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
    const osuFileContent = exportToOsuFile(map, song);

    const zip = new JSZip();

    const sanitizeFilename = (name: string) => name.replace(/[<>:"/\\|?*]/g, "").trim() || "undefined";
    const artist = sanitizeFilename(map.artist);
    const title = sanitizeFilename(map.title);
    const creator = sanitizeFilename(map.creator);
    const version = `[${sanitizeFilename(map.version)}]`;

    const osuFilename = `${artist} - ${title} (${creator}) ${version}.osu`;

    zip.file(osuFilename, osuFileContent);
    zip.file(song.name, song.bytes);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    return zipBlob;
}
