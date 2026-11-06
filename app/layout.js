export const metadata = { title: "Sales Call Audit" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f5f6f8", color: "#14181f", font: "15px/1.5 system-ui,sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
