import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: 192,
        height: 192,
        background: '#111827',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 80,
        fontWeight: 700,
        letterSpacing: '-2px',
      }}
    >
      PM
    </div>,
    { width: 192, height: 192 }
  )
}
