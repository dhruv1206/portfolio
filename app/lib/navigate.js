// Client-side navigation that knows the site spans two hosts. Same origin:
// a client transition. The other half of this site (blog <-> apex): a
// full navigation in the same tab. Anything else: a new tab.

import { OWN_ORIGINS } from "./origins";

export function go(router, href) {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) {
        router.push(`${url.pathname}${url.search}${url.hash}`);
    } else if (OWN_ORIGINS.includes(url.origin)) {
        window.location.assign(url.href);
    } else {
        window.open(url.href, "_blank", "noopener,noreferrer");
    }
}
