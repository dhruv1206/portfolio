"use client";

import { timeConverter } from "@/utils/time-converter";
import Image from "next/image";
import Link from "next/link";
import { BsHeartFill, BsClock } from "react-icons/bs";
import { FaCommentAlt } from "react-icons/fa";
import { MdArrowOutward } from "react-icons/md";

function BlogCard({ blog }) {
  return (
    <article className="glass-card overflow-hidden group h-full flex flex-col">
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={blog?.cover_image}
          height={400}
          width={600}
          alt={blog?.title || "Blog cover"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Read time badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-dark-900/80 backdrop-blur-sm rounded-full text-xs text-gray-300">
          <BsClock size={10} />
          <span>{blog.reading_time_minutes} min</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Date and stats */}
        <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
          <span>{timeConverter(blog.published_at)}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <BsHeartFill className="text-pink-500" size={12} />
              {blog.public_reactions_count}
            </span>
            {blog.comments_count > 0 && (
              <span className="flex items-center gap-1">
                <FaCommentAlt className="text-cyan-500" size={10} />
                {blog.comments_count}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <Link href={blog.url} target="_blank" rel="noopener noreferrer">
          <h3 className="text-lg font-display font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-2 mb-2">
            {blog.title}
          </h3>
        </Link>

        {/* Description */}
        <p className="text-sm text-gray-400 line-clamp-2 flex-1">
          {blog.description}
        </p>

        {/* Read more link */}
        <Link
          href={blog.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors group/link"
        >
          <span>Read Article</span>
          <MdArrowOutward
            size={14}
            className="transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
          />
        </Link>
      </div>
    </article>
  );
}

export default BlogCard;