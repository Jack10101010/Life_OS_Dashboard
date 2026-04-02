import { Component, ReactNode } from 'react'

type ErrorBoundaryProps = {
  title?: string
  description?: string
  className?: string
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('UI surface failed to render', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-sm text-white/72 ${this.props.className ?? ''}`}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">
            {this.props.title ?? 'Something went wrong'}
          </p>
          <p className="mt-2 text-sm text-mist">
            {this.props.description ?? 'This section could not be displayed right now.'}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
