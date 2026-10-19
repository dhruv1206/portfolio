// Co-located loading UI: the article is read live from dev.to, so the
// route's content is a dynamic hole. The spinner only appears if the read
// takes longer than a blink (`.spin-late`), so a fast load shows no flash.

export default function Loading() {
    return (
        <div className="rp"><div className="spin-wrap spin-late" style={{ minHeight: "50vh" }}><span className="spin" />loading the article</div></div>
    );
}
