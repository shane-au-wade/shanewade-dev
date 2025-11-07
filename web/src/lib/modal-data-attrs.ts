/**
 * Global event delegation for modal data attributes
 *
 * This single listener handles all modals on the page:
 * - [data-modal-open="modal-id"] - Opens modal
 * - [data-modal-close="modal-id"] - Closes specific modal
 * - [data-modal-close] - Closes closest parent modal
 */

// Single click handler using event delegation
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement

  // Check for open trigger
  const openTrigger = target.closest("[data-modal-open]")
  if (openTrigger) {
    const modalId = openTrigger.getAttribute("data-modal-open")
    if (modalId) {
      const modal = document.getElementById(modalId) as HTMLDialogElement
      modal?.showModal()
    }
    return
  }

  // Check for close trigger
  const closeTrigger = target.closest("[data-modal-close]")
  if (closeTrigger) {
    const modalId = closeTrigger.getAttribute("data-modal-close")

    if (modalId) {
      // Close specific modal by ID
      const modal = document.getElementById(modalId) as HTMLDialogElement
      modal?.close()
    } else {
      // Close closest parent modal
      const modal = closeTrigger.closest("dialog") as HTMLDialogElement
      modal?.close()
    }
  }
})

// Optional: Support toggling
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement
  const toggleTrigger = target.closest("[data-modal-toggle]")

  if (toggleTrigger) {
    const modalId = toggleTrigger.getAttribute("data-modal-toggle")
    if (modalId) {
      const modal = document.getElementById(modalId) as HTMLDialogElement
      if (modal) {
        if (modal.open) {
          modal.close()
        } else {
          modal.showModal()
        }
      }
    }
  }
})
