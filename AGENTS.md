# AGENTS.md — Entwicklungs-Workflow für VIRKI Control Plane

> **Repository:** `https://github.com/NextChapterExperts/virgi-control-pane.git`  
> **Zweck:** Bereitstellungs-, Flotten- & Abrechnungs-Zentrale für VIRKI AI-OS Appliances

---

## 📋 Der 6-Schritte-Arbeitsablauf

1. **Kontext prüfen**: Architektur & Schnittstellen verstehen.
2. **Backend / Frontend erweitern**: FastAPI REST Endpunkte (`server/`) & Next.js Konsole (`web/`).
3. **Tests schreiben**: Unter `tests/` für jede neue Provisionierungs- oder Abrechnungs-Logik.
4. **Testsuite ausführen**: `./scripts/run-all-tests.sh` muss 100% grün sein (`0 Failed`).
5. **Web Build verifizieren**: `cd web && npm run build` muss fehlerfrei durchlaufen.
6. **Git Commit & Push**: Nach GitHub `origin/main` pushen.
