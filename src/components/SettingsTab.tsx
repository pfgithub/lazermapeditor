import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type KeybindAction, useAppStore } from "@/store";
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
  const [bindingIndex, setBindingIndex] = useState<number | null>(null);
  const buttonRefs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];

  useEffect(() => {
    if (bindingIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't allow binding modifier keys alone
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      setKeybind(action, e.code, bindingIndex);
      setBindingIndex(null);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        bindingIndex !== null &&
        buttonRefs[bindingIndex]?.current &&
        !buttonRefs[bindingIndex]!.current!.contains(e.target as Node)
      ) {
        setBindingIndex(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [action, setKeybind, bindingIndex]);

  const currentKeys = keybinds[action] || [];

  return (
    <div className="grid grid-cols-3 items-center gap-4">
      <Label className="text-right">{keybindLabels[action]}</Label>
      <div className="col-span-2 flex gap-2">
        {[0, 1].map((index) => (
          <Button
            key={index}
            ref={buttonRefs[index]}
            variant="outline"
            onClick={() => setBindingIndex(index)}
            className="flex-1 justify-start font-mono"
          >
            {bindingIndex === index ? "Press a key..." : currentKeys[index] || "Unbound"}
          </Button>
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
