import { Label } from "@/components/ui/label";
import { type KeybindAction, useAppStore } from "@/store";
import { KeybindButton } from "./KeybindButton";

const keybindLabels: Record<KeybindAction, string> = {
  temporaryPlay: "Temporary Play",
  seekBackward: "Seek Backward",
  seekForward: "Seek Forward",
  deleteSelection: "Delete Selection",
  placeNoteLane1: "Place Note (Lane 1)",
  placeNoteLane2: "Place Note (Lane 2)",
  placeNoteLane3: "Place Note (Lane 3)",
  placeNoteLane4: "Place Note (Lane 4)",
};

function KeybindInput({ action }: { action: KeybindAction }) {
  const keybinds = useAppStore((s) => s.keybinds);
  const setKeybind = useAppStore((s) => s.setKeybind);

  const handleKeybindChange = (key: string | undefined, index: number) => {
    // The store uses "" for an unbound key. The new component uses `undefined` to signal a clear.
    setKeybind(action, key || "", index);
  };

  const currentKeys = keybinds[action] || [];

  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Label className="text-right">{keybindLabels[action]}</Label>
      <div className="col-span-2 flex gap-2">
        {[0, 1].map((index) => (
          <KeybindButton
            key={index}
            value={currentKeys[index]}
            onValueChange={(key) => handleKeybindChange(key, index)}
          />
        ))}
      </div>
    </div>
  );
}

export function SettingsTab() {
  const actions = Object.keys(keybindLabels) as KeybindAction[];

  return (
    <div className="p-4 h-full overflow-y-auto bg-[hsl(224,71%,4%)] rounded-lg border border-[hsl(217.2,32.6%,17.5%)]">
      <div className="space-y-8 max-w-md mx-auto">
        <div>
          <h2 className="text-lg font-semibold border-b border-[hsl(217.2,32.6%,17.5%)] pb-2 mb-4">Keybinds</h2>
          <div className="space-y-4">
            {actions.map((action) => (
              <KeybindInput key={action} action={action} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
