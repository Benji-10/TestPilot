export default function Spinner({ accent = false, size = 13 }) {
  return (
    <div
      className={accent ? 'spinner spinner-accent' : 'spinner'}
      style={{ width: size, height: size }}
    />
  )
}
