from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from .tasks import run_lead_discovery_for_sources


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
  length_raw = handler.headers.get("content-length")
  if not length_raw:
    return {}
  try:
    length = int(length_raw)
  except Exception:
    return {}
  if length <= 0:
    return {}
  raw = handler.rfile.read(length)
  try:
    return json.loads(raw.decode("utf-8"))
  except Exception:
    return {}


class TriggerHandler(BaseHTTPRequestHandler):
  def _send_json(self, code: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    self.send_response(code)
    self.send_header("content-type", "application/json")
    self.send_header("content-length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)

  def do_GET(self) -> None:  # noqa: N802
    if self.path.rstrip("/") == "/healthz":
      self._send_json(200, {"ok": True})
      return

    self._send_json(404, {"ok": False, "error": "Not found"})

  def do_POST(self) -> None:  # noqa: N802
    token = (os.getenv("LEAD_SCRAPER_TRIGGER_TOKEN") or "").strip()
    if token:
      provided = (self.headers.get("x-trigger-token") or "").strip()
      if not provided or provided != token:
        self._send_json(401, {"ok": False, "error": "Unauthorized"})
        return

    if self.path.rstrip("/") != "/trigger":
      self._send_json(404, {"ok": False, "error": "Not found"})
      return

    body = _read_json(self)
    org_id = str(body.get("organizationId") or "").strip()
    source_ids_raw = body.get("sourceIds")
    if not isinstance(source_ids_raw, list):
      source_ids_raw = []
    source_ids = [str(x).strip() for x in source_ids_raw if str(x).strip()]

    if not org_id:
      self._send_json(400, {"ok": False, "error": "organizationId is required"})
      return

    if not source_ids:
      self._send_json(400, {"ok": False, "error": "sourceIds is required"})
      return

    try:
      async_result = run_lead_discovery_for_sources.delay(source_ids, org_id)
      self._send_json(202, {"ok": True, "taskId": async_result.id})
      return
    except Exception as e:
      self._send_json(500, {"ok": False, "error": str(e)})
      return


def main() -> None:
  host = (os.getenv("HOST") or "0.0.0.0").strip() or "0.0.0.0"
  port_raw = (os.getenv("PORT") or "8080").strip() or "8080"
  port = int(port_raw)

  server = HTTPServer((host, port), TriggerHandler)
  server.serve_forever()


if __name__ == "__main__":
  main()
