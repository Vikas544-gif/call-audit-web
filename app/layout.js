import "./globals.css";

export const metadata = { title: "Sales Call Audit" };

const themeInit = `try{var t=localStorage.getItem("cat");if(t)document.documentElement.dataset.theme=t;var a=localStorage.getItem("caa");if(a)document.documentElement.style.setProperty("--accent",a)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Devanagari:wght@400;500;600&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
