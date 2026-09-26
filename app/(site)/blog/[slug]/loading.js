// Co-located loading UI: gives the route a Suspense boundary so the
// rest of the layout can be statically prerendered under Cache
// Components while the dynamic article streams in.

export default function Loading() {
    return (
        <div className="rp"><div className="spin-wrap" style={{ minHeight: "50vh" }}><span className="spin" />loading the article</div></div>
    );
}
