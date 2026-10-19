// A dev.to cover, sized by dev.to. Its covers are resizing URLs
// (…/dynamic/image/<options>/<original>, Cloudflare's comma-separated
// key=value options) that serve WebP at any width, so the srcset below asks
// dev.to for a ladder of widths and the browser downloads the one that fits
// the card. Vercel's optimizer is never involved: it rejects image hosts
// missing from next.config (media2.dev.to once broke every cover) and would
// only re-encode what dev.to has already encoded. A cover that is not a
// resizing URL is used as it is.

const RESIZE = /\/dynamic\/image\/([a-z]+=[^,/]+(?:,[a-z]+=[^,/]+)*)\//;
const FILE_ASPECT = 1000 / 420; // dev.to's cover shape
const BOX_ASPECT = 2; // the card's cover box (blog-card.jsx)
// Without a quality, dev.to encodes covers 3 to 4 times heavier than at 85,
// and 85 looks the same at card size, even zoomed in 4×.
const QUALITY = 85;
// About 15 % apart, so whichever width the browser picks is close to the
// width the cover renders at.
const WIDTHS = [320, 380, 440, 520, 600, 700, 820, 960, 1120, 1300];
// The card's rendered width in .g3 inside the reading container: three
// columns from 961 px (the container caps at 70, 76 and 92 rem), two from
// 601 px, one below. Keep in step with app/css/reading.scss and
// app/components/reading-shell.jsx.
const CARD = [
    ["(min-width: 1536px)", "449px"],
    ["(min-width: 1280px)", "364px"],
    ["(min-width: 1120px)", "332px"],
    ["(min-width: 961px)", "(100vw - 124px) / 3"],
    ["(min-width: 640px)", "(100vw - 110px) / 2"],
    ["(min-width: 601px)", "(100vw - 62px) / 2"],
    ["", "100vw - 48px"],
];
// The cover is wider than the box and object-fit crops its sides, so it
// renders at the box's height: FILE_ASPECT / BOX_ASPECT times the card's
// width. Sizing to the card alone would stretch it by that much.
const SIZES = CARD.map(([media, width]) => `${media} calc((${width}) * ${(FILE_ASPECT / BOX_ASPECT).toFixed(3)})`.trim()).join(", ");

// Sets the size and quality, keeping dev.to's other options (fit, gravity, format).
function at(src, width) {
    return src.replace(RESIZE, (_, list) => {
        const options = new Map(list.split(",").map((option) => option.split("=")));
        options.set("width", width).set("height", Math.round(width / FILE_ASPECT)).set("quality", QUALITY);
        return `/dynamic/image/${[...options].map((option) => option.join("=")).join(",")}/`;
    });
}

export default function DevtoCover({ src }) {
    const resizable = RESIZE.test(src);
    return (
        // eslint-disable-next-line @next/next/no-img-element -- dev.to resizes and encodes its own covers; next/image would send them through Vercel's optimizer
        <img
            src={resizable ? at(src, 600) : src}
            srcSet={resizable ? WIDTHS.map((w) => `${at(src, w)} ${w}w`).join(", ") : undefined}
            sizes={resizable ? SIZES : undefined}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
    );
}
