import { useEffect, useId, useRef, useState } from 'react'
import { Check, Download, PlusSquare, RefreshCw, Share2, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome:'accepted' | 'dismissed'; platform:string }>
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?:boolean }).standalone)
}

export function InstallPrompt() {
  const dialogId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [installEvent,setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed,setInstalled] = useState(isStandalone)
  const [iosGuideOpen,setIosGuideOpen] = useState(false)
  const [updateReady,setUpdateReady] = useState(false)
  const ios = isIosDevice()

  useEffect(() => {
    const captureInstall = (event:Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const markInstalled = () => { setInstalled(true); setInstallEvent(null); setIosGuideOpen(false) }
    const markUpdate = () => setUpdateReady(true)
    window.addEventListener('beforeinstallprompt',captureInstall)
    window.addEventListener('appinstalled',markInstalled)
    document.addEventListener('pwa-update-ready',markUpdate)
    return () => {
      window.removeEventListener('beforeinstallprompt',captureInstall)
      window.removeEventListener('appinstalled',markInstalled)
      document.removeEventListener('pwa-update-ready',markUpdate)
    }
  },[])

  useEffect(() => {
    if (!iosGuideOpen) return
    const closeOutside = (event:PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIosGuideOpen(false)
    }
    const closeWithEscape = (event:KeyboardEvent) => {
      if (event.key === 'Escape') setIosGuideOpen(false)
    }
    document.addEventListener('pointerdown',closeOutside)
    document.addEventListener('keydown',closeWithEscape)
    requestAnimationFrame(() => closeRef.current?.focus())
    return () => {
      document.removeEventListener('pointerdown',closeOutside)
      document.removeEventListener('keydown',closeWithEscape)
    }
  },[iosGuideOpen])

  async function activate() {
    if (updateReady) {
      document.dispatchEvent(new Event('pwa-apply-update'))
      return
    }
    if (installEvent) {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      setInstallEvent(null)
      if (choice.outcome === 'accepted') setInstalled(true)
      return
    }
    if (ios) setIosGuideOpen(value => !value)
  }

  if (installed && !updateReady) return null
  if (!updateReady && !installEvent && !ios) return null
  const label = updateReady ? 'Actualizar app' : installEvent ? 'Instalar app' : 'Guardar en inicio'
  const Icon = updateReady ? RefreshCw : installEvent ? Download : Share2

  return <div className="pwa-install" ref={containerRef}>
    <button type="button" className="pwa-install-button" onClick={activate} aria-expanded={iosGuideOpen} aria-controls={ios ? dialogId : undefined} title={label}>
      <Icon size={15} aria-hidden="true" /><span>{label}</span>
    </button>
    {iosGuideOpen && <div className="ios-install-guide" id={dialogId} role="dialog" aria-modal="false" aria-labelledby={`${dialogId}-title`}>
      <button ref={closeRef} type="button" className="ios-guide-close" onClick={() => setIosGuideOpen(false)} aria-label="Cerrar guía"><X size={16} /></button>
      <strong id={`${dialogId}-title`}>Llévala a tu inicio</strong>
      <p>En iPhone o iPad:</p>
      <ol><li><Share2 size={16} aria-hidden="true" />Toca <b>Compartir</b>.</li><li><PlusSquare size={16} aria-hidden="true" />Elige <b>Agregar a inicio</b>.</li></ol>
      <small><Check size={14} aria-hidden="true" />Abrirá como una app y conservará el último corte disponible.</small>
    </div>}
  </div>
}
