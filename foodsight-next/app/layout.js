import './globals.css';

export const metadata = {
  title: 'FoodSight AI — Santa Clara County Food Safety',
  description: 'GPU-accelerated food safety intelligence for Santa Clara County. Powered by NVIDIA DGX Spark.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
