"use client";

// Registers the control room's console, scenarios, panels and camera
// with the global ⌘K palette while the room is mounted.

import { useEffect } from "react";
import { useRoom, useSnapshot } from "./control-room";
import { registerCommands, type Command } from "@/app/lib/commands";
import { ACTIONS, SCENARIOS, TRACE_KINDS } from "@/app/room/data";

const PANELS: [string, string][] = [["about", "About"], ["work", "Work · replay my incidents"], ["projects", "Projects"], ["stack", "Stack"], ["contact", "Contact"], ["records", "Records"], ["notes", "How this page works"]];

export default function RoomCommands() {
    const ctl = useRoom(); const s = useSnapshot(); const tour = s.tour;
    useEffect(() => {
        const g = "Control room";
        const cmds: Command[] = [
            { id: "cr-tour", title: tour ? "Stop the tour" : "Start the tour", detail: "60 seconds, narrated", keys: "T", group: g, run: () => (tour ? ctl.stopTour() : ctl.startTour()) },
            ...TRACE_KINDS.map((k) => ({ id: "cr-trace-" + k.id, title: "Trace · " + k.label, detail: k.sub + " · slow motion", keys: "", group: g, run: () => ctl.trace(k.id) })),
            ...ACTIONS.map((a) => ({ id: "cr-act-" + a.id, title: a.label, detail: a.explain, keys: a.key, kind: a.kind, group: g, run: () => ctl.doAction(a.id) })),
            ...SCENARIOS.map((sc) => ({ id: "cr-sc-" + sc.id, title: "Replay · " + sc.title, detail: sc.org + (sc.year ? " · " + sc.year : ""), keys: "", group: g, run: () => ctl.startScenario(sc.id) })),
            ...PANELS.map(([p, label]) => ({ id: "cr-panel-" + p, title: "Open · " + label, detail: "panel", keys: "", group: g, run: () => ctl.openPanel(p as Parameters<typeof ctl.openPanel>[0]) })),
            { id: "cr-fit", title: "Fit the whole system", detail: "reset the camera", keys: "F", group: g, run: () => ctl.fit() },
        ];
        return registerCommands("room", cmds);
    }, [ctl, tour]);
    return null;
}
