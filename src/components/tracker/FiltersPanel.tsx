import { TrackerFilters, Tag } from '../../types'
import { Button } from '../ui/Button'
import { TagPill } from '../ui/TagPill'

export function FiltersPanel({
  filters,
  tags,
  onChange,
}: {
  filters: TrackerFilters
  tags: Tag[]
  onChange: (next: TrackerFilters) => void
}) {
  return (
    <div className="grid gap-4 rounded-3xl border border-white/5 bg-white/[0.03] p-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr]">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-mist/70">Tags</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const active = filters.selectedTags.includes(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() =>
                  onChange({
                    ...filters,
                    selectedTags: active
                      ? filters.selectedTags.filter((value) => value !== tag.id)
                      : [...filters.selectedTags, tag.id],
                  })
                }
              >
                <TagPill tag={tag} active={active} />
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-mist/70">Alcohol</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['all', 'All'],
            ['drank', 'Drank'],
            ['dry', 'Dry'],
          ].map(([value, label]) => (
            <Button
              key={value}
              className={filters.alcohol === value ? 'border-sky/40 bg-sky/20 text-white' : ''}
              onClick={() => onChange({ ...filters, alcohol: value as TrackerFilters['alcohol'] })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-mist/70">Score</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['all', 'All'],
            ['high', 'High'],
            ['low', 'Low'],
          ].map(([value, label]) => (
            <Button
              key={value}
              className={filters.score === value ? 'border-sky/40 bg-sky/20 text-white' : ''}
              onClick={() => onChange({ ...filters, score: value as TrackerFilters['score'] })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-panelSoft/70 px-3 py-2">
          <span className="text-sm text-mist">Big wins only</span>
          <button
            onClick={() => onChange({ ...filters, bigWinOnly: !filters.bigWinOnly })}
            className={`h-6 w-11 rounded-full p-1 transition ${filters.bigWinOnly ? 'bg-sky' : 'bg-white/10'}`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition ${filters.bigWinOnly ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
        <p className="text-xs text-mist/70">Year filter is controlled from the tracker toolbar for now.</p>
      </div>
    </div>
  )
}
