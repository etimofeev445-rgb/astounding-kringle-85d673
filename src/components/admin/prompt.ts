// Plain text prompt: Telegram has no native one, and window.prompt works in its WebView.
export function prompt(message: string): Promise<string | null> {
  try {
    return Promise.resolve(window.prompt(message, ''))
  } catch {
    return Promise.resolve('')
  }
}
