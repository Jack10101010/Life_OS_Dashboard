import { TrackerPage } from './TrackerPage'
import { HabitMapsContent, HabitMapsContentProps } from '../habit-maps/HabitMapsContent'

export function TrackerWorkspace({
  trackerPage,
  customTrackers,
}: {
  trackerPage: React.ComponentProps<typeof TrackerPage>
  customTrackers: HabitMapsContentProps
}) {
  return (
    <>
      <TrackerPage {...trackerPage} />
      <HabitMapsContent {...customTrackers} />
    </>
  )
}
