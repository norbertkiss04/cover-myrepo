# Design System — InstaCover

## UI könyvtár / komponens-könyvtár

Az InstaCover egyedi komponenseket használ, TailwindCSS v4 alapokra építve. Nincsen külső komponens-könyvtár (nem shadcn/ui, nem MUI), minden komponens saját fejlesztésű a projekt specifikus igényeire szabva.

Használt technológiák:
- **TailwindCSS v4** — Utility-first CSS framework
- **React 19** — Komponens alapú UI
- **Framer Motion** — Animációk (pl. progress, hover effektek)
- **React Hot Toast** — Toast értesítések
- **Heroicons** — Ikon készlet
- **React Masonry CSS** — Galéria elrendezés (History, Style References)

## Színpaletta

### Light Mode

| Szín | Hex kód | Használat |
|------|---------|-----------|
| Background | `#FAFAFA` | Alkalmazás háttér |
| Surface | `#FFFFFF` | Kártyák, panelek háttere |
| Surface Alt | `#F5F5F5` | Input mezők, alternatív felületek |
| Surface Hover | `#EBEBEB` | Hover állapot |
| Text | `#171717` | Elsődleges szöveg |
| Text Secondary | `#525252` | Másodlagos szöveg |
| Text Muted | `#A1A1AA` | Halvány szöveg, placeholder |
| Accent (Primary) | `#9F1239` | CTA gombok, kiemelt elemek (Rose-900) |
| Accent Hover | `#881337` | Accent hover állapot (Rose-950) |
| Accent Soft | `#FFF1F2` | Accent háttér (Rose-50) |
| Border | `#E5E5E5` | Szegélyek |
| Border Strong | `#D4D4D4` | Erősebb szegélyek |
| Error | `#DC2626` | Hibák (Red-600) |
| Error BG | `#FEF2F2` | Hiba háttér |
| Error Border | `#FECACA` | Hiba szegély |
| Success | `#16A34A` | Siker (Green-600) |
| Success BG | `#F0FDF4` | Siker háttér |
| Success Border | `#BBF7D0` | Siker szegély |
| Info | `#2563EB` | Információ (Blue-600) |
| Info BG | `#EFF6FF` | Info háttér |
| Info Border | `#BFDBFE` | Info szegély |

### Dark Mode

| Szín | Hex kód | Használat |
|------|---------|-----------|
| Background | `#09090B` | Alkalmazás háttér (Zinc-950) |
| Surface | `#18181B` | Kártyák háttere (Zinc-900) |
| Surface Alt | `#27272A` | Input mezők (Zinc-800) |
| Surface Hover | `#3F3F46` | Hover állapot (Zinc-700) |
| Text | `#FAFAFA` | Elsődleges szöveg |
| Text Secondary | `#A1A1AA` | Másodlagos szöveg |
| Text Muted | `#71717A` | Halvány szöveg |
| Accent (Primary) | `#D44060` | CTA gombok |
| Accent Hover | `#E06680` | Accent hover |
| Accent Soft | `#4C0519` | Accent háttér |
| Border | `#27272A` | Szegélyek |
| Border Strong | `#3F3F46` | Erősebb szegélyek |
| Error | `#F87171` | Hibák |
| Success | `#4ADE80` | Siker |
| Info | `#60A5FA` | Információ |

## Tipográfia

### Font családok

| Típus | Font család | Fallback |
|-------|-------------|----------|
| Heading | Space Grotesk | system-ui, sans-serif |
| Body | DM Sans | system-ui, -apple-system, sans-serif |

### Font méretek (Tailwind skála)

| Méret | Pixel | Használat |
|-------|-------|-----------|
| text-xs | 12px | Segédszövegek, labelek |
| text-sm | 14px | Form inputok, gombok, nav linkek |
| text-base | 16px | Alap szöveg |
| text-lg | 18px | Kiemelt bekezdések |
| text-xl | 20px | Kisebb címek |
| text-2xl | 24px | Oldal címek |
| text-3xl | 30px | Nagy címek |
| text-4xl | 36px | Hero címek (mobil) |
| text-5xl | 48px | Hero címek (tablet) |
| text-[3.5rem] | 56px | Hero címek (desktop) |

### Font súlyok

| Súly | Szám | Használat |
|------|------|-----------|
| normal | 400 | Alap szöveg |
| medium | 500 | Kiemelt szöveg, labelek |
| semibold | 600 | Gombok, nav linkek |
| bold | 700 | Címek |

### Letter spacing

- Címek: `-0.025em` (tight)
- Normál szöveg: `normal`
- Uppercase labelek: `tracking-wide` (0.025em)

## Spacing / Grid

### Alap egység

**4px** alapú spacing rendszer (Tailwind default)

### Gyakori spacing értékek

| Token | Pixel | Használat |
|-------|-------|-----------|
| gap-1 | 4px | Ikon + szöveg |
| gap-2 | 8px | Kis elemek között |
| gap-3 | 12px | Form elemek között |
| gap-4 | 16px | Kártyák között |
| gap-6 | 24px | Szekciók között |
| p-3 | 12px | Input padding |
| p-4 | 16px | Kártya padding (mobil) |
| p-5 | 20px | Kártya padding (desktop) |
| p-6 | 24px | Nagy kártya padding |
| p-8 | 32px | Hero szekció padding |

### Max content width

| Container | Pixel | Használat |
|-----------|-------|-----------|
| max-w-md | 448px | Login form |
| max-w-xl | 576px | Szöveg blokkok |
| max-w-6xl | 1152px | Generate oldal |
| max-w-7xl | 1280px | Templates oldal |

### Grid rendszer

- **2 oszlopos grid**: Generate oldal (form + preview)
- **4 oszlopos grid**: Sablon kártyák
- **Masonry layout**: History és Style References galéria

## Ikonkészlet

**Heroicons** (Outline variant, 24x24 és 20x20)

Gyakran használt ikonok:
- `ArrowDownTrayIcon` — Letöltés
- `TrashIcon` — Törlés
- `PencilIcon` — Szerkesztés
- `Cog6ToothIcon` — Beállítások
- `PlusIcon` — Hozzáadás
- `XMarkIcon` — Bezárás

## Sötét mód

**Támogatott**: Igen

Implementáció:
- CSS custom properties (CSS variables)
- `.dark` class a `<html>` elemen
- Automatikus rendszer preferencia detektálás
- Manuális váltási lehetőség a Navbar-ban

## Reszponzív breakpointok

| Breakpoint | Pixel | Használat |
|------------|-------|-----------|
| sm | 640px | Mobil → Tablet átmenet |
| md | 768px | Tablet |
| lg | 1024px | Tablet → Desktop átmenet |
| xl | 1280px | Desktop |
| 2xl | 1536px | Nagy desktop |

### Masonry breakpointok (galéria)

```javascript
{
  default: 4,    // 4 oszlop desktop
  1280: 3,       // 3 oszlop xl alatt
  1024: 3,       // 3 oszlop lg alatt
  768: 2,        // 2 oszlop md alatt
  640: 2         // 2 oszlop sm alatt
}
```

## Komponens stílusok

### Gombok

**Primary (Accent)**
```css
bg-accent text-white px-5 py-2 rounded-lg font-medium 
hover:bg-accent-hover disabled:opacity-40 transition-colors
```

**Secondary (Outline)**
```css
border border-border text-text-secondary rounded-lg px-4 py-2 
hover:bg-surface-alt hover:text-text transition-colors
```

### Input mezők

```css
w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl 
text-text placeholder-text-muted 
focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50
```

### Kártyák

```css
bg-surface border border-border rounded-2xl p-4 sm:p-5
```

### Border radius skála

| Token | Pixel | Használat |
|-------|-------|-----------|
| rounded | 4px | Kis elemek |
| rounded-lg | 8px | Gombok |
| rounded-xl | 12px | Inputok |
| rounded-2xl | 16px | Kártyák |
| rounded-full | 9999px | Badge-ek, profilképek |

## Animációk

- **Hover transitions**: `transition-colors` (200ms)
- **Loading spinner**: `animate-spin`
- **Hero blobs**: Egyedi `animate-gradient-blob` animáció
- **Image fade-in**: `transition-opacity duration-300`
- **Modal**: Framer Motion fade + scale

## Forrás

- Nincs külső design fájl (Figma/Penpot)
- Design tokens a `frontend/src/index.css` fájlban definiálva
- Tailwind konfiguráció: `frontend/tailwind.config.js`
