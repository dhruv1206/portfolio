"use client";

import dynamic from "next/dynamic";
import styles from "./room.module.scss";

// The room is canvas + simulation + Web Audio: client only. Until its
// chunk arrives the boot title is already on screen, so the first
// paint carries the name and the thesis (also what a thumbnail sees).
const ControlRoom = dynamic(() => import("./control-room"), {
    ssr: false,
    loading: () => <BootTitle />,
});

export function BootTitle() {
    return (
        <div className={styles.bootStatic} aria-hidden="true">
            <p className={styles.eyebrow}>Dhruv Agrawal · Software Engineer · MyRik</p>
            <h2>
                The systems I build,
                <br />
                running in front of you.
            </h2>
            <p className={styles.sub}>
                A live model of a production platform: 24 services, real queues, real
                timeouts. Break it. Watch it heal. Then replay the incidents I actually
                fixed.
            </p>
        </div>
    );
}

export default function RoomLoader() {
    return <ControlRoom />;
}
