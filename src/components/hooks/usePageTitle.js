import { useEffect } from 'react'
import { BRAND } from '../../brand/config'

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : BRAND.name
  }, [title])
}
