import { Tag } from '../../types'

export function TagPill({ tag, active = false }: { tag: Tag; active?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium`}
      style={{
        backgroundColor: `${tag.color}${active ? '33' : '1A'}`,
        borderColor: `${tag.color}${active ? '66' : '33'}`,
        color: '#EAF2FF',
      }}
    >
      {tag.name}
    </span>
  )
}
