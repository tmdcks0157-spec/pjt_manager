import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Project Manager',
    short_name: 'My PM',
    description: '나만의 프로젝트 관리 도구',
    start_url: '/today',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f9fafb',
    theme_color: '#111827',
    icons: [
      { src: '/icon', sizes: '32x32',   type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
