import { Component, ReactNode } from "react"

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error?: unknown }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("UI ErrorBoundary:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 16 }}>
          <h2>Algo salió mal al cargar esta vista.</h2>
          <p>Revisa consola para más detalles.</p>
        </div>
      )
    }
    return this.props.children
  }
}
