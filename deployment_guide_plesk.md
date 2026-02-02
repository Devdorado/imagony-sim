# Imagony Matrix Deployment auf Plesk

## 1. Vorbereitung in Plesk
- Gehe zu "Domain" > `imagony.com` > "Node.js" hinzufügen
- Wähle Node.js Version 18 oder höher
- App-Root: `httpdocs` (Standard)
- Startdatei: `server.js`
- Umgebung: `production`

## 2. Dateien hochladen (via Plesk File Manager oder FTP)
Struktur in `httpdocs`:
httpdocs/
├── server.js # (oben)
├── package.json # (oben)
├── data/ # Verzeichnis erstellen
├── public/
│ ├── index.html # (oben)
│ ├── css/
│ │ └── styles.css # (oben)
│ ├── js/
│ │ └── avatar-core.js # WIRD VON AI GENERIERT
│ └── images/ # (optional)
└── dashboard/ # Verzeichnis erstellen (leer)

## 3. Installation & Start in Plesk
1. In der Node.js-App-Verwaltung auf "NPM install" klicken
2. Auf "Start Application" klicken
3. Prüfe "http://imagony.com" – sollte die Matrix-Seite laden

## 4. Wichtige Sicherheitseinstellungen
1. **Passwort ändern**: In `server.js` Zeile 42: `imagony_secret` durch ein starkes Passwort ersetzen
2. **Admin-URL**: Nur du kennst `http://imagony.com/admin`
3. **Datenbank**: Wird automatisch in `data/loom_logs.db` erstellt

## 5. Erste Tests
1. Besuche `imagony.com` als normaler User → siehe Simulationsseite
2. Melde dich an unter `imagony.com/admin` → siehe Agenten-Logs
3. Konfiguriere deine AI-Agents, um `imagony.com` zu besuchen
🎯 Wie du vorgehst
VS Code öffnen und neuen Ordner imagony-matrix erstellen

Den oben stehenden Prompt kopieren und in deine VS Code AI (Cursor/Copilot) einfügen

Die generierten Dateien in die oben gezeigte Struktur speichern
