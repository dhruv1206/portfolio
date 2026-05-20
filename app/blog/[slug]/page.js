// Placeholder for individual blog posts. The previous implementation
// fetched the dev.to article body but never rendered it (empty <div>).
// Until full article rendering lands in a later phase, the page just
// surfaces the slug so the route resolves cleanly under Cache Components
// — no `fetch()` happens here, so PPR is unblocked.

async function BlogDetails(props) {
  const params = await props.params;
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-mono text-violet-400 mb-2">/blog/{params.slug}</p>
      <p className="text-2xl font-display font-semibold text-white mb-3">
        Article rendering coming soon
      </p>
      <p className="text-gray-400 max-w-md">
        Read the post on{" "}
        <a
          href={`https://dev.to/dhruv1206/${params.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-300 hover:text-violet-200 underline"
        >
          dev.to
        </a>{" "}
        for now.
      </p>
    </div>
  );
}

export default BlogDetails;
