import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: 512,
        height: 512,
        background: '#111827',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 200,
        fontWeight: 700,
        letterSpacing: '-6px',
      }}
    >
      PM
    </div>,
    { width: 512, height: 512 }
  )
}
