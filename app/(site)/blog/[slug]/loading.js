// Co-located loading UI: gives the route a Suspense boundary so the
// rest of the layout can be statically prerendered under Cache
// Components while the dynamic article streams in.

export default function Loading() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-6" />
            <p className="text-gray-400">Loading article…</p>
        </div>
    );
}
