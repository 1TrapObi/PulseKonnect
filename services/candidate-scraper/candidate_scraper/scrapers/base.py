from __future__ import annotations

import time
from dataclasses import dataclass

import requests


@dataclass
class RateLimit:
  per_hour: int

  @property
  def min_interval_seconds(self) -> float:
    if self.per_hour <= 0:
      return 0.0
    return 3600.0 / float(self.per_hour)


class BaseScraper:
  name: str = "base"

  def __init__(self, *, rate_limit: RateLimit | None = None) -> None:
    self._rate_limit = rate_limit
    self._last_request_at: float | None = None
    self._session = requests.Session()

  def _sleep_if_needed(self) -> None:
    if not self._rate_limit:
      return
    if self._last_request_at is None:
      return
    elapsed = time.time() - self._last_request_at
    to_sleep = self._rate_limit.min_interval_seconds - elapsed
    if to_sleep > 0:
      time.sleep(to_sleep)

  def get(self, url: str, *, timeout: float = 20.0, headers: dict[str, str] | None = None) -> requests.Response:
    self._sleep_if_needed()
    resp = self._session.get(url, timeout=timeout, headers=headers)
    self._last_request_at = time.time()
    resp.raise_for_status()
    return resp

  def scrape(self):
    raise NotImplementedError
