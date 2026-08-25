# AGENTS.md — Verbindlicher Entwicklungs- & Multi-Repo-Workflow

> **Repository:** `https://github.com/NextChapterExperts/virgi-control-pane.git`  
> **Zweck:** Bereitstellungs-, Flotten- & Abrechnungs-Zentrale für VIRKI AI-OS Appliances  
> **Branch:** `dev` (Verbindlicher Standard-Branch)

---

## 📋 Der 6-Schritte Multi-Repo Arbeitsablauf

1. **ROADMAP LESEN (Multi-Repo):**  
   Vor Beginn immer [1000-VIRKI-Umbrella/ROADMAP.md](../1000-VIRKI-Umbrella/ROADMAP.md) und [ROADMAP.md](ROADMAP.md) lesen.
2. **ROADMAP ABGLEICHEN:**  
   Geplante Änderungen vorab in beiden Roadmaps eintragen und spezifizieren.
3. **CODE-ÄNDERUNG UMSETZEN:**  
   FastAPI Backend (`server/`) und Next.js Konsole (`web/`) sauber implementieren.
4. **TESTFÄLLE ERSTELLEN:**  
   Für jede neue Provisionierungs-Logik automatisierte Tests in `tests/` ablegen.
5. **TESTSUITE AUSFÜHREN:**  
   `./scripts/run-all-tests.sh` muss 100% grün sein (`0 Failed`).
6. **ROADMAP & DOKU SYNCHRONISIEREN & GIT CHECK-IN (dev Branch):**  
   Roadmap abhaken, Umbrella aktualisieren und auf Branch `dev` committen & pushen:
   ```bash
   git checkout dev
   git add .
   git commit -m "..."
   git push origin dev
   ```
