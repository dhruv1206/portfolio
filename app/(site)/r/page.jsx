// /r — recruiter mode. A LinkedIn-friendly URL that gets a recruiter
// from a cold link to a decision in a minute: TL;DR numbers, a
// paste-a-JD role-fitter, and a direct way to reach me.

import Link from "next/link";
import TlDr from "./components/tl-dr";
import RoleFitter from "./components/role-fitter";
import { personalData } from "@/utils/data/personal-data";

export const metadata = {
    title: "Recruiter mode",
    description: "Defendable career numbers and a paste-a-JD role-fitter that says in 30 seconds whether I am the right hire, with a tailored PDF.",
    alternates: { canonical: "/r" },
    openGraph: { images: [{ url: "/api/og?title=Recruiter%20mode&sub=Defendable%20career%20numbers%20and%20a%20paste-a-JD%20fit%20score%20with%20a%20tailored%20PDF.%20Reads%20in%2060%20seconds.&path=/r", width: 1200, height: 630 }] },
    robots: { index: true, follow: true },
};

export default function RecruiterModePage() {
    return (
        <div className="rp">
            <header className="rp-head">
                <p className="rp-eyebrow"><b>/r</b> recruiter mode <i>reads in 60 seconds</i></p>
                <h1 className="rp-h1">Dhruv <em>Agrawal.</em></h1>
                <p className="rp-lede">Backend engineer, 3+ years, Bengaluru. Open to senior backend and platform roles. Every number below is on my résumé and I can defend each one in an interview. <Link href="/">The full site</Link> shows the systems; <Link href="/room">the control room</Link> lets you break them.</p>
            </header>

            <div style={{ display: "grid", gap: 18 }}>
                <TlDr />
                <RoleFitter />
                <section aria-label="Direct contact" className="cell">
                    <div className="cell-h"><i>▶</i><b>direct contact</b><span>skip the form</span><span className="r">replies within a day</span></div>
                    <div className="cell-b btns">
                        <a href={`mailto:${personalData.email}`} className="mbtn mbtn-primary">Email me</a>
                        <a href={personalData.linkedIn} target="_blank" rel="noopener noreferrer" className="mbtn">LinkedIn ↗</a>
                        <a href={personalData.resume} target="_blank" rel="noopener noreferrer" className="mbtn">Generic résumé (PDF) ↗</a>
                        <span className="rp-note" style={{ marginLeft: "auto" }}>Run the role-fitter above for a tailored PDF.</span>
                    </div>
                </section>
            </div>
        </div>
    );
}
