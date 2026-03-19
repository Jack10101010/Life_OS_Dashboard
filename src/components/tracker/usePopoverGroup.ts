import { RefObject, useEffect, useRef, useState } from 'react'

export function usePopoverGroup<T extends string>() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeMenu, setActiveMenu] = useState<T | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (containerRef.current?.contains(target)) return
      setActiveMenu(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return {
    containerRef: containerRef as RefObject<HTMLDivElement>,
    activeMenu,
    isOpen: (menu: T) => activeMenu === menu,
    toggleMenu: (menu: T) => setActiveMenu((current) => (current === menu ? null : menu)),
    closeMenu: () => setActiveMenu(null),
  }
}
