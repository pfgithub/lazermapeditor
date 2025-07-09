import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeybindAction, useAppStore } from "@/store";
import { useState, useEffect, useRef } from "react";

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
  const [isBinding, setIsBinding] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isBinding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't allow binding modifier keys alone
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      setKeybind(action, e.code);
      setIsBinding(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsBinding(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isBinding, action, setKeybind]);

  const currentKey = keybinds[action];

  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Label htmlFor={action} className="text-right">
        {keybindLabels[action]}
      </Label>
      <Button
        id={action}
        ref={buttonRef}
        variant="outline"
        onClick={() => setIsBinding(true)}
        className="col-span-2 justify-start font-mono"
      >
        {isBinding ? "Press a key..." : currentKey}
      </Button>
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
