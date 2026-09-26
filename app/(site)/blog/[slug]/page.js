import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { personalData } from "@/utils/data/personal-data";

async function getBlog(slug) {
    const res = await fetch(
        `https://dev.to/api/articles/${personalData.devUsername}/${slug}`,
        { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return res.json();
}

export async function generateMetadata(props) {
    const { slug } = await props.params;
    const blog = await getBlog(slug);
    if (!blog) {
        return { title: "Article not found" };
    }
    return {
        title: `${blog.title} | Dhruv Agrawal`,
        description: blog.description,
        openGraph: {
            title: blog.title,
            description: blog.description,
            type: "article",
            images: blog.cover_image ? [{ url: blog.cover_image }] : undefined,
        },
    };
}

export default async function BlogDetails(props) {
    const { slug } = await props.params;
    const blog = await getBlog(slug);

    if (!blog) {
        notFound();
    }

    // dev.to is a trusted publisher of our own content, but we sanitize
    // anyway to neutralise any HTML they (or a future content source)
    // might allow that we wouldn't expect.
    const sanitizedBody = DOMPurify.sanitize(blog.body_html, {
        USE_PROFILES: { html: true },
    });

    return (
        <article className="max-w-3xl mx-auto py-12 lg:py-20">
            <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-mono text-violet-400 hover:text-violet-300 mb-8"
            >
                ← All articles
            </Link>

            <header className="mb-10">
                <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white mb-4">
                    {blog.title}
                </h1>
                {blog.description && (
                    <p className="text-lg text-gray-400 mb-6">{blog.description}</p>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>
                        {new Date(blog.published_at).toLocaleDateString("en-US", {
                            dateStyle: "medium",
                        })}
                    </span>
                    {blog.reading_time_minutes ? (
                        <>
                            <span>·</span>
                            <span>{blog.reading_time_minutes} min read</span>
                        </>
                    ) : null}
                </div>
            </header>

            <div
                className="blog-body prose prose-invert prose-violet max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            />

            <footer className="mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <span>Originally published on</span>
                <a
                    href={blog.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-300 hover:text-violet-200 underline"
                >
                    dev.to
                </a>
            </footer>
        </article>
    );
}
