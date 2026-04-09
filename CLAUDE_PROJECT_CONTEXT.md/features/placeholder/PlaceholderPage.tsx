import { ResponsiveGrid, SectionCard } from '../../components/layout/LayoutPrimitives'

export function PlaceholderPage({
  title,
  description,
  highlights,
}: {
  title: string
  description: string
  highlights: string[]
}) {
  return (
    <ResponsiveGrid columns="two-uneven" className="xl:grid-cols-[1.2fr_0.9fr]">
      <SectionCard>
        <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Coming soon</p>
        <h3 className="mt-3 text-3xl font-semibold text-white">{title}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-mist">{description}</p>
      </SectionCard>
      <SectionCard>
        <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Planned shape</p>
        <div className="mt-4 space-y-3">
          {highlights.map((item) => (
            <div key={item} className="rounded-2xl border border-white/5 bg-panelSoft/50 p-3 text-sm text-white">
              {item}
            </div>
          ))}
        </div>
      </SectionCard>
    </ResponsiveGrid>
  )
}
