import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180, height: 180,
        background: '#111827',
        borderRadius: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 72,
        fontWeight: 800,
        letterSpacing: '-2px',
      }}
    >
      PM
    </div>
  )
}
