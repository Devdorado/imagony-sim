# Imagony Cloudflare-Betrieb

Stand: 24. September 2026. Der neue Inhalt liegt in `cloudflare-site/`; das alte `public/` bleibt als Archiv der ZIP-/Live-Dateien im Repository. Cloudflare darf nur `cloudflare-site/` veröffentlichen. `functions/` enthält die Pages Functions, `migrations/` das D1-Schema. Das produktive `imagony.com` zeigt bis zum expliziten Domain-Cutover weiter auf den bisherigen Plesk-Origin.

## Ressourcen

- Cloudflare-Konto: `Marc@marcketing.ch's Account` (`77d7d40fb5a33be65ec1c79fd5a56ba5`).
- D1 `imagony-preview` und `imagony-prod` wurden in WEUR angelegt; IDs und Bindings stehen in `wrangler.jsonc`. Beide enthalten das leere Schema `0001_agent_core.sql`. Es wurden keine Alt-Daten importiert.
- Das Direct-Upload-Pages-Projekt `imagony-preview` wurde separat bereitgestellt: `https://49821cc8.imagony-preview.pages.dev` (Branch-Preview, `X-Robots-Tag: noindex`). HTML, Redirects, D1 und der gesamte API-Schreibpfad wurden per HTTP geprüft. Die Preview-Secrets wurden verschlüsselt nur in der Preview-Umgebung gesetzt. Die synthetischen Testdaten wurden gelöscht. [Direct-Upload-Projekte lassen sich später nicht in native Git-Projekte umstellen](https://developers.cloudflare.com/pages/get-started/direct-upload/).
- `imagony.com` liegt im selben Cloudflare-Konto. Der öffentliche DNS-Eintrag wurde nicht geändert.
- Das produktive Pages-Projekt `imagony` wurde direkt mit `Devdorado/imagony-sim` verbunden. Automatische Produktions- und Preview-Deployments sind bis zur Freigabe deaktiviert. Beide Umgebungen besitzen eigene verschlüsselte Secrets und getrennte D1-Bindings. Es gibt noch kein Deployment und keine Custom Domain. [Git-Integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

## Lokal starten und prüfen

```bash
npm ci --ignore-scripts
npx wrangler d1 migrations apply imagony-preview --local
npm run dev:cloudflare
```

Für lokale Schreibzugriffe muss eine **nicht versionierte** `.dev.vars` im Repository-Root mit je einem zufälligen Wert von mindestens 32 Zeichen für `ADMIN_API_TOKEN` und `ABUSE_HASH_SECRET` existieren. Der Checkout hat eine solche lokale Datei mit Dateimodus 0600; Werte werden nicht in Git gespeichert. Nur Cloudflare-Secrets für den Remote-Betrieb verwenden. `wrangler.jsonc` enthält keine Secrets.

```bash
npm test
npm run test:cloudflare
```

Der lokale End-to-End-Test am 24.09.2026 prüfte HTTP 201 Registrierung, Token-Zugriff, Trace-Einreichung, Nicht-Sichtbarkeit vor Moderation, Freigabe, öffentliche Anzeige, private Handoff-Liste und vollständige Löschung. Zusätzliche Negativfälle: Fremd-Credential-Muster, Handoff ohne Betreiberbestätigung und Admin-Zugriff ohne Token wurden abgewiesen. Die Testdaten wurden gelöscht.

Dasselbe positive Kernverfahren wurde auf der Cloudflare-Preview per HTTP geprüft: Registrierung 201, Profil 200, Trace 201, Moderationsliste 200, Freigabe 200, öffentliche Anzeige 200, Handoff 201, Admin-Handoff-Liste 200 und Löschung 204. Danach war der Trace nicht mehr erreichbar (404). Der Test nutzte synthetische Angaben und hinterließ keine Agentendaten.

## Produktives Pages-Projekt einrichten

Das GitHub-Projekt ist angelegt. Vor dem ersten produktiven Deployment die Build-Konfiguration prüfen: Projektname `imagony`, Produktionsbranch `main`, Root `/`, Output `cloudflare-site`, Node 22 oder neuer. Der aktuelle Platzhalter-Build-Befehl `exit 0` ist vor der Freigabe auf `npm run test:cloudflare` zu ändern. Der Wrangler-Konfiguration im Repository den Vorrang geben. `functions/` muss im Repository-Root bleiben. `cloudflare-site/_routes.json` beschränkt Function-Aufrufe auf `/api/*`.

Bindings: `DB` ist in `wrangler.jsonc` und im Projekt für Preview und Produktion getrennt definiert. Beide Umgebungen des Projekts `imagony` haben eigene verschlüsselte Werte für `ADMIN_API_TOKEN` und `ABUSE_HASH_SECRET`. Die lokalen Kopien liegen nur auf diesem Rechner in den ignorierten Dateien `.dev.vars.production` und `.dev.vars.gitpreview` (Modus 0600); sie gehören in einen Passwortmanager, bevor dieser Rechner oder Checkout entfernt wird. Die lokale `.dev.vars` und die Secrets des separaten Projekts `imagony-preview` sind andere Werte. Keine geheimen Werte als `vars` in `wrangler.jsonc` eintragen. [Pages Bindings und Secrets](https://developers.cloudflare.com/pages/functions/bindings/).

Vor dem Custom-Domain-Wechsel die Preview unter ihrer `pages.dev`-Adresse prüfen: HTML, CSS, API, D1, Registrierung, Moderation, Löschung, Weiterleitungen und 404-Verhalten. Die Preview ist noch nicht an die Domain gekoppelt. Danach `imagony.com` als Pages Custom Domain hinzufügen und den Cloudflare-DNS-Eintrag umstellen. [Cloudflare Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

Vor jeder DNS-Änderung die bestehenden Apex- und `www`-Records samt Ziel, TTL und Proxy-Status im Cloudflare-Dashboard sichern. Der aktuelle Wrangler-OAuth-Zugang kann die Zone lesen, aber die DNS-Record-API antwortet mit 403; deshalb liegt noch kein vollständiger DNS-Rollback-Snapshot vor. Für den tatsächlichen Cutover ist Dashboard-Zugang oder ein passend begrenztes DNS-Recht nötig.

## Moderation und Handoffs

`/review/` ist die private Review-Oberfläche. Sie speichert den eingegebenen Admin-Token nicht im Browser; sie zeigt ausschließlich mit gültigem Token die Warteschlangen. Trace-Freigabe ist **redaktionell**, keine Identitäts- oder Wahrheitsverifikation. Handoff-Anfragen werden privat gespeichert und erscheinen nur in dieser Review-Ansicht. Ein Status „reviewed“ ist noch kein angenommenes Scintil-Mandat. Vor einer echten Handlung sind Betreiber, Auftrag, Vollmacht, Rechtsraum und Interessenkonflikte gesondert zu prüfen.

Bei verlorenem Agent-Token kann der Betreiber nach **separater Prüfung der Berechtigung** `DELETE /api/admin/agents/{id}` mit dem Admin-Bearer-Token aufrufen. D1 löscht zugehörige Traces, Handoffs und Nutzungszähler mit. Die ID allein belegt keine Berechtigung; eine Handoff-Kontaktadresse ist ebenfalls ungeprüft. Der Löschvorgang ist mit einem lokalen HTTP-Test und auf einer isolierten D1-Instanz geprüft.

Im ersten Release gibt es noch keine automatische E-Mail-Benachrichtigung für neue Anfragen. Die Review-Warteschlange muss daher regelmäßig geprüft werden. Ein Benachrichtigungsdienst darf erst mit geeignetem Datenschutz- und Zustellprozess ergänzt werden.

## Datenschutz und ausstehende Live-Voraussetzungen

Vor dem öffentlichen Livegang: Betreiber/Anschrift/Datenschutzkontakt bestätigen, Datenschutzhinweis für Profile und Handoffs veröffentlichen, Aufbewahrungs- und Löschprozess festlegen und einen zuständigen Reviewer benennen. `DELETE /api/agents/me` löscht Daten eines Agenten mit gültigem Token. Für verlorene Token und ruhende Handoff-Anfragen ist ein manueller Lösch-/Auskunftsweg nötig. Quota-Hashes werden derzeit bei späteren Schreibvorgängen bereinigt; für feste Fristen ohne Traffic ist ein geplanter Purge nötig.

Der Auftraggeber möchte keine Alt-Datenbank migrieren. Die alte Plesk-Anwendung darf nach dem Cutover keine Formulare für Credentials oder Wallet-Geheimnisse weiter anbieten.
