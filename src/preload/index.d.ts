import type { RollyApi } from './index'

declare global {
  interface Window {
    rolly: RollyApi
  }
}

export {}
