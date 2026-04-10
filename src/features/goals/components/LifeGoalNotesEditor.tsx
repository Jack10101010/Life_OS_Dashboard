import { ReactNode, useEffect, useRef } from 'react'
import { Extension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'

type LifeGoalNotesEditorProps = {
  goalId: string
  value: string
  onChange: (value: string) => void
}

type NotesCommand =
  | {
      title: string
      action: 'heading' | 'unordered' | 'ordered' | 'bold' | 'underline'
      icon: ReactNode
    }

const NOTES_COMMANDS: NotesCommand[] = [
  {
    title: 'Heading',
    action: 'heading',
    icon: <span className="text-[13px] font-semibold leading-none tracking-[0.01em]">H</span>,
  },
  {
    title: 'Bullet list',
    action: 'unordered',
    icon: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="3.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
        <path d="M6 4.5h6.5M6 8h6.5M6 11.5h6.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Numbered list',
    action: 'ordered',
    icon: <span className="text-[11px] font-medium leading-none tracking-[0.04em]">1.2</span>,
  },
  {
    title: 'Bold',
    action: 'bold',
    icon: <span className="text-[13px] font-semibold leading-none">B</span>,
  },
  {
    title: 'Underline',
    action: 'underline',
    icon: <span className="text-[13px] font-medium leading-none underline underline-offset-[2px]">U</span>,
  },
]

const normalizeNotesHtml = (html: string) => {
  const trimmed = html.trim()
  return trimmed === '' || trimmed === '<p></p>' ? '' : trimmed
}

const NotesListShortcuts = Extension.create({
  name: 'notesListShortcuts',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { editor } = this
        if (!editor.isActive('bulletList') && !editor.isActive('orderedList')) {
          return true
        }
        return editor.commands.sinkListItem('listItem')
      },
      'Shift-Tab': () => {
        const { editor } = this
        if (!editor.isActive('bulletList') && !editor.isActive('orderedList')) {
          return true
        }
        return editor.commands.liftListItem('listItem')
      },
    }
  },
})

const NOTES_COMMIT_DEBOUNCE_MS = 260

export function LifeGoalNotesEditor({ goalId, value, onChange }: LifeGoalNotesEditorProps) {
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const lastCommittedValueRef = useRef(normalizeNotesHtml(value))
  const latestOnChangeRef = useRef(onChange)
  const previousGoalIdRef = useRef(goalId)
  const previousGoalOnChangeRef = useRef(onChange)
  const commitTimeoutRef = useRef<number | null>(null)

  const clearPendingCommit = () => {
    if (commitTimeoutRef.current) {
      window.clearTimeout(commitTimeoutRef.current)
      commitTimeoutRef.current = null
    }
  }

  const getEditorValue = (currentEditor = editor) =>
    currentEditor ? normalizeNotesHtml(currentEditor.getHTML()) : lastCommittedValueRef.current

  const commitValue = (nextValue = getEditorValue(), commit = latestOnChangeRef.current) => {
    const normalized = normalizeNotesHtml(nextValue)
    clearPendingCommit()
    if (normalized === lastCommittedValueRef.current) return
    lastCommittedValueRef.current = normalized
    commit(normalized)
  }

  const scheduleCommit = () => {
    clearPendingCommit()
    commitTimeoutRef.current = window.setTimeout(() => {
      commitValue()
    }, NOTES_COMMIT_DEBOUNCE_MS)
  }

  useEffect(() => {
    latestOnChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    immediatelyRender: false,
    content: normalizeNotesHtml(value),
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Capture rough ideas, structure, and reminders for this goal.',
      }),
      NotesListShortcuts,
    ],
    editorProps: {
      attributes: {
        class:
          'notes-editor-surface h-full min-h-[300px] w-full font-[-apple-system,BlinkMacSystemFont,\"Segoe_UI\",Roboto,sans-serif] caret-[rgb(var(--theme-accent-rgb)/0.66)] overflow-y-auto antialiased outline-none selection:bg-[rgb(var(--theme-accent-rgb)/0.16)] [&_.ProseMirror-trailingBreak]:hidden [&_h3]:mb-[0.45em] [&_h3]:mt-[0.7em] [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:leading-[1.18] [&_h3]:tracking-[0.006em] [&_h3]:text-white/84 [&_p]:mb-[0.72em] [&_p]:min-h-[1.1rem] [&_p]:text-[12px] [&_p]:leading-[1.32] [&_p]:tracking-[0.001em] [&_p]:text-white/74 [&_strong]:font-semibold [&_u]:underline [&_li]:leading-[1.32] [&_li]:text-[12px] [&_li]:text-white/74 [&_.is-editor-empty:first-child:before]:pointer-events-none [&_.is-editor-empty:first-child:before]:float-left [&_.is-editor-empty:first-child:before]:h-0 [&_.is-editor-empty:first-child:before]:max-w-[34rem] [&_.is-editor-empty:first-child:before]:text-[13px] [&_.is-editor-empty:first-child:before]:leading-6 [&_.is-editor-empty:first-child:before]:text-white/22 [&_.is-editor-empty:first-child:before]:content-[attr(data-placeholder)]',
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      scheduleCommit()
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      const { from, to } = nextEditor.state.selection
      savedSelectionRef.current = { from, to }
    },
  })

  const activeStates = useEditorState({
    editor,
    selector: ({ editor: nextEditor }) => ({
      heading: nextEditor?.isActive('heading', { level: 3 }) ?? false,
      unordered: nextEditor?.isActive('bulletList') ?? false,
      ordered: nextEditor?.isActive('orderedList') ?? false,
      bold: nextEditor?.isActive('bold') ?? false,
      underline: nextEditor?.isActive('underline') ?? false,
    }),
  })

  useEffect(() => {
    if (previousGoalIdRef.current !== goalId) {
      const previousDraft = getEditorValue(editor)
      if (previousDraft !== lastCommittedValueRef.current) {
        commitValue(previousDraft, previousGoalOnChangeRef.current)
      } else {
        clearPendingCommit()
      }
      previousGoalIdRef.current = goalId
      previousGoalOnChangeRef.current = onChange
      const nextContent = normalizeNotesHtml(value)
      lastCommittedValueRef.current = nextContent
      if (editor) {
        const currentContent = normalizeNotesHtml(editor.getHTML())
        if (currentContent !== nextContent) {
          editor.commands.setContent(nextContent || '<p></p>', { emitUpdate: false })
        }
      }
      return
    }

    previousGoalOnChangeRef.current = onChange
    const nextContent = normalizeNotesHtml(value)
    if (nextContent === lastCommittedValueRef.current) return
    lastCommittedValueRef.current = nextContent
    if (!editor) return
    const currentContent = normalizeNotesHtml(editor.getHTML())
    if (currentContent === nextContent) return
    editor.commands.setContent(nextContent || '<p></p>', { emitUpdate: false })
  }, [editor, goalId, onChange, value])

  useEffect(
    () => () => {
      const latestValue = getEditorValue(editor)
      if (latestValue !== lastCommittedValueRef.current) {
        commitValue(latestValue)
      } else {
        clearPendingCommit()
      }
    },
    [],
  )

  const runCommand = (command: NotesCommand['action']) => {
    if (!editor) return

    const chain = editor.chain().focus()
    const savedSelection = savedSelectionRef.current
    if (savedSelection && command !== 'heading' && command !== 'bold' && command !== 'underline') {
      chain.setTextSelection(savedSelection)
    }

    if (command === 'heading') {
      chain
        .command(({ state, commands }) => {
          const { $from } = state.selection
          const parentNode = $from.parent
          const isHeadingNode = parentNode.type.name === 'heading' && parentNode.attrs.level === 3
          const isEmptyParagraphNode =
            state.selection.empty && parentNode.type.name === 'paragraph' && parentNode.isTextblock && parentNode.content.size === 0

          if (isHeadingNode) {
            return commands.setParagraph()
          }

          if (isEmptyParagraphNode) {
            return true
          }

          return commands.toggleHeading({ level: 3 })
        })
        .run()
      return
    }
    if (command === 'unordered') {
      chain.toggleBulletList().run()
      return
    }
    if (command === 'ordered') {
      chain.toggleOrderedList().run()
      return
    }
    if (command === 'bold') {
      chain.toggleBold().run()
      return
    }
    if (command === 'underline') {
      chain.toggleUnderline().run()
    }
  }

  return (
    <div className="notes-editor-root flex h-full min-h-[380px] flex-col rounded-t-[18px] rounded-b-none border border-white/[0.045] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] shadow-[inset_0_1px_0_rgba(255,255,255,0.014)] transition-[border-color,box-shadow,background-color] duration-100 ease-out focus-within:border-white/[0.065] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.016),0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="border-b border-white/[0.035] px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {NOTES_COMMANDS.map((command) => (
            <button
              key={command.action}
              type="button"
              title={command.title}
              aria-label={command.title}
              onMouseDown={(event) => {
                if (editor) {
                  const { from, to } = editor.state.selection
                  savedSelectionRef.current = { from, to }
                }
                event.preventDefault()
                runCommand(command.action)
              }}
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-white/60 transition-[background-color,border-color,color,box-shadow,transform] duration-50 ease-out hover:border-white/[0.12] hover:bg-white/[0.045] hover:text-white/86 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${
                activeStates?.[command.action] ?? false
                  ? 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.92)] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08),0_0_16px_rgb(var(--theme-accent-rgb)/0.08)]'
                  : 'border-white/[0.055] bg-white/[0.022]'
              }`}
            >
              {command.icon}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative flex-1 min-h-0 px-4 pb-2 pt-1.5"
        onBlurCapture={(event) => {
          const nextFocused = event.relatedTarget
          if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) return
          commitValue()
        }}
      >
        <EditorContent editor={editor} className="flex h-full min-h-0 w-full flex-col" />
      </div>
    </div>
  )
}
