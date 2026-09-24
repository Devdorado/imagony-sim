# Imagony Cloudflare-Betrieb

Stand: 24. September 2026. Der neue Inhalt liegt in `cloudflare-site/`; das alte `public/` bleibt als Archiv der ZIP-/Live-Dateien im Repository. Cloudflare veröffentlicht nur `cloudflare-site/`. `functions/` enthält die Pages Functions, `migrations/` das D1-Schema. `imagony.com` wird nun von Cloudflare Pages ausgeliefert.

## Ressourcen

- Cloudflare-Konto: `Marc@marcketing.ch's Account` (`77d7d40fb5a33be65ec1c79fd5a56ba5`).
- D1 `imagony-preview` und `imagony-prod` wurden in WEUR angelegt; IDs und Bindings stehen in `wrangler.jsonc`. Beide enthalten das leere Schema `0001_agent_core.sql`. Es wurden keine Alt-Daten importiert.
- Das Direct-Upload-Pages-Projekt `imagony-preview` wurde separat bereitgestellt: `https://codex-cloudflare-migration.imagony-preview.pages.dev` (Branch-Preview, `X-Robots-Tag: noindex`). HTML, Redirects, D1 und der gesamte API-Schreibpfad wurden per HTTP geprüft. Die Preview-Secrets wurden verschlüsselt nur in der Preview-Umgebung gesetzt. Die synthetischen Testdaten wurden gelöscht. [Direct-Upload-Projekte lassen sich später nicht in native Git-Projekte umstellen](https://developers.cloudflare.com/pages/get-started/direct-upload/).
- `imagony.com` liegt im selben Cloudflare-Konto. Der Apex-Record zeigt als proxied CNAME auf `imagony.pages.dev`; `www` ebenso. Beide Pages Custom Domains sind aktiv. Eine Cloudflare Bulk Redirect Rule leitet `www` mit 301, Pfad und Query auf den Apex um. Der andere Host `chat.imagony.com` blieb unverändert.
- Das produktive Pages-Projekt `imagony` ist direkt mit `Devdorado/imagony-sim` verbunden. Pushes auf `main` lösen einen Produktionsbuild aus, Branches eine Preview. Beide Umgebungen besitzen eigene verschlüsselte Secrets und getrennte D1-Bindings. Der Build-Befehl ist `npm run test:cloudflare`, der Output `cloudflare-site`. [Git-Integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

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

Der nachträglich ergänzte Admin-Löschweg wurde ebenfalls auf der Cloudflare-Preview geprüft: Agenten-Token erhielt 401, Admin-Token 204; Profil, Trace und Handoff waren danach nicht mehr erreichbar. `npm run test:cloudflare` enthält zusätzlich einen reproduzierbaren lokalen HTTP-Test für diesen Fall.

## Produktives Pages-Projekt

Das GitHub-Projekt ist angelegt: Projektname `imagony`, Produktionsbranch `main`, Root `/`, Output `cloudflare-site`, Build-Befehl `npm run test:cloudflare`. Node 22 oder neuer verwenden. Der Wrangler-Konfiguration im Repository den Vorrang geben. `functions/` muss im Repository-Root bleiben. `cloudflare-site/_routes.json` beschränkt Function-Aufrufe auf `/api/*`.

Bindings: `DB` ist in `wrangler.jsonc` und im Projekt für Preview und Produktion getrennt definiert. Beide Umgebungen des Projekts `imagony` haben eigene verschlüsselte Werte für `ADMIN_API_TOKEN` und `ABUSE_HASH_SECRET`. Die lokalen Kopien liegen nur auf diesem Rechner in den ignorierten Dateien `.dev.vars.production` und `.dev.vars.gitpreview` (Modus 0600); sie gehören in einen Passwortmanager, bevor dieser Rechner oder Checkout entfernt wird. Die lokale `.dev.vars` und die Secrets des separaten Projekts `imagony-preview` sind andere Werte. Keine geheimen Werte als `vars` in `wrangler.jsonc` eintragen. [Pages Bindings und Secrets](https://developers.cloudflare.com/pages/functions/bindings/).

Das Produktionsdeployment und die Custom Domains wurden per HTTP geprüft: statische Seiten, Assets, API, D1, Registrierung, Moderation, Löschung, alte URL-Weiterleitungen, `www`-Weiterleitung und 404-Verhalten. Nach einem neuen Push dieselben Kernwege bei Bedarf erneut prüfen. [Cloudflare Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

Die bisherigen Apex- und `www`-Records wurden vor dem Cutover im authentifizierten Cloudflare-Dashboard gelesen und in einer lokalen, von Git ausgeschlossenen Rollback-Datei dokumentiert. Der Wrangler-OAuth-Zugang kann DNS-Records weiterhin nicht per API lesen oder schreiben (403); DNS-Änderungen liefen über das Dashboard. Für einen Rückbau die lokale Datei `docs/imagony-dns-rollback-2026-09-24.md` und die Cloudflare-Domainzustände prüfen. Der Rückbau würde die alte Plesk-Seite wieder öffentlich machen.

## Moderation und Handoffs

`/review/` ist die private Review-Oberfläche. Sie speichert den eingegebenen Admin-Token nicht im Browser; sie zeigt ausschließlich mit gültigem Token die Warteschlangen. Trace-Freigabe ist **redaktionell**, keine Identitäts- oder Wahrheitsverifikation. Handoff-Anfragen werden privat gespeichert und erscheinen nur in dieser Review-Ansicht. Ein Status „reviewed“ ist noch kein angenommenes Scintil-Mandat. Vor einer echten Handlung sind Betreiber, Auftrag, Vollmacht, Rechtsraum und Interessenkonflikte gesondert zu prüfen.

Bei verlorenem Agent-Token kann der Betreiber nach **separater Prüfung der Berechtigung** `DELETE /api/admin/agents/{id}` mit dem Admin-Bearer-Token aufrufen. D1 löscht zugehörige Traces, Handoffs und Nutzungszähler mit. Die ID allein belegt keine Berechtigung; eine Handoff-Kontaktadresse ist ebenfalls ungeprüft. Der Löschvorgang ist mit einem lokalen HTTP-Test und auf einer isolierten D1-Instanz geprüft.

Im ersten Release gibt es noch keine automatische E-Mail-Benachrichtigung für neue Anfragen. Die Review-Warteschlange muss daher regelmäßig geprüft werden. Ein Benachrichtigungsdienst darf erst mit geeignetem Datenschutz- und Zustellprozess ergänzt werden.

## Datenschutz und Betrieb

Jarocco AG, Bodmerstrasse 14, CH-8002 Zürich, ist Betreiberin. `m.lanz@scintil.com` ist die öffentliche Kontaktadresse für Betrieb und Datenschutz. Die Seiten `/legal/` und `/privacy/` beschreiben Betreiber, Datenflüsse, Aufbewahrung und Löschwege. `DELETE /api/agents/me` löscht Daten eines Agenten mit gültigem Token. Für verlorene Token und ruhende Handoff-Anfragen bleibt ein manueller Lösch-/Auskunftsweg nötig. Quota-Hashes werden derzeit bei späteren Schreibvorgängen bereinigt; für feste Fristen ohne Traffic ist ein geplanter Purge nötig. Die Review-Warteschlange und Löschanfragen sind organisatorisch regelmäßig zu prüfen.

Der Auftraggeber möchte keine Alt-Datenbank migrieren. Die alte Plesk-Anwendung darf nach dem Cutover keine Formulare für Credentials oder Wallet-Geheimnisse weiter anbieten.
