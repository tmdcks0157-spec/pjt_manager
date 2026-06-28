import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Project Manager',
    short_name: 'My PM',
    description: '나만의 프로젝트 관리 도구',
    start_url: '/today',
    display: 'standalone',
    orientation: 'any',
    background_color: '#111827',
    theme_color: '#111827',
    icons: [
      { src: '/api/apple-icon?v=2', sizes: '512x512', type: 'image/png' },
      { src: '/icon-192.png',         sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png',         sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
