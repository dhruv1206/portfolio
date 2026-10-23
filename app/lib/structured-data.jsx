// schema.org JSON-LD for search engines and AI assistants. Everything here
// restates what the pages visibly say; Google asks for exactly that, and
// a claim only the markup makes is one nobody can check. The person and
// the website have fixed @ids, so every page can point at the same
// entities instead of repeating them.

import { personalData } from "@/utils/data/personal-data";
import { NAME, ORIGIN, SITE_NAME, abs } from "./seo";

export const PERSON_ID = `${ORIGIN}/#person`;
export const WEBSITE_ID = `${ORIGIN}/#website`;

/** Dhruv, as the homepage and /r describe him. `knowsAbout` comes from the caller's visible stack. */
export function person({ knowsAbout } = {}) {
    return {
        "@type": "Person",
        "@id": PERSON_ID,
        name: NAME,
        url: `${ORIGIN}/`,
        jobTitle: "Backend Engineer",
        description: "Backend engineer at MyRik in Bengaluru. The platforms he runs serve 150,000 people a month.",
        worksFor: { "@type": "Organization", name: "MyRik" },
        address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressCountry: "IN" },
        alumniOf: { "@type": "CollegeOrUniversity", name: "Lakshmi Narain College of Technology", address: { "@type": "PostalAddress", addressLocality: "Bhopal", addressCountry: "IN" } },
        email: `mailto:${personalData.email}`,
        sameAs: [personalData.github, personalData.linkedIn, personalData.twitter, `https://dev.to/${personalData.devUsername}`, personalData.leetcode],
        ...(knowsAbout ? { knowsAbout } : {}),
    };
}

/** Enough of the person for a page on another host (the blog) to stand alone. */
export function personSummary() {
    return { "@type": "Person", "@id": PERSON_ID, name: NAME, url: `${ORIGIN}/`, sameAs: [personalData.github, personalData.linkedIn, `https://dev.to/${personalData.devUsername}`] };
}

export function website() {
    return { "@type": "WebSite", "@id": WEBSITE_ID, url: `${ORIGIN}/`, name: SITE_NAME, alternateName: NAME, inLanguage: "en", publisher: { "@id": PERSON_ID } };
}

/** A trail of [name, url] pairs, home first. */
export function breadcrumbs(trail) {
    return { "@type": "BreadcrumbList", itemListElement: trail.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(url) })) };
}

/** A page of the site: its URL, name, what it is about and where it sits. */
export function webPage({ type = "WebPage", url, name, description, ...rest }) {
    return { "@type": type, "@id": `${abs(url)}#page`, url: abs(url), name, description, inLanguage: "en", isPartOf: { "@id": WEBSITE_ID }, author: { "@id": PERSON_ID }, ...rest };
}

/** One <script type="application/ld+json">. `<` is escaped so text from dev.to cannot close the tag. */
export function JsonLd({ graph }) {
    const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
