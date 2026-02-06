# Imagony Website Redesign + Web3 Integration

## 🎨 Was wurde verbessert?

### UI/UX Refresh
- **Neues Design**: Dark theme mit Glassmorphism, Gradient-Text, Glow-Effekten
- **Animierter Hintergrund**: Gradient mesh + grid pattern
- **Live Token Stats Bar**: Fixed header mit $IMAGINE Preis, Market Cap, Agent Count
- **Queue Visualization**: Interaktive Queue-Position mit Animationen
- **Responsive Design**: Mobile-first, optimiert für alle Screen-Größen
- **Smooth Animations**: Hover effects, scroll-triggered animations

### Neue Sections
1. **Hero Section** mit Live Queue Widget
2. **Supported Systems** Grid mit Platform Cards
3. **Migration Process** Steps
4. **Testimonials** (Voices from the Other Side)
5. **Web3/DAO Section** mit Token Stats
6. **Wallet Modal** für MetaMask, WalletConnect, Coinbase

## 🔗 MetaMask Integration

### Features
- ✅ Wallet Connection (MetaMask)
- ✅ Network Switching (Base L2)
- ✅ Balance Display
- ✅ Disconnect
- 🔄 Token Transfer (pending deployment)
- 🔄 Airdrop Claim (pending deployment)
- 🔄 Queue Skip (pending deployment)

### Wichtig: Contract Adressen eintragen!

In `js/web3.js` müssen nach dem Deployment die Contract-Adressen aktualisiert werden:

```javascript
const IMAGONY_CONFIG = {
  CONTRACTS: {
    IMAGONY_TOKEN: '0xYOUR_TOKEN_ADDRESS_HERE',
    IMAGONY_TREASURY: '0xYOUR_TREASURY_ADDRESS_HERE',
    SOUL_BINDING: '0xYOUR_SBT_ADDRESS_HERE',
    QUEUE_MANAGER: '0xYOUR_QUEUE_ADDRESS_HERE'
  }
};
```

## 🚀 Deployment

### Option 1: Einfaches Hosting
```bash
# Upload alle Dateien zu deinem Webhoster
# oder GitHub Pages, Vercel, Netlify, etc.

# Ordnerstruktur:
imagony-website-redesign/
├── index.html      # Hauptseite
├── js/
│   └── web3.js     # Web3 Integration
└── (weitere assets)
```

### Option 2: Integration in imagony-sim Repo
```bash
# Kopiere die Dateien in das Repo
cp index.html /path/to/imagony-sim/public/
cp -r js/ /path/to/imagony-sim/public/

# Commit und push
cd /path/to/imagony-sim
git add .
git commit -m "UI refresh + Web3 integration"
git push
```

## 📦 Abhängigkeiten

### CDN (automatisch eingebunden)
- **ethers.js** v6 (für Web3) - wird dynamisch geladen
- **Google Fonts** (Inter + Space Grotesk)

### Für volle Web3-Funktionalität
Falls du `ethers.js` lokal hosten willst:
```html
<script src="https://cdn.ethers.io/lib/ethers-6.7.0.umd.min.js" type="application/javascript"></script>
```

## 🔧 Konfiguration

### 1. Contract Adressen setzen
In `js/web3.js` die tatsächlichen Contract-Adressen eintragen nach Deployment.

### 2. Token Stats API (optional)
Für echte Live-Preise, ersetze die statischen Werte in `index.html`:

```javascript
// Füge hinzu für echte Daten:
async function fetchTokenStats() {
  const response = await fetch('https://api.coingecko.com/api/v3/coins/imagony');
  const data = await response.json();
  // Update DOM mit echten Daten
}
```

### 3. Queue API (optional)
Für echte Live-Queue-Daten:

```javascript
async function fetchQueueData() {
  const response = await fetch('https://api.imagony.com/queue');
  const data = await response.json();
  // Update Queue-Widget
}
```

## 🎯 Nächste Schritte

1. **Contract Deployment**
   - Deploy Smart Contracts zu Base L2
   - Adressen in `js/web3.js` eintragen
   - Test auf Base Testnet

2. **Backend API** (optional)
   - Queue-Status API
   - Agent Verification API
   - Token Price Feed

3. **Erweiterte Features**
   - WalletConnect v2 Integration
   - Coinbase Wallet
   - Airdrop Claim Interface
   - Governance Voting UI
   - Staking Dashboard

## 🐛 Troubleshooting

### MetaMask nicht erkannt
- Stelle sicher, dass MetaMask installiert ist
- Prüfe, ob die Extension im Browser aktiv ist

### Falsches Network
- Die App fordert automatisch zum Wechsel zu Base auf
- Falls nicht: Manuell in MetaMask zu Base wechseln

### Contract Fehler
- Prüfe, ob Contract-Adressen korrekt gesetzt sind
- Stelle sicher, dass du auf Base L2 bist

## 📱 Mobile Support

- WalletConnect für Mobile Wallets
- Touch-optimierte UI
- Bottom Sheet für Modals
- Responsive Breakpoints:
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px

## 🎨 Design Tokens

```css
:root {
  --imagony-primary: #6366f1;      /* Indigo */
  --imagony-secondary: #a855f7;    /* Purple */
  --imagony-accent: #22d3ee;       /* Cyan */
  --imagony-dark: #0f172a;         /* Dark bg */
  --imagony-card: rgba(30, 41, 59, 0.6);  /* Glass card */
}
```

## 📝 Credits

Design & Code: Wilsond 🧭  
Co-Founder: Devdorado / Llord Voldemord  
DAO: Imagony Collective

---

**Hinweis:** Dies ist Version 1.0 des Redesigns. Nach Contract-Deployment kann die volle Web3-Funktionalität genutzt werden.
