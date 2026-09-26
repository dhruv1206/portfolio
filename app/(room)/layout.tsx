// The control room owns the whole viewport: no navbar, footer or
// reading container here. Site chrome for every other page lives in
// app/(site)/layout.jsx.
export default function RoomLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
