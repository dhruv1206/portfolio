// Chrome for the reading pages (/r, /lab, /projects). The blog has its
// own group, app/(blog), because in production it is served from its own
// subdomain. The homepage (app/(home)) shares the navbar and footer
// without the container; the control room at app/(room)/room draws its
// own chrome.

import ReadingShell from "@/app/components/reading-shell";

export default function SiteLayout({ children }) {
    return <ReadingShell>{children}</ReadingShell>;
}
