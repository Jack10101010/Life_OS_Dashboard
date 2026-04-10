import { AnimatePresence, motion } from 'framer-motion'
import { memo, ReactNode, RefObject } from 'react'

type LifeGoalVisionCardProps = {
  isCollapsed: boolean
  isEditing: boolean
  isEditorOpen: boolean
  editMode: 'images' | 'statement' | 'images-statement' | 'hide'
  canUploadImages: boolean
  visionDropActive: boolean
  visionStatementLength: number
  uploadInputRef: RefObject<HTMLInputElement | null>
  onOpenEditor: () => void
  onSelectEditMode: (mode: 'images' | 'statement' | 'images-statement' | 'hide') => void
  onVisionFilesSelected: (files: FileList) => Promise<void> | void
  onUploadClick: () => void
  onDropActiveChange: (active: boolean) => void
  onDropFiles: (files: FileList) => Promise<void> | void
  onVisionStatementChange: (value: string) => void
  onApplyEditMode: () => void
  editImagesContent: ReactNode
  displayContent: ReactNode
  showEditImages: boolean
  showEditStatement: boolean
  visionStatement: string
}

export const LifeGoalVisionCard = memo(function LifeGoalVisionCard({
  isCollapsed,
  isEditing,
  isEditorOpen,
  editMode,
  canUploadImages,
  visionDropActive,
  visionStatementLength,
  uploadInputRef,
  onOpenEditor,
  onSelectEditMode,
  onVisionFilesSelected,
  onUploadClick,
  onDropActiveChange,
  onDropFiles,
  onVisionStatementChange,
  onApplyEditMode,
  editImagesContent,
  displayContent,
  showEditImages,
  showEditStatement,
  visionStatement,
}: LifeGoalVisionCardProps) {
  return (
    <div
      className={`rounded-[22px] border border-white/[0.04] bg-[rgb(var(--theme-surface-elevated-rgb)/0.42)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.015)] ${
        isEditorOpen || isCollapsed ? '' : 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden'
      } ${!isEditing ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (isCollapsed || !isEditing) {
          onOpenEditor()
        }
      }}
    >
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (event) => {
          if (!event.target.files?.length) return
          await onVisionFilesSelected(event.target.files)
          event.target.value = ''
        }}
      />

      <div className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Vision</p>
          {!isCollapsed ? (
            <p className="mt-1 text-[13px] leading-5 text-mist/62">Small reminder of what this is really for</p>
          ) : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed || isEditing ? (
          <motion.div
            key="vision-body"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`overflow-hidden ${isEditing ? '' : 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col'}`}
            onClick={(event) => {
              if (isEditing) {
                event.stopPropagation()
              }
            }}
          >
            <div className={isEditing ? '' : 'xl:roadmap-scroll xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-y-auto xl:pr-1'}>
              {isEditing ? (
                <div className="mt-3.5 space-y-3">
                  <div className="inline-flex rounded-full border border-white/[0.06] bg-white/[0.02] p-1">
                    {([
                      ['images', 'Images'],
                      ['statement', 'Statement'],
                      ['images-statement', 'Images + Statement'],
                      ['hide', 'Hide'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onSelectEditMode(mode)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${
                          editMode === mode ? 'theme-button-secondary' : 'text-white/44 hover:text-white/68'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {showEditImages ? (
                    <div className="space-y-3">
                      {editImagesContent}

                      <div
                        onDragOver={(event) => {
                          event.preventDefault()
                          onDropActiveChange(true)
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault()
                          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                          onDropActiveChange(false)
                        }}
                        onDrop={async (event) => {
                          event.preventDefault()
                          onDropActiveChange(false)
                          if (event.dataTransfer.files?.length) {
                            await onDropFiles(event.dataTransfer.files)
                          }
                        }}
                        className={`rounded-[18px] border border-dashed px-3.5 py-3 transition ${
                          visionDropActive
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.24)] bg-[rgb(var(--theme-accent-rgb)/0.05)]'
                            : 'border-white/[0.06] bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[12px] text-white/76">Images</p>
                            <p className="mt-1 text-[12px] text-mist/52">Drag in images or upload up to 4.</p>
                            <p className="mt-1 text-[11px] text-mist/40">Only the first 2 images show when collapsed. Drag to reorder.</p>
                          </div>
                          <button
                            type="button"
                            onClick={onUploadClick}
                            disabled={!canUploadImages}
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${
                              canUploadImages
                                ? 'border-white/[0.06] bg-white/[0.025] text-white/58 hover:border-white/[0.1] hover:text-white/78'
                                : 'cursor-not-allowed border-white/[0.03] bg-white/[0.015] text-white/24'
                            }`}
                          >
                            Upload
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {showEditStatement ? (
                    <div className="space-y-1">
                      <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-3.5 py-3">
                        <textarea
                          value={visionStatement}
                          onChange={(event) => onVisionStatementChange(event.target.value)}
                          maxLength={120}
                          spellCheck={true}
                          rows={4}
                          placeholder="A short reminder of what this goal makes possible"
                          className="min-h-[120px] w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-white/26"
                        />
                        <p className="mt-2 text-[11px] text-mist/42">{visionStatementLength}/120</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onApplyEditMode()
                      }}
                      className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/64 transition hover:border-white/[0.12] hover:text-white/84"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                displayContent
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
})
