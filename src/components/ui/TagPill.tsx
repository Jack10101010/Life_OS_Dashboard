import { Tag } from '../../types'

export function TagPill({
  tag,
  active = false,
  emphasis = 'default',
  muted = false,
  oneOff = false,
}: {
  tag: Tag
  active?: boolean
  emphasis?: 'default' | 'selected'
  muted?: boolean
  oneOff?: boolean
}) {
  const selected = emphasis === 'selected'
  const negative = tag.polarity === 'negative'
  const neutral = tag.polarity === 'neutral'
  const activeClass = negative
    ? selected
      ? 'border-[rgba(239,68,68,0.42)] bg-[rgba(239,68,68,0.18)] text-[#FFF1EE]'
      : 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.11)] text-[#F3D7D4]'
    : neutral
      ? selected
        ? 'border-[rgba(96,165,250,0.46)] bg-[rgba(96,165,250,0.18)] text-[#EAF3FF]'
        : 'border-[rgba(96,165,250,0.3)] bg-[rgba(96,165,250,0.1)] text-[#BFDBFE]'
      : selected
        ? 'border-[rgba(34,197,94,0.62)] bg-[rgba(34,197,94,0.28)] text-[#F4FFF7]'
        : 'border-[rgba(34,197,94,0.42)] bg-[rgba(34,197,94,0.18)] text-[#E4FBEA]'
  const inactiveClass = 'border-[#343434] bg-[#202020] text-[#C8C8C8] hover:border-[#3A3A3A] hover:bg-[#222222]'

  return (
    <span
      className={`${
        active ? 'tag-pill-select scale-100 opacity-100' : 'scale-[0.985] opacity-[0.94]'
      } rounded-full border px-2.5 py-1 text-xs font-medium transition-[transform,opacity,background-color,border-color,color,box-shadow,filter] duration-150 ease-out will-change-transform ${
        active ? activeClass : inactiveClass
      }`}
      style={{ opacity: muted ? 0.72 : 1, borderStyle: oneOff ? 'dashed' : 'solid' }}
    >
      {tag.name}
    </span>
  )
}
