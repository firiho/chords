interface MIDIInput {
  id: string;
  manufacturer?: string | null;
  name?: string | null;
  state: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MIDIMessageEvent extends Event {
  data: Uint8Array;
}

interface MIDIAccess extends EventTarget {
  inputs: Map<string, MIDIInput>;
  onstatechange: ((event: Event) => void) | null;
}

interface Navigator {
  requestMIDIAccess?(options?: { sysex?: boolean }): Promise<MIDIAccess>;
}
