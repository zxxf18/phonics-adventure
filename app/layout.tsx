import type { Metadata, Viewport } from 'next';
import './globals.css';
const title = '音标探险岛｜少儿英语音标启蒙';
const description = '好玩、好听、由浅入深的少儿英语音标学习乐园。';
export const metadata: Metadata = {
  metadataBase: new URL('https://phonics-island-2026.birgitjohn2000.chatgpt.site'),
  title,
  description,
  openGraph: { title, description, type: 'website', locale: 'zh_CN', images: [{ url: '/og.png', width: 1731, height: 909, alt: '音标探险岛的狮子探险家' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#dff4ff' };
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) { return <html lang="zh-CN"><body>{children}</body></html>; }
