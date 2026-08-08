import "./globals.css";

export const metadata = {
  title: "CRM Terminal",
  description: "Хакерская CRM для учёта сделок",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <div className="scanlines" />
        {children}
      </body>
    </html>
  );
}
