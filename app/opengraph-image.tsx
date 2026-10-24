import { ImageResponse } from 'next/og'

export const alt = 'Recall: ask your documents, get answers you can check'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** The card shown when the link is pasted into LinkedIn, Slack, WhatsApp... */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #ffffff 0%, #eef0ff 100%)',
          color: '#101828',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Recall</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>Ask your documents.</div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, color: '#4f46e5' }}>
            Get answers you can check.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: '#667085' }}>
            Cited answers from your own files, and an honest “I don’t know.”
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 24, color: '#3730a3' }}>
          {['23/23 correct', '6/6 declined', 'Every answer cited'].map(t => (
            <div key={t} style={{ display: 'flex', padding: '10px 20px', borderRadius: 999, background: '#e0e3ff' }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
