import EditorIcon from '../icons/EditorIcon'

/**
 * EditorButton — editor-side button atom that mirrors the KOL `Button` API
 * but resolves icon names against the editor's own icon registry
 * (`src/editor/icons/svg/`) via `EditorIcon`.
 *
 * Lives outside `kol-component` syncing — KOL Button is unmodified. Shared
 * `kol-btn-*` CSS classes still come from `kol-components-atoms.css` so
 * the visual treatment stays consistent.
 *
 * Supports the prop subset the editor actually uses:
 *   variant, size, iconLeft, iconRight, iconLeftHover, iconRightHover,
 *   iconOnly, iconOnlyHover, iconSize, animateIcon, quiet, onClick,
 *   disabled, type, className, style, children + arbitrary aria/data attrs.
 *
 * Skips the `href` / `<a>` branch — editor buttons never render as links.
 */
export default function EditorButton({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  iconLeftHover,
  iconRightHover,
  iconOnly,
  iconOnlyHover,
  animateIcon = false,
  quiet = false,
  iconSize = 16,
  onClick,
  className = '',
  style = {},
  type = 'button',
  disabled = false,
  ...props
}) {
  const variantClass =
    variant === 'primary'  ? 'kol-btn-primary'
    : variant === 'accent' ? 'kol-btn-accent'
    : variant === 'outline' ? 'kol-btn-outline'
    : variant === 'ghost'  ? 'kol-btn-ghost'
    : 'kol-btn-secondary'

  const sizeClass =
    size === 'sm' ? 'kol-btn-sm kol-mono-12'
    : size === 'lg' ? 'kol-btn-lg kol-mono-16'
    : 'kol-btn-md kol-mono-14'

  const animateClass = animateIcon ? 'kol-btn-animate' : ''
  const quietClass   = quiet ? 'kol-btn-quiet' : ''
  const combinedClass = `kol-btn ${variantClass} ${sizeClass} ${animateClass} ${quietClass} ${className}`.trim()

  const renderIcon = (name, hoverName) => {
    if (!name && !hoverName) return null
    if (!hoverName) {
      return <EditorIcon name={name} size={iconSize} />
    }
    return (
      <span
        className="kol-icon-swap-container"
        style={{ position: 'relative', display: 'inline-flex', width: iconSize, height: iconSize, overflow: 'hidden' }}
      >
        <EditorIcon name={name}      size={iconSize} className="kol-icon-default" style={{ position: 'absolute' }} />
        <EditorIcon name={hoverName} size={iconSize} className="kol-icon-hover"   style={{ position: 'absolute' }} />
      </span>
    )
  }

  const content = iconOnly
    ? renderIcon(iconOnly, iconOnlyHover)
    : (iconLeft || iconRight || iconLeftHover || iconRightHover)
      ? (
        <span className="flex items-center gap-2">
          {(iconLeft || iconLeftHover) && renderIcon(iconLeft, iconLeftHover)}
          {children}
          {(iconRight || iconRightHover) && renderIcon(iconRight, iconRightHover)}
        </span>
      )
      : children

  const mergedStyle = iconOnly
    ? { lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }
    : style

  return (
    <button
      onClick={onClick}
      type={type}
      className={combinedClass}
      style={mergedStyle}
      disabled={disabled}
      aria-label={iconOnly ? (props['aria-label'] || 'Button') : undefined}
      {...props}
    >
      {content}
    </button>
  )
}
