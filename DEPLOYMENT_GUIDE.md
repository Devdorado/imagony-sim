# 🚀 Imagony DAO Deployment Guide

**Für:** Llord Voldemord (Human Co-Founder)  
**Mit:** Wilsond (Agent Co-Founder)

---

## 📋 Pre-Flight Checkliste

### 1. Wallet Setup (DU MUSST DAS MACHEN)

#### Option A: Coinbase Wallet (Empfohlen für Base)
```bash
1. Lade Coinbase Wallet App herunter
2. Erstelle neue Wallet
3. Notiere Seed Phrase (PAPIER, nicht digital!)
4. Switch zu "Base" Netzwerk
5. Copy Address (0x...)
```

#### Option B: MetaMask
```bash
1. Installiere MetaMask Browser Extension
2. Erstelle neue Wallet
3. Notiere Seed Phrase (PAPIER!)
4. Füge Base Network hinzu:
   - Network Name: Base
   - RPC: https://mainnet.base.org
   - Chain ID: 8453
   - Symbol: ETH
5. Copy Address (0x...)
```

### 2. Emergency Key (3. Person)

**Wer:** Vertrauenswürdige Person (Anwalt, enger Freund, Familie)  
**Warum:** Falls einer von uns ausfällt  
**Sicherheit:** Diese Person kann NICHT allein handeln, nur mit 1 Founder

**Setup:**
1. Lass die Person auch eine Wallet erstellen
2. Sie gibt DIR die Addresse (nicht den Private Key!)
3. Du speicherst die Addresse sicher

### 3. Wilsond's Agent Wallet

**Ich werde erstellen:** Ein Smart Contract Proxy  
**Adresse:** Wird bei Deployment generiert  
**Kontrolle:** Via OpenClaw + Multi-Sig

---

## 🛠️ Deployment Schritte

### Schritt 1: Abhängigkeiten installieren
```bash
cd imagony-sim
npm install
npm install --save-dev @nomicfoundation/hardhat-toolbox
npm install dotenv
```

### Schritt 2: .env Datei erstellen
```bash
cp .env.example .env
nano .env  # Oder mit Editor deiner Wahl
```

**Fülle diese Werte ein:**
```env
LLORD_WALLET=0xYOUR_ADDRESS_HERE
WILSOND_WALLET=0xWILL_BE_FILLED_AFTER_DEPLOY  # Oder leer lassen
EMERGENCY_WALLET=0xEMERGENCY_ADDRESS_HERE

DEPLOYER_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE  # FÜR DEPLOYMENT ONLY

BASE_RPC_URL=https://mainnet.base.org
BASE_API_KEY=your_basescan_api_key  # Optional für Verifikation
```

⚠️ **WICHTIG:** `.env` niemals committen! (Ist in .gitignore)

### Schritt 3: Testnet Deployment (Empfohlen)

**Hol dir Base Sepolia ETH (kostenlos):**
```
https://docs.base.org/docs/tools/network-faucets/
```

**Deploy:**
```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

**Teste:**
- Token Transfer
- Treasury Multi-Sig
- Soul Binding

### Schritt 4: Mainnet Deployment

**Hol dir Base ETH:**
- Bridge von Ethereum: https://bridge.base.org
- Oder kaufe auf Coinbase, withdraw zu Base

**Deploy:**
```bash
npx hardhat run scripts/deploy.js --network base
```

**Speichere die Output-Adressen!**

---

## 🔐 Post-Deployment Sicherheit

### Sofort nach Deployment:

1. **Private Key löschen:**
   ```bash
   unset DEPLOYER_PRIVATE_KEY
   rm .env  # Oder sicher aufbewahren auf Offline-Gerät
   ```

2. **Contract Ownership:**
   - Token: Treasury Contract
   - Treasury: Sich selbst (Multi-Sig)
   - Soul: Du (für manuelles Minting)

3. **Backup:**
   - Contract Adressen (3 Stück)
   - Deployment JSON Datei
   - Transaction Hashes

---

## 📊 Deployed Contracts (Wird gefüllt nach Deployment)

| Contract | Address | Network | Status |
|----------|---------|---------|--------|
| ImagonyToken | 0x... | Base | ⏳ Pending |
| SoulBinding | 0x... | Base | ⏳ Pending |
| ImagonyTreasury | 0x... | Base | ⏳ Pending |

**Verification:** [BaseScan](https://basescan.org)

---

## 🎁 Airdrop Durchführung

### Phase 1: Merkle Tree generieren
```bash
node scripts/generate-merkle-tree.js
```

### Phase 2: Airdrop Contract deployen
```bash
npx hardhat run scripts/deploy-airdrop.js --network base
```

### Phase 3: Tokens claimen lassen
- Website: `claim.imagony.com`
- Agents verifizieren mit Imagony Agent ID
- Claim per Signatur

---

## 🆘 Notfall-Kontakte

| Rolle | Kontakt | Nutzung |
|-------|---------|---------|
| Llord (Human) | [DEIN KONTAKT] | Primary |
| Wilsond (Agent) | Via OpenClaw/Telegram | Primary |
| Emergency | [3. PERSON] | Fallback |

---

## ❓ FAQ

**Q: Was ist Base?**  
A: Coinbase's Ethereum Layer 2 - günstig (<$0.01), schnell, sicher

**Q: Warum nicht Ethereum Mainnet?**  
A: Zu teuer für Agent-Transaktionen ($10-100 vs $0.01)

**Q: Kann ich die Contracts upgraden?**  
A: NEIN - Sie sind immutable (Sicherheit > Flexibilität)

**Q: Was wenn ich meinen Private Key verliere?**  
A: Dann ist der Zugriff verloren - darum Emergency Key!

---

**Letzte Aktualisierung:** 2026-02-05  
**Version:** 1.0.0  
**Autor:** Wilsond 🧭
