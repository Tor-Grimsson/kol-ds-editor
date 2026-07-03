import { createContext } from 'react'

/* Compose state context — lives in its own module so HMR updates to state.jsx
 * don't recreate the context object and orphan mounted consumers
 * ("useComposeState must be inside ComposeStateProvider" during hot reload). */
export const ComposeContext = createContext(null)
