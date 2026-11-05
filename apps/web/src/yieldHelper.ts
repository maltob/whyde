/**
 * Robustly yields control to the browser event loop and compositor.
 * Uses requestAnimationFrame followed by setTimeout to guarantee that React
 * DOM commits and CSS animations have been painted to the screen before
 * any CPU-bound task (such as WebAssembly Clang compilation) begins.
 */
export async function yieldToMainThread(): Promise<void> {
  if (typeof window === 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
