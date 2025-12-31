"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import BlogCard from "./blog-card";
import { FadeIn } from "../../ui/page-transition";
import MagneticButton from "../../ui/magnetic-button";
import { MdArrowOutward } from "react-icons/md";

function Blog({ blogs }) {
  // If no blogs, show placeholder
  const hasBlog = blogs && blogs.length > 0;

  return (
    <section id="blog" className="relative py-24 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-pink-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Section Header */}
      <FadeIn>
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-mono text-violet-400 mb-4">
            &lt;blog&gt;
          </span>
          <h2 className="section-heading">Latest Articles</h2>
          <p className="section-subheading mx-auto">
            Thoughts, tutorials, and insights from my journey as a developer.
          </p>
        </div>
      </FadeIn>

      {hasBlog ? (
        <>
          {/* Blog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.slice(0, 6).map(
              (blog, index) =>
                blog?.cover_image && (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <BlogCard blog={blog} />
                  </motion.div>
                )
            )}
          </div>

          {/* View more button */}
          <FadeIn>
            <div className="flex justify-center mt-12">
              <MagneticButton href="/blog" variant="secondary" size="md">
                <span>View All Articles</span>
                <MdArrowOutward size={16} />
              </MagneticButton>
            </div>
          </FadeIn>
        </>
      ) : (
        /* Placeholder when no blogs */
        <FadeIn>
          <div className="max-w-2xl mx-auto">
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-violet-500/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-violet-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-display font-semibold text-white mb-3">
                Coming Soon
              </h3>
              <p className="text-gray-400 mb-6">
                I&apos;m currently working on some exciting articles about software
                development, best practices, and my learning journey. Stay tuned!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["React", "System Design", "DSA", "Cloud"].map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs font-medium text-gray-400 bg-white/5 border border-white/10 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Section closing tag */}
      <FadeIn>
        <div className="text-center mt-16">
          <span className="text-sm font-mono text-violet-400">
            &lt;/blog&gt;
          </span>
        </div>
      </FadeIn>
    </section>
  );
}

export default Blog;