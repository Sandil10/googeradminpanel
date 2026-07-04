import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import "./globals.css";

export const metadata: Metadata = {
    title: "Googer Admin Panel",
    description: "Googer Admin Dashboard",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Point ionicons SVG fetches to jsDelivr before the library loads */}
                <script dangerouslySetInnerHTML={{ __html: `
                  window.Ionicons = { config: { resourcesUrl: 'https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/ionicons/' } };
                  window.addEventListener('unhandledrejection', function(e) {
                    if (e.reason instanceof TypeError && e.reason.message === 'Failed to fetch') { e.preventDefault(); }
                  });
                `}} />
                <script type="module" src="https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
                <script noModule src="https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
            </head>
            <body className="bg-black text-slate-200 font-sans" suppressHydrationWarning>
                <ClientLayout>
                    {children}
                </ClientLayout>
            </body>
        </html>
    );
}
