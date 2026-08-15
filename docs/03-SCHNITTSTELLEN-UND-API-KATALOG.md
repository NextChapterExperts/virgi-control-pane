# docs/03-SCHNITTSTELLEN-UND-API-KATALOG.md — REST-API Spezifikation

> **Base URL:** `http://localhost:8080` (bzw. konfigurierte Backend-URL)  
> **OpenAPI / Swagger UI:** `http://localhost:8080/docs`

---

## 📡 1. Endpunkte-Katalog

### 1.1 Health & Systemstatus
- **`GET /health`**
  - **Beschreibung:** Liefert den Betriebszustand des Control-Plane Backends.
  - **Response (200):**
    ```json
    { "status": "ok", "service": "virki-control-plane" }
    ```

---

### 1.2 Instanzen & Flottenmanagement
- **`GET /v1/instances`**
  - **Beschreibung:** Gibt die Liste aller registrierten Instanzen zurück (sortiert nach Erstellungszeitpunkt absteigend).
  - **Response (200):**
    ```json
    {
      "status": "ok",
      "count": 2,
      "instances": [
        {
          "id": "inst_schulze_8f1b2c",
          "tenant_id": "schulze",
          "name": "VIRKI Docker Appliance (Schulze Bedachungen)",
          "type": "docker_stack",
          "status": "running",
          "endpoint_url": "http://localhost:8204",
          "backend_url": "http://localhost:8205",
          "created_at": 1786820818.93
        }
      ]
    }
    ```

- **`POST /v1/instances/provision`**
  - **Beschreibung:** Startet die asynchrone Bereitstellung einer neuen Instanz (Docker-Stack oder GCP-VM).
  - **Request Body (JSON):**
    ```json
    {
      "tenant_id": "schulze",
      "company_name": "Schulze Bedachungen GmbH",
      "admin_email": "admin@schulze.lan",
      "type": "docker_stack", // "docker_stack" | "gcp_vm"
      "zone": "europe-west3-a", // Pflicht bei gcp_vm
      "machine_type": "e2-standard-4", // Optional bei gcp_vm
      "web_port": 8190, // Optional bei docker_stack
      "api_port": 8191
    }
    ```
  - **Response (200):**
    ```json
    {
      "status": "ok",
      "message": "Docker Stack Bereitstellung gestartet",
      "instance": { "id": "inst_schulze_8f1b2c", "status": "provisioning" }
    }
    ```

- **`GET /v1/instances/{instance_id}`**
  - **Beschreibung:** Gibt die Details einer einzelnen Instanz zurück.
  - **Response (200):** Instanz-Objekt oder 404 wenn nicht gefunden.

- **`DELETE /v1/instances/{instance_id}`**
  - **Beschreibung:** Stoppt und löscht die Instanz sowie alle zugehörigen Logs. Bei GCP-VMs wird die VM auf Wunsch via GCP API entfernt.

---

### 1.3 Live-Logs
- **`GET /v1/instances/{instance_id}/logs`**
  - **Beschreibung:** Liefert die erfassten Logs der Instanz als JSON-Array.
  - **Query-Parameter:** `limit` (Standard: 200)

- **`GET /v1/instances/{instance_id}/logs/stream`**
  - **Beschreibung:** Live-Log Streaming über Server-Sent Events (SSE) für das Web-Terminal.

---

### 1.4 Auto-Installer Generator
- **`GET /v1/install/{tenant_id}.sh`**
  - **Beschreibung:** Generiert ein dynamisches Bash-Installationsskript für On-Premise / Remote Linux-Server.
  - **Query-Parameter:** `company`, `web_port`, `api_port`
  - **Content-Type:** `text/plain`
