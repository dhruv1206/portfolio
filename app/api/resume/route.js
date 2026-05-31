// Tailored-resume PDF generator. The Recruiter Mode page calls this
// with a `?jd=<encoded JD text>` query param; we run the same scoring
// the role-fitter UI runs, then emit a one-page PDF via @react-pdf/
// renderer with the matched skills highlighted inline.
//
// The PDF is generated on every request — no caching layer yet. Each
// run is ~80-200 ms for the actual layout pass. If a recruiter
// downloads the same JD twice, we re-render; trivially cacheable later
// behind an LRU keyed by the JD hash.

import { NextResponse } from "next/server";
import {
    Document,
    Page,
    StyleSheet,
    Text,
    View,
    renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { scoreJd } from "@/app/r/lib/score-jd";
import { personalData } from "@/utils/data/personal-data";
import { experiences } from "@/utils/data/experience";
import { projectsData } from "@/utils/data/projects-data";
import { skillsData } from "@/utils/data/skills";

export const maxDuration = 15;

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: "Helvetica",
        fontSize: 10,
        color: "#0f172a",
        backgroundColor: "#fff",
    },
    header: { marginBottom: 14, borderBottom: "1px solid #d4d4d8", paddingBottom: 10 },
    name: { fontSize: 22, fontWeight: 700, color: "#0f172a" },
    role: { fontSize: 11, color: "#475569", marginTop: 2 },
    contact: { fontSize: 9, color: "#64748b", marginTop: 6 },
    fitBox: {
        marginTop: 10,
        padding: 8,
        backgroundColor: "#f1f5f9",
        borderRadius: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    fitScore: { fontSize: 24, fontWeight: 700, color: "#0f172a" },
    fitLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase" },
    sectionHeading: {
        fontSize: 11,
        fontWeight: 700,
        color: "#7c3aed",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 12,
        marginBottom: 4,
    },
    row: { flexDirection: "row", marginBottom: 4, gap: 6 },
    bullet: { color: "#64748b", marginTop: 2 },
    text: { color: "#1f2937", lineHeight: 1.4, flex: 1 },
    matchedSkill: {
        backgroundColor: "#e9d5ff",
        color: "#5b21b6",
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
        fontWeight: 700,
    },
    unmatchedSkill: { color: "#1f2937", marginRight: 5 },
    skillsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, gap: 4 },
    expRow: { marginBottom: 6 },
    expTitle: { fontWeight: 700, color: "#0f172a" },
    expCompany: { color: "#475569" },
    expDuration: { color: "#94a3b8", fontSize: 9 },
    projectTitle: { fontWeight: 700, color: "#0f172a" },
    projectMeta: { color: "#94a3b8", fontSize: 9 },
    projectDesc: { color: "#1f2937", lineHeight: 1.4, marginTop: 1 },
    why: {
        marginTop: 3,
        backgroundColor: "#fef3c7",
        borderLeft: "2px solid #f59e0b",
        paddingLeft: 6,
        paddingVertical: 2,
        fontSize: 9,
        color: "#78350f",
    },
});

function ResumeDocument({ jd, scored }) {
    const matchedSet = new Set(scored.matchedSkills.map((s) => s.toLowerCase()));
    const matchedProjectSlugs = new Set(
        scored.items.filter((i) => i.kind === "project").map((i) => i.id),
    );
    const matchedExpIds = new Set(
        scored.items.filter((i) => i.kind === "experience").map((i) => i.id),
    );
    const reasonByItem = new Map(
        scored.items
            .filter((i) => i.reason)
            .map((i) => [`${i.kind}:${i.id}`, i.reason]),
    );

    // Surface projects matched first, then the rest.
    const orderedProjects = [
        ...projectsData.filter((p) => matchedProjectSlugs.has(p.slug)),
        ...projectsData.filter((p) => !matchedProjectSlugs.has(p.slug)),
    ];
    const orderedExperiences = [
        ...experiences.filter((e) =>
            matchedExpIds.has(e.company.toLowerCase().split(" ")[0]),
        ),
        ...experiences.filter(
            (e) => !matchedExpIds.has(e.company.toLowerCase().split(" ")[0]),
        ),
    ];

    return React.createElement(
        Document,
        { title: `${personalData.name} — tailored resume` },
        React.createElement(
            Page,
            { size: "A4", style: styles.page },
            // ----- Header -----
            React.createElement(
                View,
                { style: styles.header },
                React.createElement(Text, { style: styles.name }, personalData.name),
                React.createElement(Text, { style: styles.role }, "Backend engineer · Bangalore / remote"),
                React.createElement(
                    Text,
                    { style: styles.contact },
                    `${personalData.email}  ·  ${personalData.linkedIn}  ·  ${personalData.github}`,
                ),
            ),
            // ----- Fit box -----
            jd
                ? React.createElement(
                      View,
                      { style: styles.fitBox },
                      React.createElement(
                          View,
                          null,
                          React.createElement(Text, { style: styles.fitScore }, `${scored.score}%`),
                          React.createElement(
                              Text,
                              { style: styles.fitLabel },
                              "JD MATCH",
                          ),
                      ),
                      React.createElement(
                          Text,
                          { style: [styles.text, { fontSize: 9 }] },
                          scored.matchedSkills.length > 0
                              ? `Matched: ${scored.matchedSkills.join(", ")}`
                              : "No direct skill overlap — see project + experience matches below.",
                      ),
                  )
                : null,

            // ----- Skills (highlighted) -----
            React.createElement(Text, { style: styles.sectionHeading }, "Skills"),
            React.createElement(
                View,
                { style: styles.skillsRow },
                ...skillsData.map((s, i) => {
                    const isMatch = matchedSet.has(s.toLowerCase());
                    return React.createElement(
                        Text,
                        {
                            key: `skill-${i}`,
                            style: isMatch ? styles.matchedSkill : styles.unmatchedSkill,
                        },
                        s,
                    );
                }),
            ),

            // ----- Experience -----
            React.createElement(Text, { style: styles.sectionHeading }, "Experience"),
            ...orderedExperiences.slice(0, 5).map((e, i) => {
                const matched = matchedExpIds.has(e.company.toLowerCase().split(" ")[0]);
                const reason = matched
                    ? reasonByItem.get(
                          `experience:${e.company.toLowerCase().split(" ")[0]}`,
                      )
                    : null;
                return React.createElement(
                    View,
                    { key: `exp-${i}`, style: styles.expRow },
                    React.createElement(
                        Text,
                        { style: styles.expTitle },
                        `${e.title}, `,
                        React.createElement(Text, { style: styles.expCompany }, e.company),
                        "  ",
                        React.createElement(Text, { style: styles.expDuration }, e.duration),
                    ),
                    reason
                        ? React.createElement(Text, { style: styles.why }, `Why for this JD: ${reason}`)
                        : null,
                );
            }),

            // ----- Projects -----
            React.createElement(Text, { style: styles.sectionHeading }, "Projects"),
            ...orderedProjects.slice(0, 4).map((p, i) => {
                const reason = reasonByItem.get(`project:${p.slug}`);
                return React.createElement(
                    View,
                    { key: `proj-${i}`, style: styles.expRow },
                    React.createElement(
                        Text,
                        { style: styles.projectTitle },
                        `${p.name}`,
                        React.createElement(
                            Text,
                            { style: styles.projectMeta },
                            `  ·  ${p.tools.slice(0, 4).join(", ")}`,
                        ),
                    ),
                    React.createElement(
                        Text,
                        { style: styles.projectDesc },
                        (p.description || "").slice(0, 250),
                    ),
                    reason
                        ? React.createElement(Text, { style: styles.why }, `Why for this JD: ${reason}`)
                        : null,
                );
            }),

            // ----- Footer -----
            React.createElement(
                Text,
                { style: { marginTop: 16, fontSize: 8, color: "#94a3b8" } },
                "Generated from dhruvagrawal.dev/r — the in-browser role-fitter ran against the JD you pasted. Matched skills are highlighted; matched items carry a 'Why for this JD' line. Full portfolio + live demos: dhruvagrawal.dev",
            ),
        ),
    );
}

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const jd = (searchParams.get("jd") || "").slice(0, 8000);

    const scored = jd ? scoreJd(jd) : { score: 0, matchedSkills: [], items: [] };

    let buf;
    try {
        const element = React.createElement(ResumeDocument, { jd, scored });
        buf = await renderToBuffer(element);
    } catch (err) {
        return NextResponse.json(
            { error: "pdf-render-failed", detail: String(err?.message || err) },
            { status: 500 },
        );
    }

    const slug = `${personalData.name.toLowerCase().replace(/\s+/g, "-")}-tailored.pdf`;
    return new NextResponse(buf, {
        status: 200,
        headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${slug}"`,
            "cache-control": "no-store",
        },
    });
}
