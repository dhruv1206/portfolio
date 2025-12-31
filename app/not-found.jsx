import Link from "next/link";
import { projectsData } from "@/utils/data/projects-data";

export default function NotFound() {
    // Get top 3 projects
    const topProjects = projectsData?.slice(0, 3) || [];

    return (
        <main className="min-h-screen flex items-center justify-center px-6">
            <div className="max-w-2xl w-full text-center">
                {/* Glitch-style 404 */}
                <div className="relative mb-8">
                    <h1 className="text-[150px] md:text-[200px] font-bold leading-none gradient-text opacity-20">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-6xl md:text-8xl font-bold gradient-text">
                            404
                        </span>
                    </div>
                </div>

                {/* Message */}
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                    Page Not Found
                </h2>
                <p className="text-gray-400 text-lg mb-2">
                    This page was{" "}
                    <span className="text-violet-400 font-mono">garbage collected</span>.
                </p>
                <p className="text-gray-500 text-sm mb-8">
                    The route you&apos;re looking for doesn&apos;t exist, but these do...
                </p>

                {/* Suggested Projects */}
                <div className="mb-8">
                    <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-4">
                        Featured Projects
                    </h3>
                    <div className="grid gap-3">
                        {topProjects.map((project, index) => (
                            <Link
                                key={project.id || index}
                                href={`/projects/${project.slug}`}
                                className="group glass-card p-4 flex items-center justify-between 
                                    hover:border-violet-500/30 transition-all duration-300"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-violet-400 font-mono text-sm">
                                        0{index + 1}
                                    </span>
                                    <span className="text-white group-hover:text-violet-400 transition-colors">
                                        {project.name}
                                    </span>
                                </div>
                                <svg
                                    className="w-4 h-4 text-gray-500 group-hover:text-violet-400 
                                        transition-all transform group-hover:translate-x-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Navigation buttons */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/"
                        className="btn-primary px-6 py-3"
                    >
                        <span>Go Home</span>
                    </Link>
                    <Link
                        href="/#contact"
                        className="btn-secondary px-6 py-3"
                    >
                        <span>Contact Me</span>
                    </Link>
                </div>

                {/* Easter egg */}
                <p className="mt-12 text-[10px] text-gray-700 font-mono">
                    Error: ENOENT: no such file or route
                </p>
            </div>
        </main>
    );
}
